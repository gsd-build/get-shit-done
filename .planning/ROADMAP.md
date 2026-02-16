# Roadmap: GSD Enhancements v2.0

## Overview

This roadmap transforms GSD from a phase-based development framework into an intelligent, autonomous system that learns user preferences and executes entire projects with minimal intervention. The journey begins with Auto Mode (intelligent model selection for 40-60% token savings), builds knowledge persistence using SQLite + sqlite-vec with multi-phase search and memory evolution (synthesizing omega-memory patterns), then culminates in autonomous multi-phase roadmap execution with structured checkpoints and fresh context per phase. Integration touchpoints (Telegram notifications, observability) enable production-ready deployment with cost controls and progress tracking.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [] **Phase 1: Auto Mode Foundation** - Intelligent model selection with complexity detection and cost tracking
- [x] **Phase 2: Auto Mode Refinement** - Circuit breakers, learning feedback loops, and error handling
- [ ] **Phase 3: Knowledge System Foundation** - SQLite + sqlite-vec with multi-phase search, TTL lifecycle, and access tracking
- [ ] **Phase 4: Knowledge Extraction & Hooks** - Passive capture via hooks, deduplication, memory evolution, and principle learning
- [ ] **Phase 5: Knowledge Permissions & Safety** - Explicit boundaries for irreversible/external/costly actions
- [ ] **Phase 6: Autonomous Execution Core** - Multi-phase roadmap orchestration with structured checkpoints
- [ ] **Phase 7: Autonomous Execution Optimization** - Parallel execution, context management, and task chunking
- [ ] **Phase 8: Notifications & Observability** - Telegram integration and production monitoring

## Phase Details

### Phase 1: Auto Mode Foundation
**Goal**: Users can execute GSD commands with `/gsd:set-profile auto` and see 40-60% token savings through intelligent model selection without quality loss
**Depends on**: Nothing (first phase)
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-07, AUTO-08, AUTO-09, AUTO-10
**Success Criteria** (what must be TRUE):
  1. System detects task complexity via multi-signal analysis and maps to model tiers (Haiku/Sonnet/Opus)
  2. Users can set profile to 'auto' and commands route to appropriate model automatically
  3. Token and cost tracking displays per-task metrics and cumulative savings vs manual profiles
  4. Quota tracking prevents exceeding session/weekly limits by adjusting model selection
  5. Default behavior uses Sonnet when complexity unclear or detection fails
**Plans:** 6 plans

Plans:
- [ ] 01-01-PLAN.md - Routing rules infrastructure (pattern table, parser, merge logic)
- [ ] 01-02-PLAN.md - Task context skill (model + context injection)
- [ ] 01-03-PLAN.md - Quota and token tracking with auto-wait
- [ ] 01-04-PLAN.md - Auto profile and status display
- [ ] 01-05-PLAN.md - Session scanning for rule bootstrap (checkpoint)
- [ ] 01-06-PLAN.md - Execute-plan integration and fallback behavior

### Phase 2: Auto Mode Refinement
**Goal**: Auto mode operates safely with circuit breakers preventing runaway execution and learns from user feedback to improve routing accuracy
**Depends on**: Phase 1
**Requirements**: AUTO-05, AUTO-06, AUTO-11, AUTO-12, AUTO-13, AUTO-14
**Success Criteria** (what must be TRUE):
  1. Haiku-executed tasks are validated by Sonnet before marking complete
  2. Failed Haiku validations trigger automatic re-execution with Sonnet
  3. Hard iteration caps (15-20 steps) and global timeouts (60-120 sec) prevent infinite loops
  4. Error rate thresholds automatically escalate to stronger models
  5. Users can mark incorrect model choices and system learns to improve future routing
**Plans:** 6 plans

Plans:
- [ ] 02-01-PLAN.md - Validation infrastructure (LLM-as-a-judge, two-stage checking)
- [ ] 02-02-PLAN.md - Circuit breakers (opossum, iteration caps, adaptive thresholds)
- [ ] 02-03-PLAN.md - Error escalation (weighted scoring, escalation ladder)
- [ ] 02-04-PLAN.md - Feedback collection (human/Opus modes, feature flag)
- [ ] 02-05-PLAN.md - Learning system (pattern extraction, rule merging)
- [ ] 02-06-PLAN.md - Execute-plan integration (safety mechanisms)

