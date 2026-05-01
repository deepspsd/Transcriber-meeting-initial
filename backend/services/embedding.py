"""
Speaker embedding service using resemblyzer.
Generates 256-d voice embeddings and computes cosine similarity.
"""
import numpy as np
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

_encoder = None


def get_encoder():
    global _encoder
    if _encoder is None:
        try:
            from resemblyzer import VoiceEncoder
            _encoder = VoiceEncoder()
            logger.info("[Embedding] VoiceEncoder loaded.")
        except Exception as e:
            logger.error(f"[Embedding] Failed to load VoiceEncoder: {e}")
            raise
    return _encoder


def extract_embedding(audio: np.ndarray, sr: int = 16000) -> Optional[np.ndarray]:
    """
    Extract a 256-d speaker embedding from mono audio at 16kHz.
    Returns None on failure.
    """
    try:
        from resemblyzer import preprocess_wav
        enc = get_encoder()
        wav = preprocess_wav(audio, source_sr=sr)
        if len(wav) < sr * 1.0:   # need at least 1 second
            return None
        embedding = enc.embed_utterance(wav)
        return embedding
    except Exception as e:
        logger.error(f"[Embedding] extract_embedding failed: {e}")
        return None


def extract_embedding_from_file(file_path: str) -> Optional[np.ndarray]:
    """Load a file and extract embedding."""
    try:
        from resemblyzer import preprocess_wav
        enc = get_encoder()
        wav = preprocess_wav(file_path)
        embedding = enc.embed_utterance(wav)
        return embedding
    except Exception as e:
        logger.error(f"[Embedding] extract_embedding_from_file failed: {e}")
        return None


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors."""
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def best_match_similarity(query: np.ndarray, stored: List[List[float]]) -> float:
    """
    Given a query embedding and a list of stored embeddings,
    return the highest cosine similarity score.
    """
    if not stored:
        return 0.0
    sims = [cosine_similarity(query, np.array(e)) for e in stored]
    return max(sims)


def average_embeddings(embeddings: List[np.ndarray]) -> np.ndarray:
    """Average multiple embeddings into one representative vector."""
    arr = np.stack(embeddings, axis=0)
    avg = np.mean(arr, axis=0)
    norm = np.linalg.norm(avg)
    if norm > 0:
        avg = avg / norm
    return avg
