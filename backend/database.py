from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB]

    # Existing indexes
    await db.users.create_index("email", unique=True)
    await db.recordings.create_index("user_id")
    await db.recordings.create_index("created_at")
    await db.voice_profiles.create_index("user_id")

    # Session management indexes
    await db.sessions.create_index("session_id", unique=True)
    await db.sessions.create_index("user_id")
    await db.sessions.create_index("refresh_token_hash")
    # TTL index — MongoDB auto-deletes expired sessions
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)

    # Login rate-limiting index (TTL auto-cleans old attempt windows)
    await db.login_attempts.create_index("ip_address")
    await db.login_attempts.create_index("email")
    await db.login_attempts.create_index(
        "created_at", expireAfterSeconds=settings.RATE_LIMIT_LOGIN_WINDOW_SECONDS
    )

    # Minutes of Meeting indexes
    await db.minutes_of_meeting.create_index("recording_id")
    await db.minutes_of_meeting.create_index("user_id")

    print(f"[DB] Connected to MongoDB: {settings.MONGODB_DB}")


async def close_db():
    global client
    if client:
        client.close()


def get_db():
    return db