### Phase 3: Knowledge System Foundation
**Goal**: GSD maintains local knowledge databases (global and project-scoped) using SQLite + sqlite-vec with multi-phase search, type-weighted scoring, TTL-based lifecycle management, and access tracking for relevance ranking
**Depends on**: Nothing (parallel to Phase 1-2)
**Requirements**: KNOW-01, KNOW-02, KNOW-03, KNOW-04, KNOW-05, KNOW-06, KNOW-07, KNOW-08, KNOW-09, KNOW-10, KNOW-11
**Success Criteria** (what must be TRUE):
  1. Local database using SQLite + sqlite-vec (better-sqlite3) stores knowledge with vector + FTS5 search
  2. Multi-phase search pipeline: vector similarity, FTS5 text fallback, type weights, context boost
  3. Type-weighted scoring ranks decisions/lessons at 2.0x, summaries at 0.5x
  4. TTL categories manage memory lifecycle (permanent: lessons, long-term: decisions, short-term: summaries)
  5. Automatic cleanup removes expired memories based on TTL without manual intervention
  6. Access tracking (access_count, last_accessed) boosts frequently-used knowledge in search
  7. Global scope at ~/.claude/knowledge/, project scope at .planning/knowledge/
  8. System works without knowledge DB (fallback to current GSD behavior)
  9. Multi-user support via separate files per developer prevents merge conflicts
**Plans:** 5 plans

Plans:
- [ ] 03-01-PLAN.md - Database infrastructure (SQLite + sqlite-vec setup, schema, migrations)
- [ ] 03-02-PLAN.md - Knowledge CRUD operations (insert, update, delete with TTL)
- [ ] 03-03-PLAN.md - Multi-phase search pipeline (FTS5 + vector + RRF + type weights)
- [ ] 03-04-PLAN.md - TTL lifecycle and access tracking (cleanup, staleness scoring)
- [ ] 03-05-PLAN.md - Integration and fallback (unified API, gsd-tools CLI commands)

### Phase 4: Knowledge Extraction & Hooks
**Goal**: Claude passively captures decisions and lessons via hooks during normal work, deduplicates and evolves memories, and makes autonomous decisions based on learned principles
**Depends on**: Phase 3
**Requirements**: KNOW-12, KNOW-13, KNOW-14, KNOW-15, KNOW-16, KNOW-17, KNOW-18, KNOW-19, HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, HOOK-06, HOOK-07, HOOK-08
**Success Criteria** (what must be TRUE):
  1. Claude hooks capture conversation context using regex patterns (decisions: "let's use", "decided to"; lessons: "turns out", "I learned")
  2. Quality gates prevent noise (min 20 chars, tech signal detection like `/`, backticks, "error")
  3. Per-turn mode analyzes after each response; session-end mode batches at end
  4. Hooks configurable: enable/disable, switch timing modes
  5. On-the-fly extraction captures decisions during GSD flows without blocking execution
  6. Three-stage deduplication: content hash, canonical hash, embedding similarity (0.88 threshold)
  7. Memory evolution: similarity 0.65-0.88 updates existing memory instead of creating duplicate
  8. Q&A sessions enable Claude to ask questions and learn from user answers
  9. Session scanning batch-reviews past conversations to extract patterns
  10. Synthesis passes consolidate knowledge into higher-level principles
  11. Claude makes autonomous decisions based on learned principles without approval for reversible actions
**Plans:** 6 plans

Plans:
- [ ] 04-01-PLAN.md - Local embeddings via transformers.js (Nomic Embed, lazy loading)
- [ ] 04-02-PLAN.md - Extraction patterns with quality gates (regex, dedup within batch)
- [ ] 04-03-PLAN.md - Three-stage deduplication and memory evolution
- [ ] 04-04-PLAN.md - Hook integration (session-end, per-turn, config)
- [ ] 04-05-PLAN.md - Q&A sessions and session scanning flows
- [ ] 04-06-PLAN.md - Synthesis passes and autonomous decision-making

