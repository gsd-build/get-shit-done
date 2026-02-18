"""
Website scraper service.

Strategy:
1. Try fast BeautifulSoup scraping (most sites)
2. Fallback to Playwright for JS-heavy SPAs

Returns cleaned text suitable for injecting into the agent context.
"""

import re
import asyncio
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup


MAX_CONTENT_LENGTH = 8000  # chars — enough context, not too many tokens

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; MarketingBotScraper/1.0; "
        "+https://yourdomain.ru/bot)"
    )
}


def _clean_text(text: str) -> str:
    """Remove excessive whitespace and empty lines."""
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _extract_main_content(html: str, url: str) -> str:
    """Parse HTML and extract meaningful text, skipping nav/footer/scripts."""
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    # Priority: main/article content
    main = soup.find("main") or soup.find("article") or soup.body

    if main:
        text = main.get_text(separator="\n")
    else:
        text = soup.get_text(separator="\n")

    # Also grab meta description for summary
    meta_desc = ""
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        meta_desc = f"Описание сайта: {meta['content']}\n\n"

    # Page title
    title = ""
    if soup.title:
        title = f"Заголовок страницы: {soup.title.string}\n\n"

    combined = title + meta_desc + _clean_text(text)
    return combined[:MAX_CONTENT_LENGTH]


async def scrape_fast(url: str) -> str | None:
    """HTTP-only scraping with httpx. Fast and cheap."""
    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            timeout=15,
            follow_redirects=True,
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            return _extract_main_content(response.text, url)
    except Exception:
        return None


async def scrape_with_playwright(url: str) -> str | None:
    """JS-rendering fallback using Playwright."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(extra_http_headers=HEADERS)
            await page.goto(url, timeout=20000, wait_until="networkidle")
            html = await page.content()
            await browser.close()
            return _extract_main_content(html, url)
    except Exception:
        return None


async def scrape(url: str) -> str:
    """
    Main entry point. Try fast scraping first, fall back to Playwright.
    Returns extracted text or an error message.
    """
    parsed = urlparse(url)
    if not parsed.scheme:
        url = "https://" + url

    content = await scrape_fast(url)
    if content and len(content) > 200:
        return content

    content = await scrape_with_playwright(url)
    if content and len(content) > 200:
        return content

    return f"Не удалось извлечь содержимое сайта {url}. Возможно, сайт защищён от парсинга."
