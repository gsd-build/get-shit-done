/**
 * knowledge-crud.js
 *
 * CRUD operations for knowledge entries with TTL categories and vector embedding support.
 *
 * Usage:
 *   const { insertKnowledge, getKnowledge, updateKnowledge, deleteKnowledge } = require('./knowledge-crud.js')
 *   const { openKnowledgeDB } = require('./knowledge-db.js')
 *
 *   const conn = openKnowledgeDB('project')
 *   const result = insertKnowledge(conn.db, {
 *     content: 'Decision text',
 *     type: 'decision',
 *     scope: 'project',
 *     ttlCategory: 'long_term'
 *   })
 */

const crypto = require('crypto')

// ─── Constants ─────────────────────────────────────────────────────────────

/**
 * TTL category durations in milliseconds
 */
const TTL_CATEGORIES = {
  permanent: null,                        // Never expires (lessons, patterns)
  long_term: 90 * 24 * 60 * 60 * 1000,   // 90 days (decisions)
  short_term: 7 * 24 * 60 * 60 * 1000,   // 7 days (summaries)
  ephemeral: 24 * 60 * 60 * 1000         // 24 hours (temp notes)
}

/**
 * Default TTL category for each knowledge type
 */
const TYPE_TO_TTL = {
  lesson: 'permanent',      // Lessons and patterns never expire
  decision: 'long_term',    // Decisions last 90 days
  summary: 'short_term',    // Summaries last 7 days
  temp_note: 'ephemeral'    // Temp notes last 24 hours
}

// ─── Embedding Normalization ───────────────────────────────────────────────

/**
 * Normalize embedding vector for cosine similarity
 * @param {Float32Array|Array} embedding - Raw embedding vector
 * @returns {Float32Array} L2-normalized embedding
 */
function normalizeEmbedding(embedding) {
  // L2 normalization for cosine similarity
  const arr = embedding instanceof Float32Array ? embedding : new Float32Array(embedding)
  const norm = Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0))
  if (norm < 1e-12) return arr // Avoid division by zero
  return new Float32Array(arr.map(v => v / norm))
}

// ─── Insert Operation ──────────────────────────────────────────────────────

/**
 * Insert new knowledge entry
 * @param {object} db - better-sqlite3 database connection
 * @param {object} params - Knowledge parameters
 * @param {string} params.content - Knowledge content
 * @param {string} params.type - Knowledge type ('decision', 'lesson', 'summary', 'temp_note')
 * @param {string} params.scope - Knowledge scope ('global' or 'project')
 * @param {string} [params.ttlCategory] - TTL category (defaults to type-based value)
 * @param {Float32Array|Array} [params.embedding] - Optional embedding vector
 * @param {object} [params.metadata] - Optional metadata object
 * @returns {{ id: number, content_hash: string }}
 */
function insertKnowledge(db, {
  content,
  type,
  scope,
  ttlCategory = null,
  embedding = null,
  metadata = {}
}) {
  // 1. Compute content hash (SHA-256)
  const hash = crypto.createHash('sha256').update(content).digest('hex')

  // 2. Determine effective TTL category
  const effectiveTTL = ttlCategory || TYPE_TO_TTL[type] || 'short_term'

  // 3. Calculate expires_at from TTL category
  const now = Date.now()
  const ttlMs = TTL_CATEGORIES[effectiveTTL]
  const expiresAt = ttlMs ? now + ttlMs : null

  // 4. Prepare insert statement
  const stmt = db.prepare(`
    INSERT INTO knowledge (content, type, scope, created_at, expires_at, access_count, last_accessed, content_hash, metadata)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
  `)

  // 5. Execute transaction
  const result = db.transaction(() => {
    const info = stmt.run(content, type, scope, now, expiresAt, now, hash, JSON.stringify(metadata))
    const id = info.lastInsertRowid

    // 6. Insert embedding if provided (FTS5 handled by trigger)
    if (embedding && db.vectorEnabled) {
      const normalized = normalizeEmbedding(embedding)
      db.prepare('INSERT INTO knowledge_vec (rowid, embedding) VALUES (?, ?)').run(id, normalized)
    }

    return id
  })()

  return { id: result, content_hash: hash }
}

// ─── Read Operations ───────────────────────────────────────────────────────

/**
 * Get knowledge entry by ID
 * @param {object} db - better-sqlite3 database connection
 * @param {number} id - Knowledge entry ID
 * @returns {object|null} Knowledge entry or null if not found
 */
function getKnowledge(db, id) {
  const row = db.prepare('SELECT * FROM knowledge WHERE id = ?').get(id)
  if (!row) return null
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }
}

/**
 * Get knowledge entry by content hash (for deduplication)
 * @param {object} db - better-sqlite3 database connection
 * @param {string} contentHash - SHA-256 content hash
 * @returns {object|null} Knowledge entry or null if not found
 */
