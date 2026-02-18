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
**Plans:** 9 plans (6 original + 3 gap closure)

Plans:
- [ ] 01-01-PLAN.md - Routing rules infrastructure (pattern table, parser, merge logic)
- [ ] 01-02-PLAN.md - Task context skill (model + context injection)
- [ ] 01-03-PLAN.md - Quota and token tracking with auto-wait
- [ ] 01-04-PLAN.md - Auto profile and status display
- [ ] 01-05-PLAN.md - Session scanning for rule bootstrap (checkpoint)
- [ ] 01-06-PLAN.md - Execute-plan integration and fallback behavior
- [ ] 01-07-PLAN.md - Gap closure: multi-signal complexity scoring algorithm (AUTO-01, AUTO-02)
- [ ] 01-08-PLAN.md - Gap closure: quota-aware routing with selectModelFromRulesWithQuota (AUTO-09)
- [ ] 01-09-PLAN.md - Gap closure: active coordinator integration (gsd-task-router agent + phase coordinator wiring)

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
**Plans:** 7 plans

Plans:
- [x] 08-01-PLAN.md - Telegram bot foundation (text questions, responses, resume)
- [x] 08-02-PLAN.md - Voice message transcription (Whisper, ffmpeg, audio pipeline)
- [x] 08-03-PLAN.md - OpenTelemetry tracing (distributed traces, LLM metrics)
- [x] 08-04-PLAN.md - Graduated budget alerts (50/80/90/100%, Telegram escalation)
- [x] 08-05-PLAN.md - Dashboard and savings reports (WebSocket streaming, cost analysis)
- [x] 08-06-PLAN.md - AI-Powered Telegram Bot with Haiku Monitor (gap closure)
- [x] 08-07-PLAN.md - Documentation and Setup Guide (gap closure)

### Phase 08.1: Telegram MCP Server - Replace standalone bot with MCP integration using subscription tokens (INSERTED)

**Goal:** Replace standalone Telegram bot (Phase 8) with MCP server that auto-loads with Claude Code, uses subscription tokens instead of external API keys, and fixes architectural issues from Phase 8's standalone approach
**Depends on:** Phase 8
**Plans:** 6 plans

Plans:
- [ ] 08.1-01-PLAN.md - MCP server foundation (stdio transport, tool/resource registration)
- [ ] 08.1-02-PLAN.md - JSONL persistence layer (question queues, requirements messages)
- [ ] 08.1-03-PLAN.md - MCP tools implementation (ask_blocking_question, check_answers, mark_answered)
- [ ] 08.1-04-PLAN.md - Telegram bot integration (Telegraf with middleware pattern, transcription, logging)
- [ ] 08.1-05-PLAN.md - MCP server integration (bot lifecycle, resource handlers, tool wiring)
- [ ] 08.1-06-PLAN.md - Claude Code configuration and orchestrator integration

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

