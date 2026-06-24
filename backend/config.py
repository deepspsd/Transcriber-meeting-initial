from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "voicesum"

    # JWT — Access token (short-lived, in-memory on client)
    JWT_SECRET: str = "change-me-in-production-use-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 15  # 15 minutes — refresh token extends session

    # Refresh token (long-lived, HttpOnly cookie)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Environment ("development" | "production") — controls Secure cookie flag
    ENVIRONMENT: str = "development"

    # Rate limiting — login endpoint
    RATE_LIMIT_LOGIN_MAX: int = 5          # max failed attempts
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 300  # 5-minute window
    ACCOUNT_LOCKOUT_SECONDS: int = 900     # 15-minute lockout after max attempts

    # Groq LLM
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    # HuggingFace (optional — enables pyannote diarization)
    HF_TOKEN: Optional[str] = ""

    # Audio storage
    UPLOAD_DIR: str = "uploads"

    # Speaker identification
    SPEAKER_SIMILARITY_THRESHOLD: float = 0.65
    MIN_SEGMENT_DURATION: float = 1.5  # seconds

    # Transcription
    WHISPER_MODEL_SIZE: str = "medium"
    WHISPER_DEVICE: str = "auto"  # "cuda", "cpu", "auto"
    WHISPER_COMPUTE_TYPE: str = "int8"

    # Word confidence thresholds
    WORD_CONF_LOW: float = 0.7
    WORD_CONF_MID: float = 0.85

    # Overlap detection model (Wav2Vec2-based binary classifier)
    OVERLAP_MODEL_PATH: str = "C:\\Users\\vikas\\Downloads\\overlap_model.pth"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
