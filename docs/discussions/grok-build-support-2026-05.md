# Grok Build + GSD Compatibility & Local Multi-Runtime Sync (May 2026)

**Date:** 2026-05-16  
**Status:** Discussion active on closed issue. Awaiting maintainer response.  
**Purpose of this document:** Serve as the primary context file for future Grok (or other) agent sessions started inside this repository (`/home/cristian/bum/get-shit-done`) so they can work on local Grok Build support and improved synchronization across multiple AI coding harnesses.

---

## 1. Executive Summary & Goals

**Goal:** Achieve reliable, first-class GSD support when using **Grok Build**, while maintaining excellent compatibility and low-friction synchronization across the four runtimes the author uses daily:

- Grok Build (current primary TUI)
- Claude Code
- Gemini CLI
- Codex

Currently, Grok Build is only supported via its Claude compatibility layer. This creates daily friction in paths, skill discovery, command surfaces, hooks, `grok inspect` output, and mental models.

**Long-term vision:**
- Run GSD natively and cleanly inside Grok Build.
- Maintain a single source of truth in this repository.
- Have a robust, automated (or semi-automated) sync mechanism that deploys adapted skills/agents/hooks to all four runtime environments (`~/.agents/`, `~/.claude/`, `~/.grok/`, Gemini location, Codex location).
- Keep the work clean enough that high-quality pieces can eventually be contributed upstream.

---

## 2. Current Multi-Runtime Setup (as of May 2026)

### Development Source (Single Source of Truth)
- **Path:** `/home/cristian/bum/get-shit-done` (this repo — your working fork of `gsd-build/get-shit-done`)

### Installed Locations
- `~/.agents/get-shit-done/` — Core workflows, references, templates, `gsd-tools.cjs`, `bin/`
- `~/.agents/skills/gsd-*` — ~125 skills (heavily GSD + many large reference skills like `userinterface-wiki`, `react-best-practices`, etc.)
- `~/.agents/agents/` — 22 GSD sub-agents (with `.md` + `.toml`)
- `~/.claude/skills/gsd-*` + `~/.claude/get-shit-done/` + `~/.claude/agents/` — Parallel Claude Code install (~208 skills total)
- `~/.grok/skills/` — Mostly empty (only the 7 official bundled Grok skills)
- `~/.grok/` — Not yet properly used by GSD

### Existing Sync Tooling
- `gsd-sync-skills` skill exists in `~/.agents/skills/gsd-sync-skills/`
- Its stated purpose: "Sync managed GSD skills across runtime roots so multi-runtime users stay aligned after an update"
- Currently uses a combination of manual processes + this skill.

### Codex-Style Adaptations Already in Use
- Many `gsd-*` skills in `~/.agents/skills/` contain a `<codex_skill_adapter>` section at the top.
- This adapter translates Claude Code patterns (`AskUserQuestion`, `Task()`) into Codex/Grok-compatible ones (`request_user_input`, `spawn_agent`).
- This pattern was developed because Grok Build / Codex use a different skill invocation and subagent model than Claude Code.

---

## 3. History & Prior Art

### Previous Upstream Attempt (May 2026)
- **Issue #3603**: "Add Grok Build (`--grok`) as a first-class runtime"
- **PR #3604** (by `lordgraysith`): Very large, high-quality implementation attempt.

The PR included:
- Full `--grok` installer support
- Conversion functions (`convertClaudeToGrokMarkdown`, `convertClaudeCommandToGrokSkill`, `convertClaudeAgentToGrokAgent`)
- JSON hook manifest generation for Grok
- Model catalog entries for Grok models
- `GROK_CONFIG_DIR` support
- Extensive tests and documentation
- A complete planning folder: `docs/grok-build-support/` containing 7 detailed documents:
  - 01-runtime-detection-and-config.md
  - 02-installer-logic.md
  - 03-model-catalog-and-profiles.md
  - 04-skills-agents-hooks-conversion.md
  - 05-documentation-and-user-experience.md
  - 06-testing-strategy.md
  - 07-phased-implementation-and-rollout.md

**Outcome:** Both issue and PR were closed the next day by `trek-e` as `not_planned`.

### Maintainer’s Position (Critical Context)
From `trek-e`’s detailed closing comment on #3603:

- **Biggest blockers right now:**
  - Grok Build is extremely new (launched May 14, 2026) and still in early beta. Hook events and config surface are unstable.
  - Strong desire to protect GSD’s reputation for stability ("vibe coded piece of junk" reputation risk).
  - Recent painful experience with Codex making breaking changes shortly after GSD stabilized something.
