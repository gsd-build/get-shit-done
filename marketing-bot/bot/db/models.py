"""
Database models for the AI Marketing Agent.

Tables:
    users          — Telegram users
    businesses     — Business projects (many per user)
    messages       — Conversation history per business
    subscriptions  — Payment & plan tracking
    reminders      — Scheduled reminder jobs
"""

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, ForeignKey,
    Integer, String, Text, JSON, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# ─── Enums ────────────────────────────────────────────────────────────────────

class BusinessLevel(str, enum.Enum):
    MICRO = "micro"      # 🟢 1–3 чел, до 500к/мес
    SMALL = "small"      # 🔵 5–20 чел, 500к–5млн/мес
    MEDIUM = "medium"    # 🟣 20–100 чел, 5–50млн/мес


class FlowStep(str, enum.Enum):
    """Steps of the agent flow."""
    ONBOARDING = "onboarding"       # Step 0: определение уровня
    PROFILE = "profile"             # Step 1: знакомство/брифинг
    AUDIT = "audit"                 # Step 2: чекап/аудит
    STRATEGY = "strategy"           # Step 3: стратегия
    CONTENT_PLAN = "content_plan"   # Step 4: контент-план
    GENERATION = "generation"       # Step 5: генерация
    CYCLE = "cycle"                 # Step 6: еженедельный цикл


class SubscriptionPlan(str, enum.Enum):
    FREE_TRIAL = "free_trial"
    MICRO = "micro"
    SMALL = "small"
    MEDIUM = "medium"
    PRO = "pro"           # до 3 проектов
    AGENCY = "agency"     # до 10 проектов


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # Telegram user_id
    username: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str] = mapped_column(String(128))
    last_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    language_code: Mapped[str] = mapped_column(String(8), default="ru")

    reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    reminder_day: Mapped[int] = mapped_column(Integer, default=1)    # 1=Mon, 7=Sun
    reminder_hour: Mapped[int] = mapped_column(Integer, default=10)  # UTC hour

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    businesses: Mapped[list["Business"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    @property
    def active_subscription(self) -> Optional["Subscription"]:
        for sub in self.subscriptions:
            if sub.status == SubscriptionStatus.ACTIVE:
                return sub
        return None

    @property
    def max_projects(self) -> int:
        sub = self.active_subscription
        if not sub:
            return 0
        limits = {
            SubscriptionPlan.MICRO: 1,
            SubscriptionPlan.SMALL: 1,
            SubscriptionPlan.MEDIUM: 1,
            SubscriptionPlan.PRO: 3,
            SubscriptionPlan.AGENCY: 10,
        }
        return limits.get(sub.plan, 0)


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(256))
    level: Mapped[Optional[BusinessLevel]] = mapped_column(Enum(BusinessLevel), nullable=True)
    current_step: Mapped[FlowStep] = mapped_column(Enum(FlowStep), default=FlowStep.ONBOARDING)

    # Профиль бизнеса — JSON-документ, накапливается в процессе диалога
    profile: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Утверждённые документы (после каждого шага)
    audit_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    strategy: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    content_plan: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Мета
    website_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    website_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # кэш парсинга

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # TTL: удалить через 6 мес после истечения подписки
    delete_after: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="businesses")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="business",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    """Full conversation history per business project."""
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16))     # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    step: Mapped[Optional[FlowStep]] = mapped_column(Enum(FlowStep), nullable=True)

    # Токены — для аналитики расходов
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    business: Mapped["Business"] = relationship(back_populates="messages")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    plan: Mapped[SubscriptionPlan] = mapped_column(Enum(SubscriptionPlan))
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.PENDING
    )

    # Платёж
    payment_id: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    amount_rub: Mapped[int] = mapped_column(Integer)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="subscriptions")
