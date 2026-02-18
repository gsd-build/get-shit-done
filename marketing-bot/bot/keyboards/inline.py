from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

from bot.db.models import Business, User, BusinessLevel

LEVEL_EMOJI = {
    BusinessLevel.MICRO: "🟢",
    BusinessLevel.SMALL: "🔵",
    BusinessLevel.MEDIUM: "🟣",
}


def projects_keyboard(businesses: list[Business]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for b in businesses:
        emoji = LEVEL_EMOJI.get(b.level, "⚪️")
        builder.button(
            text=f"{emoji} {b.name}",
            callback_data=f"project:{b.id}",
        )
    builder.button(text="➕ Новый проект", callback_data="new_project")
    builder.adjust(1)
    return builder.as_markup()


def new_project_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="➕ Создать проект", callback_data="new_project")
    return builder.as_markup()


def confirm_delete_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="❌ Да, удалить всё", callback_data="confirm_delete")
    builder.button(text="Отмена", callback_data="cancel")
    builder.adjust(1)
    return builder.as_markup()


def settings_keyboard(user: User) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    reminder_label = (
        "🔔 Выключить напоминания" if user.reminders_enabled
        else "🔕 Включить напоминания"
    )
    builder.button(text=reminder_label, callback_data="toggle_reminders")
    builder.button(text="🗑 Удалить мои данные", callback_data="request_delete")
    builder.adjust(1)
    return builder.as_markup()
