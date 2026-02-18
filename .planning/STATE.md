# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Claude learns to make autonomous decisions based on user's reasoning patterns, only stopping for irreversible/external/costly actions
**Current focus:** Phase 4 - Knowledge Extraction & Hooks

## Current Position

Phase: 14 of 14 (Telegram MCP and Bot Audit and Rework)
Plan: 03 of 06
Status: In Progress
Last activity: 2026-02-18 — Completed plan 14-03 (Telegram Bot Module: webhook/polling, forum threads, Status/Questions panels, voice transcription)

Progress: [████████████████████████████████████░] 97%

## Performance Metrics

**Velocity:**
- Total plans completed: 36
- Average duration: 3.2 min
- Total execution time: 2.22 hours

**By Phase:**

| Phase | Plans | Total  | Avg/Plan |
|-------|-------|--------|----------|
| 01    | 6     | 20 min | 3.3 min  |
| 02    | 6     | 28 min | 4.7 min  |
| 03    | 5     | 16 min | 3.2 min  |
| 04    | 6     | 14 min | 2.3 min  |
| 09    | 4     | 18 min | 4.5 min  |
| 08.1  | 5     | 19 min | 3.8 min  |
| 10    | 4     | 9 min  | 2.3 min  |
| 10.1  | 4     | 12 min | 3.0 min  |

