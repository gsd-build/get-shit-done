"""
Claude API service — the brain of the marketing agent.

Manages:
- Building conversation context from DB history
- Sending requests to Claude with the right system prompt
- Tracking token usage
- Retry logic with exponential backoff
"""

import asyncio
from typing import AsyncGenerator

import anthropic
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from bot.config import settings
from bot.agent.prompts import get_system_prompt
from bot.db.models import Business, Message


# Max messages to include in context window (to control costs)
MAX_CONTEXT_MESSAGES = 40

client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


def _build_context_messages(business: Business) -> list[dict]:
    """
    Build the messages array for the Claude API from the business's
    conversation history. Trims to MAX_CONTEXT_MESSAGES to control costs.
    """
    messages = business.messages[-MAX_CONTEXT_MESSAGES:]
    return [{"role": msg.role, "content": msg.content} for msg in messages]


def _build_system_prompt(business: Business) -> str:
    """
    Build the full system prompt with injected business context.
    This way the model always has the latest profile data, even mid-conversation.
    """
    level = business.level.value if business.level else None
    step = business.current_step.value

    base = get_system_prompt(level, step)

    # Inject current business profile as context
    context_parts = []

    if business.profile:
        import json
        context_parts.append(
            f"## Текущий профиль бизнеса\n```json\n{json.dumps(business.profile, ensure_ascii=False, indent=2)}\n```"
        )

    if business.audit_result:
        import json
        context_parts.append(
            f"## Утверждённый чекап\n```json\n{json.dumps(business.audit_result, ensure_ascii=False, indent=2)}\n```"
        )

    if business.strategy:
        import json
        context_parts.append(
            f"## Утверждённая стратегия\n```json\n{json.dumps(business.strategy, ensure_ascii=False, indent=2)}\n```"
        )

    if business.website_content:
        # Only include a trimmed preview of scraped content
        preview = business.website_content[:2000]
        context_parts.append(f"## Содержимое сайта (извлечено автоматически)\n{preview}")

    if context_parts:
        base += "\n\n---\n\n" + "\n\n".join(context_parts)

    return base


@retry(
    retry=retry_if_exception_type((anthropic.APIConnectionError, anthropic.RateLimitError)),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(4),
)
async def chat(
    business: Business,
    user_message: str,
) -> tuple[str, int, int]:
    """
    Send a message to Claude and get a response.

    Returns:
        (response_text, input_tokens, output_tokens)
    """
    system_prompt = _build_system_prompt(business)
    messages = _build_context_messages(business)

    # Append the current user message
    messages.append({"role": "user", "content": user_message})

    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    )

    text = response.content[0].text
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens

    return text, input_tokens, output_tokens


async def chat_stream(
    business: Business,
    user_message: str,
) -> AsyncGenerator[str, None]:
    """
    Streaming version — yields text chunks as they arrive.
    Used for long responses (strategy, content plan) to show typing effect.
    """
    system_prompt = _build_system_prompt(business)
    messages = _build_context_messages(business)
    messages.append({"role": "user", "content": user_message})

    async with client.messages.stream(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
