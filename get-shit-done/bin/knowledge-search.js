/**
 * knowledge-search.js
 *
 * Multi-phase search pipeline for the knowledge system.
 * Combines FTS5 keyword search, vector similarity, and hybrid RRF fusion.
 *
 * Usage:
 *   const { searchKnowledge, hybridSearch } = require('./knowledge-search.js')
 *   const results = searchKnowledge(db, 'SQLite storage', { limit: 10 })
 */

// ─── Constants ─────────────────────────────────────────────────────────────

const TYPE_WEIGHTS = {
  decision: 2.0,
  lesson: 2.0,
  summary: 0.5,
  temp_note: 0.3
}

// ─── Query Sanitization ────────────────────────────────────────────────────

/**
 * Sanitize FTS5 query to prevent syntax errors
 * @param {string} query - Raw query string
 * @returns {string} Sanitized query safe for FTS5 MATCH
 */
function sanitizeFTSQuery(query) {
  // Escape special FTS5 characters
  return query
    .replace(/[(){}[\]^"~*?:\\]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .join(' ')
}

// ─── FTS5 Search ───────────────────────────────────────────────────────────

/**
 * Full-text search using FTS5 with BM25 ranking
 * @param {object} db - Database connection object from openKnowledgeDB
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @param {number} options.limit - Maximum results (default: 20)
 * @param {string} options.scope - Filter by scope ('global' or 'project')
 * @param {string[]} options.types - Filter by types
 * @returns {object[]} Array of results with bm25_score and fts_rank
 */
function ftsSearch(db, query, { limit = 20, scope = null, types = null } = {}) {
  if (!query || query.trim().length === 0) {
    return []
  }

  // Sanitize query for FTS5
  const sanitizedQuery = sanitizeFTSQuery(query)
  if (!sanitizedQuery) {
    return []
  }

  // Build query with optional filters
  let sql = `
    SELECT
      k.id,
      k.content,
      k.type,
      k.scope,
      k.access_count,
      k.created_at,
      k.metadata,
      bm25(knowledge_fts) as bm25_score
    FROM knowledge_fts
    JOIN knowledge k ON knowledge_fts.rowid = k.id
    WHERE knowledge_fts MATCH ?
  `

  const params = [sanitizedQuery]

  if (scope) {
    sql += ' AND k.scope = ?'
    params.push(scope)
  }

  if (types && types.length > 0) {
    sql += ` AND k.type IN (${types.map(() => '?').join(',')})`
    params.push(...types)
  }

  // Exclude expired entries
  sql += ' AND (k.expires_at IS NULL OR k.expires_at > ?)'
  params.push(Date.now())

  sql += ' ORDER BY bm25_score LIMIT ?'
  params.push(limit)

  try {
    return db.prepare(sql).all(...params).map((row, idx) => ({
      ...row,
      fts_rank: idx + 1,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }))
  } catch (err) {
    // FTS5 MATCH can throw on malformed queries
    if (err.message.includes('fts5')) {
      return []
    }
    throw err
  }
}

// ─── Vector Search ─────────────────────────────────────────────────────────

/**
 * Normalize embedding vector to unit length
 * @param {Float32Array|number[]} embedding - Raw embedding vector
 * @returns {Float32Array} Normalized embedding
 */
function normalizeEmbedding(embedding) {
  const arr = embedding instanceof Float32Array ? embedding : new Float32Array(embedding)
  const norm = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0))
  if (norm < 1e-12) return arr
  return new Float32Array(arr.map(v => v / norm))
}

/**
 * Vector similarity search using sqlite-vec
 * @param {object} conn - Database connection object from openKnowledgeDB
 * @param {Float32Array|number[]} embedding - Query embedding vector
 * @param {object} options - Search options
 * @param {number} options.limit - Maximum results (default: 20)
 * @param {string} options.scope - Filter by scope ('global' or 'project')
 * @param {string[]} options.types - Filter by types
 * @returns {object[]} Array of results with vec_distance and vec_rank
 */
