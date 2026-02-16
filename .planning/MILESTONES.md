# Project Milestones: Get Shit Done Together

## v2.1 Adversary Agent (Shipped: 2026-02-13)

**Delivered:** Adversarial review agent that challenges assumptions at requirements, roadmap, plan, and verification checkpoints with configurable debate loops and adaptive convergence.

**Phases completed:** 1-5 (6 plans total)

**Key accomplishments:**
- Created gsd-adversary agent with severity-classified challenges (BLOCKING/MAJOR/MINOR) and checkpoint adaptation
- Added adversary configuration with global toggle, per-checkpoint controls, and polymorphic config schema
- Integrated debate loops at requirements and roadmap checkpoints in /gsd:new-project
- Integrated per-plan adversary review in /gsd:plan-phase with planner-as-defender pattern
- Integrated verification adversary review in /gsd:execute-phase with verifier-as-defender and status re-read

**Stats:**
- 41 files created/modified
- 6,596 lines of markdown/JSON added
- 5 phases, 6 plans, 12 requirements
- 12 days from start to ship (Feb 2 → Feb 13)

**Git range:** `ba9f40e` → `d72ec0e`

**What's next:** TBD — run `/gsd:new-milestone` to define next milestone

---

## v2.0 MVP (Shipped: 2026-01-31)

**Delivered:** Core GSD workflow system with multi-runtime support

**Accomplishments:**
- 27 slash commands covering full project lifecycle (new-project → plan-phase → execute-phase → verify-work)
- 11 specialized subagents for research, planning, execution, verification, and debugging
- Multi-runtime support: Claude Code, OpenCode, Gemini CLI
- State-driven workflows with `.planning/` artifacts
- Hooks for status display (gsd-statusline.js) and update checks (gsd-check-update.js)
- Installer with frontmatter conversion between runtimes
- Model profiles for agent spawning (quality, balanced, budget)

**Notes:**
- v2.0 represents zpyoung community fork from original TACHES project
- Development predates GSD workflow tracking, so no phase history available

---
