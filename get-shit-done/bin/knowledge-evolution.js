#!/usr/bin/env node

/**
 * knowledge-evolution.js
 * Memory evolution logic for intelligent knowledge management
 *
 * Decision logic:
 * - Similarity > 0.88: Skip (exact duplicate)
 * - Similarity 0.65-0.88: Evolve existing memory
 * - Similarity < 0.65: Create new entry
 */

const { checkDuplicate, findSimilarByEmbedding, computeCanonicalHash } = require('./knowledge-dedup.js');
const { updateKnowledge, insertKnowledge } = require('./knowledge-crud.js');

// In-process write serializer: ensures concurrent insertOrEvolve calls are
// queued and executed sequentially, preventing check→write races where two
// callers both decide to evolve the same entry and the second overwrites the first.
// Note: this is per-process only — multi-process scenarios are not protected.
let pendingWrites = Promise.resolve();

// Similarity ranges from research
const EVOLUTION_THRESHOLDS = {
  duplicate: 0.88,    // > 0.88: exact duplicate, skip
  evolve_max: 0.88,   // <= 0.88: candidate for evolution
  evolve_min: 0.65,   // >= 0.65: evolve existing memory
  create: 0.65        // < 0.65: create new entry
};

/**
 * Merge existing memory with new content
 * @param {object} existing - Existing entry { content, metadata }
 * @param {string} newContent - New content to append
 * @param {object} options - Merge options
 * @returns {object} { merged, metadata, evolutionCount }
 */
function mergeMemories(existing, newContent, options = {}) {
  const { separator = '\n\nUpdate: ' } = options;

  // Append new content with timestamp
  const timestamp = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
  const merged = `${existing.content}${separator}[${timestamp}] ${newContent}`;

  // Update metadata with evolution tracking
  const existingMeta = existing.metadata || {};
  const evolutionCount = (existingMeta.evolution_count || 0) + 1;

  const metadata = {
    ...existingMeta,
    evolution_count: evolutionCount,
    last_evolution: Date.now(),
    evolution_history: [
      ...(existingMeta.evolution_history || []),
      {
        date: timestamp,
        content_preview: newContent.slice(0, 100),
        similarity: options.similarity
      }
    ].slice(-10)  // Keep last 10 evolutions
  };

  return { merged, metadata, evolutionCount };
}

/**
 * Insert or evolve knowledge entry based on similarity.
 * Serializes all calls through a per-process promise chain to prevent concurrent
 * check→write races (two callers seeing "evolve entry #X" and overwriting each other).
 * @param {object} conn - Database connection object
 * @param {object} entry - Entry to insert { content, type, scope, embedding, metadata, project_slug }
 * @param {object} options - Options
 * @returns {Promise<object>} { action, id?, similarity?, ... }
 */
async function insertOrEvolve(conn, entry, options = {}) {
  // Serialize all writes through a promise chain to prevent concurrent
  // check→write races (two callers seeing "evolve entry #X" and overwriting each other)
  const result = await new Promise((resolve, reject) => {
    pendingWrites = pendingWrites.then(() => _insertOrEvolveImpl(conn, entry, options))
      .then(resolve, reject);
  });
  return result;
}

/**
 * Internal implementation of insertOrEvolve. Called serially via the pendingWrites chain.
 * @param {object} conn - Database connection object
 * @param {object} entry - Entry to insert { content, type, scope, embedding, metadata, project_slug }
 * @param {object} options - Options
 * @returns {Promise<object>} { action, id?, similarity?, ... }
 */
async function _insertOrEvolveImpl(conn, entry, options = {}) {
  const { content, type, scope, embedding, metadata = {}, project_slug } = entry;
  const { db } = conn;

  // Step 1: Check for duplicates
  const dupCheck = await checkDuplicate(conn, content, embedding);

  // Case 1: Exact duplicate (> 0.88) - skip
  if (dupCheck.isDuplicate && dupCheck.similarity > EVOLUTION_THRESHOLDS.duplicate) {
    return {
      action: 'skipped',
      reason: `duplicate_${dupCheck.stage}`,
      existingId: dupCheck.existingId,
      similarity: dupCheck.similarity
    };
  }

  // Case 2: Similar (0.65-0.88) - evolve existing
  if (dupCheck.isDuplicate &&
      dupCheck.similarity >= EVOLUTION_THRESHOLDS.evolve_min &&
      dupCheck.similarity <= EVOLUTION_THRESHOLDS.evolve_max) {

    const existing = db.prepare('SELECT * FROM knowledge WHERE id = ?').get(dupCheck.existingId);
    if (!existing) {
      // Shouldn't happen, but fallback to create
      return insertOrEvolve(conn, entry, { ...options, forceCreate: true });
    }

    // Merge memories
    const existingMeta = existing.metadata ? JSON.parse(existing.metadata) : {};
    const { merged, metadata: newMeta, evolutionCount } = mergeMemories(
      { content: existing.content, metadata: existingMeta },
      content,
      { similarity: dupCheck.similarity }
    );

    // Update existing entry
    await updateKnowledge(db, dupCheck.existingId, {
      content: merged,
      metadata: {
        ...newMeta,
        canonical_hash: dupCheck.canonicalHash || existingMeta.canonical_hash
      }
    });

    // Note: Embedding update not supported in sqlite-vec 0.1.6
    // The existing embedding stays (represents original concept)

    return {
      action: 'evolved',
      id: dupCheck.existingId,
      similarity: dupCheck.similarity,
      evolutionCount
    };
  }

  // Case 3: Different enough (< 0.65 or no match) - create new
  const canonicalHash = dupCheck.canonicalHash || computeCanonicalHash(content);

  const result = await insertKnowledge(db, {
    content,
    type,
    scope,
    embedding,
    project_slug,
    metadata: {
      ...metadata,
      canonical_hash: canonicalHash
    }
  });

  return {
    action: 'created',
    id: result.id,
    contentHash: result.content_hash,
    similarity: dupCheck.similarity || 0
  };
}

/**
 * Process batch of extracted knowledge entries
 * @param {object} conn - Database connection object
 * @param {Array} extractions - Array of extracted entries
 * @param {object} options - Processing options
 * @returns {Promise<object>} { created, evolved, skipped, errors }
 */
async function processExtractionBatch(conn, extractions, options = {}) {
  const { generateEmbedding } = require('./embeddings.js');
  const results = { created: 0, evolved: 0, skipped: 0, errors: [] };

  for (const ext of extractions) {
    try {
      // Generate embedding if not provided
      const embedding = ext.embedding || await generateEmbedding(ext.content);

      const result = await insertOrEvolve(conn, {
        content: ext.content,
        type: ext.type,
        scope: options.scope || 'project',
        embedding,
        project_slug: options.project_slug || null,
        metadata: {
          source: options.source || 'extraction',
          pattern: ext.pattern,
          extracted_at: Date.now()
        }
      });

      results[result.action]++;
    } catch (err) {
      results.errors.push({
        content: ext.content.slice(0, 50),
        error: err.message
      });
    }
  }

  return results;
}

module.exports = {
  EVOLUTION_THRESHOLDS,
  mergeMemories,
  insertOrEvolve,
  processExtractionBatch
};
