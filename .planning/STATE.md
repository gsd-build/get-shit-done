# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Claude learns to make autonomous decisions based on user's reasoning patterns, only stopping for irreversible/external/costly actions
**Current focus:** Phase 4 - Knowledge Extraction & Hooks

## Current Position

Phase: 08.1 of 12 (Telegram MCP Server)
Plan: 02 of 08
Status: In Progress
Last activity: 2026-02-17 — Completed plan 08.1-02 (JSONL-Based Persistence Layer)

Progress: [████████████████████████████████████] 96%

## Performance Metrics

**Velocity:**
- Total plans completed: 25
- Average duration: 3.3 min
- Total execution time: 1.5 hours

**By Phase:**

| Phase | Plans | Total  | Avg/Plan |
|-------|-------|--------|----------|
| 01    | 6     | 20 min | 3.3 min  |
| 02    | 6     | 28 min | 4.7 min  |
| 03    | 5     | 16 min | 3.2 min  |
| 04    | 5     | 12 min | 2.4 min  |

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

### Roadmap Evolution

- Phase 08.1 inserted after Phase 08: Telegram MCP Server - Replace standalone bot with MCP integration using subscription tokens (URGENT)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-17T10:27:05Z (plan execution)
Stopped at: Completed 08.1-02-PLAN.md (JSONL-Based Persistence Layer) - Phase 08.1 Plan 02 complete
Resume file: None
