---
phase: 03-knowledge-system-foundation
plan: 04
subsystem: knowledge-lifecycle
tags: [lifecycle, ttl, cleanup, access-tracking, staleness, maintenance]
dependency-graph:
  requires:
    - 03-01: Database infrastructure with WAL mode
    - 03-02: CRUD operations for knowledge management
  provides:
    - TTL-based automatic cleanup
    - Access tracking for relevance boosting
    - Staleness scoring for quality assessment
    - WAL maintenance utilities
  affects:
    - Knowledge quality over time
    - Database maintenance operations
    - Access-based ranking (03-03)
tech-stack:
  added: []
  patterns:
    - Atomic transactions for multi-table cleanup
    - WAL checkpointing after large operations
    - Logarithmic staleness scoring
    - Type-based volatility scoring
    - Batch access tracking for efficiency
key-files:
  created:
    - get-shit-done/bin/knowledge-lifecycle.js (333 lines)
  modified: []
decisions:
  - Type volatility: temp_note=0.9, summary=0.7, decision=0.3, lesson=0.1
  - Staleness threshold default: 0.7 (70%)
  - Staleness formula: (dormant_days/30) * volatility * (1/(1 + log(1 + access_count)))
  - WAL checkpoint threshold: 100+ deleted entries
  - Cleanup transaction includes: main table, vec table (FTS5 via triggers)
metrics:
  duration: 97s (1m 37s)
  completed: 2026-02-16
  tasks: 3 (consolidated)
  commits: 1
  files: 1
---

# Phase 03 Plan 04: Knowledge Lifecycle Management Summary

TTL-based lifecycle management with automatic cleanup, access tracking, and staleness scoring for knowledge quality assessment.

## What Was Built

Created `knowledge-lifecycle.js` module providing comprehensive lifecycle management:

### TTL Cleanup (Task 1)

**cleanupExpired(db):**
- Finds all expired knowledge (expires_at < now)
- Deletes atomically from main table, vector table, and FTS5 (via triggers)
- Returns `{ deleted: number, ids: number[] }`
- Triggers WAL checkpoint if deleted > 100 entries

**checkpointWAL(db):**
- Runs `PRAGMA wal_checkpoint(TRUNCATE)`
- Merges WAL changes to main database
- Returns `{ success: boolean, error?: string }`

**scheduleCleanup(db, intervalMs):**
- Sets up periodic cleanup interval
- Default: 24 hours
- For future daemon mode (CLI tools run cleanup on startup)

**Transaction pattern:**
```javascript
db.transaction(() => {
  // Get IDs to delete
  // Delete from vec table (if vector enabled)
  // Delete from main table (triggers FTS5 cleanup)
  return { deleted, ids }
})()
```

This ensures no orphaned entries across tables.

### Access Tracking (Task 2)

**trackAccess(db, knowledgeId):**
- Increments `access_count`
- Updates `last_accessed` timestamp
- Returns `{ updated: boolean }`

**trackAccessBatch(db, knowledgeIds):**
- Batch version for efficiency
- Wrapped in transaction
- Returns `{ updated: number }`

**getAccessStats(db, options):**
- Aggregate metrics by type and scope
- Returns: total_count, total_accesses, avg_accesses, max_accesses, avg_age_ms
- Supports filtering by scope and type

**Integration with search (03-03):**
Access tracking enables the access boost in hybrid search:
```javascript
final_score = rrf_score * type_weight * (1 + log(1 + access_count))
```

### Staleness Scoring (Task 3)

**getStalenessScore(db, knowledgeId):**
Computes staleness based on four factors:

1. **Age**: Time since creation (ageDays)
2. **Dormancy**: Time since last access or creation (dormantDays)
3. **Type volatility**: How quickly this type becomes stale
   - `temp_note`: 0.9 (high volatility)
   - `summary`: 0.7 (medium-high)
   - `decision`: 0.3 (low)
   - `lesson`: 0.1 (very low)
4. **Access frequency**: High access_count reduces staleness

**Formula:**
```javascript
accessFactor = 1 / (1 + log(1 + access_count))
timeFactor = dormantDays / 30  // Normalize to 30-day scale
staleness = min(1.0, timeFactor * volatility * accessFactor)
```

**Returns:**
```javascript
{
  id, type,
  age_days, dormant_days, access_count,
  volatility,
  staleness_score,  // 0.0 (fresh) to 1.0 (completely stale)
  expires_at,
  is_stale          // true if staleness_score > 0.7
}
```

**getStaleKnowledge(db, options):**
- Finds entries above staleness threshold
- Default threshold: 0.7
- Sorts by staleness_score descending (most stale first)
- Excludes expired entries (only active knowledge)
- Returns array of staleness metrics

**markRefreshed(db, knowledgeId):**
- Resets dormancy timer by updating last_accessed
- Used when knowledge is verified as still relevant
- Returns `{ success: boolean }`

## Implementation Notes

### Task Consolidation

