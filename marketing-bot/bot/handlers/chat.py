"""
Main chat handler — routes user messages to Claude and streams the response.

Reads the active business from FSM state, builds context, calls Claude,
saves both user message and assistant response to DB.
"""

import re
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession

from bot.handlers.states import ChatState, OnboardingState
from bot.db.repositories.business import (
    get_active_business,
    get_or_create_user,
    create_business,
    add_message,
    update_profile,
)
from bot.services.claude import chat as claude_chat
from bot.services.scraper import scrape
from bot.db.models import BusinessLevel, FlowStep

router = Router()

URL_RE = re.compile(r"https?://[^\s]+|www\.[^\s]+")


async def _handle_url_in_message(text: str, business, session: AsyncSession) -> str:
    """If user sent a URL, scrape it and attach to business. Return notification."""
    urls = URL_RE.findall(text)
    if not urls or business.website_content:
        return ""

    url = urls[0]
    content = await scrape(url)
    business.website_url = url
    business.website_content = content
    await session.flush()
    return f"\n\n_(Я прочитал содержимое сайта {url} и учту его в работе)_"


@router.message(ChatState.active)
async def handle_chat_message(message: Message, state: FSMContext, session: AsyncSession) -> None:
    data = await state.get_data()
    business_id = data.get("business_id")

    if not business_id:
        await message.answer("Выбери проект командой /projects")
        return

    business = await get_active_business(session, message.from_user.id, business_id)
    if not business:
        await message.answer("Проект не найден. Выбери снова: /projects")
        await state.clear()
        return

    user_text = message.text or ""

    # Handle URL scraping in background
    url_notice = await _handle_url_in_message(user_text, business, session)

    # Save user message
    await add_message(session, business, "user", user_text)

    # Show typing indicator
    await message.bot.send_chat_action(message.chat.id, "typing")

    # Call Claude
    response_text, input_tokens, output_tokens = await claude_chat(business, user_text)

    # Save assistant response
    await add_message(
        session, business, "assistant", response_text,
        input_tokens=input_tokens, output_tokens=output_tokens,
    )

    await session.commit()

    # Send response (split if > 4096 chars for Telegram)
    full_response = response_text + url_notice
    for chunk in _split_message(full_response):
        await message.answer(chunk, parse_mode="Markdown")


def _split_message(text: str, max_len: int = 4000) -> list[str]:
    """Split long messages into Telegram-safe chunks."""
    if len(text) <= max_len:
        return [text]
    chunks = []
    while text:
        chunks.append(text[:max_len])
        text = text[max_len:]
    return chunks


# ─── Onboarding flow ──────────────────────────────────────────────────────────

@router.message(OnboardingState.waiting_for_level_answers)
async def handle_onboarding_answers(
    message: Message, state: FSMContext, session: AsyncSession
) -> None:
    """
    User answered the 3 onboarding questions.
    Claude determines the business level and asks for confirmation.
    """
    user = await get_or_create_user(session, message.from_user.id, message.from_user.first_name)

    # Create a temporary business placeholder
    business = await create_business(session, user.id, f"Проект {message.from_user.first_name}")
    await session.commit()

    # Save user's answer
    await add_message(session, business, "user", message.text)

    await message.bot.send_chat_action(message.chat.id, "typing")

    # Claude determines the level
    from bot.services.claude import chat as claude_chat
    response, in_tok, out_tok = await claude_chat(business, message.text)

    await add_message(session, business, "assistant", response, in_tok, out_tok)
    await session.commit()

    # Move to confirmation state
    await state.set_state(OnboardingState.waiting_for_level_confirmation)
    await state.update_data(business_id=business.id)

    await message.answer(response, parse_mode="Markdown")


@router.message(OnboardingState.waiting_for_level_confirmation)
async def handle_level_confirmation(
    message: Message, state: FSMContext, session: AsyncSession
) -> None:
    """User confirms or corrects the level."""
    data = await state.get_data()
    business_id = data.get("business_id")
    business = await get_active_business(session, message.from_user.id, business_id)

    if not business:
        await state.clear()
        return

    # Detect level from user's confirmation
    text_lower = message.text.lower()
    level = None
    if any(w in text_lower for w in ["микро", "micro", "да", "верно", "правильно"]):
        level = BusinessLevel.MICRO
    elif any(w in text_lower for w in ["малый", "малого", "small"]):
        level = BusinessLevel.SMALL
    elif any(w in text_lower for w in ["средний", "среднего", "medium"]):
        level = BusinessLevel.MEDIUM

    await add_message(session, business, "user", message.text)

    if level:
        business.level = level
        business.current_step = FlowStep.PROFILE
        await session.commit()

        # Transition to active chat
        await state.set_state(ChatState.active)
        await state.update_data(business_id=business.id)

        # Get first question for profile step from Claude
        from bot.services.claude import chat as claude_chat
        greeting = f"Отлично, уровень подтверждён. Переходим к знакомству."
        response, in_tok, out_tok = await claude_chat(business, greeting)
        await add_message(session, business, "assistant", response, in_tok, out_tok)
        await session.commit()

        await message.answer(response, parse_mode="Markdown")
    else:
        # Let Claude handle ambiguous confirmation
        from bot.services.claude import chat as claude_chat
        response, in_tok, out_tok = await claude_chat(business, message.text)
        await add_message(session, business, "assistant", response, in_tok, out_tok)
        await session.commit()
        await message.answer(response, parse_mode="Markdown")
