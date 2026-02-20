/**
 * Knowledge Lifecycle Management
 *
 * Implements TTL-based lifecycle with automatic cleanup, access tracking,
 * and staleness scoring for knowledge quality assessment.
 *
 * @module knowledge-lifecycle
 */

/**
 * Clean up expired knowledge entries atomically
 *
 * Removes all knowledge entries past their expiration timestamp,
 * cleaning up from main table, vector table, and FTS5 (via triggers).
 * Uses transaction for atomicity across all tables.
 *
 * @param {Object} db - Database connection from openKnowledgeDB
 * @returns {Object} { deleted: number, ids: number[] }
 */
function cleanupExpired(db) {
  const now = Date.now();

  const deleted = db.transaction(() => {
    // First, get IDs to delete (for vector cleanup)
    const expiredIds = db.prepare(`
      SELECT id FROM knowledge
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `).all(now).map(row => row.id);

    if (expiredIds.length === 0) {
      return { deleted: 0, ids: [] };
    }

    // Delete from vector table (FTS5 handled by trigger)
    if (db.vectorEnabled) {
      const placeholders = expiredIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM knowledge_vec WHERE rowid IN (${placeholders})`).run(...expiredIds);
    }

    // Delete from main table (triggers FTS5 cleanup)
    const result = db.prepare(`
      DELETE FROM knowledge
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `).run(now);

    return { deleted: result.changes, ids: expiredIds };
  })();

  // Checkpoint WAL after large deletions
  if (deleted.deleted > 100) {
    checkpointWAL(db);
  }

  return deleted;
}

/**
 * Checkpoint WAL file to main database
 *
 * Truncates the WAL file and merges changes to main database.
 * Should be called after large write operations to prevent unbounded WAL growth.
 *
 * @param {Object} db - Database connection from openKnowledgeDB
 * @returns {Object} { success: boolean, error?: string }
 */
function checkpointWAL(db) {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Schedule periodic cleanup
 *
 * For CLI tools, cleanup runs on startup rather than daemon-style.
 * This function is for future daemon mode.
 *
 * @param {Object} db - Database connection from openKnowledgeDB
 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 24 hours)
 * @returns {number} Interval ID for clearInterval()
 */
function scheduleCleanup(db, intervalMs = 24 * 60 * 60 * 1000) {
  // For CLI tools, cleanup runs on startup rather than daemon-style
  // This function is for future daemon mode
  const cleanup = () => {
    const result = cleanupExpired(db);
    if (result.deleted > 0) {
      console.log(`Knowledge cleanup: removed ${result.deleted} expired entries`);
    }
  };

  return setInterval(cleanup, intervalMs);
}

/**
 * Track knowledge access
 *
 * Increments access count and updates last_accessed timestamp.
 * Called whenever knowledge is retrieved.
 *
 * @param {Object} db - Database connection from openKnowledgeDB
 * @param {number} knowledgeId - Knowledge entry ID
 * @returns {Object} { updated: boolean }
 */
function trackAccess(db, knowledgeId) {
  const now = Date.now();

  const result = db.prepare(`
    UPDATE knowledge
    SET access_count = access_count + 1,
        last_accessed = ?
    WHERE id = ?
  `).run(now, knowledgeId);

  return { updated: result.changes > 0 };
}

/**
 * Track access for multiple knowledge entries
 *
 * Batch version of trackAccess for efficiency.
 *
 * @param {Object} db - Database connection from openKnowledgeDB
 * @param {number[]} knowledgeIds - Array of knowledge entry IDs
 * @returns {Object} { updated: number }
 */
function trackAccessBatch(db, knowledgeIds) {
  if (knowledgeIds.length === 0) return { updated: 0 };

  const now = Date.now();

  const updated = db.transaction(() => {
    const stmt = db.prepare(`
      UPDATE knowledge
      SET access_count = access_count + 1,
          last_accessed = ?
      WHERE id = ?
    `);

    let count = 0;
    for (const id of knowledgeIds) {
      const result = stmt.run(now, id);
      count += result.changes;
    }
    return count;
  })();

  return { updated };
}

/**
 * Get access statistics
 *
 * Aggregate metrics for access patterns by type and scope.
 *
 * @param {Object} db - Database connection from openKnowledgeDB
 * @param {Object} options - Filter options
 * @param {string} options.scope - Filter by scope ('global' or 'project')
 * @param {string} options.type - Filter by type (e.g., 'decision', 'lesson')
 * @returns {Array} Array of { type, scope, total_count, total_accesses, avg_accesses, max_accesses, avg_age_ms }
 */
function getAccessStats(db, { scope = null, type = null } = {}) {
  let sql = `
    SELECT
      type,
      scope,
      COUNT(*) as total_count,
      SUM(access_count) as total_accesses,
      AVG(access_count) as avg_accesses,
      MAX(access_count) as max_accesses,
      AVG(CASE WHEN last_accessed IS NOT NULL THEN (? - last_accessed) ELSE NULL END) as avg_age_ms
    FROM knowledge
    WHERE 1=1
  `;

  const params = [Date.now()];

  if (scope) {
    sql += ' AND scope = ?';
    params.push(scope);
  }

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' GROUP BY type, scope';

  return db.prepare(sql).all(...params);
}

/**
 * Calculate staleness score for knowledge entry
 *
 * Staleness is based on:
 * - Age since creation
 * - Dormancy (time since last access)
 * - Type volatility (how quickly this type of knowledge becomes stale)
 * - Access count (frequently accessed = still relevant)
 *
 * Score range: 0.0 (fresh) to 1.0 (completely stale)
 * Default stale threshold: 0.7
 *
 * @param {Object} db - Database connection from openKnowledgeDB
 * @param {number} knowledgeId - Knowledge entry ID
 * @returns {Object|null} Staleness metrics or null if not found
 */
function getStalenessScore(db, knowledgeId) {
  const row = db.prepare(`
    SELECT
      id,
      type,
      created_at,
      last_accessed,
      access_count,
      expires_at
    FROM knowledge
    WHERE id = ?
  `).get(knowledgeId);

  if (!row) return null;

  const now = Date.now();
  const ageMs = now - row.created_at;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  // Time since last access (or creation if never accessed)
  const lastAccessMs = row.last_accessed || row.created_at;
  const dormantMs = now - lastAccessMs;
  const dormantDays = dormantMs / (24 * 60 * 60 * 1000);

  // Volatility based on type
  const volatility = {
    temp_note: 0.9,    // High volatility - stales quickly
    summary: 0.7,      // Medium-high
    decision: 0.3,     // Low volatility - decisions age slowly
    lesson: 0.1        // Very low - lessons remain relevant
  }[row.type] || 0.5;

  // Staleness formula:
  // - Higher dormancy increases staleness
  // - Higher access count decreases staleness (frequently used = still relevant)
  // - Volatility scales the decay rate
  const accessFactor = 1 / (1 + Math.log(1 + row.access_count));
  const timeFactor = dormantDays / 30; // Normalize to 30-day scale
  const staleness = Math.min(1.0, timeFactor * volatility * accessFactor);

  return {
    id: row.id,
    type: row.type,
    age_days: ageDays,
    dormant_days: dormantDays,
    access_count: row.access_count,
    volatility,
    staleness_score: staleness,
    expires_at: row.expires_at,
    is_stale: staleness > 0.7  // Threshold for "stale" classification
  };
}

/**
 * Get stale knowledge entries
 *
 * Returns knowledge entries above the staleness threshold,
 * sorted by staleness score (most stale first).
 *
 * @param {Object} db - Database connection from openKnowledgeDB
 * @param {Object} options - Filter options
 * @param {number} options.threshold - Staleness score threshold (default: 0.7)
 * @param {number} options.limit - Maximum results to return (default: 100)
 * @param {string} options.scope - Filter by scope ('global' or 'project')
 * @returns {Array} Array of staleness metrics sorted by score descending
 */
function getStaleKnowledge(db, { threshold = 0.7, limit = 100, scope = null } = {}) {
  let sql = `
    SELECT id FROM knowledge
    WHERE (expires_at IS NULL OR expires_at > ?)
  `;

  const params = [Date.now()];

  if (scope) {
    sql += ' AND scope = ?';
    params.push(scope);
  }

  sql += ' ORDER BY last_accessed ASC NULLS FIRST LIMIT ?';
  params.push(limit);

  const candidates = db.prepare(sql).all(...params);

  return candidates
    .map(row => getStalenessScore(db, row.id))
    .filter(score => score && score.staleness_score > threshold)
    .sort((a, b) => b.staleness_score - a.staleness_score);
}

/**
 * Prune stale knowledge entries
 *
 * Deletes entries whose staleness score exceeds the threshold.
 * Uses getStaleKnowledge internally to identify candidates, then
 * deletes them from the main table (FTS5 trigger handles FTS cleanup,
 * vec table handled explicitly when vectorEnabled is true).
 *
 * @param {Object} db - Database connection (the .db property from openKnowledgeDB)
 * @param {Object} options - Prune options
 * @param {number} [options.threshold=0.7] - Staleness score threshold
 * @param {number} [options.limit=200] - Max entries to prune per run
 * @param {string} [options.scope=null] - Filter by scope ('global' or 'project')
 * @param {boolean} [options.dryRun=false] - If true, return candidates without deleting
 * @param {boolean} [options.vectorEnabled=false] - Whether vec table exists (pass conn.vectorEnabled)
 * @returns {Object} { deleted: number, candidates: number, entries: Array }
 */
function pruneStaleEntries(db, options = {}) {
  const { threshold = 0.7, limit = 200, scope = null, dryRun = false, vectorEnabled = false } = options;

  const candidates = getStaleKnowledge(db, { threshold, limit, scope });

  if (dryRun || candidates.length === 0) {
    return { deleted: 0, candidates: candidates.length, entries: candidates };
  }

  const ids = candidates.map(c => c.id);

  const deleted = db.transaction(() => {
    if (vectorEnabled) {
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`DELETE FROM knowledge_vec WHERE rowid IN (${placeholders})`).run(...ids);
    }
    const result = db.prepare(
      `DELETE FROM knowledge WHERE id IN (${ids.map(() => '?').join(',')})`
    ).run(...ids);
    return result.changes;
  })();

  if (deleted > 100) {
    checkpointWAL(db);
  }

  return { deleted, candidates: candidates.length, entries: candidates };
}

/**
 * Mark knowledge as refreshed
 *
 * Resets the dormancy timer by updating last_accessed.
 * Useful when knowledge is verified as still relevant.
 *
 * @param {Object} db - Database connection from openKnowledgeDB
 * @param {number} knowledgeId - Knowledge entry ID
 * @returns {Object} { success: boolean }
 */
function markRefreshed(db, knowledgeId) {
  const now = Date.now();
  db.prepare(`
    UPDATE knowledge
    SET last_accessed = ?
    WHERE id = ?
  `).run(now, knowledgeId);
  return { success: true };
}

module.exports = {
  cleanupExpired,
  checkpointWAL,
  scheduleCleanup,
  trackAccess,
  trackAccessBatch,
  getAccessStats,
  getStalenessScore,
  getStaleKnowledge,
  pruneStaleEntries,
  markRefreshed
};
