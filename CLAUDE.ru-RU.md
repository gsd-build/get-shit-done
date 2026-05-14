<!-- Это перевод. Рабочий файл, который читает Claude Code, — CLAUDE.md (на английском). -->

## Доступ к GitHub

Используй настроенную сессию GitHub CLI для этого чекаута. Всегда передавай
`--repo gsd-build/get-shit-done` в командах `gh`, чтобы операции с issue и PR
оставались в рамках канонического репозитория.

---

## Скиллы агента

### Трекер задач

Issues живут в GitHub Issues (`gsd-build/get-shit-done`). См. `docs/agents/issue-tracker.md`.

### Triage-лейблы

Кастомная разметка лейблов: `confirmed` = готово для AFK-агента (баги); `approved-enhancement` / `approved-feature` = готово для человека (улучшения/фичи); `needs-reproduction` = ждёт ответа от репортёра. См. `docs/agents/triage-labels.md`.

### Доменные доки

Single-context репозиторий — `CONTEXT.md` + `docs/adr/` в корне. См. `docs/agents/domain.md`.
