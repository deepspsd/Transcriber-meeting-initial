"""History router — list, view, and delete recordings."""
from fastapi import APIRouter, Depends, HTTPException, Body
from bson import ObjectId
from database import get_db
from routers.auth import get_current_user
from utils.storage import delete_file

router = APIRouter(prefix="/history", tags=["history"])


@router.patch("/{recording_id}/rename")
async def rename_recording(
    recording_id: str,
    filename: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
):
    """Rename a recording. Validates the new name and updates in DB."""
    name = filename.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be empty.")
    if len(name) > 200:
        raise HTTPException(status_code=422, detail="Name too long (max 200 chars).")

    user_id = str(current_user["_id"])
    db = get_db()
    try:
        result = await db.recordings.update_one(
            {"_id": ObjectId(recording_id), "user_id": user_id},
            {"$set": {"filename": name}},
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid recording ID.")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recording not found.")

    return {"id": recording_id, "filename": name}


@router.get("")
async def list_history(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()
    cursor = db.recordings.find(
        {"user_id": user_id},
        {"transcript": 0, "raw_text": 0},  # exclude heavy fields from list
    ).sort("created_at", -1).limit(100)

    recordings = await cursor.to_list(length=100)
    return [
        {
            "id": str(r["_id"]),
            "filename": r.get("filename", ""),
            "duration": r.get("duration", 0),
            "status": r.get("status", "unknown"),
            "speakers_detected": r.get("speakers_detected", []),
            "has_summary": bool(r.get("summary")),
            "created_at": r["created_at"].isoformat(),
            "processed_at": r["processed_at"].isoformat() if r.get("processed_at") else None,
        }
        for r in recordings
    ]


@router.get("/{recording_id}")
async def get_recording(recording_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()
    try:
        rec = await db.recordings.find_one(
            {"_id": ObjectId(recording_id), "user_id": user_id}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID.")
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found.")

    return {
        "id": str(rec["_id"]),
        "filename": rec.get("filename", ""),
        "duration": rec.get("duration", 0),
        "status": rec.get("status"),
        "file_path": rec.get("file_path"),
        "transcript": rec.get("transcript", []),
        "raw_text": rec.get("raw_text", ""),
        "summary": rec.get("summary", ""),
        "key_points": rec.get("key_points", []),
        "action_items": rec.get("action_items", []),
        "speakers_detected": rec.get("speakers_detected", []),
        "language": rec.get("language", "en"),
        "created_at": rec["created_at"].isoformat(),
        "processed_at": rec["processed_at"].isoformat() if rec.get("processed_at") else None,
    }


@router.delete("/{recording_id}")
async def delete_recording(recording_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()
    try:
        rec = await db.recordings.find_one(
            {"_id": ObjectId(recording_id), "user_id": user_id}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID.")
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found.")

    # Delete audio file
    if rec.get("file_path"):
        delete_file(rec["file_path"])

    await db.recordings.delete_one({"_id": ObjectId(recording_id)})
    return {"message": "Recording deleted."}


@router.get("/{recording_id}/audio")
async def stream_audio(recording_id: str, current_user: dict = Depends(get_current_user)):
    """Return file path for audio playback (frontend fetches with auth)."""
    user_id = str(current_user["_id"])
    db = get_db()
    rec = await db.recordings.find_one(
        {"_id": ObjectId(recording_id), "user_id": user_id},
        {"file_path": 1},
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Not found.")

    from fastapi.responses import FileResponse
    import os
    fp = rec.get("file_path", "")
    if not fp or not os.path.exists(fp):
        raise HTTPException(status_code=404, detail="Audio file not found on disk.")
    return FileResponse(fp, media_type="audio/wav")
