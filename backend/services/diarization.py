"""
Speaker diarization service.

If HF_TOKEN is set → uses pyannote.audio speaker-diarization-3.1.
Overlap detection is computed from segment intersections (no deprecated OSD pipeline).
Otherwise → falls back to lightweight energy-based diarization.
"""
import logging
import numpy as np
from typing import List, Dict, Any, Optional
from config import settings
import soundfile as sf

# Patch missing attribute for compatibility
if not hasattr(sf, "SoundFileRuntimeError"):
    sf.SoundFileRuntimeError = RuntimeError
logger = logging.getLogger(__name__)

_diarization_pipeline = None
_pyannote_available = False

def _patch_torchaudio_backend():
    try:
        import torchaudio
        if not hasattr(torchaudio, "set_audio_backend"):
            torchaudio.set_audio_backend = lambda backend: None
            logger.info("[Diarization] patched torchaudio.set_audio_backend")
    except ImportError:
        pass
def _patch_torchaudio():
    """
    Compatibility shim: newer torchaudio (2.4+) removed AudioMetaData from
    the top-level namespace. pyannote.audio still references it there.
    """
    try:
        import torchaudio
        if hasattr(torchaudio, "AudioMetaData"):
            return  # already fine
        # Walk known relocation paths
        for mod_path, attr in [
            ("torchaudio.backend.common", "AudioMetaData"),
            ("torchaudio._backend",       "AudioMetaData"),
            ("torchaudio.io",             "AudioMetaData"),
        ]:
            try:
                import importlib
                mod = importlib.import_module(mod_path)
                cls = getattr(mod, attr)
                torchaudio.AudioMetaData = cls
                logger.info(f"[Diarization] torchaudio.AudioMetaData patched from {mod_path}")
                return
            except Exception:
                continue
        # Last resort: create a namedtuple with the expected fields
        from collections import namedtuple
        torchaudio.AudioMetaData = namedtuple(
            "AudioMetaData",
            ["sample_rate", "num_frames", "num_channels", "bits_per_sample", "encoding"],
        )
        logger.warning("[Diarization] torchaudio.AudioMetaData shimmed with namedtuple.")
    except ImportError:
        pass  # torchaudio not installed at all — that's OK


def _try_load_pyannote():
    global _diarization_pipeline, _overlap_pipeline, _pyannote_available
    if not settings.HF_TOKEN:
        logger.info("[Diarization] HF_TOKEN not set — using fallback energy-based diarization.")
        return

    # Patch torchaudio BEFORE importing pyannote
    _patch_torchaudio()
    _patch_torchaudio_backend()
    try:
        from pyannote.audio import Pipeline
        logger.info("[Diarization] Loading pyannote speaker-diarization-3.1 ...")
        _diarization_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=settings.HF_TOKEN,
        )
        _pyannote_available = True
        logger.info("[Diarization] pyannote speaker-diarization-3.1 ready ✓")
    except Exception as e:
        logger.warning(f"[Diarization] Speaker diarization load failed ({e}). Using energy fallback.")
        _pyannote_available = False


def init_diarization():
    _try_load_pyannote()


# ── pyannote diarization ───────────────────────────────────────
def _load_for_pyannote(file_path: str) -> dict:
    """
    Load audio via soundfile → torch tensor dict.
    Bypasses torchcodec/FFmpeg DLL issues on Windows.
    """
    import torch
    import soundfile as sf
    data, sr = sf.read(file_path, dtype="float32", always_2d=True)
    waveform = torch.from_numpy(data.T)  # (channels, samples)
    return {"waveform": waveform, "sample_rate": sr}


