/**
 * knowledge-feedback.js
 *
 * Principle feedback and invalidation system.
 * Implements KNOW-26 (mark wrong/outdated) and KNOW-27 (learn from feedback).
 *
 * Usage:
 *   const { markPrincipleWrong, markPrincipleOutdated } = require('./knowledge-feedback.js')
 *   const { openKnowledgeDB } = require('./knowledge-db.js')
 *
 *   const conn = openKnowledgeDB('project')
 *   const result = markPrincipleWrong(conn.db, principleId, {
 *     severity: 'major',
 *     reason: 'Does not work in production'
 *   })
 */

// ─── Constants ─────────────────────────────────────────────────────────────

/**
 * Confidence degradation factors by severity
 */
const DEGRADATION_FACTORS = {
  critical: 1.0,   // Invalidate immediately (confidence -> 0)
  major: 0.5,      // Cut confidence in half
  minor: 0.2       // Reduce by 20%
}

/**
 * Minimum confidence threshold for validity
 */
const INVALIDATION_THRESHOLD = 0.3

// ─── Mark Principle Wrong ──────────────────────────────────────────────────

/**
 * Mark a principle as wrong, degrading its confidence
 * @param {object} db - better-sqlite3 database connection
 * @param {number} principleId - Principle ID
 * @param {object} [feedback={}] - Feedback details
 * @param {string} [feedback.severity='minor'] - Severity level ('minor', 'major', 'critical')
 * @param {string} [feedback.reason] - Reason for marking wrong
 * @returns {object} Result with old/new confidence and invalidation status
 */
function markPrincipleWrong(db, principleId, feedback = {}) {
  // 1. Extract severity (default to minor)
  const severity = feedback.severity || 'minor'

  // 2. Get current principle
  const row = db.prepare('SELECT * FROM knowledge WHERE id = ?').get(principleId)
  if (!row) {
    return { success: false, error: 'principle_not_found' }
  }

  // 3. Parse metadata and get current confidence
  const metadata = row.metadata ? JSON.parse(row.metadata) : {}
  const currentConfidence = metadata.confidence !== undefined ? metadata.confidence : 0.7

  // 4. Calculate new confidence
  const degradationFactor = DEGRADATION_FACTORS[severity] || DEGRADATION_FACTORS.minor
  const newConfidence = currentConfidence * (1 - degradationFactor)

  // 5. Update metadata
  metadata.confidence = newConfidence
  metadata.feedback_count = (metadata.feedback_count || 0) + 1
  metadata.last_feedback = Date.now()
  if (feedback.reason) {
    metadata.last_feedback_reason = feedback.reason
  }
  metadata.last_feedback_severity = severity

  // 6. Check for invalidation
  const invalidated = newConfidence < INVALIDATION_THRESHOLD
  if (invalidated) {
    metadata.invalidated = true
    metadata.invalidated_at = Date.now()
  }

  // 7. Update database
  db.prepare('UPDATE knowledge SET metadata = ? WHERE id = ?').run(
    JSON.stringify(metadata),
    principleId
  )

  return {
    success: true,
    old_confidence: currentConfidence,
    new_confidence: newConfidence,
    invalidated
  }
}

// ─── Mark Principle Outdated ───────────────────────────────────────────────

/**
 * Mark a principle as outdated (soft delete with expiration)
 * @param {object} db - better-sqlite3 database connection
 * @param {number} principleId - Principle ID
 * @param {object} [options={}] - Outdating options
 * @param {string} [options.replacement] - ID of replacement principle
 * @returns {object} Result with outdated status and expiration
 */
function markPrincipleOutdated(db, principleId, options = {}) {
  // 1. Get current principle
  const row = db.prepare('SELECT * FROM knowledge WHERE id = ?').get(principleId)
  if (!row) {
    return { success: false, error: 'principle_not_found' }
  }

  // 2. Parse metadata
  const metadata = row.metadata ? JSON.parse(row.metadata) : {}

  // 3. Update metadata with outdated status
  metadata.outdated = true
  metadata.outdated_at = Date.now()
  metadata.confidence = 0.0
  if (options.replacement) {
    metadata.replaced_by = options.replacement
  }

  // 4. Set expires_at to 7 days from now (soft delete)
  const now = Date.now()
  const expiresAt = now + (7 * 24 * 60 * 60 * 1000) // 7 days

  // 5. Update database
  db.prepare('UPDATE knowledge SET metadata = ?, expires_at = ? WHERE id = ?').run(
    JSON.stringify(metadata),
    expiresAt,
    principleId
  )

  return {
    success: true,
    outdated: true,
    expires_at: expiresAt
  }
}

// ─── Get Principle Metadata ────────────────────────────────────────────────

/**
 * Get parsed metadata for a principle
 * @param {object} db - better-sqlite3 database connection
 * @param {number} principleId - Principle ID
 * @returns {object} Parsed metadata object or empty object
 */
function getPrincipleMetadata(db, principleId) {
  const row = db.prepare('SELECT metadata FROM knowledge WHERE id = ?').get(principleId)
  if (!row) return {}
  return row.metadata ? JSON.parse(row.metadata) : {}
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  DEGRADATION_FACTORS,
  markPrincipleWrong,
  markPrincipleOutdated,
  getPrincipleMetadata
}
