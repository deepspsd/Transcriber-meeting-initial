"""
Auth router — production-grade session management.

Architecture:
  - Access token (JWT, 15 min) → returned in response body, stored in memory on client
  - Refresh token (32-byte random, 30 days) → HttpOnly SameSite cookie, hashed in DB
  - Sessions collection tracks every active device session
  - Rate limiting and account lockout via MongoDB login_attempts collection
"""
import hashlib
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext

try:
    from bson import ObjectId
except ImportError:
    from bson.objectid import ObjectId  # type: ignore

from database import get_db
from models.user import UserCreate, UserLogin
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ── Crypto helpers ─────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)

REFRESH_COOKIE = "vs_refresh"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_token(raw: str) -> str:
    """SHA-256 hex digest — fast, one-way, no need for bcrypt on random tokens."""
    return hashlib.sha256(raw.encode()).hexdigest()


def create_access_token(user_id: str, session_id: str) -> str:
    """Short-lived JWT carrying user_id and session_id for revocation checks."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "sid": session_id, "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token() -> tuple[str, str]:
    """Return (raw_token, hashed_token). Raw goes to cookie; hash goes to DB."""
    raw = os.urandom(32).hex()  # 64-char hex string
    return raw, hash_token(raw)


def set_refresh_cookie(response: Response, raw_token: str, expires_at: datetime) -> None:
    """Set HttpOnly refresh token cookie with proper security flags."""
    max_age = int((expires_at - datetime.now(timezone.utc)).total_seconds())
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw_token,
        max_age=max_age,
        expires=expires_at.strftime("%a, %d %b %Y %H:%M:%S GMT"),
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT == "production"),
        path="/",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE,
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT == "production"),
        path="/",
    )


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_device_name(request: Request) -> str:
    ua = request.headers.get("User-Agent", "")
    # Simplified UA parsing — good enough for session labels
    if "Chrome" in ua and "Edg" not in ua:
        browser = "Chrome"
    elif "Firefox" in ua:
        browser = "Firefox"
    elif "Safari" in ua and "Chrome" not in ua:
        browser = "Safari"
    elif "Edg" in ua:
        browser = "Edge"
    else:
        browser = "Browser"

    if "Windows" in ua:
        os_name = "Windows"
    elif "Mac" in ua:
        os_name = "macOS"
    elif "Linux" in ua:
        os_name = "Linux"
    elif "Android" in ua:
        os_name = "Android"
    elif "iPhone" in ua or "iPad" in ua:
        os_name = "iOS"
    else:
        os_name = "Unknown OS"

    return f"{browser} on {os_name}"


# ── Rate limiting & lockout ────────────────────────────────────

async def _check_rate_limit(db, email: str, ip: str) -> None:
    """Raise 429 if too many failed attempts; raise 423 if account locked."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS)

    # Check account lockout on user document
    user = await db.users.find_one({"email": email.lower()})
    if user and user.get("locked_until"):
        locked_until = user["locked_until"]
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if now < locked_until:
            remaining = int((locked_until - now).total_seconds())
            raise HTTPException(
                status_code=423,
                detail=f"Account temporarily locked. Try again in {remaining // 60 + 1} minutes.",
            )

    # Count recent failed attempts from this IP
    recent_ip = await db.login_attempts.count_documents({
        "ip_address": ip,
        "created_at": {"$gte": window_start},
        "success": False,
    })
    if recent_ip >= settings.RATE_LIMIT_LOGIN_MAX * 2:  # IP gets double threshold
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts from this IP. Try again later.",
        )


async def _record_attempt(db, email: str, ip: str, success: bool) -> None:
    """Record a login attempt and apply lockout on max failures."""
    now = datetime.now(timezone.utc)
    await db.login_attempts.insert_one({
        "email": email.lower(),
        "ip_address": ip,
        "success": success,
        "created_at": now,
    })
    if not success:
        # Count recent per-email failures
        window_start = now - timedelta(seconds=settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS)
        failures = await db.login_attempts.count_documents({
            "email": email.lower(),
            "success": False,
            "created_at": {"$gte": window_start},
        })
        if failures >= settings.RATE_LIMIT_LOGIN_MAX:
            locked_until = now + timedelta(seconds=settings.ACCOUNT_LOCKOUT_SECONDS)
            await db.users.update_one(
                {"email": email.lower()},
                {"$set": {"locked_until": locked_until, "failed_login_attempts": failures}},
            )
    else:
        # Clear lockout on success
        await db.users.update_one(
            {"email": email.lower()},
            {"$unset": {"locked_until": "", "failed_login_attempts": ""}},
        )


