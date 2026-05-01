"""Auth router — register, login, current user."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from bson import ObjectId
from database import get_db
from models.user import UserCreate, UserLogin, UserInDB, UserOut
from models.settings import UserSettings
from config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise credentials_exception
    return user


# ── Register ─────────────────────────────────────────────────
@router.post("/register", response_model=dict, status_code=201)
async def register(body: UserCreate):
    db = get_db()
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    hashed = hash_password(body.password)
    user_doc = {
        "name": body.name,
        "email": body.email.lower(),
        "hashed_password": hashed,
        "needs_setup": True,
        "own_profile_id": None,
        "created_at": datetime.utcnow(),
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
        "updated_at": datetime.utcnow(),
    })

    token = create_access_token({"sub": user_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": body.name,
            "email": body.email.lower(),
            "needs_setup": True,
        },
    }


# ── Login ────────────────────────────────────────────────────
@router.post("/login", response_model=dict)
async def login(body: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": user["name"],
            "email": user["email"],
            "needs_setup": user.get("needs_setup", True),
            "own_profile_id": user.get("own_profile_id"),
        },
    }


# ── OAuth2 form token (for swagger UI) ──────────────────────
@router.post("/token", include_in_schema=False)
async def token_form(form: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    user = await db.users.find_one({"email": form.username.lower()})
    if not user or not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id})
    return {"access_token": token, "token_type": "bearer"}


# ── Me ───────────────────────────────────────────────────────
@router.get("/me", response_model=dict)
async def me(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "name": current_user["name"],
        "email": current_user["email"],
        "needs_setup": current_user.get("needs_setup", True),
        "own_profile_id": current_user.get("own_profile_id"),
        "created_at": current_user["created_at"].isoformat(),
    }
