"""
Background pipeline: transcribe → diarize → identify speakers → generate AI insights → save.

WhisperX integration:
  - transcribe() returns an `aligned_result` dict consumed by whisperx.assign_word_speakers()
  - assign_word_speakers() annotates every word with the speaker from pyannote diarization
  - We then run our voice-profile identification on top to map pyannote IDs → human names
"""
import logging
from datetime import datetime
from typing import List, Dict, Any
from bson import ObjectId
from database import get_db
from services.transcription import transcribe
from services.diarization import diarize
from services.identification import identify_speakers
from services.llm import generate_summary, generate_key_points, generate_action_items
from config import settings

logger = logging.getLogger(__name__)


def _convert_diar_to_whisperx_format(
    diar_segments: List[Dict[str, Any]]
) -> Any:
    """
    Convert our pyannote diarization output to the format whisperx.assign_word_speakers
    expects.  WhisperX wants a pandas DataFrame (or object with an .itertracks()-like
    interface), but its internal `assign_word_speakers` actually just needs a list of
    dicts with keys: segment, label.

    We replicate the minimal DataFrame structure whisperx expects by wrapping in a
    simple object — or we can use the pandas route which is more robust.
    """
    try:
        import pandas as pd
        rows = []
        for seg in diar_segments:
            rows.append({
                "segment": {"start": seg["start"], "end": seg["end"]},
                "label": seg["speaker"],
                "speaker": seg["speaker"],
            })
        return pd.DataFrame(rows)
    except ImportError:
        return None


