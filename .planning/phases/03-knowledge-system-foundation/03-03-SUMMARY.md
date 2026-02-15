---
phase: 03-knowledge-system-foundation
plan: 03
subsystem: knowledge-search
tags: [search, fts5, vector-search, hybrid-search, rrf, ranking]
dependency-graph:
  requires:
    - 03-01: Database infrastructure with FTS5 and vec0 tables
    - 03-02: CRUD operations for knowledge insertion
  provides:
    - Multi-phase search pipeline (FTS5 + vector + hybrid)
    - RRF-based result fusion
    - Type-weighted relevance scoring
    - Access-based boosting
  affects:
    - Knowledge retrieval operations
    - CLI search commands (03-05)
    - Autonomous decision-making (Phase 6+)
tech-stack:
  added:
    - Reciprocal Rank Fusion (RRF) algorithm with k=60
  patterns:
    - BM25 ranking for FTS5 full-text search
    - Cosine similarity for vector search
    - Logarithmic access boost scaling
    - Graceful degradation when vec0 unavailable
key-files:
  created:
    - get-shit-done/bin/knowledge-search.js (356 lines)
  modified:
    - get-shit-done/bin/knowledge-db.js (schema fix: AUTOINCREMENT)
    - get-shit-done/bin/knowledge-crud.js (vec0 insert fix)
decisions:
  - Use RRF with k=60 (standard constant from OpenSearch/Azure)
  - Type weights: decisions/lessons 2.0x, summaries 0.5x, temp_notes 0.3x
  - Access boost: logarithmic scale (1 + log(1 + count)) prevents dominance
  - Fetch 3x candidates for RRF fusion (limit * 3) for better ranking
  - Graceful degradation: FTS-only when vector unavailable
  - FTS5 query sanitization removes special characters to prevent syntax errors
  - sqlite-vec 0.1.6 uses 'k' parameter in MATCH clause (not LIMIT)
  - AUTOINCREMENT required for knowledge.id to match vec0 auto-assigned rowid
  - Disable embedding updates (vec0 limitation) with clear error message
metrics:
  duration: 398s (6m 38s)
  completed: 2026-02-16
  tasks: 3 (consolidated)
  commits: 2 (bug fix + feature)
  files: 3
---

# Phase 03 Plan 03: Multi-Phase Search Pipeline Summary

Hybrid search combining FTS5 keyword ranking, vector similarity, and RRF fusion with type weights and access boosting.

## What Was Built

Created `knowledge-search.js` providing comprehensive search capabilities:

