FROM python:3.12-slim

WORKDIR /app

# System deps for Playwright + lxml
RUN apt-get update && apt-get install -y \
    gcc \
    libxml2-dev \
    libxslt-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser (chromium only)
RUN playwright install chromium --with-deps

COPY . .

# Run as non-root
RUN useradd -m botuser
USER botuser

CMD ["python", "-m", "bot.main"]
