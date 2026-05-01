"""
LLM service using Groq API.
Provides meeting summaries, key points, action items, and conversational Q&A.
"""
import logging
from typing import List, Dict, Any, Optional
from config import settings

logger = logging.getLogger(__name__)

_groq_client = None


def get_groq_client():
    global _groq_client
    if _groq_client is None:
        if not settings.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set in environment.")
        from groq import Groq
        _groq_client = Groq(api_key=settings.GROQ_API_KEY)
        logger.info("[LLM] Groq client initialized.")
    return _groq_client


def _call(messages: List[Dict], max_tokens: int = 1024) -> str:
    client = get_groq_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def _format_transcript(transcript: List[Dict]) -> str:
    """Convert transcript segments into a readable dialogue string."""
    lines = []
    for seg in transcript:
        label = seg.get("speaker_label", "Unknown")
        text = seg.get("text", "").strip()
        if text:
            lines.append(f"{label}: {text}")
    return "\n".join(lines)


def generate_summary(transcript: List[Dict]) -> str:
    dialogue = _format_transcript(transcript)
    if not dialogue.strip():
        return "No transcript available to summarize."

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert meeting analyst. Given a conversation transcript with speaker labels, "
                "produce a concise, professional meeting summary in 3-5 sentences. "
                "Focus on the main topics discussed, decisions made, and overall outcome."
            ),
        },
        {
            "role": "user",
            "content": f"Transcript:\n\n{dialogue}\n\nPlease provide a meeting summary.",
        },
    ]
    return _call(messages, max_tokens=512)


def generate_key_points(transcript: List[Dict]) -> List[str]:
    dialogue = _format_transcript(transcript)
    if not dialogue.strip():
        return []

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert meeting analyst. Extract key points from the conversation. "
                "Return ONLY a numbered list of key points, one per line, no preamble. "
                "Each point should be concise (one sentence max)."
            ),
        },
        {
            "role": "user",
            "content": f"Transcript:\n\n{dialogue}\n\nList the key points.",
        },
    ]
    raw = _call(messages, max_tokens=512)
    lines = [l.strip() for l in raw.split("\n") if l.strip()]
    # Strip numbering like "1. " or "- "
    cleaned = []
    for line in lines:
        if line and line[0].isdigit() and ". " in line:
            cleaned.append(line.split(". ", 1)[1])
        elif line.startswith("- "):
            cleaned.append(line[2:])
        else:
            cleaned.append(line)
    return cleaned


def generate_action_items(transcript: List[Dict]) -> List[str]:
    dialogue = _format_transcript(transcript)
    if not dialogue.strip():
        return []

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert meeting analyst. Extract clear action items from the conversation. "
                "Return ONLY a numbered list of action items, one per line, no preamble. "
                "Each item should include who is responsible if mentioned. "
                "If there are no action items, return 'None identified'."
            ),
        },
        {
            "role": "user",
            "content": f"Transcript:\n\n{dialogue}\n\nList the action items.",
        },
    ]
    raw = _call(messages, max_tokens=512)
    if "none identified" in raw.lower():
        return []
    lines = [l.strip() for l in raw.split("\n") if l.strip()]
    cleaned = []
    for line in lines:
        if line and line[0].isdigit() and ". " in line:
            cleaned.append(line.split(". ", 1)[1])
        elif line.startswith("- "):
            cleaned.append(line[2:])
        else:
            cleaned.append(line)
    return cleaned


def answer_question(transcript: List[Dict], question: str, history: List[Dict] = None) -> str:
    """
    Answer a user's question about the transcript.
    history: list of {"role": "user"|"assistant", "content": str}
    """
    dialogue = _format_transcript(transcript)
    if not dialogue.strip():
        return "There is no transcript to query."

    system_msg = {
        "role": "system",
        "content": (
            "You are a helpful assistant with access to a conversation transcript. "
            "Answer questions accurately based only on the transcript content. "
            "If the answer is not in the transcript, say so clearly.\n\n"
            f"Transcript:\n{dialogue}"
        ),
    }

    messages = [system_msg]
    if history:
        messages.extend(history[-6:])  # last 3 exchanges
    messages.append({"role": "user", "content": question})

    return _call(messages, max_tokens=512)