### Phase 5: Knowledge Permissions & Safety
**Goal**: Users can grant explicit permissions with boundaries, and Claude stops to ask only for irreversible/external/costly actions
**Depends on**: Phase 4
**Requirements**: KNOW-20, KNOW-21, KNOW-22, KNOW-23, KNOW-24, KNOW-25, KNOW-26, KNOW-27
**Success Criteria** (what must be TRUE):
  1. Claude stops and asks before irreversible actions (data/code deletion)
  2. Claude stops and asks before external communications (emails, API calls to third parties)
  3. Claude stops and asks before actions that cost money above tracked thresholds
  4. Users can grant explicit permissions with stated limits (e.g., "max $20 on AWS")
  5. Conflict resolution applies user-defined priority rules when principles conflict
  6. Users can mark outdated or incorrect principles, triggering updates or invalidation
**Plans:** 6 plans

Plans:
- [ ] 05-01-PLAN.md - Permission schema and storage (grant/revoke/check with pattern matching)
- [ ] 05-02-PLAN.md - Stop-and-ask safety gates (irreversible/external/costly)
- [ ] 05-03-PLAN.md - Cost tracking and graduated budget alerts (50%/80%/90%/100%)
- [ ] 05-04-PLAN.md - Principle conflict resolution with priority matrix
- [ ] 05-05-PLAN.md - Feedback loop for principle invalidation and replacement
- [ ] 05-06-PLAN.md - CLI commands and workflow integration

### Phase 6: Autonomous Execution Core
**Goal**: Users can run `/gsd:execute-roadmap` and entire project phases execute autonomously with Opus coordinator spawning sub-coordinators per phase, using structured checkpoints for resume capability
**Depends on**: Phase 1, Phase 2, Phase 5
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, EXEC-07, EXEC-08, EXEC-09, EXEC-10, EXEC-11
**Success Criteria** (what must be TRUE):
  1. `/gsd:execute-roadmap` command checks for ROADMAP.md and prompts user confirmation
  2. Opus coordinator parses roadmap and creates execution queue with phase dependencies
  3. Coordinator spawns sub-coordinator for each phase with fresh context window
  4. Sub-coordinator executes full cycle (research -> plan -> execute -> verify) autonomously
  5. Automatic context cleanup and archiving prevents context rot across phases
  6. EXECUTION_LOG.md tracks real-time progress with checkpoints
  7. Structured checkpoint format captures: task_title, plan[], progress{completed, current, remaining}, files_touched[], decisions[], key_context, next_steps[], created_at
  8. Checkpoints stored as searchable memories (semantic search for resume)
  9. System resumes from last checkpoint on failure via checkpoint lookup
  10. Phase dependencies are detected and enforced (Phase 2 waits for Phase 1)
**Plans:** 6 plans

Plans:
- [x] 06-01-PLAN.md - Roadmap parsing and DAG builder (topological sort, dependency detection)
- [x] 06-02-PLAN.md - Execute-roadmap workflow and phase coordinator (command, confirmation, spawning)
- [x] 06-03-PLAN.md - Execution log infrastructure (JSONL append, progress tracking, resume detection)
- [x] 06-04-PLAN.md - Checkpoint storage and retrieval (knowledge system integration, semantic search)
- [x] 06-05-PLAN.md - Phase archiving and context management (compression, cleanup, integration)
- [ ] 06-06-PLAN.md - Gap closure: sync init execute-roadmap to repo copy

### Phase 7: Autonomous Execution Optimization
**Goal**: Autonomous execution scales to 20+ phases with parallel execution, context compression, and intelligent task splitting without quality degradation
**Depends on**: Phase 6
**Requirements**: EXEC-12, EXEC-13, EXEC-14, EXEC-15, EXEC-16, EXEC-17, EXEC-18, EXEC-19, EXEC-20, EXEC-21, EXEC-22
**Success Criteria** (what must be TRUE):
  1. Independent phases execute in parallel when dependency graph allows
  2. Token limit monitoring prevents exceeding session window during execution
  3. Failure handling provides retry/skip/escalate options with user choice
  4. Sub-coordinators provide structured completion signals (success/failure/blocked)
  5. Context compression summarizes completed phases to fit more in window
  6. Selective context injection passes only relevant history, not entire conversation
  7. Sub-coordinator spawns agents for tasks instead of running in own context
  8. Large task detection identifies work exceeding single context capacity
  9. Task chunking splits large tasks into batches (e.g., "update 350 tests" -> multiple runs)
  10. Phase size limits trigger splitting when too many requirements exceed safe handling
  11. Batch processing optimizes repetitive operations (tests, migrations, refactors)