All three tasks implemented as a single cohesive module (333 lines):
- Task 1: TTL cleanup (lines 20-98)
- Task 2: Access tracking (lines 100-199)
- Task 3: Staleness scoring (lines 201-310)

This follows the established pattern from 03-01, 03-02, 03-03.

### Transaction Usage

All multi-table operations use transactions:
- **cleanupExpired**: Delete from vec + main table atomically
- **trackAccessBatch**: Batch updates in single transaction

### Staleness Design Rationale

The staleness formula balances three concerns:

1. **Time decay**: Older, less-accessed knowledge becomes stale
2. **Type sensitivity**: Lessons age slowly, temp notes age quickly
3. **Usage signals**: Frequently accessed = still relevant

**Example scenarios:**

| Type | Age | Access Count | Dormancy | Staleness | Is Stale |
|------|-----|--------------|----------|-----------|----------|
| lesson | 90d | 10 | 30d | ~0.05 | No |
| decision | 90d | 2 | 60d | ~0.45 | No |
| summary | 30d | 0 | 30d | ~0.70 | Yes |
| temp_note | 10d | 0 | 10d | ~0.30 | No |

### WAL Checkpointing

Checkpoint triggers after large cleanup (100+ entries) to:
- Prevent unbounded WAL growth
- Reclaim disk space
- Improve read performance

For small cleanups (< 100), SQLite's auto-checkpoint (every 1000 pages) is sufficient.

## Deviations from Plan

**None** - All functionality delivered exactly as specified.

## Verification Results

All verification criteria passed:

1. ✅ cleanupExpired removes all expired entries atomically
2. ✅ Vector and FTS entries cleaned up together (no orphans)
3. ✅ WAL checkpoint after large cleanup (>100 entries)
4. ✅ trackAccess increments access_count and updates last_accessed
5. ✅ trackAccessBatch handles multiple IDs in transaction
6. ✅ getAccessStats returns aggregate metrics by type/scope
7. ✅ Staleness score considers: dormancy, access count, type volatility
8. ✅ Type volatility: temp_note=0.9, summary=0.7, decision=0.3, lesson=0.1
9. ✅ getStalenessScore returns 0.0-1.0 range
10. ✅ getStaleKnowledge returns entries above threshold
11. ✅ is_stale flag at 0.7 threshold
12. ✅ markRefreshed resets dormancy timer

**Tested scenarios:**
- Insert ephemeral entry, expire it, cleanup → deleted=1
- Track access 3 times → access_count=3
- Batch track 2 entries → updated=2
- Get access stats by type and scope → returns aggregate data
- Recent entry staleness → score near 0.0, is_stale=false
- Query stale knowledge → returns sorted list by staleness
- Mark entry as refreshed → last_accessed updated
- WAL checkpoint → success=true

## Files Changed

**Created:**
- `get-shit-done/bin/knowledge-lifecycle.js` (333 lines)

**Modified:**
- None

## Next Steps

This lifecycle system enables:
- **03-05**: CLI commands for knowledge maintenance (`gsd knowledge cleanup`, `gsd knowledge stats`)
- **Phase 4**: Automatic cleanup on startup
- **Phase 5**: Staleness-based knowledge review workflows
- **Phase 6**: Quality assessment for autonomous decision-making

The lifecycle system is production-ready:
- Atomic transactions prevent data corruption
- Type-based volatility reflects knowledge semantics
- Access tracking provides usage signals
- Staleness scoring identifies candidates for review/deletion
- WAL maintenance prevents unbounded growth

## Self-Check

Verifying deliverables exist and commits are valid.

**File existence:**
```bash
[ -f "get-shit-done/bin/knowledge-lifecycle.js" ] && echo "FOUND" || echo "MISSING"
# FOUND

wc -l get-shit-done/bin/knowledge-lifecycle.js
# 333 get-shit-done/bin/knowledge-lifecycle.js
```

**Commit verification:**
```bash
git log --oneline | head -1
# 712664f feat(03-04): implement knowledge lifecycle management
```

**Module functionality:**
```bash
node -e "
const lifecycle = require('./get-shit-done/bin/knowledge-lifecycle.js');
console.log('Exports:', Object.keys(lifecycle).join(', '));
"
# Exports: cleanupExpired, checkpointWAL, scheduleCleanup, trackAccess, trackAccessBatch, getAccessStats, getStalenessScore, getStaleKnowledge, markRefreshed
```

**Exports match plan requirements:**
- ✅ cleanupExpired
- ✅ checkpointWAL
- ✅ trackAccess
- ✅ trackAccessBatch
- ✅ getAccessStats
- ✅ getStalenessScore
- ✅ getStaleKnowledge
- ✅ markRefreshed
- ✅ scheduleCleanup (bonus export for future daemon mode)

**Min lines requirement:** 333 lines (requirement: 120) ✅

## Self-Check: PASSED

All files exist, commits are valid, and module functions correctly.
