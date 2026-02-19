# Roadmap: GSD Enhancements

## Milestones

- ✅ **v1.9.0 GSD Enhancements** — Phases 1-14 (shipped 2026-02-19)
- ✅ **v1.9.1 Upstream Sync** — Phases 18-20 (completed 2026-02-19)
- ✅ **v1.10.0 Autonomous Phase Discussion** — Phases 21-25 (completed 2026-02-19)
- ⬜ **v1.11.0 Milestone Summary & Archival** — Phase 26 (planned)

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

<details>
<summary>✅ v1.9.1 Upstream Sync (Phases 18-20) — COMPLETE 2026-02-19</summary>

**Milestone Goal:** Review glittercowboy/get-shit-done upstream commits and port the most valuable improvements into this fork without breaking fork-specific features (auto routing, knowledge system, Telegram MCP, autonomous execution).

#### Phase 18: Upstream Audit — COMPLETE
**Goal**: Developer can see exactly what upstream has added since the fork diverged, with every change categorized and evaluated for portability
**Depends on**: Nothing (first phase of milestone)
**Requirements**: AUDT-01, AUDT-02
**Plans**: 1/1

Plans:
- [x] 18-01: Fetch upstream, compare commit history, produce UPSTREAM-DIFF.md — completed 2026-02-19

#### Phase 19: Bug Fixes & Context Window Management — COMPLETE
**Goal**: All upstream stability fixes and context window improvements are running in the fork with no regressions to existing fork-specific features
**Depends on**: Phase 18
**Requirements**: BUGF-01, BUGF-02, CTXT-01
**Plans**: 2/2

Plans:
- [x] 19-01: Port upstream bug fixes to shared code paths — completed 2026-02-19
- [x] 19-02: Port upstream context window management improvements — completed 2026-02-19

#### Phase 20: Git Branching & Autonomous Execution — COMPLETE
**Goal**: GSD creates feature branches at phase start and any compatible upstream execution improvements are integrated without breaking the fork's sub-coordinator design
**Depends on**: Phase 19
**Requirements**: GIT-01, GIT-02, EXEC-01, EXEC-02
**Plans**: 2/2

Plans:
- [x] 20-01: Implement early git branching at phase start — completed 2026-02-19
- [x] 20-02: Port compatible upstream autonomous execution improvements — completed 2026-02-19

</details>

### ✅ v1.10.0 Autonomous Phase Discussion (Complete)

**Milestone Goal:** Enable `execute-roadmap` to autonomously discuss each phase using a global meta-knowledge DB, writing CONTEXT.md before research begins, with Telegram escalation for sensitive decisions and progress notifications throughout execution.

- [x] **Phase 21: Knowledge Global Migration** — Migrate knowledge DB to `~/.claude/knowledge/`, add project tagging, cross-project mining, and `query-knowledge` CLI command
- [x] **Phase 22: Discuss Step & Meta-Answerer** — Add autonomous discuss step to phase coordinator: gray-area analysis, 10-20 Q&A questions per gray area, `gsd-meta-answerer` subagent answers from global knowledge DB, CONTEXT.md written from answers
- [x] **Phase 23: Telegram Escalation** — Wire sensitive flagged questions into Telegram blocking escalation with multi-turn follow-up loop, sensitivity criteria enforcement, and JSONL logging
- [x] **Phase 24: Telegram Notifications** — Add `create_topic` MCP tool for milestone forum topics, wire phase lifecycle and roadmap-level events into coordinator notifications
- [x] **Phase 25: End-to-End Validation** — Verify full autonomous discuss loop on a real phase with mixed autonomous and Telegram-escalated answers producing a complete CONTEXT.md

#### Phase 21: Knowledge Global Migration
**Goal**: The knowledge system operates from a single global DB at `~/.claude/knowledge/` shared across all projects, with project tagging for scoped queries and cross-project conversation mining
**Depends on**: Phase 20 (existing knowledge system)
**Requirements**: KNOW-01, KNOW-02, KNOW-03, KNOW-04, KNOW-05
**Success Criteria** (what must be TRUE):
  1. Running `gsd-tools query-knowledge "should I use async or sync here"` returns relevant past decisions with confidence scores and source snippets from the global DB
  2. Knowledge entries written during any project session carry a `project_slug` field that filters correctly when queried with `--project=<slug>`
  3. The conversation miner scans `~/.claude/projects/` (all projects) and successfully populates the global DB with entries from projects other than the current working directory
  4. All Phase 3/4/11/12 modules (knowledge-writer, session-analyzer, conversation-miner) write to `~/.claude/knowledge/<user>.db` and the old `.planning/knowledge/` path is no longer used as primary storage
  5. Existing knowledge entries (if any) remain queryable after migration with no data loss
