from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from bot.config import settings

engine = create_async_engine(
    settings.database_url,
    pool_size=settings.database_pool_size,
    echo=not settings.is_production,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session


async def create_tables() -> None:
    from bot.db.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
