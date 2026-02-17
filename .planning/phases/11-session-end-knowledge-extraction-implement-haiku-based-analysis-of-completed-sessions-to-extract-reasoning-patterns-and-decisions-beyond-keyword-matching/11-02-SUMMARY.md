---
phase: 11-session-end-knowledge-extraction
plan: 02
subsystem: knowledge
tags: [session-analysis, quality-gates, chunking, content-hashing, voice-resolution, cost-control]

requires:
  - phase: 11-01-session-analysis-infrastructure
    provides: analysis-prompts.js, formatEntriesForPrompt() for chunk size measurement
  - phase: 10.1-multi-instance-mcp-safety
    provides: session JSONL storage at .planning/telegram-sessions/

provides:
  - session-quality-gates.js: shouldAnalyzeSession(), getSessionContentHash(), markSessionAnalyzed(), isAlreadyAnalyzed(), getAnalysisStats()
  - session-chunker.js: chunkSession(), resolveVoiceEntries(), prepareSessionForAnalysis()
  - .analysis-log.jsonl: append-only JSONL tracking which sessions have been analyzed with what content hash

affects:
  - 11-03-PLAN.md (historical extractor calls shouldAnalyzeSession and isAlreadyAnalyzed before analysis)
  - 11-04-PLAN.md (session-end hook uses prepareSessionForAnalysis before calling analyzeSession)

tech-stack:
  added: []
  patterns:
    - "Quality gate pattern: shouldAnalyzeSession() returns {analyze, reason} - caller decides, module explains"
    - "Content hash pattern: SHA-256 of sorted substantive entries (not full session) for stable re-analysis detection"
    - "Append-only JSONL log pattern: markSessionAnalyzed() appends one line, never rewrites (crash-safe)"
    - "Entry boundary chunking: chunks split between entries, never mid-entry, metadata header preserved per chunk"
    - "Voice resolution pattern: voice_message entries promoted to user_message with transcription text before analysis"

key-files:
  created:
    - get-shit-done/bin/session-quality-gates.js
    - get-shit-done/bin/session-chunker.js
  modified: []

key-decisions:
  - "shouldAnalyzeSession() uses AND logic for all three thresholds (2+ questions AND 2+ answers AND 10+ total entries) - each threshold serves a different quality signal"
  - "Content hash covers substantive entries only (question/answer/user_message/bot_response) sorted by timestamp - metadata and heartbeat excluded to avoid false cache misses"
  - "Analysis log stored at .planning/telegram-sessions/.analysis-log.jsonl - co-located with session files for discoverability"
  - "chunkSession() measures chunk size via formatEntriesForPrompt() (not raw JSON) - measures what Haiku actually sees in its context"
  - "Voice entries promoted to user_message type after transcription resolution - formatEntriesForPrompt recognizes user_message but not voice_message"

patterns-established:
  - "Gate-before-analyze pattern: shouldAnalyzeSession() + isAlreadyAnalyzed() checked before any API call"
  - "Prepare-then-analyze pattern: prepareSessionForAnalysis() resolves voice + chunks, result passed to analyzeSession()"

duration: 4min
completed: 2026-02-17
---

# Phase 11 Plan 02: Session Quality Gates and Chunking Summary

**SHA-256 content-hash gating, 25k-char entry-boundary chunking, and voice-to-text resolution as pre-analysis pipeline for session-end knowledge extraction**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T21:02:25Z
- **Completed:** 2026-02-17T21:06:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `session-quality-gates.js` with five exports: `shouldAnalyzeSession()` rejects sessions below the 2-question/2-answer/10-entry threshold, `getSessionContentHash()` produces a deterministic SHA-256 hash of substantive entries sorted by timestamp, `markSessionAnalyzed()` appends to an append-only JSONL log for crash-safe tracking, `isAlreadyAnalyzed()` short-circuits re-analysis when session content hasn't changed, and `getAnalysisStats()` aggregates totals for observability
- Created `session-chunker.js` with `chunkSession()` that splits large sessions at entry boundaries using `formatEntriesForPrompt()` for accurate character measurement (what Haiku sees, not raw JSON), `resolveVoiceEntries()` that promotes voice_message entries to user_message with transcription text or a placeholder, and `prepareSessionForAnalysis()` that combines both into one pre-analysis call

## Task Commits

Each task was committed atomically:

1. **Task 1: Create session quality gates and re-analysis prevention** - `9ac5eb2` (feat)
2. **Task 2: Create session chunker with voice text resolution** - `93c26a2` (feat)

**Plan metadata:** (created in final commit)

## Files Created/Modified

- `get-shit-done/bin/session-quality-gates.js` - shouldAnalyzeSession(), getSessionContentHash(), markSessionAnalyzed(), isAlreadyAnalyzed(), getAnalysisStats() — no external deps beyond Node.js crypto/fs
- `get-shit-done/bin/session-chunker.js` - chunkSession(), resolveVoiceEntries(), prepareSessionForAnalysis() — uses formatEntriesForPrompt from analysis-prompts.js

## Decisions Made

- AND logic for quality thresholds: sessions must satisfy all three minimums (questions, answers, total entries) — each catches a different trivial-session case
- Substantive-entries-only hash: SHA-256 excludes heartbeat and session_metadata so routine metadata updates don't invalidate the cache for unchanged conversation content
- `formatEntriesForPrompt()` for chunk measurement: ensures chunk size matches what Haiku actually receives in the prompt, not raw JSON size
- Voice entries promoted to `user_message` type: `formatEntriesForPrompt()` only handles known substantive types; promoting the type ensures voice content is included in analysis

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `shouldAnalyzeSession()` and `isAlreadyAnalyzed()` ready for Plan 11-03 (historical extractor) to gate batch analysis
- `prepareSessionForAnalysis()` ready for Plan 11-04 (session-end hook) to use before calling `analyzeSession()`
- `markSessionAnalyzed()` ready for any caller to persist analysis records after successful extraction
- No blocking issues, no external dependencies added

## Self-Check: PASSED

- FOUND: get-shit-done/bin/session-quality-gates.js
- FOUND: get-shit-done/bin/session-chunker.js
- FOUND: .planning/phases/11-.../11-02-SUMMARY.md
- FOUND: commit 9ac5eb2 (quality-gates)
- FOUND: commit 93c26a2 (chunker)

---
*Phase: 11-session-end-knowledge-extraction*
*Completed: 2026-02-17*
