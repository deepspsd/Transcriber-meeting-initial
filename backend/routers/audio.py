"""Audio upload/record router — accepts files, triggers pipeline."""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from bson import ObjectId
from database import get_db
from routers.auth import get_current_user
from utils.storage import save_upload, save_bytes,delete_file
from utils.audio_utils import validate_audio, convert_to_wav, get_duration

from tasks.pipeline import run_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/audio", tags=["audio"])


async def _create_recording_and_run(
    file_path: str,
    original_filename: str,
    user_id: str,
    background_tasks: BackgroundTasks,
    db,
) -> str:
    """Create recording doc and schedule pipeline."""
    try:
        duration = get_duration(file_path)
    except Exception:
        duration = 0.0

    recording_doc = {
        "user_id": user_id,
        "filename": original_filename,
        "file_path": file_path,
        "duration": duration,
        "status": "pending",
        "progress": "queued",
        "transcript": [],
        "raw_text": None,
        "summary": None,
        "key_points": [],
        "action_items": [],
        "speakers_detected": [],
        "created_at": datetime.utcnow(),
        "processed_at": None,
    }
    result = await db.recordings.insert_one(recording_doc)
    recording_id = str(result.inserted_id)

    background_tasks.add_task(run_pipeline, recording_id, file_path, user_id)
    return recording_id


# ── Upload audio file ─────────────────────────────────────────
@router.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict = Depends(get_current_user),
):
    """Upload a pre-recorded audio file for processing."""
    user_id = str(current_user["_id"])
    db = get_db()

    raw_path = await save_upload(file, user_id, prefix="rec_")

    # Convert to WAV
    wav_path = raw_path.rsplit(".", 1)[0] + "_proc.wav"
    try:
        convert_to_wav(raw_path, wav_path)
        delete_file(raw_path)
    except Exception as e:
        delete_file(raw_path)
        raise HTTPException(status_code=422, detail=f"Audio conversion failed: {e}")

    valid, reason = validate_audio(wav_path)
    if not valid:
        delete_file(wav_path)
        raise HTTPException(status_code=422, detail=reason)

    recording_id = await _create_recording_and_run(
        file_path=wav_path,
        original_filename=file.filename,
        user_id=user_id,
        background_tasks=background_tasks,
        db=db,
    )

    return {
        "recording_id": recording_id,
        "status": "pending",
        "message": "Audio uploaded. Processing started in background.",
    }


# ── Submit raw recorded audio (from browser MediaRecorder) ────
@router.post("/record")
async def submit_recording(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict = Depends(get_current_user),
):
    """
    Accept audio blob from browser MediaRecorder (webm/ogg/wav).
    Converts to 16kHz WAV and queues for processing.
    """
    user_id = str(current_user["_id"])
    db = get_db()

    raw_path = await save_upload(file, user_id, prefix="live_")
    wav_path = raw_path.rsplit(".", 1)[0] + "_proc.wav"

    try:
        convert_to_wav(raw_path, wav_path)
        delete_file(raw_path)
    except Exception as e:
        delete_file(raw_path)
        raise HTTPException(status_code=422, detail=f"Conversion failed: {e}")

    valid, reason = validate_audio(wav_path)
    if not valid:
        delete_file(wav_path)
        raise HTTPException(status_code=422, detail=reason)

    recording_id = await _create_recording_and_run(
        file_path=wav_path,
        original_filename=file.filename or "live_recording.wav",
        user_id=user_id,
        background_tasks=background_tasks,
        db=db,
    )

    return {
        "recording_id": recording_id,
        "status": "pending",
        "message": "Recording received. Processing started.",
    }


# ── Poll job status ───────────────────────────────────────────
@router.get("/jobs/{recording_id}")
async def get_job_status(
    recording_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Poll the status of a recording job. Returns full result when done."""
    user_id = str(current_user["_id"])
    db = get_db()

    try:
        rec = await db.recordings.find_one(
            {"_id": ObjectId(recording_id), "user_id": user_id}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid recording ID.")

    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found.")

    resp = {
        "job_id": recording_id,
        "status": rec["status"],
        "progress": rec.get("progress", ""),
        "duration": rec.get("duration", 0),
        "created_at": rec["created_at"].isoformat(),
    }

    if rec["status"] == "done":
        resp["result"] = {
            "transcript": rec.get("transcript", []),
            "raw_text": rec.get("raw_text", ""),
            "summary": rec.get("summary", ""),
            "key_points": rec.get("key_points", []),
            "action_items": rec.get("action_items", []),
            "speakers_detected": rec.get("speakers_detected", []),
            "language": rec.get("language", "en"),
            "processed_at": rec["processed_at"].isoformat() if rec.get("processed_at") else None,
        }
    elif rec["status"] == "error":
        resp["error"] = rec.get("error_message", "Unknown error.")

    return resp
