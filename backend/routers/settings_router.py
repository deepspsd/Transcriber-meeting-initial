"""Settings router — get/update user threshold settings."""
from datetime import datetime
from fastapi import APIRouter, Depends
from database import get_db
from routers.auth import get_current_user
from models.settings import UserSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_settings(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()
    doc = await db.settings.find_one({"user_id": user_id})
    if not doc:
        return {
            "speaker_similarity_threshold": 0.75,
            "word_conf_low": 0.7,
            "word_conf_mid": 0.85,
            "min_segment_duration": 1.5,
        }
    return {
        "speaker_similarity_threshold": doc.get("speaker_similarity_threshold", 0.75),
        "word_conf_low": doc.get("word_conf_low", 0.7),
        "word_conf_mid": doc.get("word_conf_mid", 0.85),
        "min_segment_duration": doc.get("min_segment_duration", 1.5),
        "updated_at": doc.get("updated_at", datetime.utcnow()).isoformat(),
    }


@router.put("")
async def update_settings(
    body: UserSettingsUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    db = get_db()

    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    patch["updated_at"] = datetime.utcnow()

    await db.settings.update_one(
        {"user_id": user_id},
        {"$set": patch},
        upsert=True,
    )
    return {"message": "Settings updated.", **patch}
