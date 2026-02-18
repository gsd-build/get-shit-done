.PHONY: up down run docker-up logs shell redis stop reset fresh install lint

# ─── Инфраструктура (без бота) ──────────────────────────────────────────────

up:
	docker compose up -d db redis
	@echo "⏳ Жду готовности PostgreSQL..."
	@sleep 3
	@echo "✅ PostgreSQL + Redis запущены"

down:
	docker compose down

stop:
	docker compose stop

reset:
	docker compose down -v
	@echo "✅ Тома удалены. Запусти: make docker-up"

fresh: reset docker-up

# ─── Бот локально (polling) ─────────────────────────────────────────────────

install:
	pip install -r requirements.txt

run: up
	DATABASE_URL=postgresql+asyncpg://bot:secret@localhost:5432/marketing_bot \
	REDIS_URL=redis://localhost:6379/0 \
	python -m bot.main

# ─── Бот в Docker (всё вместе) ──────────────────────────────────────────────

docker-up:
	docker compose up --build -d
	@echo "✅ Всё запущено. Логи: make logs"

docker-rebuild:
	docker compose up --build -d bot

# ─── Утилиты ────────────────────────────────────────────────────────────────

logs:
	docker compose logs -f bot

shell:
	docker compose exec db psql -U bot -d marketing_bot

redis:
	docker compose exec redis redis-cli

lint:
	python -m py_compile bot/**/*.py && echo "✅ OK"
