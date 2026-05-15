# Grok Build Support Plan

**Goal:** Add first-class support for [Grok Build](https://x.ai/cli) (xAI's TUI coding agent) as a GSD runtime, on par with Claude Code, OpenCode, Codex, Gemini CLI, Windsurf, and the other 14 supported CLIs.

**Current state (pre-plan):** GSD works for "most CLI AI coding tools" via shared workflows/agents + runtime-specific installation, frontmatter conversion, hook projection, model catalog entries, and docs. Grok Build is **not yet listed** in `SUPPORTED_RUNTIMES`, `bin/install.js`, `runtime-homes.cjs`, or the model catalog. However, because Grok Build has excellent Claude compatibility (reads `Claude.md`/`CLAUDE.md`/`AGENTS.md`, discovers `~/.claude/skills/`, supports similar subagent + skill concepts), a *partial* experience may already work for users who install with `--claude` while using `grok` as their driver. Full support requires native `.grok/` paths, Grok-flavored SKILL.md / agent frontmatter, hook JSON manifests, brand-neutral or Grok-aware prose, and Grok model tier mappings.

**Why now:** Grok Build TUI (v0.x as of 2026) has matured its skills (SKILL.md + YAML frontmatter), agents (`.grok/agents/`), project rules (AGENTS.md family), hooks (JSON lifecycle events), subagents, plan-mode, background tasks, and MCP/skill marketplace. GSD's 60+ skills + 30+ agents + guard hooks + stateful workflows are a natural fit and will differentiate Grok Build for complex, long-horizon projects.

**Scope of this plan:** Changes required in installer, SDK catalog, hook projection, content adaptation layer, documentation, and tests. No changes to core GSD orchestration or agent prompts themselves (they remain runtime-agnostic).

**Non-goals:** Re-architecture of the monolithic `bin/install.js`; full Grok-native hook JS runtime (we will shell out to the existing Node hooks); adding Grok-specific agents beyond the standard GSD set.

**Success criteria:**
- `npx get-shit-done-cc --grok --global` (and `--local`) succeeds and produces a working install under `~/.grok/` and `./.grok/`.
- All 6 core skills (`new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, `phase`, `help`) + standard profile are installed as `/gsd:*` slash commands.
- GSD agents appear as spawnable subagents under Grok's agent system.
- GSD hooks (guards, statusline, context monitor, update banner, etc.) fire via Grok's JSON hook config.
- `gsd-sdk query` and model resolution honor `runtime: grok` / `GSD_RUNTIME=grok` with sensible Grok model defaults (or null + overrides).
- `README.md`, `CLI-TOOLS.md`, `CONFIGURATION.md`, and per-language docs list Grok Build.
- Existing tests + new `grok-install.test.cjs` + runtime-gate tests pass.
- No regression for Claude / Codex / OpenCode installs.

**Key references:**
- Grok Build docs (local): `~/.grok/docs/user-guide/` (skills, hooks, project-rules, subagents, plan-mode).
- Current runtime matrix: `sdk/shared/model-catalog.json`.
- Installer surface: `bin/install.js` (11k LOC, getGlobalDir, per-runtime install* functions, conversion helpers, hook staging).
- CJS runtime homes: `get-shit-done/bin/lib/runtime-homes.cjs`.
- Hook projection: `get-shit-done/bin/lib/shell-command-projection.cjs`.
- Content sources: `commands/gsd/*.md`, `agents/*.md`, `hooks/*.js`, `templates/claude-md.md`.
- Tests: `tests/*install*.test.cjs`, `tests/windsurf-conversion.test.cjs`, `tests/trae-install.test.cjs`, `sdk/src/runtime-gate.test.ts`.

**Plan documents in this directory:**
- `01-runtime-detection-and-config.md` — adding the `grok` runtime identifier, env var, global/local paths.
- `02-installer-logic.md` — CLI flags, dispatch, per-runtime install/uninstall paths, manifest, skill staging.
- `03-model-catalog-and-profiles.md` — extending the JSON catalog, CJS/TS consumers, reasoning_effort (Grok may not need it).
- `04-skills-agents-hooks-conversion.md` — frontmatter transforms, path rewriting (`~/.claude/get-shit-done` → `~/.grok/get-shit-done`), brand substitution, Grok hook JSON generation, agent sandbox/permissions, AGENTS.md vs CLAUDE.md handling.
- `05-documentation-and-user-experience.md` — READMEs, CLI-TOOLS, CONFIGURATION (review.models.grok), manual-update, in-product help, first-run messaging.
- `06-testing-strategy.md` — new tests, parity gates, manual verification matrix, CI impact.
- `07-phased-implementation-and-rollout.md` — milestone breakdown, risk mitigation, back-compat, deprecation of compat shims.

**Estimated effort:** 3–5 engineering days for a full, tested implementation (heavy on the installer and conversion layer). One ADR + one PR (or stacked PRs) following the project's issue-driven + changeset process.

**Next step after review:** Create tracking issue in `gsd-build/get-shit-done`, label `approved-enhancement`, then execute via the implement skill or direct coding on the `grok-build` branch.

---
*This plan directory was created on the `grok-build` branch as the authoritative design artifact for the feature.*