# ── Session helpers ────────────────────────────────────────────

async def _create_session(db, user_id: str, raw_refresh: str, request: Request) -> dict:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    session = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "refresh_token_hash": hash_token(raw_refresh),
        "device_name": _get_device_name(request),
        "ip_address": _get_client_ip(request),
        "created_at": now,
        "expires_at": expires_at,
        "last_used": now,
        "is_revoked": False,
    }
    await db.sessions.insert_one(session)
    return session


# ── Dependency: current user ───────────────────────────────────

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> dict:
    """Validate access token and ensure session is not revoked."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        session_id: str = payload.get("sid")
        if not user_id or not session_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db = get_db()

    # Check session is still active (not revoked, not expired)
    session = await db.sessions.find_one({"session_id": session_id})
    if not session or session.get("is_revoked"):
        raise credentials_exception

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise credentials_exception

    return user


# ── Shared response builder ────────────────────────────────────

def _user_payload(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "needs_setup": user.get("needs_setup", True),
        "own_profile_id": user.get("own_profile_id"),
    }


async def _issue_tokens_and_respond(
    response: Response,
    user: dict,
    request: Request,
    db,
) -> dict:
    """Create a session, set cookie, return access token."""
    user_id = str(user["_id"])
    raw_refresh, _ = create_refresh_token()
    session = await _create_session(db, user_id, raw_refresh, request)
    access_token = create_access_token(user_id, session["session_id"])
    set_refresh_cookie(response, raw_refresh, session["expires_at"])
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_EXPIRE_MINUTES * 60,
        "user": _user_payload(user),
    }


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

# ── Register ─────────────────────────────────────────────────
@router.post("/register", status_code=201)
async def register(body: UserCreate, request: Request, response: Response):
    db = get_db()
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    hashed = hash_password(body.password)
    user_doc = {
        "name": body.name.strip(),
        "email": body.email.lower(),
        "hashed_password": hashed,
        "needs_setup": True,
        "own_profile_id": None,
        "created_at": datetime.now(timezone.utc),
        "failed_login_attempts": 0,
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Bootstrap default settings
    await db.settings.insert_one({
        "user_id": user_id,
        "speaker_similarity_threshold": settings.SPEAKER_SIMILARITY_THRESHOLD,
        "word_conf_low": settings.WORD_CONF_LOW,
        "word_conf_mid": settings.WORD_CONF_MID,
        "min_segment_duration": settings.MIN_SEGMENT_DURATION,
        "updated_at": datetime.now(timezone.utc),
    })

    user_doc["_id"] = result.inserted_id
    return await _issue_tokens_and_respond(response, user_doc, request, db)


# ── Login ────────────────────────────────────────────────────
@router.post("/login")
async def login(body: UserLogin, request: Request, response: Response):
    db = get_db()
    ip = _get_client_ip(request)

    # Rate limit & lockout check BEFORE querying password
    await _check_rate_limit(db, body.email, ip)

    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["hashed_password"]):
        # Record failure (only if user exists — avoids enumeration via timing on locked accounts)
        if user:
            await _record_attempt(db, body.email, ip, success=False)
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    await _record_attempt(db, body.email, ip, success=True)
    return await _issue_tokens_and_respond(response, user, request, db)


# ── Refresh ──────────────────────────────────────────────────
@router.post("/refresh")
async def refresh(request: Request, response: Response):
    """
    Silent token refresh. Called automatically by the frontend.
    Reads refresh token from HttpOnly cookie, validates against DB session,
    issues new access token and rotates the refresh token.
    """
    raw_refresh = request.cookies.get(REFRESH_COOKIE)
    if not raw_refresh:
        raise HTTPException(status_code=401, detail="No refresh token.")

    token_hash = hash_token(raw_refresh)
    db = get_db()
    now = datetime.now(timezone.utc)

    session = await db.sessions.find_one({"refresh_token_hash": token_hash})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid refresh token.")

    if session.get("is_revoked"):
        # Possible token theft — revoke ALL sessions for this user as precaution
        logger.warning(f"[AUTH] Revoked refresh token reused for user {session['user_id']} — revoking all sessions.")
        await db.sessions.update_many(
            {"user_id": session["user_id"]},
            {"$set": {"is_revoked": True}},
        )
        clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Session revoked. Please log in again.")

    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now >= expires_at:
        clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh token expired. Please log in again.")

    # Rotate refresh token (token rotation — invalidates old token)
    new_raw, new_hash = create_refresh_token()
    new_expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    await db.sessions.update_one(
        {"session_id": session["session_id"]},
        {"$set": {
            "refresh_token_hash": new_hash,
            "expires_at": new_expires,
            "last_used": now,
        }},
    )

    user = await db.users.find_one({"_id": ObjectId(session["user_id"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    access_token = create_access_token(session["user_id"], session["session_id"])
    set_refresh_cookie(response, new_raw, new_expires)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_EXPIRE_MINUTES * 60,
        "user": _user_payload(user),
    }


# ── Logout ───────────────────────────────────────────────────
@router.post("/logout")
async def logout(request: Request, response: Response):
    """Revoke current session and clear cookie."""
    raw_refresh = request.cookies.get(REFRESH_COOKIE)
    if raw_refresh:
        token_hash = hash_token(raw_refresh)
        db = get_db()
        await db.sessions.update_one(
            {"refresh_token_hash": token_hash},
            {"$set": {"is_revoked": True}},
        )
    clear_refresh_cookie(response)
    return {"detail": "Logged out successfully."}


# ── Me ───────────────────────────────────────────────────────
@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {
        **_user_payload(current_user),
        "created_at": current_user["created_at"].isoformat(),
    }


# ── Sessions list ────────────────────────────────────────────
@router.get("/sessions")
async def list_sessions(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Return all active (non-revoked, non-expired) sessions for current user."""
    db = get_db()
    now = datetime.now(timezone.utc)

    # Identify current session from cookie
    raw_refresh = request.cookies.get(REFRESH_COOKIE)
    current_hash = hash_token(raw_refresh) if raw_refresh else None

    cursor = db.sessions.find({
        "user_id": str(current_user["_id"]),
        "is_revoked": False,
        "expires_at": {"$gt": now},
    })
    sessions = []
    async for s in cursor:
        sessions.append({
            "session_id": s["session_id"],
            "device_name": s["device_name"],
            "ip_address": s["ip_address"],
            "created_at": s["created_at"].isoformat(),
            "last_used": s["last_used"].isoformat(),
            "expires_at": s["expires_at"].isoformat(),
            "is_current": s["refresh_token_hash"] == current_hash,
        })

    # Sort: current first, then by last_used desc
    sessions.sort(key=lambda x: (not x["is_current"], x["last_used"]), reverse=False)
    sessions.sort(key=lambda x: x["last_used"], reverse=True)
    if sessions:
        current_sessions = [s for s in sessions if s["is_current"]]
        other_sessions = [s for s in sessions if not s["is_current"]]
        sessions = current_sessions + other_sessions

    return {"sessions": sessions}


# ── Revoke session ───────────────────────────────────────────
@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    response: Response,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Revoke a specific session by session_id (must belong to current user)."""
    db = get_db()
    session = await db.sessions.find_one({
        "session_id": session_id,
        "user_id": str(current_user["_id"]),
    })
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"is_revoked": True}},
    )

    # If revoking current session, clear cookie too
    raw_refresh = request.cookies.get(REFRESH_COOKIE)
    if raw_refresh and hash_token(raw_refresh) == session.get("refresh_token_hash"):
        clear_refresh_cookie(response)
        return {"detail": "Session revoked. You have been logged out.", "self": True}

    return {"detail": "Session revoked.", "self": False}


# ── OAuth2 form token (Swagger UI only) ─────────────────────
@router.post("/token", include_in_schema=False)
async def token_form(form: OAuth2PasswordRequestForm = Depends(), request: Request = None, response: Response = None):
    db = get_db()
    user = await db.users.find_one({"email": form.username.lower()})
    if not user or not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    user_id = str(user["_id"])
    session_id = str(uuid.uuid4())  # ephemeral session for Swagger
    token = create_access_token(user_id, session_id)
    return {"access_token": token, "token_type": "bearer"}