- **Price was clarified as low priority** ("honestly price is probably the lowest of the factors").
- **Claude-compat already works**, so native support is seen as polish rather than a must-have.
- **Process concern:** Implementation was done before the issue was properly approved.
- **Recommendation:** Revisit once Grok Build has stabilized (versioned config surface held for at least one minor release) **and** is reachable on a more realistic solo-dev price tier.

**Important:** The 7 planning documents in `docs/grok-build-support/` remain excellent reference material even if the code from that PR is not merged.

---

## 4. Recommended Work Plan for Future Grok Sessions in This Repo

When a new Grok session is started inside `/home/cristian/bum/get-shit-done`, it should follow something like this phased approach:

### Phase 0 — Orientation (Current Session Context)
- Read this document fully.
- Read the 7 files in `docs/grok-build-support/`.
- Explore the current local multi-runtime setup (see Section 2 above).
- Understand the existing `gsd-sync-skills` skill and any Codex adapters already present.

### Phase 1 — Audit Current State
- Map exactly what is installed where across `~/.agents/`, `~/.claude/`, `~/.grok/`, and Gemini/Codex locations.
- Identify duplication, drift, and friction points when using GSD in Grok Build today.
- Run `grok inspect` and analyze what it shows for GSD skills.
- Document gaps specific to Grok Build (command surface, hooks, `grok inspect` cleanliness, agent spawning, etc.).

### Phase 2 — Study Prior Art
- Deeply study the conversion specifications in `docs/grok-build-support/04-skills-agents-hooks-conversion.md`.
- Understand what a proper Grok `SKILL.md` should look like (frontmatter, description style, runtime hints).
- Understand Grok hook JSON manifest requirements.
- Review how the previous PR handled model catalog and runtime homes.
- Look for any existing local experiments or partial adapters in this fork.

### Phase 3 — Design Local Grok Adapter (MVP)
Design a practical local solution that works for **this user’s four-runtime reality**, not necessarily a full upstream `--grok` installer yet.

Possible components:
- A local Grok conversion layer (or extension of existing Codex adapters).
- Proper `gsd-*` skills under `~/.grok/skills/` with correct Grok frontmatter + `codex_skill_adapter` sections where needed.
- Grok-compatible agent definitions (`.md` + any required TOML/config).
- JSON hook manifests in `~/.grok/hooks/`.
- Updates to the sync mechanism (`gsd-sync-skills` or a new `gsd-multi-runtime-sync` tool) so one source can deploy cleanly to all four targets.

**Key principle:** Prefer extending/improving the existing sync tooling rather than creating yet another parallel install path.

### Phase 4 — Implementation & Testing
- Implement the MVP Grok adapter in this local fork.
- Create or enhance sync logic.
- Test end-to-end inside an actual Grok Build session:
  - `grok inspect` cleanliness
  - Command discovery (`/gsd-*` or Grok-native form)
  - Agent spawning
  - Hook firing
  - Full `gsd-new-project` → `gsd-progress` → `gsd-execute-phase` flow
- Verify no regression in Claude / Gemini / Codex usage.

### Phase 5 — Documentation & Future Upstream Path
- Update this discussion note and any relevant docs in the repo.
- Document the local sync architecture clearly.
- Identify which pieces of the local solution would be good candidates for upstream contribution later (when Grok Build is more mature).

---

## 5. Key Files & Areas to Study

**In this repo:**
- `docs/grok-build-support/` (all 7 documents — highest priority)
- `bin/install.js` (installer logic, especially runtime handling and conversion functions)
- `get-shit-done/bin/lib/runtime-homes.cjs`
- `get-shit-done/bin/lib/shell-command-projection.cjs` (hook projection)
- `sdk/shared/model-catalog.json`
- Existing `gsd-sync-skills` skill (in `~/.agents/skills/gsd-sync-skills/`)
- Any skills that already contain `<codex_skill_adapter>` sections (study the pattern)

**External / Prior Art:**
- The original PR #3604 (study the actual conversion code if accessible via the author’s fork)
- Grok Build documentation on skill format, agent format, and hook JSON manifests (as of the session date)

---

## 6. How to Test Grok Build Compatibility Locally

Useful commands and checks when working on this:

- `grok inspect` (and `grok inspect --json`) — check skill discovery, sources, and token counts.
- `grok` TUI inside a real project that uses GSD.
- Full workflow test: `/gsd-progress`, `/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase`, etc.
- Verify hooks fire correctly via Grok’s JSON hook system.
- Check that subagents (the 22 GSD agents in `~/.agents/agents/`) can be spawned from Grok.

---

## 7. Sync Strategy Principles (for Multi-Runtime)

When designing improvements to sync:

