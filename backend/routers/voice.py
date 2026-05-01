"""Voice profile router — onboarding samples + add-voice + manage profiles."""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from bson import ObjectId
from database import get_db
from routers.auth import get_current_user
from utils.storage import save_upload, get_voice_dir, delete_file
from utils.audio_utils import validate_audio, convert_to_wav
from services.embedding import extract_embedding_from_file
import os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])


# ── Upload a single voice sample ─────────────────────────────
@router.post("/sample")
async def upload_voice_sample(
    file: UploadFile = File(...),
    label: str = Form("self"),
    sample_index: int = Form(0),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload one voice sample. Returns the saved file path.
    Client calls this 1-3 times, then calls /finalize-setup or /add-profile.
    """
    user_id = str(current_user["_id"])
    # Save raw upload
    raw_path = await save_upload(file, user_id, prefix=f"vs_{sample_index}_")

    # Convert to WAV 16 kHz
    wav_path = raw_path.rsplit(".", 1)[0] + "_16k.wav"
    try:
        convert_to_wav(raw_path, wav_path)
    except Exception as e:
        delete_file(raw_path)
        raise HTTPException(status_code=422, detail=f"Audio conversion failed: {e}")

    delete_file(raw_path)   # keep only converted

    # Validate
    valid, reason = validate_audio(wav_path)
    if not valid:
        delete_file(wav_path)
        raise HTTPException(status_code=422, detail=reason)

    return {"file_path": wav_path, "sample_index": sample_index, "label": label}


# ── Finalize onboarding setup ─────────────────────────────────
@router.post("/finalize-setup")
async def finalize_setup(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Body: {"file_paths": [...], "label": "My Name"}
    Generates embeddings from samples and stores as the user's own voice profile.
    Marks needs_setup = False.
    """
    user_id = str(current_user["_id"])
    file_paths = body.get("file_paths", [])
    label = body.get("label", current_user.get("name", "Me"))

    if not file_paths:
        raise HTTPException(status_code=400, detail="No voice sample files provided.")

    embeddings = []
    for fp in file_paths:
        emb = extract_embedding_from_file(fp)
        if emb is not None:
            embeddings.append(emb.tolist())

    if not embeddings:
        raise HTTPException(status_code=422, detail="Could not extract embeddings from samples. Please re-record.")

    db = get_db()
    now = datetime.utcnow()

    profile_doc = {
        "user_id": user_id,
        "label": label,
        "embeddings": embeddings,
        "sample_count": len(file_paths),
        "created_at": now,
        "updated_at": now,
        "is_self": True,
    }
    result = await db.voice_profiles.insert_one(profile_doc)
    profile_id = str(result.inserted_id)

    # Mark setup complete
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"needs_setup": False, "own_profile_id": profile_id}},
    )

    return {
        "profile_id": profile_id,
        "label": label,
        "embedding_count": len(embeddings),
        "message": "Voice profile created. Setup complete!",
    }


# ── Add an extra voice profile ────────────────────────────────
@router.post("/add-profile")
async def add_voice_profile(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Body: {"file_paths": [...], "label": "Alice"}
    """
    user_id = str(current_user["_id"])
    file_paths = body.get("file_paths", [])
    label = body.get("label", "").strip()

    if not label:
        raise HTTPException(status_code=400, detail="Label is required.")
    if not file_paths:
        raise HTTPException(status_code=400, detail="No file paths provided.")

    embeddings = []
    for fp in file_paths:
        emb = extract_embedding_from_file(fp)
        if emb is not None:
            embeddings.append(emb.tolist())

    if not embeddings:
        raise HTTPException(status_code=422, detail="Could not extract embeddings. Please re-record with clearer audio.")

    db = get_db()
    now = datetime.utcnow()
    profile_doc = {
        "user_id": user_id,
        "label": label,
        "embeddings": embeddings,
        "sample_count": len(file_paths),
        "created_at": now,
        "updated_at": now,
        "is_self": False,
    }
    result = await db.voice_profiles.insert_one(profile_doc)

    return {
        "profile_id": str(result.inserted_id),
        "label": label,
        "embedding_count": len(embeddings),
    }


# ── List all profiles ─────────────────────────────────────────
@router.get("/profiles")
async def list_profiles(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()
    profiles = await db.voice_profiles.find({"user_id": user_id}).to_list(length=50)
    return [
        {
            "id": str(p["_id"]),
            "label": p["label"],
            "sample_count": p.get("sample_count", 0),
            "is_self": p.get("is_self", False),
            "created_at": p["created_at"].isoformat(),
            "updated_at": p["updated_at"].isoformat(),
        }
        for p in profiles
    ]


# ── Rename profile ────────────────────────────────────────────
@router.put("/profiles/{profile_id}")
async def update_profile(
    profile_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    db = get_db()
    result = await db.voice_profiles.update_one(
        {"_id": ObjectId(profile_id), "user_id": user_id},
        {"$set": {"label": body.get("label", ""), "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return {"message": "Profile updated."}


# ── Delete profile ────────────────────────────────────────────
@router.delete("/profiles/{profile_id}")
async def delete_profile(
    profile_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    db = get_db()
    result = await db.voice_profiles.delete_one(
        {"_id": ObjectId(profile_id), "user_id": user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found.")

    # If deleted own profile, mark needs_setup again
    if str(current_user.get("own_profile_id")) == profile_id:
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"needs_setup": True, "own_profile_id": None}},
        )
    return {"message": "Profile deleted."}
