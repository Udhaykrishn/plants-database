from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Check if we are using Neon (usually has neon.tech in host)
connect_args = {}
if "neon.tech" in str(settings.SQLALCHEMY_DATABASE_URI):
    connect_args["ssl"] = True

_env = (settings.ENVIRONMENT or "development").lower()
_is_prod = _env in ("production", "prod")

engine = create_async_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),
    echo=not _is_prod,
    future=True,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
