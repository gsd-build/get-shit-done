"""
/start handler — entry point for new users.

Flow:
1. Create or load user from DB
2. If user has businesses → show project selector
3. If no businesses → initiate onboarding (Step 0)
"""

from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from sqlalchemy.ext.asyncio import AsyncSession

from bot.db.repositories.business import get_or_create_user, get_user_businesses, create_business
from bot.keyboards.inline import projects_keyboard, new_project_keyboard
from bot.handlers.states import OnboardingState

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message, session: AsyncSession, state: FSMContext) -> None:
    user = await get_or_create_user(
        session,
        telegram_id=message.from_user.id,
        first_name=message.from_user.first_name,
        last_name=message.from_user.last_name,
        username=message.from_user.username,
        language_code=message.from_user.language_code or "ru",
    )
    await session.commit()

    businesses = await get_user_businesses(session, user.id)

    if not businesses:
        await state.set_state(OnboardingState.waiting_for_level_answers)
        await message.answer(
            "Привет! Я — твой ИИ-маркетолог. 👋\n\n"
            "Прежде чем начать, мне нужно понять твой бизнес. "
            "Ответь на три вопроса:\n\n"
            "1️⃣ Сколько человек работает в компании?\n"
            "2️⃣ Есть ли у вас выделенный маркетолог или отдел маркетинга?\n"
            "3️⃣ Какой примерный месячный оборот?\n\n"
            "Можешь отвечать в свободной форме — я разберусь."
        )
    else:
        keyboard = projects_keyboard(businesses)
        await message.answer(
            f"С возвращением, {message.from_user.first_name}! 👋\n\n"
            "Выбери проект, с которым продолжим работу:",
            reply_markup=keyboard,
        )


@router.message(Command("new_project"))
async def cmd_new_project(message: Message, session: AsyncSession, state: FSMContext) -> None:
    user = await get_or_create_user(
        session,
        telegram_id=message.from_user.id,
        first_name=message.from_user.first_name,
    )
    businesses = await get_user_businesses(session, user.id)

    if len(businesses) >= user.max_projects:
        await message.answer(
            "❌ Достигнут лимит проектов на вашем тарифе.\n\n"
            f"Текущий лимит: {user.max_projects} проект(а).\n"
            "Перейди на тариф **Про** чтобы добавить больше проектов.",
            parse_mode="Markdown",
        )
        return

    await state.set_state(OnboardingState.waiting_for_level_answers)
    await message.answer(
        "Создаём новый проект. Расскажи мне о нём.\n\n"
        "1️⃣ Сколько человек работает в компании?\n"
        "2️⃣ Есть ли выделенный маркетолог или отдел маркетинга?\n"
        "3️⃣ Какой примерный месячный оборот?"
    )


@router.message(Command("projects"))
async def cmd_projects(message: Message, session: AsyncSession) -> None:
    businesses = await get_user_businesses(session, message.from_user.id)
    if not businesses:
        await message.answer("У тебя пока нет проектов. Напиши /start чтобы создать первый.")
        return

    keyboard = projects_keyboard(businesses)
    await message.answer("Твои проекты:", reply_markup=keyboard)


@router.message(Command("delete_data"))
async def cmd_delete_data(message: Message) -> None:
    from bot.keyboards.inline import confirm_delete_keyboard
    await message.answer(
        "⚠️ Ты запрашиваешь удаление всех твоих данных.\n\n"
        "Будут удалены: все проекты, вся переписка, все документы.\n"
        "Это действие необратимо.\n\n"
        "Подтверди удаление:",
        reply_markup=confirm_delete_keyboard(),
    )


@router.message(Command("settings"))
async def cmd_settings(message: Message, session: AsyncSession) -> None:
    from bot.keyboards.inline import settings_keyboard
    user = await get_or_create_user(session, message.from_user.id, message.from_user.first_name)
    await message.answer(
        "⚙️ **Настройки**\n\n"
        f"Напоминания: {'✅ включены' if user.reminders_enabled else '❌ выключены'}",
        reply_markup=settings_keyboard(user),
        parse_mode="Markdown",
    )