- Single source of truth = this repository (`/home/cristian/bum/get-shit-done`).
- Runtime-specific transformations should be as declarative and maintainable as possible.
- The `<codex_skill_adapter>` pattern is already proven for Grok/Codex — extend it rather than reinvent.
- Prefer generating the runtime-specific artifacts during sync rather than maintaining four separate copies.
- Make it easy to add a fifth runtime later if needed.

---

## 8. Open Questions & Decisions to Make (for Future Sessions)

- Should we aim for a full local `--grok` installer equivalent, or just excellent skill/agent/hook generation + sync?
- How much of the previous PR’s conversion logic can/should be reused locally?
- What is the right balance between “make Grok work great for me now” vs “keep it clean for potential upstream contribution”?
- Should the sync tool become a first-class GSD skill (`gsd-multi-runtime-sync` or similar)?
- How do we handle model profiles and agent routing differences for Grok models?

---

## 9. How to Resume This Work

When starting a new Grok session in this repository, begin by reading:

1. This file: `docs/discussions/grok-build-support-2026-05.md`
2. All files in `docs/grok-build-support/`
3. The existing `gsd-sync-skills` skill

Then follow the phased plan in Section 4.

---

**Last updated:** 2026-05-16 (by Grok, in this session)

---

## 10. Progress — May 2026 Session (Current)

### Audit Findings (Phase 1)
- **Version drift confirmed**: `~/.agents/get-shit-done/` (Grok Build primary) was on 1.38.4; `~/.claude/` on 1.42.2; `~/.codex/` and `~/.gemini/` on 1.41.2.
- `~/.agents/hooks/` was empty (no hooks active for Grok Build sessions).
- `grok inspect` successfully discovers 80+ `gsd-*` skills via the `~/.agents/skills/` layout + the existing `<codex_skill_adapter>` blocks.
- No `grok` or `agents` runtime existed in installer or sync logic.
- `~/.grok/` itself contains only the 7 official bundled skills; GSD lives entirely in the shared `~/.agents/` layout.

### Immediate Actions Taken
- **Engine drift fixed ASAP**: Backed up old `~/.agents/get-shit-done/` to `.backup-1.38.4/`, then rsynced the current source `get-shit-done/` tree into `~/.agents/get-shit-done/`. Now running the latest from this repo (v1.50.0-canary.0). New modules (active-workstream-store, adr-parser, etc.) and updated workflows are live for Grok Build sessions.
- **First-class 'grok' runtime added** (pragmatic choice: maps to `~/.agents/`):
  - [get-shit-done/bin/lib/runtime-homes.cjs](/home/cristian/bum/get-shit-done/get-shit-done/bin/lib/runtime-homes.cjs): Added `grok` case (honors `GROK_AGENTS_HOME` env, defaults to `~/.agents`).
  - [bin/install.js](/home/cristian/bum/get-shit-done/bin/install.js): Added `--grok` flag, `hasGrok`, `getDirName('grok') → '.agents'`, `getGlobalDir('grok')`, `getConfigDirFromHome`, inclusion in `--all` and help text. Reuses existing Codex conversion logic (skill adapters + agent .toml generation) because Grok Build uses the same invocation model.
  - [get-shit-done/workflows/sync-skills.md](/home/cristian/bum/get-shit-done/get-shit-done/workflows/sync-skills.md): Added `grok` to supported runtimes and the `--to all` list.
- Verified: `node bin/install.js --skills-root grok` correctly returns `~/.agents/skills`.

### Next Steps (for follow-up sessions)
- Full `gsd install --grok --global` end-to-end (hook projection, agent .toml generation with correct sandbox, skill wrapping with adapters, statusline, etc.). Currently the flag is recognized but some codex-specific install branches may need `|| runtime === 'grok'`.
- Run `gsd update --sync --from claude --to grok --apply` (or `--from grok --to claude`) once the runtime is fully wired, to keep the 4 harnesses in sync without manual rsync.
- Slim the `<codex_skill_adapter>` blocks (currently ~60 lines inlined in every gsd-* SKILL.md). Options: extract detailed mapping to a shared `@reference/codex-skill-adapter.md` that skills include, or make the adapter header shorter/optional for lower `grok inspect` token cost.
- Investigate Grok Build native hook support (JSON manifests under `~/.grok/hooks/` vs the shell hooks in `~/.agents/hooks/`).
- Update `grok inspect` output cleanliness (remove "unknown tool prefix: Skill(gsd:*)" warnings if possible via settings or skill manifest).
- Consider whether to also populate a native `~/.grok/skills/gsd-*` tree in addition to the working `.agents` layout.

This session delivered working `grok` runtime resolution + immediate version parity for the user's primary Grok Build harness.

---

**Last updated:** 2026-05-16 (by Grok, in this session)

This document is intended to be living. Update it as the local Grok Build work progresses.