**Plans:** 6 plans

Plans:
- [x] 07-01-PLAN.md - Token budget monitoring with 80% alert thresholds
- [x] 07-02-PLAN.md - Failure handling with retry/skip/escalate options
- [x] 07-03-PLAN.md - Structured completion signals for sub-coordinators
- [x] 07-04-PLAN.md - Task chunker with large task detection and batch processing (gap closure)
- [x] 07-05-PLAN.md - Phase size limits with split recommendations (gap closure)
- [x] 07-06-PLAN.md - Parallel executor with worker pool (gap closure)

### Phase 8: Notifications & Observability
**Goal**: Production-ready deployment with Telegram notifications for blocking questions and comprehensive observability for cost control and progress tracking
**Depends on**: Phase 7
**Requirements**: TELE-01, TELE-02, TELE-03, TELE-04, TELE-05, OBSV-01, OBSV-02, OBSV-03, OBSV-04, OBSV-05
**Success Criteria** (what must be TRUE):
  1. Claude sends blocking questions to user via Telegram when human input required
  2. Telegram supports text chat and audio messages (speech-to-text via local LLM like Whisper)
  3. Claude resumes execution after receiving Telegram response
  4. Distributed tracing tracks multi-agent workflows with span-level detail
  5. LLM-specific metrics (tokens, cost, context size, latency) are captured per operation
  6. Graduated budget alerts notify at 50%, 80%, 90%, 100% thresholds
  7. Real-time progress dashboard shows execution status via EXECUTION_LOG.md
  8. Token savings report compares auto mode vs manual profiles with detailed analytics
**Plans**: TBD

Plans:
- [ ] 08-01: TBD (Telegram integration)
- [ ] 08-02: TBD (Observability + tracing)
- [ ] 08-03: TBD (Budget alerts + dashboards)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

**Phase Dependencies:**
```
Phase 1 (Auto Mode Foundation) -----+
                                     +--> Phase 6 (Autonomous Execution Core)
Phase 2 (Auto Mode Refinement) -----+
                                     |
Phase 5 (Permissions & Safety) -----+

Phase 3 (Knowledge Foundation) --> Phase 4 (Extraction & Hooks) --> Phase 5 (Permissions & Safety)

Phase 6 (Autonomous Core) --> Phase 7 (Autonomous Optimization)

Phase 7 (Autonomous Optimization) --> Phase 8 (Notifications & Observability)
```

**Parallel Execution Opportunities:**
- Phases 1-2 (Auto Mode) can run parallel to Phase 3 (Knowledge Foundation)
- Phase 4 can run parallel to Phase 2 if Phase 3 completes first

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Auto Mode Foundation | 6 | Planning complete | - |
| 2. Auto Mode Refinement | 6 | Complete | 2026-02-16 |
| 3. Knowledge System Foundation | 5 | Planning complete | - |
| 4. Knowledge Extraction & Hooks | 6 | Planning complete | - |
| 5. Knowledge Permissions & Safety | 6 | Planning complete | - |
| 6. Autonomous Execution Core | 6 | Complete | 2026-02-16 |
| 7. Autonomous Execution Optimization | 6 | Complete | 2026-02-16 |
| 8. Notifications & Observability | TBD | Not started | - |

### Phase 9: Hook-based documentation compression - Optimize context injection by extracting AI-friendly headers from docs and injecting only summaries with absolute links instead of full content

**Goal:** [To be planned]
**Depends on:** Phase 8
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 9 to break down)

### Phase 10: Module repository consolidation - Move external modules (validator, circuit-breaker, escalation, feedback, learning) into repo with installation script and proper structure

**Goal:** [To be planned]
**Depends on:** Phase 9
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 10 to break down)

### Phase 11: Session-end knowledge extraction - Implement Haiku-based analysis of completed sessions to extract reasoning patterns and decisions beyond keyword matching

**Goal:** [To be planned]
**Depends on:** Phase 10
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 11 to break down)

### Phase 12: Historical conversation mining - Analyze Claude Code project conversations and planning documents to extract meta-knowledge, reasoning patterns, and decision context for enhanced context building

**Goal:** [To be planned]
**Depends on:** Phase 11
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 12 to break down)

---
*Roadmap created: 2026-02-15*
*Last updated: 2026-02-16 after Phase 7 gap closure planning*
