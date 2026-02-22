## Запуск бота (local dev)

### 1. Создать .env
```bash
cp .env.example .env
# Затем вписать в .env:
# TELEGRAM_BOT_TOKEN=...
# ANTHROPIC_API_KEY=...
```

### 2. Запустить
```bash
make up        # поднять PostgreSQL + Redis
make run       # запустить бота (polling)
```

Или всё в одном контейнере:
```bash
make docker-up
```

### Полезные команды
```bash
make logs      # логи бота
make shell     # psql в базу
make redis     # redis-cli
make stop      # остановить всё
make reset     # полный сброс (УДАЛИТ данные)
```
