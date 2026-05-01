from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB]

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.recordings.create_index("user_id")
    await db.recordings.create_index("created_at")
    await db.voice_profiles.create_index("user_id")
    print(f"[DB] Connected to MongoDB: {settings.MONGODB_DB}")


async def close_db():
    global client
    if client:
        client.close()


def get_db():
    return db
