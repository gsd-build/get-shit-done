# Roadmap: GSD Enhancements

## Milestones

- ✅ **v1.9.0 GSD Enhancements** — Phases 1-14 (shipped 2026-02-19)
- 🚧 **v1.9.1 Upstream Sync** — Phases 18-20 (in progress)

## Phases

<details>
<summary>✅ v1.9.0 GSD Enhancements (Phases 1-14) — SHIPPED 2026-02-19</summary>

- [x] Phase 1: Auto Mode Foundation (9/9 plans) — completed 2026-02-16
- [x] Phase 2: Auto Mode Refinement (6/6 plans) — completed 2026-02-16
- [x] Phase 3: Knowledge System Foundation (5/5 plans) — completed 2026-02-16
- [x] Phase 4: Knowledge Extraction & Hooks (6/6 plans) — completed 2026-02-16
- [x] Phase 5: Knowledge Permissions & Safety (6/6 plans) — completed 2026-02-16
- [x] Phase 6: Autonomous Execution Core (6/6 plans) — completed 2026-02-16
- [x] Phase 7: Autonomous Execution Optimization (6/6 plans) — completed 2026-02-16
- [x] Phase 8: Notifications & Observability (8/8 plans) — completed 2026-02-16
- [x] Phase 8.1: Telegram MCP Server (6/6 plans) — completed 2026-02-16
- [x] Phase 9: Doc Compression Hooks (5/5 plans) — completed 2026-02-17
- [x] Phase 10: GSD Installation System (4/4 plans) — completed 2026-02-17
- [x] Phase 10.1: Multi-Instance MCP Safety (4/4 plans) — completed 2026-02-17
- [x] Phase 11: Session-End Knowledge Extraction (4/4 plans) — completed 2026-02-17
- [x] Phase 12: Historical Conversation Mining (3/3 plans) — completed 2026-02-18
- [x] Phase 13: Cross-Phase Integration Fixes (1/1 plans) — completed 2026-02-18
- [x] Phase 14: Telegram MCP Audit & Rework (6/6 plans) — completed 2026-02-18

Full details: `.planning/milestones/v1.9.0-ROADMAP.md`

</details>

### 🚧 v1.9.1 Upstream Sync (In Progress)

**Milestone Goal:** Review glittercowboy/get-shit-done upstream commits and port the most valuable improvements into this fork without breaking fork-specific features (auto routing, knowledge system, Telegram MCP, autonomous execution).

#### Phase 18: Upstream Audit — COMPLETE
**Goal**: Developer can see exactly what upstream has added since the fork diverged, with every change categorized and evaluated for portability
**Depends on**: Nothing (first phase of milestone)
**Requirements**: AUDT-01, AUDT-02
**Success Criteria** (what must be TRUE):
  1. UPSTREAM-DIFF.md exists listing every upstream commit not present in this fork, each tagged with a category (bug-fix, feature, workflow-change, context-management, git-branching, execution)
  2. Each upstream change is assessed as safe-to-port, needs-adaptation, or conflicts-with-fork with a one-line rationale
  3. Developer can read UPSTREAM-DIFF.md and know without any further research which changes to take into Phase 19 and which into Phase 20
**Plans**: 1/1

Plans:
- [x] 18-01: Fetch upstream, compare commit history, produce UPSTREAM-DIFF.md — completed 2026-02-19

#### Phase 19: Bug Fixes & Context Window Management
**Goal**: All upstream stability fixes and context window improvements are running in the fork with no regressions to existing fork-specific features
**Depends on**: Phase 18
**Requirements**: BUGF-01, BUGF-02, CTXT-01
**Success Criteria** (what must be TRUE):
  1. Every bug fix from upstream identified in Phase 18 as safe-to-port is applied to the fork's shared code paths (workflows, skills, templates)
  2. Fork shared code paths produce the same behavior as upstream for identical inputs (no silent divergence on bug-fixed paths)
  3. Upstream context window management improvements are active in the fork — context pressure is handled at least as well as upstream does it
  4. No existing fork feature (auto routing, knowledge system, Telegram MCP) is broken by ported changes
**Plans**: TBD

Plans:
- [ ] 19-01: Port upstream bug fixes to shared code paths
- [ ] 19-02: Port upstream context window management improvements

#### Phase 20: Git Branching & Autonomous Execution
**Goal**: GSD creates feature branches at phase start and any compatible upstream execution improvements are integrated without breaking the fork's sub-coordinator design
**Depends on**: Phase 19
**Requirements**: GIT-01, GIT-02, EXEC-01, EXEC-02
**Success Criteria** (what must be TRUE):
  1. When a GSD phase begins execution, a feature branch is created before any code changes are written (not after phase completion)
  2. Branch names follow a consistent convention derived from upstream pattern (or improved where upstream falls short)
  3. Upstream execution flow improvements identified as compatible in Phase 18 are running in the fork
  4. `/gsd:execute-roadmap` still works end-to-end and the per-phase fresh-context sub-coordinator pattern is intact
**Plans**: TBD

Plans:
- [ ] 20-01: Implement early git branching at phase start
- [ ] 20-02: Port compatible upstream autonomous execution improvements

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Auto Mode Foundation | 9/9 | Complete   | 2026-02-19 | 2026-02-16 |
| 2. Auto Mode Refinement | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 3. Knowledge System Foundation | v1.9.0 | 5/5 | Complete | 2026-02-16 |
| 4. Knowledge Extraction & Hooks | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 5. Knowledge Permissions & Safety | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 6. Autonomous Execution Core | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 7. Autonomous Execution Optimization | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 8. Notifications & Observability | v1.9.0 | 8/8 | Complete | 2026-02-16 |
| 8.1. Telegram MCP Server | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 9. Doc Compression Hooks | v1.9.0 | 5/5 | Complete | 2026-02-17 |
| 10. GSD Installation System | v1.9.0 | 4/4 | Complete | 2026-02-17 |
| 10.1. Multi-Instance MCP Safety | v1.9.0 | 4/4 | Complete | 2026-02-17 |
| 11. Session-End Knowledge Extraction | v1.9.0 | 4/4 | Complete | 2026-02-17 |
| 12. Historical Conversation Mining | v1.9.0 | 3/3 | Complete | 2026-02-18 |
| 13. Cross-Phase Integration Fixes | v1.9.0 | 1/1 | Complete | 2026-02-18 |
| 14. Telegram MCP Audit & Rework | v1.9.0 | 6/6 | Complete | 2026-02-18 |
| 18. Upstream Audit | v1.9.1 | 1/1 | Complete | 2026-02-19 |
| 19. Bug Fixes & Context Window Management | v1.9.1 | 0/TBD | Not started | - |
| 20. Git Branching & Autonomous Execution | v1.9.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-15 | Last updated: 2026-02-19 — Phase 18 complete*