function getKnowledgeByHash(db, contentHash) {
  const row = db.prepare('SELECT * FROM knowledge WHERE content_hash = ?').get(contentHash)
  if (!row) return null
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }
}

/**
 * Get knowledge entries by type
 * @param {object} db - better-sqlite3 database connection
 * @param {string} type - Knowledge type
 * @param {object} [options] - Query options
 * @param {number} [options.limit=100] - Maximum results to return
 * @param {string} [options.scope] - Optional scope filter
 * @returns {Array<object>} Array of knowledge entries
 */
function getKnowledgeByType(db, type, { limit = 100, scope = null } = {}) {
  const params = [type]
  let query = 'SELECT * FROM knowledge WHERE type = ?'
  if (scope) {
    query += ' AND scope = ?'
    params.push(scope)
  }
  query += ' ORDER BY access_count DESC, created_at DESC LIMIT ?'
  params.push(limit)

  return db.prepare(query).all(...params).map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }))
}

// ─── Update Operation ──────────────────────────────────────────────────────

/**
 * Update knowledge entry
 * @param {object} db - better-sqlite3 database connection
 * @param {number} id - Knowledge entry ID
 * @param {object} updates - Fields to update
 * @param {string} [updates.content] - New content
 * @param {string} [updates.type] - New type
 * @param {string} [updates.ttlCategory] - New TTL category
 * @param {object} [updates.metadata] - New metadata
 * @param {Float32Array|Array} [updates.embedding] - New embedding
 * @returns {{ success: boolean, error?: string }}
 */
function updateKnowledge(db, id, updates) {
  // Check if entry exists
  const current = getKnowledge(db, id)
  if (!current) return { success: false, error: 'not_found' }

  const now = Date.now()
  const fields = []
  const values = []

  // Update content (and hash)
  if (updates.content !== undefined) {
    fields.push('content = ?', 'content_hash = ?')
    const hash = crypto.createHash('sha256').update(updates.content).digest('hex')
    values.push(updates.content, hash)
  }

  // Update type
  if (updates.type !== undefined) {
    fields.push('type = ?')
    values.push(updates.type)
  }

  // Update TTL
  if (updates.ttlCategory !== undefined) {
    const ttlMs = TTL_CATEGORIES[updates.ttlCategory]
    fields.push('expires_at = ?')
    values.push(ttlMs ? now + ttlMs : null)
  }

  // Update metadata
  if (updates.metadata !== undefined) {
    fields.push('metadata = ?')
    values.push(JSON.stringify(updates.metadata))
  }

  values.push(id)

  // Execute transaction
  db.transaction(() => {
    if (fields.length > 0) {
      db.prepare(`UPDATE knowledge SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }

    // Update embedding if provided
    if (updates.embedding && db.vectorEnabled) {
      const normalized = normalizeEmbedding(updates.embedding)
      db.prepare('DELETE FROM knowledge_vec WHERE rowid = ?').run(id)
      db.prepare('INSERT INTO knowledge_vec (rowid, embedding) VALUES (?, ?)').run(id, normalized)
    }
  })()

  return { success: true }
}

// ─── Delete Operation ──────────────────────────────────────────────────────

/**
 * Delete knowledge entry
 * @param {object} db - better-sqlite3 database connection
 * @param {number} id - Knowledge entry ID
 * @returns {{ deleted: boolean }}
 */
function deleteKnowledge(db, id) {
  const result = db.transaction(() => {
    // Delete from vec (FTS5 handled by trigger)
    if (db.vectorEnabled) {
      db.prepare('DELETE FROM knowledge_vec WHERE rowid = ?').run(id)
    }
    const info = db.prepare('DELETE FROM knowledge WHERE id = ?').run(id)
    return info.changes
  })()

  return { deleted: result > 0 }
}

// ─── TTL Refresh ───────────────────────────────────────────────────────────

/**
 * Refresh TTL for knowledge entry (extend expiration)
 * @param {object} db - better-sqlite3 database connection
 * @param {number} id - Knowledge entry ID
 * @param {string} [ttlCategory] - TTL category (defaults to type-based value)
 * @returns {{ success: boolean, expires_at?: number, error?: string }}
 */
function refreshTTL(db, id, ttlCategory = null) {
  const current = getKnowledge(db, id)
  if (!current) return { success: false, error: 'not_found' }

  const effectiveTTL = ttlCategory || TYPE_TO_TTL[current.type] || 'short_term'
  const ttlMs = TTL_CATEGORIES[effectiveTTL]
  const now = Date.now()
  const expiresAt = ttlMs ? now + ttlMs : null

  db.prepare('UPDATE knowledge SET expires_at = ? WHERE id = ?').run(expiresAt, id)
  return { success: true, expires_at: expiresAt }
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  insertKnowledge,
  getKnowledge,
  getKnowledgeByHash,
  getKnowledgeByType,
  updateKnowledge,
  deleteKnowledge,
  refreshTTL,
  TTL_CATEGORIES,
  TYPE_TO_TTL
}