**Plans**: 3 plans

Plans:
- [ ] 21-01: Migrate knowledge DB path to `~/.claude/knowledge/`, update all modules to global scope, add `project_slug` schema, create `migrate-knowledge` command
- [ ] 21-02: Add `project_slug` tagging to all write paths (crud, writer, evolution) and query filtering to all search paths
- [ ] 21-03: Extend conversation miner to scan all projects (`--all-projects`) and implement `query-knowledge` gsd-tools command

#### Phase 22: Discuss Step & Meta-Answerer
**Goal**: The phase coordinator autonomously identifies gray areas before research begins, generates targeted Q&A questions, spawns `gsd-meta-answerer` to answer from the global knowledge DB, and writes CONTEXT.md from the results — all without human input for questions it can answer with sufficient confidence
**Depends on**: Phase 21 (query-knowledge command required by gsd-meta-answerer)
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, DISC-07
**Success Criteria** (what must be TRUE):
  1. When `execute-roadmap` starts a phase that has no CONTEXT.md, the coordinator runs a discuss step before research; when CONTEXT.md already exists, the discuss step is skipped automatically
  2. The discuss step produces a list of gray areas for the phase (goal, requirements, and context analyzed) along with 10-20 concrete questions per gray area
  3. `gsd-meta-answerer` receives the questions and phase context, queries the global knowledge DB via `query-knowledge`, and returns an answer + confidence score + source references for each question
  4. Each answer is evaluated and marked `sufficient` or `needs-escalation`; sufficient answers are written directly into CONTEXT.md
  5. CONTEXT.md exists and contains documented decisions before the research step begins, regardless of whether all answers came autonomously or some required escalation
**Plans**: 4 plans

Plans:
- [x] 22-01-PLAN.md — Add discuss step skeleton to gsd-phase-coordinator (CONTEXT.md skip guard + gray-area identification)
- [x] 22-02-PLAN.md — Implement question generation (gray-area analysis → 10-20 Q&A per area)
- [x] 22-03-PLAN.md — Create gsd-meta-answerer subagent (query-knowledge integration, confidence scoring, source references)
- [x] 22-04-PLAN.md — Wire meta-answerer invocation, answer evaluation (sufficient vs needs-escalation), and CONTEXT.md writer

#### Phase 23: Telegram Escalation
**Goal**: Questions the meta-answerer cannot answer with sufficient confidence are sent to the user via Telegram, execution blocks until the user replies, follow-up exchanges continue until confidence threshold is met, and the full exchange is logged for future knowledge extraction
**Depends on**: Phase 22 (needs-escalation signal from discuss step)
**Requirements**: ESCL-01, ESCL-02, ESCL-03, ESCL-04, ESCL-05
**Success Criteria** (what must be TRUE):
  1. A flagged question triggers `mcp__telegram__ask_blocking_question` with the question text, sensitivity reason, phase context, and options; the coordinator waits for a reply before continuing
  2. The user's reply is written into CONTEXT.md and counted as an answered question; execution resumes only after the reply is received
  3. After receiving a reply, the subagent re-evaluates confidence on the topic; if still below threshold, a follow-up question is sent automatically — this loop continues until confidence is satisfied
  4. All six sensitivity criteria (irreversible change, >1 phase rework risk, major architectural decision, money/data loss potential, conflicting KB signals, always-ask topics) trigger escalation correctly and non-sensitive questions do not escalate
  5. Every escalated question, user reply, and follow-up exchange is appended to the Telegram session JSONL in the same format as existing session logs
**Plans**: 2 plans

Plans:
- [ ] 23-01-PLAN.md — Escalation trigger: sensitivity criteria evaluation + mcp__telegram__ask_blocking_question blocking call + escalated answers merged into CONTEXT.md
- [ ] 23-02-PLAN.md — Multi-turn follow-up loop (max 3 turns, confidence re-evaluation) + JSONL logging (escalation_question, escalation_reply, escalation_complete)

#### Phase 24: Telegram Notifications
**Goal**: Each roadmap execution gets a dedicated Telegram forum topic, and phase lifecycle events are posted to that topic so the user can monitor autonomous execution from their phone without polling
**Depends on**: Phase 22 (coordinator changes exist), Phase 23 (Telegram session logging established)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. Calling `create_topic` via the Telegram MCP returns a `thread_id` and creates a visible forum topic in the configured Telegram group
  2. At execution start, the coordinator creates a milestone forum topic and the `thread_id` is stored in EXECUTION_LOG.md under `telegram_topic_id`; all subsequent messages pass this `thread_id`
  3. Phase lifecycle notifications appear in the correct topic thread: phase start, context-ready (N autonomous + M escalated answers), research done, plans ready, phase complete (with duration), and phase failure (with 'retry'/'skip'/'stop' options)
  4. Roadmap-level events appear in the topic: execution start listing all phases, and execution complete with a one-liner per phase from SUMMARY.md
  5. All notification messages (not just escalation) are logged in the session JSONL for future knowledge extraction