Phase 8 (Notifications & Observability) --> Phase 08.1 (Telegram MCP Server)
```

**Parallel Execution Opportunities:**
- Phases 1-2 (Auto Mode) can run parallel to Phase 3 (Knowledge Foundation)
- Phase 4 can run parallel to Phase 2 if Phase 3 completes first

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Auto Mode Foundation | 9 | Gap closure planned | - |
| 2. Auto Mode Refinement | 6 | Complete | 2026-02-16 |
| 3. Knowledge System Foundation | 5 | Planning complete | - |
| 4. Knowledge Extraction & Hooks | 6 | Planning complete | - |
| 5. Knowledge Permissions & Safety | 6 | Planning complete | - |
| 6. Autonomous Execution Core | 6 | Complete | 2026-02-16 |
| 7. Autonomous Execution Optimization | 6 | Complete | 2026-02-16 |
| 8. Notifications & Observability | 7 | Complete | 2026-02-16 |
| 08.1. Telegram MCP Server | 6 | Planning complete | - |
| 10. GSD Installation System | 4 | Complete | 2026-02-17 |
| 10.1. Multi-Instance MCP Safety | 4 | Complete | 2026-02-17 |
| 11. Session-End Knowledge Extraction | 4 | Complete | 2026-02-17 |
| 12. Historical Conversation Mining | 3 | Planning complete | - |

### Phase 9: Hook-based documentation compression - Optimize context injection by extracting AI-friendly headers from docs and injecting only summaries with absolute links instead of full content

**Goal:** Documentation files (RESEARCH.md, PLAN.md, STATE.md) are automatically compressed via PreToolUse hooks, achieving 60-70% token reduction while preserving access to full content through absolute file links
**Depends on:** Phase 8
**Requirements:** Context optimization via header extraction, PreToolUse hook integration, caching with content-hash invalidation, circuit breaker safety, CLI controls
**Success Criteria** (what must be TRUE):
  1. PreToolUse hook intercepts Read calls for documentation files matching GSD patterns
  2. Header extraction compresses markdown to 60-70% token reduction
  3. Compressed summaries include absolute file links for full content access
  4. Cache prevents redundant compression using content hash + mtime keys
  5. Circuit breaker disables compression after 3 consecutive failures (auto-resets in 5 min)
  6. gsd-tools provides compression commands (status, enable, disable, metrics, clear-cache)
  7. TokenBudgetMonitor triggers compression recommendations at 80% utilization
**Plans:** 4 plans

Plans:
- [ ] 09-01-PLAN.md - Header extraction core (markdown-it, gray-matter, SummaryGenerator)
- [ ] 09-02-PLAN.md - Task Context Skill and routing extensions (SKILL.md, compress summary CLI)
- [ ] 09-03-PLAN.md - PreToolUse hook integration (config, doc-compression-hook, settings.json)
- [ ] 09-04-PLAN.md - Circuit breaker safety and CLI commands (enable/disable/status/metrics)

### Phase 10: GSD Installation System - Comprehensive installer that sets up all dependencies, external modules, Whisper models (en+ru), Claude Code hooks, and MCP servers with zero manual configuration

**Goal:** Users can run a single installation command that: (1) installs all NPM dependencies across modules, (2) downloads and configures Whisper models for English and Russian, (3) installs Claude Code hooks to ~/.claude/, (4) configures MCP servers in .claude/.mcp.json, (5) consolidates external modules (validator, circuit-breaker, escalation, feedback, learning) into repo, (6) verifies installation and provides health check, (7) creates .env template with required variables
**Depends on:** Phase 9
**Requirements:** Installation orchestrator, dependency resolution, Whisper model download (base.en + base.ru or base multilingual), hook installation to ~/.claude/, MCP server configuration, external module consolidation, health check validation
**Success Criteria** (what must be TRUE):
  1. Single install command handles all setup: `npm run install:gsd` or `./scripts/install.sh`
  2. NPM dependencies installed for all modules (get-shit-done/, mcp-servers/telegram-mcp/, external modules)
  3. Whisper models downloaded and verified (base.en + base.ru or base multilingual covering both)
  4. Claude Code hooks installed to ~/.claude/hooks/ (SessionStart, PreToolUse, PostToolUse)
  5. MCP server configuration added to ~/.claude/.mcp.json (or .claude/.mcp.json for project-specific)
  6. External modules moved into repo at get-shit-done/modules/ with proper structure
  7. .env.template created with all required variables (TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID, etc.)
  8. Health check validates: NPM packages, Whisper models, hooks, MCP servers, module imports
  9. Uninstall script available for clean removal
  10. Installation works on macOS, Linux (Ubuntu/Debian), and reports unsupported platforms gracefully
**Plans:** 4 plans

Plans:
- [x] 10-01-PLAN.md - Installation orchestrator and npm workspace configuration
- [x] 10-02-PLAN.md - Whisper model automation and health check
- [x] 10-03-PLAN.md - Hook installation and MCP configuration
- [x] 10-04-PLAN.md - Environment template, uninstall script, and verification

### Phase 10.1: Multi-Instance MCP Safety - Robust concurrent Claude Code support with per-session storage, file locking, and proper answer routing (INSERTED)

**Goal:** Multiple Claude Code instances can run simultaneously without conflicts, answer confusion, or race conditions. Each instance maintains isolated question queues and routing, with proper file locking and session tracking.
**Depends on:** Phase 10
**Requirements:** Per-session JSONL files, file locking (flock/lockfile), session-aware answer routing, backward compatibility with Phase 08.1 quick fix
**Success Criteria** (what must be TRUE):
  1. Each Claude Code instance writes to its own session-scoped JSONL files
  2. File locking prevents simultaneous writes from corrupting data
  3. Answers route to correct session (no cross-instance confusion)
  4. Session cleanup removes old/abandoned sessions automatically
  5. Telegram messages clearly identify which session asked
  6. Works seamlessly when only one instance runs (no overhead)
  7. Backward compatible with existing questions using session_id
**Plans:** 4 plans

Plans:
- [x] 10.1-01-PLAN.md - Session infrastructure (file-lock.ts, session-manager.ts, dependencies)
- [x] 10.1-02-PLAN.md - Question queue refactor to per-session JSONL storage
- [x] 10.1-03-PLAN.md - MCP tools and server lifecycle (session-aware tools, heartbeat, cleanup)
- [x] 10.1-04-PLAN.md - Telegram bot multi-session UI and gitignore configuration

### Phase 11: Session-end knowledge extraction - Implement Haiku-based analysis of completed sessions to extract reasoning patterns and decisions beyond keyword matching

**Goal:** Completed Telegram MCP sessions are automatically analyzed by Haiku 4.5 at session close to extract decisions, reasoning patterns, and meta-knowledge beyond regex matching, storing structured insights in the Phase 3 knowledge system with deduplication, quality gates, and cost controls
**Depends on:** Phase 10.1
**Plans:** 4 plans

Plans:
- [x] 11-01-PLAN.md - Core session analyzer with Task() subagent prompts and conversation_id grouping
- [x] 11-02-PLAN.md - Session quality gates, chunking, and re-analysis prevention
- [x] 11-03-PLAN.md - Knowledge storage integration with dedup and MCP session-end hook
- [x] 11-04-PLAN.md - CLI commands for manual analysis, historical extraction, and status reporting

### Phase 12: Historical conversation mining - Analyze Claude Code project conversations and planning documents to extract meta-knowledge, reasoning patterns, and decision context for enhanced context building

**Goal:** Claude Code project conversations (JSONL files at ~/.claude/projects/{slug}/*.jsonl) are mined for decisions, reasoning patterns, and meta-knowledge using a format adapter that converts Claude Code entries to Phase 11-compatible format, enabling full reuse of the Haiku extraction pipeline with zero Phase 11 infrastructure changes
**Depends on:** Phase 11
**Plans:** 3 plans

Plans:
- [ ] 12-01-PLAN.md - conversation-miner.js core module (format adapter, discovery, quality gate, extraction prep)
- [ ] 12-02-PLAN.md - gsd-tools.js CLI commands (mine-conversations, store-conversation-result)
- [ ] 12-03-PLAN.md - mine-conversations.md workflow and end-to-end integration verification

---
*Roadmap created: 2026-02-15*
*Last updated: 2026-02-18 after Phase 1 gap closure planning (plans 07-09)*
