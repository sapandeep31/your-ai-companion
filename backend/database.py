import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is not set. "
        "Please create a .env file based on .env.example with your PostgreSQL connection string."
    )

# Convert to asyncpg scheme for AsyncEngine
if DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    if "sslmode=require" in ASYNC_DATABASE_URL:
        ASYNC_DATABASE_URL = ASYNC_DATABASE_URL.replace("sslmode=require", "ssl=require")
elif DATABASE_URL.startswith("postgres://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    if "sslmode=require" in ASYNC_DATABASE_URL:
        ASYNC_DATABASE_URL = ASYNC_DATABASE_URL.replace("sslmode=require", "ssl=require")
else:
    ASYNC_DATABASE_URL = DATABASE_URL

Base = declarative_base()

async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

def init_sync_db():
    sync_engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(bind=sync_engine)