function vectorSearch(conn, embedding, { limit = 20, scope = null, types = null } = {}) {
  if (!conn.vectorEnabled) {
    return [] // Gracefully degrade if sqlite-vec not available
  }

  if (!embedding || embedding.length === 0) {
    return []
  }

  // Normalize query embedding
  const normalizedEmb = normalizeEmbedding(embedding)

  // Build subquery for filtering first (if needed)
  // sqlite-vec requires k parameter in MATCH clause, can't use LIMIT
  // If we have filters, we need to handle them differently

  const now = Date.now()

  // Simple case: no filters, just use vec0 k parameter
  if (!scope && (!types || types.length === 0)) {
    const sql = `
      SELECT
        k.id,
        k.content,
        k.type,
        k.scope,
        k.access_count,
        k.created_at,
        k.metadata,
        distance as vec_distance
      FROM knowledge_vec
      JOIN knowledge k ON knowledge_vec.rowid = k.id
      WHERE embedding MATCH ? AND k = ?
        AND (k.expires_at IS NULL OR k.expires_at > ?)
      ORDER BY distance
    `

    const params = [normalizedEmb, limit, now]

    try {
      return conn.db.prepare(sql).all(...params).map((row, idx) => ({
        ...row,
        vec_rank: idx + 1,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }))
    } catch (err) {
      console.warn('Vector search failed:', err.message)
      return []
    }
  }

  // Complex case: with filters - fetch more and filter/limit after
  const fetchLimit = limit * 3
  let sql = `
    SELECT
      k.id,
      k.content,
      k.type,
      k.scope,
      k.access_count,
      k.created_at,
      k.metadata,
      distance as vec_distance
    FROM knowledge_vec
    JOIN knowledge k ON knowledge_vec.rowid = k.id
    WHERE embedding MATCH ? AND k = ?
  `

  const params = [normalizedEmb, fetchLimit]

  if (scope) {
    sql += ' AND k.scope = ?'
    params.push(scope)
  }

  if (types && types.length > 0) {
    sql += ` AND k.type IN (${types.map(() => '?').join(',')})`
    params.push(...types)
  }

  // Exclude expired entries
  sql += ' AND (k.expires_at IS NULL OR k.expires_at > ?)'
  params.push(now)

  sql += ' ORDER BY distance'

  try {
    const results = conn.db.prepare(sql).all(...params)
      .map((row, idx) => ({
        ...row,
        vec_rank: idx + 1,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }))

    // Apply limit after filtering (for complex case)
    return results.slice(0, limit)
  } catch (err) {
    console.warn('Vector search failed:', err.message)
    return []
  }
}

// ─── Hybrid Search with RRF ────────────────────────────────────────────────

/**
 * Hybrid search combining FTS5 and vector with Reciprocal Rank Fusion
 * @param {object} conn - Database connection object from openKnowledgeDB
 * @param {object} options - Search options
 * @param {string} options.query - Text query for FTS5
 * @param {Float32Array|number[]} options.embedding - Vector embedding for similarity
 * @param {number} options.limit - Maximum results (default: 10)
 * @param {string} options.scope - Filter by scope ('global' or 'project')
 * @param {string[]} options.types - Filter by types
 * @param {number} options.k - RRF constant (default: 60)
 * @returns {object[]} Array of results with final_score, rrf_score, type_weight, access_boost
 */
function hybridSearch(conn, {
  query = null,
  embedding = null,
  limit = 10,
  scope = null,
  types = null,
  k = 60
} = {}) {
  const candidateLimit = limit * 3 // Fetch more candidates for fusion

  // Phase 1: Gather candidates from both sources
  const ftsResults = query ? ftsSearch(conn.db, query, { limit: candidateLimit, scope, types }) : []
  const vecResults = embedding ? vectorSearch(conn, embedding, { limit: candidateLimit, scope, types }) : []

  // Phase 2: Build RRF score map
  const scoreMap = new Map()

  for (const row of ftsResults) {
    scoreMap.set(row.id, {
      id: row.id,
      content: row.content,
      type: row.type,
      scope: row.scope,
      access_count: row.access_count,
      created_at: row.created_at,
      metadata: row.metadata,
      rrf_score: 1 / (k + row.fts_rank),
      sources: ['fts']
    })
  }

  for (const row of vecResults) {
    const existing = scoreMap.get(row.id)
    const rrfScore = 1 / (k + row.vec_rank)

    if (existing) {
      existing.rrf_score += rrfScore
      existing.sources.push('vec')
    } else {
      scoreMap.set(row.id, {
        id: row.id,
        content: row.content,
        type: row.type,
        scope: row.scope,
        access_count: row.access_count,
        created_at: row.created_at,
        metadata: row.metadata,
        rrf_score: rrfScore,
        sources: ['vec']
      })
    }
  }

  // Phase 3: Apply type weights and access boost
  const results = Array.from(scoreMap.values())
    .map(entry => {
      const typeWeight = TYPE_WEIGHTS[entry.type] || 1.0
      const accessBoost = 1 + Math.log(1 + entry.access_count)
      return {
        ...entry,
        type_weight: typeWeight,
        access_boost: accessBoost,
        final_score: entry.rrf_score * typeWeight * accessBoost
      }
    })
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, limit)

  return results
}

/**
 * Main search function (convenience wrapper)
 * @param {object} conn - Database connection object from openKnowledgeDB
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @param {Float32Array|number[]} options.embedding - Optional vector embedding
 * @param {number} options.limit - Maximum results (default: 10)
 * @param {string} options.scope - Filter by scope ('global' or 'project')
 * @param {string[]} options.types - Filter by types
 * @returns {object[]} Array of results with scoring metadata
 */
function searchKnowledge(conn, query, options = {}) {
  // If query is string, use FTS
  // If embedding provided, include vector search
  // Returns hybrid results with scoring metadata
  return hybridSearch(conn, {
    query: typeof query === 'string' ? query : null,
    embedding: options.embedding || null,
    limit: options.limit || 10,
    scope: options.scope || null,
    types: options.types || null
  })
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  searchKnowledge,
  ftsSearch,
  vectorSearch,
  hybridSearch,
  normalizeEmbedding,
  sanitizeFTSQuery,
  TYPE_WEIGHTS
}
