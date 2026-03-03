# Milestones

## v1.23 Copilot CLI Support (Shipped: 2026-03-03)

**Phases completed:** 4 phases, 6 plans, 0 tasks

**Key accomplishments:**
- Added Copilot as 5th selectable runtime with CLI flags (`--copilot`), interactive prompt, and directory resolution (`.github/` local, `~/.copilot/` global)
- Built content conversion engine: 31 commands→skills, 11 agents→`.agent.md`, 13 tool mappings with deduplication, 4 path patterns + command name conversion
- Implemented `copilot-instructions.md` with marker-based smart merge/strip, full uninstall support, manifest hashing, and patch persistence
- Validated with 104 Copilot-specific tests (15 E2E with SHA256 integrity checks), 566 total tests passing
- Fixed local path mapping (`isGlobal` parameter across all converters) and YAML argument-hint quoting

**Stats:** 30 commits, 42 files, +10,425/-29 lines, 2 days (2026-03-02 → 2026-03-03)
**Git range:** `ca94bc9..91c3f93` on `feat/copilot-install`

---

