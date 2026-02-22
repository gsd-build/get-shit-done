FROM python:3.12-slim-bookworm

WORKDIR /app

# System deps for lxml + Playwright Chromium on Debian Bookworm
# Installing chromium deps manually so we control the package list
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libxml2-dev \
    libxslt-dev \
    curl \
    # Chromium system dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install only the browser binary (deps already installed above)
RUN playwright install chromium

COPY . .

# Run as non-root
RUN useradd -m botuser
USER botuser

CMD ["python", "-m", "bot.main"]
