"""Chat router — AI Q&A on a specific recording transcript."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId
from database import get_db
from routers.auth import get_current_user
from services.llm import answer_question

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    recording_id: str
    question: str
    history: Optional[List[ChatMessage]] = []


@router.post("")
async def chat(body: ChatRequest, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()

    try:
        rec = await db.recordings.find_one(
            {"_id": ObjectId(body.recording_id), "user_id": user_id},
            {"transcript": 1, "status": 1},
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid recording ID.")

    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found.")

    if rec.get("status") != "done":
        raise HTTPException(status_code=400, detail="Recording is still being processed.")

    transcript = rec.get("transcript", [])
    history = [{"role": m.role, "content": m.content} for m in (body.history or [])]

    try:
        answer = answer_question(transcript, body.question, history)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {"answer": answer, "question": body.question}