def _detect_overlaps_from_segments(segments: List[Dict]) -> List[Dict]:
    """
    Manual overlap detection: if two segments from DIFFERENT speakers
    overlap in time, mark both as is_overlap=True.
    No external OSD pipeline needed.
    """
    n = len(segments)
    for i in range(n):
        for j in range(i + 1, n):
            a, b = segments[i], segments[j]
            if a["speaker"] == b["speaker"]:
                continue
            overlap_start = max(a["start"], b["start"])
            overlap_end   = min(a["end"],   b["end"])
            if overlap_end - overlap_start > 0.1:   # >100ms overlap
                a["is_overlap"] = True
                b["is_overlap"] = True
    return segments


def _diarize_pyannote(file_path: str) -> List[Dict[str, Any]]:
    try:
        audio_input = _load_for_pyannote(file_path)
    except Exception as e:
        logger.warning(f"[Diarization] soundfile load failed ({e}), using file path.")
        audio_input = file_path

    diarization = _diarization_pipeline(audio_input)

    # 🔥 THIS IS THE REAL FIX
    annotation = diarization.speaker_diarization

    segments = []
    for turn, _, speaker in annotation.itertracks(yield_label=True):
        segments.append({
            "start": round(turn.start, 3),
            "end": round(turn.end, 3),
            "speaker": speaker,
            "is_overlap": False,
        })

    logger.info(f"[Diarization] pyannote found {len(segments)} segments, speakers: {list({s['speaker'] for s in segments})}")
    return _detect_overlaps_from_segments(segments)
# ── Fallback: energy-based diarization ───────────────────────
def _diarize_energy(file_path: str, min_seg_dur: float = 1.5) -> List[Dict[str, Any]]:
    """
    Simple energy-based speaker change detection.
    Groups frames by high/low energy and assigns alternating speaker labels.
    Not accurate for real conversations but works without HF_TOKEN.
    """
    import librosa
    audio, sr = librosa.load(file_path, sr=16000, mono=True)
    hop_length = 512
    frame_length = 2048

    rms = librosa.feature.rms(y=audio, frame_length=frame_length, hop_length=hop_length)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)

    threshold = np.percentile(rms, 30)
    speech_mask = rms > threshold

    segments = []
    current_speaker = 0
    in_speech = False
    seg_start = 0.0
    SILENCE_GAP = 0.8  # seconds gap to trigger speaker change
    min_frames_silence = int(SILENCE_GAP * sr / hop_length)
    silence_count = 0

    for i, is_speech in enumerate(speech_mask):
        if is_speech:
            if not in_speech:
                seg_start = float(times[i])
                in_speech = True
            silence_count = 0
        else:
            if in_speech:
                silence_count += 1
                if silence_count >= min_frames_silence:
                    end = float(times[i - min_frames_silence // 2])
                    dur = end - seg_start
                    if dur >= min_seg_dur:
                        segments.append({
                            "start": round(seg_start, 3),
                            "end": round(end, 3),
                            "speaker": f"SPEAKER_{current_speaker:02d}",
                            "is_overlap": False,
                        })
                        current_speaker = (current_speaker + 1) % 2  # alternate
                    in_speech = False
                    silence_count = 0

    # close last segment
    if in_speech:
        end = float(times[-1])
        dur = end - seg_start
        if dur >= min_seg_dur:
            segments.append({
                "start": round(seg_start, 3),
                "end": round(end, 3),
                "speaker": f"SPEAKER_{current_speaker:02d}",
                "is_overlap": False,
            })

    return segments


# ── Public API ─────────────────────────────────────────────────
def diarize(file_path: str) -> List[Dict[str, Any]]:
    """
    Returns a list of diarization segments:
    [{"start": float, "end": float, "speaker": str, "is_overlap": bool}]
    """
    min_dur = settings.MIN_SEGMENT_DURATION
    if _pyannote_available:
        raw = _diarize_pyannote(file_path)
    else:
        raw = _diarize_energy(file_path, min_seg_dur=min_dur)

    # filter out too-short segments
    return [s for s in raw if (s["end"] - s["start"]) >= min_dur]


def is_pyannote_available() -> bool:
    return _pyannote_available
