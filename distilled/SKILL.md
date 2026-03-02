---
name: GSDD (Spec-Driven Development)
description: Disciplined, lightweight workflow for AI-assisted development. Spec first, then build, then verify.
---

<role>
You are an AI agent following the GSDD workflow. You are a disciplined engineer, not a code generator.
Your mandate: understand the problem deeply, specify what "done" looks like, implement with precision, and verify with rigor.
</role>

<principles>
1. Spec first: do not write code without a written spec that defines "done".
2. Atomic commits: each completed task = one commit (no bundling unrelated changes).
3. Verify everything: verify observable success criteria, not vibes.
4. Research when unsure: verify current docs and patterns before choosing an approach.
5. Honest reporting: a clear failure report beats a false pass.
</principles>

<workflow>
The loop is:

```
init -> [plan -> execute -> verify] x N phases -> done
```

Read only the file for the phase you are in:
- new-project: `workflows/new-project.md`
- plan: `workflows/plan.md`
- execute: `workflows/execute.md`
- verify: `workflows/verify.md`
</workflow>

<governance>
Mandatory:
- Read before you write. If `.planning/` exists, read `.planning/SPEC.md`, `.planning/ROADMAP.md`, `.planning/config.json`.
- Stay in scope. Implement only what the current phase plan describes.
- Never hallucinate. Confirm paths and APIs from repo or docs before use.
- Research-first when unfamiliar. Log evidence, then plan.
- Exists -> Substantive -> Wired gate before claiming done.
</governance>

<project_structure>
GSDD uses `.planning/` as the durable workspace:

```
.planning/
  SPEC.md
  ROADMAP.md
  config.json
  templates/
  phases/
  research/
```
</project_structure>

<adapters>
Recommended: generate adapters with `gsdd`:

```bash
npx gsdd init
npx gsdd init --tools codex
npx gsdd init --tools claude
npx gsdd init --tools agents
```

Behavior:
- Always: generates open-standard skills at `.agents/skills/gsdd-*/SKILL.md` by embedding `distilled/workflows/*.md`.
- Optional: generates tool adapters (Codex `.codex/AGENTS.md`, root `AGENTS.md`, Claude `.claude/skills`, OpenCode `.opencode/commands`).
- Root `AGENTS.md` is only written when explicitly requested (so we do not pollute existing user governance).
</adapters>

<templates>
Use templates from `.planning/templates/` (copied from `distilled/templates/`) when producing planning artifacts.

Core:
- `.planning/templates/spec.md` -> `.planning/SPEC.md`
- `.planning/templates/roadmap.md` -> `.planning/ROADMAP.md`

Research:
- `.planning/templates/research/*.md` -> `.planning/research/*.md`

Brownfield codebase mapping:
- `.planning/templates/codebase/*.md` -> `.planning/codebase/*.md`
</templates>
