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


def generate_executive_summary(transcript: List[Dict]) -> dict:
    """
    Generate a detailed 4-part executive summary for PDF reports.
    Returns a dict with: purpose, discussion_points, outcomes, next_steps
    """
    dialogue = _format_transcript(transcript)
    if not dialogue.strip():
        return {
            "purpose": "No transcript available.",
            "discussion_points": [],
            "outcomes": [],
            "next_steps": [],
        }

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert meeting analyst producing an executive summary for a formal report. "
                "Analyze the transcript and respond in this EXACT format with these section headers:\n\n"
                "MEETING PURPOSE:\n[1-2 sentences describing why the meeting was held]\n\n"
                "MAIN DISCUSSION POINTS:\n- [point 1]\n- [point 2]\n- [point 3]\n\n"
                "OUTCOMES:\n- [outcome 1]\n- [outcome 2]\n\n"
                "NEXT STEPS:\n- [step 1]\n- [step 2]\n\n"
                "Be concise, professional, and factual. Use bullet points exactly as shown."
            ),
        },
        {
            "role": "user",
            "content": f"Transcript:\n\n{dialogue}\n\nGenerate the executive summary.",
        },
    ]

    raw = _call(messages, max_tokens=800)

    # Parse sections
    def _extract_section(text: str, header: str) -> List[str]:
        """Extract bullet points from a named section."""
        lines = text.split("\n")
        collecting = False
        items = []
        for line in lines:
            if header.upper() in line.upper():
                collecting = True
                continue
            if collecting:
                stripped = line.strip()
                if stripped.startswith("-"):
                    items.append(stripped[1:].strip())
                elif stripped and any(
                    h in stripped.upper()
                    for h in ["MEETING PURPOSE", "MAIN DISCUSSION", "OUTCOMES", "NEXT STEPS"]
                ):
                    break
        return items

    def _extract_paragraph(text: str, header: str) -> str:
        """Extract the paragraph (non-bullet) content from a named section."""
        lines = text.split("\n")
        collecting = False
        parts = []
        for line in lines:
            if header.upper() in line.upper():
                collecting = True
                continue
            if collecting:
                stripped = line.strip()
                if stripped and any(
                    h in stripped.upper()
                    for h in ["MAIN DISCUSSION", "OUTCOMES", "NEXT STEPS"]
                ):
                    break
                if stripped and not stripped.startswith("-"):
                    parts.append(stripped)
        return " ".join(parts).strip()

    return {
        "purpose": _extract_paragraph(raw, "MEETING PURPOSE") or "See full transcript for details.",
        "discussion_points": _extract_section(raw, "MAIN DISCUSSION POINTS") or _extract_section(raw, "MAIN DISCUSSION"),
        "outcomes": _extract_section(raw, "OUTCOMES"),
        "next_steps": _extract_section(raw, "NEXT STEPS"),
    }


def generate_key_decisions(transcript: List[Dict]) -> List[str]:
    """
    Extract key decisions made during the meeting for the PDF report.
    """
    dialogue = _format_transcript(transcript)
    if not dialogue.strip():
        return []

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert meeting analyst. Extract only concrete decisions that were made or agreed upon "
                "during this conversation. A decision is a definitive choice, agreement, or resolution reached. "
                "Return ONLY a numbered list of decisions, one per line, no preamble. "
                "If there are no clear decisions, return 'None identified'."
            ),
        },
        {
            "role": "user",
            "content": f"Transcript:\n\n{dialogue}\n\nList the key decisions made.",
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


def generate_mom(transcript: List[Dict], recording_meta: dict) -> dict:
    """
    Extract a complete Minutes of Meeting (MoM) structure from the transcript in a single call.
    Returns a dictionary matching the MoM schema.
    """
    dialogue = _format_transcript(transcript)
    if not dialogue.strip():
        return {}

    # Simple truncation for extremely long transcripts to fit context window
    # We take the first 60% and last 20% to capture intro/decisions and next steps
    words = dialogue.split()
    if len(words) > 3500:
        first_part = " ".join(words[:2500])
        last_part = " ".join(words[-1000:])
        dialogue = f"{first_part}\n\n...[Middle section omitted for length]...\n\n{last_part}"

    system_prompt = (
        "You are an expert executive assistant. Analyze the meeting transcript and generate a structured Minutes of Meeting (MoM) report. "
        "Return ONLY a valid JSON object matching this exact schema. Do not include markdown formatting like ```json or any other text.\n\n"
        "{\n"
        '  "title": "A concise, professional meeting title",\n'
        '  "agenda_items": ["item 1", "item 2"],\n'
        '  "discussion_summary": "A 1-2 paragraph professional summary of the main points discussed.",\n'
        '  "decisions": ["decision 1", "decision 2"],\n'
        '  "action_items": [{"task": "task description", "owner": "name or Unassigned", "deadline": "date or ASAP"}],\n'
        '  "risks_concerns": ["risk 1", "risk 2"],\n'
        '  "next_steps": ["step 1", "step 2"],\n'
        '  "next_meeting_date": "Date/time if mentioned, else null"\n'
        "}\n\n"
        "If a section has no relevant content, return an empty array [] or null as appropriate."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Transcript:\n\n{dialogue}\n\nGenerate the JSON MoM."},
    ]

    try:
        raw = _call(messages, max_tokens=1500)
        import json
        
        # Strip potential markdown wrapping if the model ignored instructions
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
            
        data = json.loads(raw.strip())
        
        # Ensure default values if LLM missed fields
        return {
            "title": data.get("title") or recording_meta.get("filename", "Meeting Notes"),
            "date": recording_meta.get("created_at", ""),
            "duration": recording_meta.get("duration", 0),
            "participants": recording_meta.get("speakers_detected", []),
            "agenda_items": data.get("agenda_items") or [],
            "discussion_summary": data.get("discussion_summary") or "",
            "decisions": data.get("decisions") or [],
            "action_items": data.get("action_items") or [],
            "risks_concerns": data.get("risks_concerns") or [],
            "next_steps": data.get("next_steps") or [],
            "next_meeting_date": data.get("next_meeting_date"),
        }
    except Exception as e:
        logger.error(f"[LLM] Failed to generate MoM: {e}")
        # Fallback to empty structure
        return {
            "title": recording_meta.get("filename", "Meeting Notes"),
            "date": recording_meta.get("created_at", ""),
            "duration": recording_meta.get("duration", 0),
            "participants": recording_meta.get("speakers_detected", []),
            "agenda_items": [],
            "discussion_summary": "Failed to generate summary.",
            "decisions": [],
            "action_items": [],
            "risks_concerns": [],
            "next_steps": [],
            "next_meeting_date": None,
        }