### FTS5 Keyword Search
- **BM25 ranking**: SQLite's built-in relevance scoring for full-text queries
- **Query sanitization**: Strips FTS5 special characters `(){}[]^"~*?:\` to prevent syntax errors
- **Filtering**: Scope (global/project), types (decision/lesson/summary/temp_note)
- **TTL awareness**: Excludes expired entries automatically
- **Error handling**: Returns empty array on malformed queries instead of throwing

### Vector Similarity Search
- **Cosine distance**: Uses sqlite-vec's built-in cosine metric (0 = identical, 2 = opposite)
- **L2 normalization**: Embeddings normalized to unit length before search
- **Graceful degradation**: Returns empty array if sqlite-vec unavailable (FTS fallback)
- **sqlite-vec 0.1.6 compatibility**: Uses `k` parameter in MATCH clause (not explicit rowid)
- **Filtering**: Same scope/type/TTL support as FTS5

### Hybrid Search with RRF
- **Reciprocal Rank Fusion**: Standard algorithm (k=60) for combining ranked lists
- **Three-phase pipeline**:
  1. Gather candidates from FTS and vector (3x limit each)
  2. Calculate RRF scores: `score = 1 / (k + rank)`
  3. Apply type weights and access boost, sort by final score

- **Type weighting** (per KNOW-07):
  - `decision`: 2.0x (high priority)
  - `lesson`: 2.0x (high priority)
  - `summary`: 0.5x (lower priority)
  - `temp_note`: 0.3x (lowest priority)

- **Access boosting** (per KNOW-11):
  - Formula: `1 + log(1 + access_count)`
  - Logarithmic scale prevents highly-accessed items from dominating
  - New entries (access_count=0) get boost of 1.0 (no penalty)

- **Source tracking**: Results include `sources: ['fts']`, `['vec']`, or `['fts', 'vec']`

### API Surface

**Main exports:**
- `searchKnowledge(conn, query, options)` - Convenience wrapper for hybrid search
- `ftsSearch(db, query, options)` - FTS5-only search with BM25 ranking
- `vectorSearch(conn, embedding, options)` - Vector-only similarity search
- `hybridSearch(conn, { query, embedding, ...options })` - Full RRF hybrid search
- `normalizeEmbedding(embedding)` - L2 normalization utility
- `sanitizeFTSQuery(query)` - FTS5 query sanitizer
- `TYPE_WEIGHTS` - Type weighting constants

**Options:**
- `limit`: Maximum results (default: 10 for hybrid, 20 for individual searches)
- `scope`: Filter by 'global' or 'project'
- `types`: Array of types to filter (e.g., `['decision', 'lesson']`)
- `k`: RRF constant (default: 60)

## Implementation Notes

### Task Consolidation

All three tasks implemented as a single cohesive module:
- Task 1: FTS5 search (lines 35-115)
- Task 2: Vector search (lines 117-202)
- Task 3: Hybrid RRF (lines 204-330)

This follows the principle established in 03-01 and 03-02: don't create artificial boundaries when functions share constants, utilities, and design patterns.

### sqlite-vec 0.1.6 Compatibility

The plan and research documented sqlite-vec with explicit rowid support, but version 0.1.6 does **not** support this:

```sql
-- Documented pattern (doesn't work in 0.1.6)
INSERT INTO knowledge_vec (rowid, embedding) VALUES (?, ?)
-- Error: "Only integers are allowed for primary key values"

-- Working pattern (0.1.6)
INSERT INTO knowledge_vec (embedding) VALUES (?)
-- Auto-assigns sequential rowid
```

**Solution implemented:**
1. Use `INTEGER PRIMARY KEY AUTOINCREMENT` in knowledge table (fixed in knowledge-db.js)
2. Insert knowledge row first to get ID
3. Immediately insert vec row (gets matching rowid via auto-increment)
4. Validate rowid match in transaction (rollback if mismatch)

This ensures `knowledge.id == knowledge_vec.rowid` for JOIN operations.

### Vector Search Query Syntax

sqlite-vec 0.1.6 requires `k` parameter in MATCH clause for KNN queries:

```sql
-- Simple case (no filters)
WHERE embedding MATCH ? AND k = ?

-- With filters (fetch more, filter, limit)
WHERE embedding MATCH ? AND k = ?
  AND type IN (...)
  AND scope = ?
```

The search module handles both cases:
- No filters: use exact limit in `k` parameter
- With filters: fetch 3x limit, apply filters, slice to limit

## Deviations from Plan

### Auto-Fixed Issues (RULE 1 & 3)

**1. Schema missing AUTOINCREMENT (blocking bug)**
- **Found during:** Task 1 verification (vector search testing)
- **Issue:** knowledge table used `INTEGER PRIMARY KEY` without AUTOINCREMENT
- **Impact:** Deleting entries allowed rowid reuse, breaking vec0 JOIN correlation
- **Fix:** Added AUTOINCREMENT to schema, deleted dev database to force recreation
- **Files modified:** `get-shit-done/bin/knowledge-db.js`
- **Commit:** e5b9677

**2. vec0 table insert syntax (blocking bug)**
- **Found during:** Task 2 verification (embedding insertion testing)
- **Issue:** CRUD module tried explicit rowid specification: `INSERT INTO knowledge_vec (rowid, embedding) VALUES (?, ?)`
- **Root cause:** sqlite-vec 0.1.6 doesn't support explicit rowid in vec0 tables
- **Fix:** Changed to auto-insert `INSERT INTO knowledge_vec (embedding) VALUES (?)` with rowid mismatch validation
- **Side effect:** Disabled embedding updates (returns error with clear message)
- **Files modified:** `get-shit-done/bin/knowledge-crud.js`
- **Commit:** e5b9677

**3. Vector search query syntax (implementation bug)**
- **Found during:** Task 2 verification
- **Issue:** Initial implementation used `LIMIT ?` instead of `k = ?` in MATCH clause
- **Fix:** Refactored to use `k` parameter with conditional logic for filtered vs unfiltered queries
- **Files modified:** `get-shit-done/bin/knowledge-search.js` (before commit)
- **Commit:** 97cf381 (included in main implementation)

All three issues were auto-fixed per deviation rules (RULE 1: bugs, RULE 3: blocking issues). No architectural decisions required.

## Verification Results

All verification criteria passed:

1. ✅ ftsSearch returns BM25-ranked results with proper scoring
2. ✅ vectorSearch returns distance-ranked results (lower = more similar)
3. ✅ hybridSearch combines both with RRF (k=60)
4. ✅ Type weights: decision=2.0, lesson=2.0, summary=0.5, temp_note=0.3
5. ✅ Access boost: 1 + log(1 + access_count)
6. ✅ Expired entries excluded from all searches
7. ✅ Empty queries/embeddings handled gracefully (return empty array)
8. ✅ FTS5 query sanitization prevents syntax errors
9. ✅ Vector search works with sqlite-vec 0.1.6 (k parameter)
10. ✅ Graceful degradation when vectorEnabled=false

**Tested scenarios:**
- FTS5 search with query "SQLite storage" → correct BM25 ranking
- Vector search with matching embedding → distance ~0.0 (identical)
- Vector search with distinct embeddings → correct similarity ordering
- Hybrid search with both FTS and vector → sources=['fts', 'vec']
- Type filtering: lessons-only FTS search
- Scope filtering: project-only results
- Empty query handling: returns [] without errors
- Special character sanitization: `test (query) *special*` → `test query special`

## Files Changed

**Created:**
- `get-shit-done/bin/knowledge-search.js` (356 lines)

**Modified:**
- `get-shit-done/bin/knowledge-db.js`: Added AUTOINCREMENT to knowledge table schema
- `get-shit-done/bin/knowledge-crud.js`: Fixed vec0 insert syntax, disabled embedding updates

## Next Steps

This search infrastructure enables:
- **03-04**: TTL cleanup (can now search for entries near expiration)
- **03-05**: CLI search commands (`gsd knowledge search`)
- **Phase 4**: Context injection (retrieve relevant knowledge for prompts)
- **Phase 6**: Autonomous execution (search past decisions/lessons before acting)

The hybrid search is production-ready:
- Handles both keyword and semantic queries
- Gracefully degrades if vector search unavailable
- Type weighting prioritizes decisions and lessons
- Access tracking boosts frequently-used knowledge
- RRF fusion outperforms single-method retrieval

## Self-Check

Verifying deliverables exist and commits are valid.

**File existence:**
```bash
[ -f "get-shit-done/bin/knowledge-search.js" ] && echo "FOUND" || echo "MISSING"
# FOUND

wc -l get-shit-done/bin/knowledge-search.js
# 356 get-shit-done/bin/knowledge-search.js
```

**Commit verification:**
```bash
git log --oneline | grep -q "e5b9677" && echo "FOUND: e5b9677" || echo "MISSING"
# FOUND: e5b9677 (fix: AUTOINCREMENT + vec0 insert syntax)

git log --oneline | grep -q "97cf381" && echo "FOUND: 97cf381" || echo "MISSING"
# FOUND: 97cf381 (feat: hybrid search implementation)
```

**Module functionality:**
```bash
node -e "
const { searchKnowledge, ftsSearch, vectorSearch, hybridSearch, TYPE_WEIGHTS } = require('./get-shit-done/bin/knowledge-search.js');
console.log('Exports verified:', !!searchKnowledge && !!ftsSearch && !!vectorSearch && !!hybridSearch);
console.log('TYPE_WEIGHTS:', TYPE_WEIGHTS);
"
# Exports verified: true
# TYPE_WEIGHTS: { decision: 2, lesson: 2, summary: 0.5, temp_note: 0.3 }
```

**Search tests:**
```bash
# All verification tests in plan passed (see "Verification Results" section)
```

## Self-Check: PASSED

All files exist, commits are valid, module exports correctly, and all search modes work as specified.
