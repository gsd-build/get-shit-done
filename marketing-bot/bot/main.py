"""
Main entry point for the Telegram bot.

Supports two modes:
  - Polling  (development)
  - Webhook  (production)
"""

import asyncio
import logging
import traceback

import structlog
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.redis import RedisStorage
from aiogram.types import ErrorEvent
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web

from bot.config import settings
from bot.db import create_tables, async_session_factory
from bot.handlers import start, chat, callbacks
from bot.middlewares.db import DbSessionMiddleware

log = structlog.get_logger()


async def on_startup(bot: Bot) -> None:
    await create_tables()
    log.info("Database tables ready")

    if settings.is_production and settings.webhook_url:
        await bot.set_webhook(
            url=f"{settings.webhook_url}/webhook",
            secret_token=settings.webhook_secret,
        )
        log.info("Webhook set", url=settings.webhook_url)
    else:
        # Polling mode: clear any stale webhook so Telegram sends updates to us
        await bot.delete_webhook(drop_pending_updates=True)
        log.info("Webhook cleared, polling mode active")


async def on_shutdown(bot: Bot) -> None:
    if settings.is_production:
        await bot.delete_webhook()
    log.info("Bot stopped")


def create_bot() -> Bot:
    return Bot(
        token=settings.telegram_bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN),
    )


async def on_error(event: ErrorEvent) -> None:
    log.error(
        "Unhandled handler exception",
        update_type=event.update.event_type if event.update else "unknown",
        error=repr(event.exception),
        traceback=traceback.format_exc(),
    )


def create_dispatcher() -> Dispatcher:
    storage = RedisStorage.from_url(settings.redis_url)
    dp = Dispatcher(storage=storage)

    # Middleware — inject DB session into every handler
    dp.update.middleware(DbSessionMiddleware(session_factory=async_session_factory))

    # Routers
    dp.include_router(start.router)
    dp.include_router(callbacks.router)
    dp.include_router(chat.router)

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)
    dp.errors.register(on_error)

    return dp


async def run_polling() -> None:
    """Development mode."""
    bot = create_bot()
    dp = create_dispatcher()
    log.info("Starting bot in polling mode")
    await dp.start_polling(bot, allowed_updates=["message", "callback_query"])


def run_webhook() -> None:
    """Production mode."""
    bot = create_bot()
    dp = create_dispatcher()

    app = web.Application()
    SimpleRequestHandler(
        dispatcher=dp,
        bot=bot,
        secret_token=settings.webhook_secret,
    ).register(app, path="/webhook")
    setup_application(app, dp, bot=bot)

    log.info("Starting bot in webhook mode", port=8080)
    web.run_app(app, host="0.0.0.0", port=8080)


if __name__ == "__main__":
    logging.basicConfig(level=settings.log_level)
    if settings.is_production:
        run_webhook()
    else:
        asyncio.run(run_polling())
