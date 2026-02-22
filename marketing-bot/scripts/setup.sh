#!/bin/bash
# Первичная настройка проекта на новой машине
set -e

echo "🤖 Настройка AI Marketing Bot"
echo "================================"

# 1. Создать .env из примера
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Создан файл .env"
else
    echo "ℹ️  .env уже существует, пропускаю"
fi

# 2. Запросить токены
echo ""
echo "Введи токен Telegram бота (от @BotFather):"
read -r TG_TOKEN
echo ""
echo "Введи Anthropic API key (console.anthropic.com):"
read -r ANTHROPIC_KEY

# Вставить в .env
sed -i "s|TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TG_TOKEN|" .env
sed -i "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" .env

echo ""
echo "✅ Токены сохранены в .env"

# 3. Проверить Docker
echo ""
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker не запущен. Запусти Docker Desktop или dockerd и повтори."
    exit 1
fi
echo "✅ Docker работает"

# 4. Поднять инфраструктуру
echo ""
echo "⏳ Запускаю PostgreSQL + Redis..."
docker compose up -d db redis

echo "⏳ Жду готовности БД (10 сек)..."
sleep 10

echo ""
echo "✅ Готово! Запускай бота:"
echo ""
echo "  Вариант А — в Docker (рекомендую):"
echo "    make docker-up"
echo "    make logs"
echo ""
echo "  Вариант Б — локально (нужен Python 3.11+):"
echo "    pip install -r requirements-dev.txt"
echo "    make run"
echo ""