**Plans**: 4 plans

Plans:
- [x] 24-01-PLAN.md — Add `create_topic` tool to Telegram MCP server (types.ts + daemon handler + adapter tool + npm build) — completed 2026-02-19
- [x] 24-02-PLAN.md — Wire topic creation into execute-roadmap (create topic at start, store telegram_topic_id, roadmap-level notifications) — completed 2026-02-19
- [x] 24-03-PLAN.md — Thread telegram_topic_id through all send_message/send_status_update calls in phase coordinator — completed 2026-02-19
- [x] 24-04-PLAN.md — Implement 6 phase lifecycle notification events + JSONL logging for all notifications — completed 2026-02-19

#### Phase 25: End-to-End Validation
**Goal**: The full autonomous discuss loop is verified working on a real phase: questions generated, most answered by the meta-answerer, at least one escalated to Telegram, user replies on phone, CONTEXT.md contains both autonomous and human-answered decisions, and execution continues into research
**Depends on**: Phase 24 (all components in place)
**Requirements**: VALID-01, VALID-02
**Success Criteria** (what must be TRUE):
  1. Running `execute-roadmap` on a test phase with known gray areas produces a discuss step that generates questions, answers most autonomously via the global knowledge DB, and escalates at least one question to Telegram
  2. The user receives the escalated question on their phone via the milestone forum topic, replies, and the system receives the reply and continues execution without manual intervention
  3. CONTEXT.md written before research begins contains documented decisions from both autonomous (meta-answerer) and human (Telegram reply) sources, each attributed to its source
  4. The full exchange — questions, autonomous answers, Telegram escalation, user reply, follow-up if any — is present in the session JSONL
**Plans**: 4 plans

Plans:
- [ ] 25-01-PLAN.md — Static verification of Phase 21–24 component wiring (no live execution)
- [ ] 25-02-PLAN.md — Design and inject Phase 26 test stub into ROADMAP.md with calibrated gray areas
- [ ] 25-03-PLAN.md — Execute live discuss step on Phase 26 (requires Telegram reply from user)
- [ ] 25-04-PLAN.md — Artifact verification and phase closure (VERIFICATION.md + STATE.md + ROADMAP.md update)

#### Phase 26: Milestone Summary & Archival
**Goal**: After a milestone completes, an automated step generates a structured milestone summary (what was built, decisions made, plan count, duration) and archives completed phase artifacts to a milestone subfolder for fast future reference
**Depends on**: Phase 25 (validation complete)
**Requirements**: ARCH-01, ARCH-02, ARCH-03
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:complete-milestone` after a milestone produces a milestone summary document written to `.planning/milestones/{version}-SUMMARY.md` containing a one-liner per phase, total plan count, total duration, and key decisions
  2. Completed phase directories are moved (not copied) to `.planning/milestones/{version}/phases/` on archival, leaving only the milestone summary in `.planning/milestones/`
  3. The milestone summary is committed to the repo as a readable artifact and optionally broadcast via Telegram if a telegram_topic_id is active
  4. Re-running `/gsd:complete-milestone` on an already-archived milestone is idempotent — no duplicate moves or overwrites
**Plans**: TBD

Plans:
- [ ] 26-01: Design and execute milestone summary & archival validation scenario

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Auto Mode Foundation | v1.9.0 | 9/9 | Complete | 2026-02-16 |
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
| 19. Bug Fixes & Context Window Management | v1.9.1 | 2/2 | Complete | 2026-02-19 |
| 20. Git Branching & Autonomous Execution | v1.9.1 | 2/2 | Complete | 2026-02-19 |
| 21. Knowledge Global Migration | v1.10.0 | 3/3 | Complete | 2026-02-19 |
| 22. Discuss Step & Meta-Answerer | v1.10.0 | 4/4 | Complete | 2026-02-19 |
| 23. Telegram Escalation | v1.10.0 | 2/2 | Complete | 2026-02-19 |
| 24. Telegram Notifications | v1.10.0 | 4/4 | Complete | 2026-02-19 |
| 25. End-to-End Validation | v1.10.0 | 4/4 | Complete | 2026-02-19 |
| 26. Milestone Summary & Archival | v1.11.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-15 | Last updated: 2026-02-19 — Phase 25 complete: end-to-end validation passed, v1.10.0 Autonomous Phase Discussion milestone complete*
