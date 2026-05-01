"""
Transcription service using WhisperX.

Drops in as a replacement for the previous faster-whisper service.
Returns the same output schema (segments with word-level timestamps)
plus an aligned result that pipeline.py uses for word→speaker assignment.
"""
import logging
from typing import List, Dict, Any
from config import settings

logger = logging.getLogger(__name__)

_whisperx_model = None
_whisperx_device: str = "cuda"
_whisperx_compute_type: str = "float16"


def _resolve_device() -> tuple[str, str]:
    """Resolve device and compute_type, respecting WHISPER_DEVICE setting."""
    device = settings.WHISPER_DEVICE
    if device == "auto":
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = settings.WHISPER_COMPUTE_TYPE
    # float16 only makes sense on CUDA; fall back to int8 on CPU
    if device == "cpu" and compute_type == "float16":
        compute_type = "int8"
    return device, compute_type


def get_whisperx_model():
    """Lazy-load the WhisperX model (done once per process)."""
    global _whisperx_model, _whisperx_device, _whisperx_compute_type
    if _whisperx_model is None:
        import whisperx
        _whisperx_device, _whisperx_compute_type = _resolve_device()
        logger.info(
            f"[Transcription] Loading WhisperX model '{settings.WHISPER_MODEL_SIZE}' "
            f"on {_whisperx_device} ({_whisperx_compute_type})"
        )
        _whisperx_model = whisperx.load_model(
            settings.WHISPER_MODEL_SIZE,
            _whisperx_device,
            compute_type=_whisperx_compute_type,
        )
        logger.info("[Transcription] WhisperX model ready ✓")
    return _whisperx_model


def transcribe(file_path: str) -> Dict[str, Any]:
    """
    Transcribe an audio file with WhisperX and run the forced-alignment step
    to obtain precise word-level timestamps.

    Returns:
        {
          "segments": [
            {
              "start": float,
              "end": float,
              "text": str,
              "words": [{"word": str, "start": float, "end": float, "score": float}],
            }
          ],
          "language": str,
          "raw_text": str,
          # Extra key consumed by pipeline.py for word→speaker assignment:
          "aligned_result": dict,   # raw WhisperX aligned output
        }
    """
    import whisperx

    device, compute_type = _resolve_device()
    model = get_whisperx_model()

    # ── Step 1: Transcribe ────────────────────────────────────
    logger.info(f"[Transcription] Transcribing {file_path} …")
    raw_result = model.transcribe(file_path, batch_size=16)
    language: str = raw_result.get("language", "en")
    logger.info(f"[Transcription] Detected language: {language}")

    # ── Step 2: Forced alignment (word-level timestamps) ──────
    logger.info("[Transcription] Running forced alignment …")
    try:
        model_a, metadata = whisperx.load_align_model(
            language_code=language,
            device=device,
        )
        aligned_result = whisperx.align(
            raw_result["segments"],
            model_a,
            metadata,
            file_path,
            device,
            return_char_alignments=False,
        )
        logger.info("[Transcription] Alignment complete ✓")
    except Exception as e:
        logger.warning(
            f"[Transcription] Alignment failed ({e}). "
            "Falling back to unaligned segments."
        )
        aligned_result = raw_result

    # ── Step 3: Normalise output schema ───────────────────────
    segments: List[Dict[str, Any]] = []
    raw_parts: List[str] = []

    for seg in aligned_result.get("segments", []):
        words: List[Dict[str, Any]] = []
        for w in seg.get("words", []):
            # WhisperX uses "score" instead of "probability"
            words.append({
                "word": w.get("word", "").strip(),
                "start": round(float(w.get("start", seg["start"])), 3),
                "end": round(float(w.get("end", seg["end"])), 3),
                # Expose as "probability" to keep downstream code unchanged
                "probability": round(float(w.get("score", 1.0)), 4),
            })
        print(words)
        text = seg.get("text", "").strip()
        segments.append({
            "start": round(float(seg["start"]), 3),
            "end": round(float(seg["end"]), 3),
            "text": text,
            "words": words,
            "avg_logprob": round(float(seg.get("avg_logprob", 0.0)), 4),
        })
        raw_parts.append(text)

    return {
        "segments": segments,
        "language": language,
        "raw_text": " ".join(raw_parts),
        # Pipeline uses this for word-level speaker assignment
        "aligned_result": aligned_result,
    }
