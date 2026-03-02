# GSDD (Get Shit Done Distilled)

Lightweight Spec-Driven Development (SDD) for AI-assisted engineering.

Distilled from GSD (Get Shit Done): keep rigor and leverage, drop ceremony.

## What This Is

GSDD is a small set of workflow sources plus a CLI (`gsdd`) that:
- scaffolds a project planning workspace (`.planning/`)
- generates portable workflow entrypoints as skills (`.agents/skills/gsdd-*/SKILL.md`)
- optionally generates tool-specific adapters (Codex `.codex/AGENTS.md`, root `AGENTS.md`, Claude skills, OpenCode commands)

## Quick Start

Run in your project root:
```bash
npx gsdd init
```

Optional adapters:
```bash
npx gsdd init --tools claude
npx gsdd init --tools codex
npx gsdd init --tools agents
npx gsdd init --tools all
```

Notes:
- `gsdd init` always generates open-standard skills at `.agents/skills/gsdd-*`.
- Root `AGENTS.md` is only written when explicitly requested (`--tools agents` or `--tools all`).

## The Workflow

```
gsdd init           -> bootstrap (create .planning/, copy templates, generate skills/adapters)
/gsdd:new-project   -> SPEC.md + ROADMAP.md  (questioning + codebase audit + research)
/gsdd:plan N        -> phases/N/PLAN.md      (task breakdown + research)
/gsdd:execute N     -> atomic commits        (plan execution with quality gates)
/gsdd:verify N      -> VERIFICATION.md       (goal-backward validation)
  ... repeat plan/execute/verify per phase ...
/gsdd:complete      -> archive milestone, evolve SPEC.md
/gsdd:milestone     -> new ROADMAP.md for next milestone
```

## Current Status (updated 2026-03-01)

| Workflow | Status | Notes |
|----------|--------|-------|
| `new-project.md` | ✅ Defined, source-audited | Covers greenfield + brownfield + milestone context |
| `plan.md` | ⚠️ Stub — not audited | Audit against `get-shit-done/workflows/plan-phase.md` next |
| `execute.md` | ⚠️ Stub — not audited | Audit against `get-shit-done/workflows/execute-phase.md` |
| `verify.md` | ⚠️ Stub — not audited | Audit against `get-shit-done/workflows/verify-phase.md` |
| `gsdd remap` | ❌ Not defined | Phase 2 — selective codebase re-mapping (Refresh/Update/Skip) |

## Init Workflow Agent Count (by config)

| Mode | Mappers | Researchers | Synthesizer | Total |
|------|---------|-------------|-------------|-------|
| Brownfield, first run, research balanced/deep | 4 | 4 | 1 | 9 |
| Brownfield, first run, research fast | 4 | 4 | 0 (inline) | 8 |
| Brownfield, subsequent run, research balanced/deep | 0 (maps exist) | 4 | 1 | 5 |
| Greenfield, research balanced/deep | 0 | 4 | 1 | 5 |
| Greenfield, research fast | 0 | 4 | 0 (inline) | 4 |
| Any, no research | 0–4 | 0 | 0 | 0–4 |

## What Gets Created (Project Output)

```
.planning/
  SPEC.md
  ROADMAP.md
  config.json
  templates/           # copied from distilled/templates/
  phases/              # phase plans and summaries
  research/            # optional research outputs
.agents/skills/
  gsdd-new-project/SKILL.md
  gsdd-plan/SKILL.md
  gsdd-execute/SKILL.md
  gsdd-verify/SKILL.md
```

## Files In This Framework

```
distilled/
  SKILL.md                 # primary entry point (plain markdown)
  workflows/
    new-project.md
    plan.md
    execute.md
    verify.md
  templates/
    spec.md
    roadmap.md
    agents.md              # full AGENTS.md template (for tool adapters)
    agents.block.md        # bounded block payload for root AGENTS.md insertion
    delegates/               # delegate instruction files (copied to .planning/templates/delegates/)
      mapper-tech.md
      mapper-arch.md
      mapper-quality.md
      mapper-concerns.md
      researcher-stack.md
      researcher-features.md
      researcher-architecture.md
      researcher-pitfalls.md
      researcher-synthesizer.md
    research/
      stack.md
      features.md
      architecture.md
      pitfalls.md
      summary.md
    codebase/
      stack.md
      architecture.md
      conventions.md
      concerns.md
```
