"""Inline keyboard callback handlers."""

from aiogram import Router, F
from aiogram.types import CallbackQuery
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession

from bot.db.repositories.business import (
    get_active_business,
    get_user_businesses,
    delete_user_data,
)
from bot.db.models import User
from bot.handlers.states import ChatState
from bot.keyboards.inline import projects_keyboard, settings_keyboard

router = Router()


@router.callback_query(F.data.startswith("project:"))
async def on_project_select(callback: CallbackQuery, state: FSMContext, session: AsyncSession) -> None:
    business_id = int(callback.data.split(":")[1])
    business = await get_active_business(session, callback.from_user.id, business_id)

    if not business:
        await callback.answer("Проект не найден", show_alert=True)
        return

    await state.set_state(ChatState.active)
    await state.update_data(business_id=business.id)

    from bot.db.models import FlowStep
    step_labels = {
        FlowStep.ONBOARDING: "Начало — определение уровня",
        FlowStep.PROFILE: "Шаг 1 — Знакомство",
        FlowStep.AUDIT: "Шаг 2 — Чекап",
        FlowStep.STRATEGY: "Шаг 3 — Стратегия",
        FlowStep.CONTENT_PLAN: "Шаг 4 — Контент-план",
        FlowStep.GENERATION: "Шаг 5 — Генерация",
        FlowStep.CYCLE: "Шаг 6 — Цикл",
    }
    current = step_labels.get(business.current_step, "")

    await callback.message.edit_text(
        f"✅ Проект: **{business.name}**\n"
        f"📍 Текущий шаг: {current}\n\n"
        "Продолжаем! Напиши что угодно.",
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "new_project")
async def on_new_project(callback: CallbackQuery, state: FSMContext, session: AsyncSession) -> None:
    from bot.handlers.states import OnboardingState
    from sqlalchemy import select
    from bot.db.models import User

    result = await session.execute(select(User).where(User.id == callback.from_user.id))
    user = result.scalar_one_or_none()

    if not user:
        await callback.answer("Сначала напиши /start")
        return

    businesses = await get_user_businesses(session, user.id)
    if len(businesses) >= user.max_projects:
        await callback.answer(
            f"Лимит проектов ({user.max_projects}) достигнут. Перейди на тариф Про.",
            show_alert=True,
        )
        return

    await state.set_state(OnboardingState.waiting_for_level_answers)
    await callback.message.edit_text(
        "Создаём новый проект!\n\n"
        "1️⃣ Сколько человек работает в компании?\n"
        "2️⃣ Есть ли выделенный маркетолог или отдел маркетинга?\n"
        "3️⃣ Какой примерный месячный оборот?"
    )
    await callback.answer()


@router.callback_query(F.data == "toggle_reminders")
async def on_toggle_reminders(callback: CallbackQuery, session: AsyncSession) -> None:
    from sqlalchemy import select
    result = await session.execute(select(User).where(User.id == callback.from_user.id))
    user = result.scalar_one_or_none()

    if user:
        user.reminders_enabled = not user.reminders_enabled
        await session.commit()
        status = "включены ✅" if user.reminders_enabled else "выключены ❌"
        await callback.message.edit_text(
            f"⚙️ **Настройки**\n\nНапоминания: {status}",
            reply_markup=settings_keyboard(user),
            parse_mode="Markdown",
        )
    await callback.answer()


@router.callback_query(F.data == "request_delete")
async def on_request_delete(callback: CallbackQuery) -> None:
    from bot.keyboards.inline import confirm_delete_keyboard
    await callback.message.edit_text(
        "⚠️ **Удаление данных**\n\n"
        "Будут удалены все твои проекты, переписка и документы.\n"
        "Это необратимо.\n\n"
        "Подтвердить?",
        reply_markup=confirm_delete_keyboard(),
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "confirm_delete")
async def on_confirm_delete(callback: CallbackQuery, state: FSMContext, session: AsyncSession) -> None:
    await delete_user_data(session, callback.from_user.id)
    await session.commit()
    await state.clear()
    await callback.message.edit_text(
        "✅ Все данные удалены. Если захочешь вернуться — напиши /start."
    )
    await callback.answer()


@router.callback_query(F.data == "cancel")
async def on_cancel(callback: CallbackQuery) -> None:
    await callback.message.delete()
    await callback.answer("Отменено")