def _assign_speakers_to_words_manual(
    aligned_result: Dict[str, Any],
    identified_segs: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Fallback word→speaker assignment (used if whisperx.assign_word_speakers
    is not available or fails).

    For every word, find the identified diarization segment with the greatest
    time overlap and assign its speaker_label.
    """
    out_segments = []
    for seg in aligned_result.get("segments", []):
        seg_start = seg["start"]
        seg_end = seg["end"]

        # Find best segment match by time overlap
        best_label = "Unknown"
        best_profile_id = None
        best_is_overlap = False
        best_overlap = 0.0
        for s in identified_segs:
            ov = max(0.0, min(seg_end, s["end"]) - max(seg_start, s["start"]))
            if ov > best_overlap:
                best_overlap = ov
                best_label = s.get("speaker_label", "Unknown")
                best_profile_id = s.get("speaker_profile_id")
                best_is_overlap = s.get("is_overlap", False)

        # Per-word speaker (fine-grained)
        enriched_words = []
        for w in seg.get("words", []):
            w_start = w.get("start", seg_start)
            w_end = w.get("end", seg_end)
            w_label = best_label
            w_profile_id = best_profile_id
            for s in identified_segs:
                ov = max(0.0, min(w_end, s["end"]) - max(w_start, s["start"]))
                if ov > 0.0:
                    w_label = s.get("speaker_label", w_label)
                    w_profile_id = s.get("speaker_profile_id", w_profile_id)
                    break
            enriched_words.append({
                "word": w.get("word", "").strip(),
                "start": float(w.get("start", seg_start)),
                "end": float(w.get("end", seg_end)),
                "probability": float(
                    w.get("probability", w.get("score", 1.0))
                ),
                "speaker_label": w_label,
            })
        
        out_segments.append({
            "start": seg_start,
            "end": seg_end,
            "text": seg.get("text", "").strip(),
            "words": enriched_words,
            "avg_logprob": seg.get("avg_logprob", 0.0),
            "speaker_label": best_label,
            "speaker_profile_id": best_profile_id,
            "is_overlap": best_is_overlap,
        })

    return out_segments


async def run_pipeline(recording_id: str, file_path: str, user_id: str):
    """
    Full async pipeline for a single recording.
    Updates the recording document at each stage.
    """
    db = get_db()

    async def update_status(status: str, extra: dict = None):
        patch = {"status": status}
        if extra:
            patch.update(extra)
        await db.recordings.update_one(
            {"_id": ObjectId(recording_id)},
            {"$set": patch},
        )

    try:
        # ── Stage 1: Transcription (WhisperX + alignment) ─────
        await update_status("processing", {"progress": "transcribing"})
        logger.info(f"[Pipeline] {recording_id} — transcribing {file_path}")
        t_result = transcribe(file_path)
        transcript_segs = t_result["segments"]
        raw_text = t_result["raw_text"]
        language = t_result.get("language", "en")
        aligned_result = t_result.get("aligned_result", {"segments": transcript_segs})

        # ── Stage 2: Diarization ──────────────────────────────
        await update_status("processing", {"progress": "diarizing"})
        logger.info(f"[Pipeline] {recording_id} — diarizing")
        diar_segs = diarize(file_path)

        # ── Stage 3: Load voice profiles ──────────────────────
        voice_profiles = await db.voice_profiles.find(
            {"user_id": user_id}
        ).to_list(length=100)

        user_settings = await db.settings.find_one({"user_id": user_id})
        threshold = (
            user_settings.get("speaker_similarity_threshold", settings.SPEAKER_SIMILARITY_THRESHOLD)
            if user_settings else settings.SPEAKER_SIMILARITY_THRESHOLD
        )

        # ── Stage 4: Speaker identification ───────────────────
        await update_status("processing", {"progress": "identifying_speakers"})
        logger.info(f"[Pipeline] {recording_id} — identifying speakers")
        identified_segs = identify_speakers(
            file_path=file_path,
            diarization_segments=diar_segs,
            voice_profiles=voice_profiles,
            similarity_threshold=threshold,
        )

        # ── Stage 5: Word-level speaker assignment (WhisperX-native) ──
        logger.info(f"[Pipeline] {recording_id} — assigning words to speakers")
        try:
            import whisperx
            diar_df = _convert_diar_to_whisperx_format(identified_segs)
            if diar_df is not None and not diar_df.empty:
                # Use WhisperX's built-in word→speaker assignment
                wx_assigned = whisperx.assign_word_speakers(diar_df, aligned_result)
                speaker_segments = _post_process_whisperx_segments(wx_assigned, identified_segs)
            else:
                raise ValueError("Empty diarization dataframe")
        except Exception as e:
            logger.warning(
                f"[Pipeline] whisperx.assign_word_speakers failed ({e}), "
                "falling back to manual assignment."
            )
            speaker_segments = _assign_speakers_to_words_manual(aligned_result, identified_segs)
        print("speak segments",speaker_segments)
        # ── Stage 6: Build final segments ─────────────────────
        final_segments = []
        for seg in speaker_segments:
            words = seg.get("words", [])
            final_segments.append({
                "speaker_label": seg.get("speaker_label", "Unknown"),
                "speaker_profile_id": seg.get("speaker_profile_id"),
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
                "words": words,
                "is_overlap": seg.get("is_overlap", False),
            })

        speakers_detected = list({
            s["speaker_label"]
            for s in final_segments
            if s["speaker_label"] not in ("Unknown", "[Multiple Speakers]")
        })

        # ── Stage 7: AI insights ──────────────────────────────
        await update_status("processing", {"progress": "generating_insights"})
        logger.info(f"[Pipeline] {recording_id} — generating AI insights")
        summary = ""
        key_points: List[str] = []
        action_items: List[str] = []

        try:
            summary = generate_summary(final_segments)
            key_points = generate_key_points(final_segments)
            action_items = generate_action_items(final_segments)
        except Exception as e:
            logger.warning(f"[Pipeline] AI insights failed (non-fatal): {e}")

        # ── Stage 8: Persist results ──────────────────────────
        await db.recordings.update_one(
            {"_id": ObjectId(recording_id)},
            {"$set": {
                "status": "done",
                "progress": "done",
                "transcript": final_segments,
                "raw_text": raw_text,
                "language": language,
                "summary": summary,
                "key_points": key_points,
                "action_items": action_items,
                "speakers_detected": speakers_detected,
                "processed_at": datetime.utcnow(),
            }},
        )
        logger.info(f"[Pipeline] {recording_id} — complete ✓")

    except Exception as e:
        logger.error(f"[Pipeline] {recording_id} — FAILED: {e}", exc_info=True)
        await update_status("error", {"error_message": str(e)})


def _post_process_whisperx_segments(
    wx_result: Dict[str, Any],
    identified_segs: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Map WhisperX speaker IDs (SPEAKER_00, SPEAKER_01…) from assign_word_speakers
    back to human-readable labels from our voice-profile identification.

    whisperx.assign_word_speakers annotates each segment/word with a "speaker"
    key using the raw diarization IDs.  We build a mapping from those IDs to
    human labels using identified_segs.
    """
    # Build pyannote_id → speaker_label map
    id_to_label: Dict[str, str] = {}
    id_to_profile: Dict[str, str | None] = {}
    for seg in identified_segs:
        raw_id = seg.get("speaker", "")
        if raw_id and raw_id not in id_to_label:
            id_to_label[raw_id] = seg.get("speaker_label", "Unknown")
            id_to_profile[raw_id] = seg.get("speaker_profile_id")

    out = []
    print("inside post_process wx results",wx_result)
    for seg in wx_result.get("segments", []):
        raw_id = seg.get("speaker", "")
        label = id_to_label.get(raw_id, seg.get("speaker", "Unknown"))
        profile_id = id_to_profile.get(raw_id)

        # Per-word labels
        enriched_words = []
        for w in seg.get("words", []):
            w_raw = w.get("speaker", raw_id)
            print("inside post_process wx results",w)
            enriched_words.append({
                "word": w.get("word", "").strip(),
                "start": round(float(w.get("start", seg["start"])), 3),
                "end": round(float(w.get("end", seg["end"])), 3),
                "probability": round(float(w.get("score", 1.0)), 4),
                "speaker_label": id_to_label.get(w_raw, label),
            })

        # Determine overlap flag from identified_segs
        seg_start = seg["start"]
        seg_end = seg["end"]
        is_overlap = any(
            s.get("is_overlap", False)
            and max(seg_start, s["start"]) < min(seg_end, s["end"])
            for s in identified_segs
        )
        print("enriched_words",enriched_words)
        out.append({
            "start": round(float(seg_start), 3),
            "end": round(float(seg_end), 3),
            "text": seg.get("text", "").strip(),
            "words": enriched_words,
            "avg_logprob": round(float(seg.get("avg_logprob", 0.0)), 4),
            "speaker_label": label,
            "speaker_profile_id": profile_id,
            "is_overlap": is_overlap,
        })
    return out
