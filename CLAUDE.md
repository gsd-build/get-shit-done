## GitHub access

Use the configured GitHub CLI session for this checkout. Always pass
`--repo gsd-build/get-shit-done` on `gh` commands so issue and PR operations
stay scoped to the canonical repository.

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gsd-build/get-shit-done`). See `docs/agents/issue-tracker.md`.

### Triage labels

Custom label mapping: `confirmed` = AFK-agent-ready (bugs); `approved-enhancement` / `approved-feature` = human-ready (enhancements/features); `needs-reproduction` = waiting on reporter. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.
