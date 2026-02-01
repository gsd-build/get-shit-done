# Milestones

## Shipped

### v2.0 MVP

**Shipped:** 2026-01-31
**Summary:** Core GSD workflow system with multi-runtime support

**Accomplishments:**
- 27 slash commands covering full project lifecycle (new-project → plan-phase → execute-phase → verify-work)
- 11 specialized subagents for research, planning, execution, verification, and debugging
- Multi-runtime support: Claude Code, OpenCode, Gemini CLI
- State-driven workflows with `.planning/` artifacts
- Hooks for status display (gsd-statusline.js) and update checks (gsd-check-update.js)
- Installer with frontmatter conversion between runtimes
- Model profiles for agent spawning (quality, balanced, budget)

**Notes:**
- v2.0 represents zpyoung community fork from original TÂCHES project
- Development predates GSD workflow tracking, so no phase history available

---

## In Progress

### v2.1 Adversary Agent

**Started:** 2026-01-31
**Goal:** Adversarial review agent that challenges assumptions at key checkpoints

See: `.planning/ROADMAP.md` for phase details