**Recent Completions:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01    | 05   | 1 min    | 5     | 1     |
| 01    | 06   | 2 min    | 3     | 3     |
| 02    | 01   | 4 min    | 3     | 3     |
| 02    | 02   | 3 min    | 3     | 5     |
| 02    | 03   | 3 min    | 3     | 2     |
| 02    | 04   | 8 min    | 3     | 4     |
| 02    | 05   | 4 min    | 3     | 3     |
| 02    | 06   | 6 min    | 3     | 2     |
| 03    | 01   | 2 min    | 3     | 2     |
| 03    | 02   | 2 min    | 3     | 1     |
| 03    | 03   | 7 min    | 3     | 3     |
| 03    | 04   | 2 min    | 3     | 1     |
| 03    | 05   | 3 min    | 3     | 2     |
| 04    | 01   | 2 min    | 2     | 3     |
| 04    | 02   | 3 min    | 3     | 1     |
| 04    | 03   | 2 min    | 2     | 2     |
| 04    | 04   | 3 min    | 2     | 1     |
| 04    | 05   | 2 min    | 2     | 3     |
| 04    | 06   | 2 min    | 2     | 2     |
| 09    | 02   | 5 min    | 3     | 2     |
| 09    | 03   | 5 min    | 4     | 3     |
| 09    | 04   | 5 min    | 3     | 3     |
| 09    | 05   | 3 min    | 4     | 2     |
| 08.1  | 02   | 4 min    | 3     | 5     |
| 08.1  | 03   | 3 min    | 3     | 5     |
| 08.1  | 04   | 4 min    | 3     | 4     |
| 08.1  | 05   | 5 min    | 3     | 5     |
| 08.1  | 06   | 3 min    | 3     | 4     |
| 10    | 01   | 2 min    | 3     | 13    |
| 10    | 02   | 3 min    | 2     | 2     |
| 10    | 03   | 2 min    | 2     | 2     |
| 10    | 04   | 2 min    | 3     | 3     |
| 10.1  | 01   | 2 min    | 2     | 4     |
| 10.1  | 02   | 3 min    | 2     | 6     |
| 10.1  | 03   | 4 min    | 2     | 6     |
| 10.1  | 04   | 3 min    | 2     | 2     |
| Phase 11 P01 | 4 | 2 tasks | 5 files |
| Phase 11 P02 | 4 | 2 tasks | 2 files |
| Phase 11 P03 | 3 | 2 tasks | 4 files |
| Phase 11 P04 | 4 | 3 tasks | 3 files |
| Phase 12 P01 | 2 | 2 tasks | 1 files |
| Phase 12 P02 | 2 | 1 tasks | 1 files |
| Phase 12 P03 | 3 | 2 tasks | 2 files |
| Phase 06 P02 | 4min | 3 tasks | 3 files |
| Phase 01 P07 | 5min | 1 task | 2 files |
| Phase 01 P08 | 2 | 1 tasks | 2 files |
| Phase 01 P09 | 3min | 2 tasks | 4 files |
| Phase 13 P01 | 2min | 3 tasks | 3 files |
| Phase 14 P01 | 9min | 2 tasks | 8 files |
| Phase 14 P02 | 2min | 2 tasks | 4 files |
| Phase 14 P03 | 6min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Initial roadmap: 8-phase structure with Auto Mode first, then Knowledge, then Autonomous Execution
- Sequence: Auto Mode (1-2) → Knowledge (3-5) → Autonomous (6-7) → Integration (8)
- Phase sizing: 3-5 plans per phase target to avoid context exhaustion
- Parallel execution: Phases 1-2 can run parallel to Phase 3
- [Phase 01]: Use comma-separated patterns in markdown tables instead of pipe-separated to avoid delimiter conflicts
- [Phase 01]: Routing rules: project rules override global rules for same patterns
- [Phase 01-02]: Use simple keyword extraction with stop words instead of NLP library for speed
- [Phase 01-02]: Cache context index for 1 hour to avoid rebuilding on every routing call
- [Phase 01-02]: Weight tag matches 2x higher than keyword matches for scoring
- [Phase 01-02]: Extract CLAUDE.md instructions via pattern matching (bullet/numbered lists)
- [Phase 01-03]: 80% soft warning threshold (shows once per session, non-blocking)
- [Phase 01-03]: 98% hard threshold triggers auto-wait calculation
- [Phase 01-03]: Auto-wait returns duration info for coordinator to handle (not blocking in CLI)
- [Phase 01-03]: Both session and weekly quotas tracked independently
- [Phase 01-04]: Status bar shows: total tokens, last model, time saved, model distribution
- [Phase 01-04]: Stats command calculates cost savings vs hypothetical all-Opus execution
- [Phase 01-04]: Both table (human-readable) and JSON (programmatic) output formats
- [Phase 01-04]: Quota functions integrated into project gsd-tools.js for consistency
- [Phase 01-05]: Use 11 categories to organize routing rules (Testing, Architecture, Implementation, Debugging, Analysis, Refactoring, Security, DevOps, Documentation, Research, Performance)
- [Phase 01-05]: Extract high-level patterns from session logs rather than project-specific patterns
- [Phase 01-05]: Use action verbs with scope modifiers to capture intent and complexity level
- [Phase 01-06]: Escalation ladder: Haiku (20min) → Sonnet (40min) → Opus (60min) before failure
- [Phase 01-06]: Log both fallbacks and matches for comprehensive routing analytics
- [Phase 01-06]: Fallback to Sonnet when routing fails rather than blocking execution
- [Phase 02-01]: Mock validation for infrastructure testing; live Sonnet API integration deferred to execute-plan workflow
- [Phase 02-01]: Three validation depths: light (docs/low-risk), standard (API/config), thorough (auth/security/database)
- [Phase 02-01]: Auto-retry triggers on REDO or FIX with scores < 70
- [Phase 02-01]: JSONL format for validation log enables streaming append and easy analytics
- [Phase 02-02]: Iteration caps (15-20 steps) have HIGHER priority than time limits for execution safety
- [Phase 02-02]: Model-specific timeouts: 20m Haiku, 40m Sonnet, 60m Opus
- [Phase 02-02]: Complexity keywords trigger 1.5x multiplier for task limits
- [Phase 02-02]: Learned multipliers stored in thresholds.json for pattern-based adjustment
- [Phase 02-03]: Weighted error scoring: COMPLETE_REJECTION=1.0, VALIDATION_FIX=0.5, RETRY=0.25
- [Phase 02-03]: Aggressive escalation threshold of 1.0 (1-2 errors trigger escalation)
- [Phase 02-03]: Escalation ladder: haiku → sonnet → opus → null
- [Phase 02-03]: Summary notification at end only (no inline interruptions)
- [Phase 02-03]: JSONL format for escalation log enables streaming and analytics
- [Phase 02-04]: Feedback disabled by default (optional feature flag)
- [Phase 02-04]: Support both human and Opus modes (configurable)
- [Phase 02-04]: Three frequency modes: all, escalations, sample
- [Phase 02-04]: JSONL format for feedback log enables streaming append and easy analytics
- [Phase 02-04]: Task fingerprinting with multi-signal complexity detection (keywords, technical terms, complexity)
- [Phase 02-05]: Multi-signal pattern extraction combines keywords with complexity signals
- [Phase 02-05]: Keyword overlap >50% threshold for pattern consolidation
- [Phase 02-05]: Evidence threshold of 3 feedback entries required to override built-in rules
- [Phase 02-05]: Learned rules in human-readable markdown for transparency and user editing
- [Phase 02-05]: All conflict resolution decisions logged to rule-merge-log.jsonl
- [Phase 02-06]: Execute-plan workflow documents Phase 2 safety integration (validation, circuit-breaker, escalation, feedback)
- [Phase 02-06]: Auto-task orchestration commands provide single entry point for Phase 2 system status and reporting
- [Phase 02-06]: End-of-execution report aggregates validation stats, escalation history, and feedback summary
- [Phase 02-06]: All five Phase 2 modules integrated and tested end-to-end
- [Phase 03-01]: Use WAL mode for better concurrency in knowledge operations
- [Phase 03-01]: Cache database connections per path to avoid repeated opens
- [Phase 03-01]: Gracefully degrade when sqlite-vec unavailable (FTS5 still works)
- [Phase 03-01]: Store per-user databases using OS username
- [Phase 03-01]: PRAGMA user_version for schema migration tracking
- [Phase 03-02]: TTL categories: permanent (null), long_term (90d), short_term (7d), ephemeral (24h)
- [Phase 03-02]: Type defaults: lesson=permanent, decision=long_term, summary=short_term, temp_note=ephemeral
- [Phase 03-03]: RRF (Reciprocal Rank Fusion) with k=60 for hybrid search ranking
- [Phase 03-03]: Type weights for relevance: decisions/lessons 2.0x, summaries 0.5x, temp_notes 0.3x
- [Phase 03-03]: Access boost uses logarithmic scale (1 + log(1 + count)) to prevent dominance
- [Phase 03-03]: AUTOINCREMENT required for knowledge.id to match vec0 auto-assigned rowid
- [Phase 03-03]: sqlite-vec 0.1.6 doesn't support explicit rowid in vec0 tables (auto-assign only)
- [Phase 03-03]: Embedding updates disabled due to vec0 limitation (delete and reinsert instead)
- [Phase 03-02]: SHA-256 for content hash (supports future deduplication queries)
- [Phase 03-02]: L2 normalization for embeddings (cosine similarity ready)
- [Phase 03-02]: refreshTTL extends expiration for frequently-accessed knowledge
- [Phase 03-04]: Type volatility: temp_note=0.9, summary=0.7, decision=0.3, lesson=0.1 for staleness scoring
- [Phase 03-04]: Staleness threshold default: 0.7 (70%) to identify stale knowledge
- [Phase 03-04]: Staleness formula: (dormant_days/30) * volatility * (1/(1 + log(1 + access_count)))
- [Phase 03-04]: WAL checkpoint threshold: 100+ deleted entries to prevent unbounded WAL growth
- [Phase 03-04]: Cleanup uses atomic transactions across main, vec, and FTS tables to prevent orphans
- [Phase 03]: Lazy load knowledge modules to avoid dependency errors at import time
- [Phase 03]: Cache database connections per path to avoid repeated opens
- [Phase 03]: Pass full connection object to search, db property to CRUD functions
- [Phase 04]: Use Nomic Embed v1.5 with 512-dim Matryoshka for local embeddings
- [Phase 04]: Lazy-load embedding pipeline on first use, not at import time
- [Phase 04-02]: Use regex patterns with capture groups for decision/lesson extraction
- [Phase 04-02]: 20-char minimum length threshold for quality gates
- [Phase 04-02]: Technical signals include code backticks, paths, keywords, identifiers
- [Phase 04-02]: All-caps pattern added for technical terms (AUTOINCREMENT, WAL, etc.)
- [Phase 04-02]: Canonical hash normalizes case/punctuation for near-duplicate detection
- [Phase 04-04]: Session-end as default timing mode (less noisy than per-turn)
- [Phase 04-04]: Summaries disabled by default in extraction config (too noisy)
- [Phase 04-04]: Non-blocking error handling in per-turn mode (logs but continues)
- [Phase 04-04]: MD5 hashing for response deduplication tracking
- [Phase 04]: Three-stage deduplication: content hash (1.0) → canonical hash (0.95) → embedding (0.88)
- [Phase 04]: Similarity ranges: >0.88 skip, 0.65-0.88 evolve, <0.65 create
- [Phase 04-03]: Memory evolution appends with timestamp, preserves original content
- [Phase 04-03]: Evolution history limited to 10 entries to prevent unbounded growth
- [Phase 04-03]: Embedding updates disabled (vec0 limitation), existing embedding represents original concept
- [Phase 04-05]: Q&A answers stored as global scope lessons (user preferences cross projects)
- [Phase 04-05]: Gap-based question generation (< 5 lessons, < 3 decisions, < 10 total)
- [Phase 04-05]: Session scanning focuses on assistant responses only
- [Phase 04-05]: Session log age filter defaults to 30 days for discovery
- [Phase 04-05]: 10-character minimum for valid Q&A answers
- [Phase 04-06]: Minimum 5 examples required to form a principle (KNOW-18)
- [Phase 04-06]: Confidence threshold 0.7 for valid principles
- [Phase 04-06]: Only reversible actions can proceed autonomously (KNOW-19)
- [Phase 04-06]: Enhanced delete detection with production/data context awareness
- [Phase 09-02]: On-demand summary extraction vs pre-computed: chose on-demand for routing full (faster index builds)
- [Phase 09-02]: Task Context Skill provides structured output format for orchestrators
- [Phase 09-02]: HeaderExtractor lazy-loaded to avoid dependency errors at import time
- [Phase 09-03]: Cache key combines filePath + content + mtime for reliable cache invalidation
- [Phase 09-03]: Match both full path and basename for flexible glob pattern matching
- [Phase 09-03]: 5-minute default cache TTL balances freshness and performance
- [Phase 09-03]: Pass-through on error (don't block reads) for resilience
- [Phase 09-04]: Circuit breaker with 3-failure threshold before opening
- [Phase 09-04]: 5-minute auto-reset timeout for circuit recovery
- [Phase 09-04]: Half-open state allows one test request before full recovery
- [Phase 09-04]: Separate state file (compression-state.json) from config for runtime state
- [Phase 09-05]: At 80% utilization, reserve() includes exact command to enable compression
- [Phase 09-05]: Existing token_budget.json state preserved on load (not reset)
- [Phase 09-05]: Five graduated alert thresholds (50/65/80/90/95%) for progressive warnings
- [Phase 09-05]: Recommendation includes full command path for immediate execution
- [Phase 08]: Use __dirname for dotenv path resolution (stable, script-relative)
- [Phase 08]: Capture PROJECT_ROOT at module load time (before any cwd changes)
- [Phase 08]: Replace process.cwd() with PROJECT_ROOT in session logger paths
- [Phase 08.1-02]: Use PROJECT_ROOT resolution (env var or path traversal) for MCP server JSONL storage paths
- [Phase 08.1-02]: UUID for question IDs, ISO timestamp for requirement IDs
- [Phase 08.1-02]: Archive answered questions to daily session logs instead of deleting
- [Phase 08.1-01]: Use @modelcontextprotocol/sdk official TypeScript SDK for MCP protocol implementation
- [Phase 08.1-01]: Placeholder tool implementations return mock responses until Plan 02
- [Phase 08.1-01]: All logging to stderr (stdout reserved for JSON-RPC)
- [Phase 08.1-03]: Long polling with 5-second intervals, max 300 seconds (5 minutes) to prevent MCP client hangs
- [Phase 08.1-03]: Centralized tool exports via tools/index.ts for cleaner server imports
- [Phase 08.1-03]: Error handling in CallToolRequestSchema returns errors in MCP format rather than throwing
- [Phase 08.1-03]: MCP tool handler pattern exports both handler function and tool definition for registration
- [Phase 08.1-04]: Use session middleware instead of .once() listeners to fix Phase 8 bug where menu buttons only work once
- [Phase 08.1-04]: Daily JSONL logs (YYYY-MM-DD.jsonl) instead of per-session timestamp files for unified session tracking
- [Phase 08.1-04]: Lazy-load whisper-node to avoid cwd corruption on import
- [Phase 08.1-04]: New Requirements button DISABLED per user decision (conversational flow not compatible with Telegraf)
- [Phase 08.1]: Lazy bot initialization to allow MCP server startup without TELEGRAM_BOT_TOKEN
- [Phase 08.1-06]: Track .claude/.mcp.json in git with negation pattern for team sharing
- [Phase 08.1-06]: Graceful degradation required - system must work without Telegram MCP
- [Phase 08.1-06]: checkTelegramMCP utility function for availability detection
- [Phase 10-01]: Use npm workspaces for unified dependency management (automatic hoisting, npm 7+)
- [Phase 10-01]: Create module stubs with placeholder exports to enable workspace config without implementation
- [Phase 10-01]: Detect npx github:user/repo scenario and delegate to bin/install.js for different installation contexts
- [Phase 10-01]: Gracefully skip missing installers (whisper, hooks, MCP, env, health-check) to allow Plan 01 to work independently
- [Phase 10-02]: Use direct HTTPS download instead of npx whisper-node download (bypasses interactive TTY)
- [Phase 10-02]: Skip .env.template check if .env exists (user has configured environment)
- [Phase 10-03]: Prefer hooks/dist/ over hooks/ source for bundled hook distribution
- [Phase 10-03]: Skip statusLine configuration if already set (preserve user customization)
- [Phase 10-03]: Merge GSD MCP servers with existing .mcp.json, user servers take precedence
- [Phase 10-03]: Create backup before .mcp.json modification for safety
- [Phase 10-03]: Export single function when required as module, matching install-whisper.js pattern
- [Phase 10-02]: Use direct HTTPS download instead of npx whisper-node download (bypasses interactive TTY)
- [Phase 10-02]: Skip .env.template check if .env exists (user has configured environment)
- [Phase 10-04]: Separate required and optional environment variables in template for clear user guidance
- [Phase 10-04]: Preserve user data (.planning/, .env, Whisper models) during uninstall
- [Phase 10-04]: Use Node.js for JSON manipulation in uninstall script for cross-platform reliability
- [Phase 10-04]: Create backups before modifying user config files for safety
- [Phase 10.1-01]: Use proper-lockfile instead of custom locking for production-ready file protection
- [Phase 10.1-01]: PID check via process.kill(pid, 0) instead of process-exists package for simplicity
- [Phase 10.1-01]: 24-hour heartbeat TTL balances cleanup speed with session persistence
- [Phase 10.1-01]: 10% corruption threshold triggers warnings in self-healing JSONL reader
- [Phase 10.1-01]: Opportunistic cleanup on session creation prevents stale session buildup
- [Phase 10.1-01]: Date-based archive folders (YYYY-MM-DD) enable organized historical session storage
- [Phase 10.1-02]: Changed PendingQuestion.session_id from number (PID) to string (UUID)
- [Phase 10.1-02]: Questions stored in per-session JSONL files, not global pending.jsonl
- [Phase 10.1-02]: markAnswered updates in-place within session file (no separate archiving)
- [Phase 10.1-03]: Session state module provides shared getCurrentSessionId() for tools
- [Phase 10.1-03]: MCP server creates session on startup and sets ID for tools
- [Phase 10.1-03]: Heartbeat interval runs every 5 minutes during server operation
- [Phase 10.1-04]: Button callback format answer:<sessionId>:<questionId> for session routing
- [Phase 10.1-04]: Session labels shown in question list for user identification
- [Phase 10.1-04]: Auto-match preserved for single pending question (zero overhead)
- [Phase 10.1-04]: loadAllPendingQuestions for bot, loadPendingQuestions(sessionId) for tools
- [Phase 11-01]: All Haiku analysis via Task() subagent - analyzeSession() returns extraction request objects, caller invokes Task() - zero @anthropic-ai/sdk usage
- [Phase 11-01]: context_snippet required for grounding: parseExtractionResult filters any item with empty/short context_snippet to prevent hallucinated knowledge
- [Phase 11-01]: conversation_id optional for backward compat: existing PendingQuestion entries without conversation_id grouped under 'ungrouped' key
- [Phase 11]: shouldAnalyzeSession() AND logic for all three thresholds (2+ questions AND 2+ answers AND 10+ total entries) - each catches different trivial-session case
- [Phase 11]: Content hash covers substantive entries only sorted by timestamp - metadata/heartbeat excluded to avoid false cache misses on unchanged conversations
- [Phase 11]: chunkSession() measures via formatEntriesForPrompt() (not raw JSON) - chunk size matches what Haiku actually sees in prompt
- [Phase 11-03]: session_analysis_pending JSONL entry as async handoff signal - MCP prepares extraction requests, GSD workflow reads entry and invokes Haiku Task()
- [Phase 11-03]: createRequire(import.meta.url) in ESM session-manager.ts for requiring CommonJS get-shit-done/bin/*.js quality-gates and analyzer modules
- [Phase 11-03]: Embedding stage of dedup skipped at session-close time - hash-based stages 1 and 2 always run for reliable synchronous dedup
- [Phase 11-03]: insertOrEvolve used for all insertions (not just near-duplicates) so canonical_hash metadata is always written for future Stage 2 dedup
- [Phase 11-04]: historical-extract.js returns extraction requests (not results) - same Task() subagent pattern as session-analyzer.js, maintains zero direct API calls
- [Phase 11-04]: ROADMAP.md completed phase detection uses three patterns: [x] checkbox, table Complete/Done status, and ## [x] section header
- [Phase 11-04]: list-pending-sessions double-guards against re-analysis: session_analysis_complete JSONL entry check AND isAlreadyAnalyzed() call
- [Phase 11-04]: store-analysis-result appends session_analysis_complete to JSONL after storing insights, enabling list-pending-sessions filter
- [Phase 12]: Use separate .planning/knowledge/.conversation-analysis-log.jsonl for conversation re-analysis prevention (separate from Telegram session log)
- [Phase 12]: shouldMineConversation() uses bot_response >= 2 and totalChars >= 500 thresholds for conversation format, never shouldAnalyzeSession() which requires question/answer types
- [Phase 12]: Lazy-require Phase 11 modules inside prepareConversationForMining() body to match gsd-tools.js lazy-loading pattern
- [Phase 12-02]: Separate conversation analysis log at .planning/knowledge/.conversation-analysis-log.jsonl — never writes to telegram-sessions log to prevent cross-domain contamination
- [Phase 12-02]: filteredArgs conditional guard: only filter when --content-hash flag present (contentHashIdx !== -1) to avoid off-by-one dropping sessionId at index 0 when flag absent
- [Phase 12-03]: mine-conversations.md follows analyze-pending-sessions.md pattern: purpose, constraints, process steps, success_criteria — consistent UX for both session and conversation mining
- [Phase 12-03]: contentHash propagated from prepareConversationForMining through cmdMineConversations output — workflow passes --content-hash to store-conversation-result for correct re-analysis prevention
- [Phase 06]: Fresh context per phase via Task() sub-coordinator spawning - no context bleed across phases
- [Phase 06]: User confirmation gate required before autonomous roadmap execution
- [Phase 06]: Sequential phase execution by default, parallel execution requires explicit user opt-in
- [Phase 06]: JSONL format for EXECUTION_LOG.md enables streaming append and resume state tracking
- [Phase 01-07]: Multi-signal routing: keyword (0-50) + length (0-25) + structural (0-25) = 0-100 complexity score
- [Phase 01-07]: Tier boundaries: score <=30 → haiku, 31-70 → sonnet, 71+ → opus
- [Phase 01-07]: No-match default: 25 pts keyword signal (unknown tasks land in sonnet territory)
- [Phase 01-07]: Length buckets refined: <=5 words=3pts, 6-20=8pts, 21-50=15pts for haiku/sonnet differentiation
- [Phase 01-07]: loadRoutingRules filter bug fixed: removed overly-aggressive 'architecture'/'testing' pattern filter that stripped real patterns
- [Phase 01-08]: quota-aware routing wraps selectModelFromRules() without modifying it — clean separation of concerns
- [Phase 01-08]: Downgrade ladder: >80% quota downgrades opus to sonnet; >95% downgrades opus/sonnet to haiku
- [Phase 01-08]: quota_adjusted bool + quota_percent included in all responses for coordinator observability
- [Phase 01-09]: gsd-task-router agent is the agent-layer bridge between coordinators and routing match-with-quota CLI command
- [Phase 01-09]: gsd-phase-coordinator reads model_profile once before executor loop — single config read per phase
- [Phase 01-09]: EXECUTOR_MODEL variable replaces hardcoded sonnet in Task() spawn; fallback to sonnet when profile != auto
- [Phase 01-09]: routing_context block appended to executor prompt only when auto profile active — observable auto mode metadata
- [Phase 13-01]: Lazy-load opossum inside createTaskBreaker() so gsd-circuit-breaker.js works without the dep for checkExecution/getAdaptiveThresholds
- [Phase 13-01]: checkExecution() gate uses fail-open pattern (errors return proceed:true to never block execution)
- [Phase 13-01]: Token monitor uses process.env.HOME-based absolute path for hooks/config.js (not __dirname-relative, supports varied install locations)
- [Phase 13-01]: TELEGRAM_STANDALONE_FORCE=1 env var overrides dual-bot race condition guard
- [Phase 13-01]: telegram?.bot optional chaining fixes pre-existing null crash when TELEGRAM_BOT_TOKEN not set
- [Phase 14-01]: Pino used for structured logging — bundled TypeScript types, zero-config stderr destination via pino.destination({dest:2})
- [Phase 14-01]: Socket path uses SHA-1 of PROJECT_ROOT (first 8 hex chars) for project-scoped collision avoidance at /tmp/telegram-mcp-{hash}.sock
- [Phase 14-01]: IPCMethod as union type (not enum) for ESM/NodeNext moduleResolution compatibility
- [Phase 14-01]: graduated-alerts.js --telegram flag deprecated silently with comment (standalone bot deleted, feature was never in production use)
- [Phase 14-02]: IPCServer extends EventEmitter so daemon can listen for client_disconnected without coupling to bot logic
- [Phase 14-02]: clientId -> sessionId reverse map in SessionService for O(1) disconnect lookup
- [Phase 14-02]: Plan 04 stubs return { status: 'not_implemented' } to keep daemon startable before question service exists
- [Phase 14-03]: initializeBot() creates Telegraf + session middleware only; setupHandlers not called until startBot() has sessionService in scope
- [Phase 14-03]: Webhook mode uses Node built-in http module — no express dependency (not in package.json)
- [Phase 14-03]: handlerEvents named EventEmitter exported from handlers.ts — explicit import avoids emitter/listener mismatch
- [Phase 14-03]: Whisper cwd guard uses finally block to guarantee restore even on transcription failure

### Roadmap Evolution

- Phase 08.1 inserted after Phase 08: Telegram MCP Server - Replace standalone bot with MCP integration using subscription tokens (URGENT)
- Phase 14 added: Telegram MCP and bot audit and rework — pending questions not found by bot, buttons not working, full end-to-end review needed
- Phase 14 Plan 01 complete: AUDIT.md written, standalone bot deleted, shared foundation modules created
- Phase 14 Plan 02 complete: IPC server (NDJSON Unix socket) and SessionService (in-memory registry with events) created; daemon entry point bootstraps full IPC method routing
- Phase 14 Plan 03 complete: Daemon bot module created — webhook/polling auto-detect, forum thread support, Status/Questions panels, voice transcription with cwd fix, handlerEvents EventEmitter for Plan 04 wiring

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-18T14:05:51Z (plan execution)
Stopped at: Completed 14-03-PLAN.md (Bot Module) - Phase 14 Plan 03 - daemon/bot/index.ts, handlers.ts, menu.ts, whisper.ts created
Resume file: None
