"""Data access layer for User, Business, Message."""

from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bot.db.models import User, Business, Message, FlowStep
from bot.config import settings


# ─── User ─────────────────────────────────────────────────────────────────────

async def get_or_create_user(
    session: AsyncSession,
    telegram_id: int,
    first_name: str,
    last_name: Optional[str] = None,
    username: Optional[str] = None,
    language_code: str = "ru",
) -> User:
    result = await session.execute(select(User).where(User.id == telegram_id))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            id=telegram_id,
            first_name=first_name,
            last_name=last_name,
            username=username,
            language_code=language_code,
        )
        session.add(user)
        await session.flush()

    return user


# ─── Business ─────────────────────────────────────────────────────────────────

async def get_active_business(
    session: AsyncSession,
    user_id: int,
    business_id: int,
) -> Optional[Business]:
    """Load business with full message history."""
    result = await session.execute(
        select(Business)
        .where(Business.id == business_id, Business.user_id == user_id, Business.is_active == True)
        .options(selectinload(Business.messages))
    )
    return result.scalar_one_or_none()


async def get_user_businesses(
    session: AsyncSession,
    user_id: int,
) -> list[Business]:
    result = await session.execute(
        select(Business)
        .where(Business.user_id == user_id, Business.is_active == True)
        .order_by(Business.updated_at.desc())
    )
    return list(result.scalars().all())


async def create_business(
    session: AsyncSession,
    user_id: int,
    name: str,
) -> Business:
    business = Business(user_id=user_id, name=name)
    session.add(business)
    await session.flush()
    return business


async def advance_step(
    session: AsyncSession,
    business: Business,
    step: FlowStep,
) -> None:
    business.current_step = step
    await session.flush()


async def update_profile(
    session: AsyncSession,
    business: Business,
    profile_data: dict,
) -> None:
    existing = business.profile or {}
    existing.update(profile_data)
    business.profile = existing
    await session.flush()


async def save_document(
    session: AsyncSession,
    business: Business,
    doc_type: str,  # "audit_result" | "strategy" | "content_plan"
    data: dict,
) -> None:
    setattr(business, doc_type, data)
    await session.flush()


# ─── Messages ─────────────────────────────────────────────────────────────────

async def add_message(
    session: AsyncSession,
    business: Business,
    role: str,
    content: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
) -> Message:
    msg = Message(
        business_id=business.id,
        role=role,
        content=content,
        step=business.current_step,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    session.add(msg)
    await session.flush()

    # Keep in-memory list in sync to avoid re-querying
    if business.messages is not None:
        business.messages.append(msg)

    return msg


# ─── Data retention cleanup ───────────────────────────────────────────────────

async def mark_for_deletion(
    session: AsyncSession,
    user_id: int,
    days: int = None,
) -> None:
    """Mark all businesses of a user for deletion after N days."""
    if days is None:
        days = settings.data_retention_days

    delete_after = datetime.now(timezone.utc) + timedelta(days=days)
    await session.execute(
        update(Business)
        .where(Business.user_id == user_id, Business.is_active == True)
        .values(delete_after=delete_after)
    )


async def delete_user_data(
    session: AsyncSession,
    user_id: int,
) -> None:
    """Immediately delete all data for a user (GDPR/152-ФЗ request)."""
    result = await session.execute(
        select(Business).where(Business.user_id == user_id)
    )
    for business in result.scalars():
        await session.delete(business)

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        await session.delete(user)

    await session.flush()
