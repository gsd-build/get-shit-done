/**
 * knowledge-checkpoint.js
 *
 * Checkpoint storage and retrieval system using Phase 3 knowledge infrastructure.
 * Enables structured checkpoints with semantic search for resume capability (EXEC-09, EXEC-10).
 *
 * Usage:
 *   const checkpoint = require('./knowledge-checkpoint.js');
 *   await checkpoint.createCheckpoint({
 *     task_title: 'Setup Database',
 *     plan: ['step1', 'step2', 'step3'],
 *     progress: { completed: ['step1'], current: 'step2', remaining: ['step3'] },
 *     phase: 3,
 *     plan_id: '03-01'
 *   });
 */

// ─── Checkpoint Schema ─────────────────────────────────────────────────────

/**
 * Checkpoint schema following EXEC-09 specification
 */
const CHECKPOINT_SCHEMA = {
  task_title: 'string',         // Human-readable task name
  plan: 'array',                // Planned steps for this task
  progress: {
    completed: 'array',         // Completed steps with timestamps
    current: 'string',          // Current step in execution
    remaining: 'array'          // Remaining steps
  },
  files_touched: 'array',       // Files created/modified
  decisions: 'array',           // Key decisions made
  key_context: 'string',        // Semantic context for resume (200-500 chars)
  next_steps: 'array',          // What to do when resuming
  created_at: 'timestamp',      // ISO 8601
  phase: 'number',              // Phase number
  plan_id: 'string'             // Plan ID (e.g., "03-01")
};

// ─── Checkpoint Creation ───────────────────────────────────────────────────

/**
 * Generate semantic context string for search indexing
 * @param {object} checkpoint - Checkpoint data
 * @returns {string} Semantic context for embedding
 */
function generateSemanticContext(checkpoint) {
  const completedCount = checkpoint.progress?.completed?.length || 0;
  const planLength = checkpoint.plan?.length || 0;
  const nextSteps = checkpoint.next_steps?.join(', ') || 'None specified';

  return `Phase ${checkpoint.phase}: ${checkpoint.task_title}
Current: ${checkpoint.progress?.current || 'Not started'}
Progress: ${completedCount}/${planLength}
Context: ${checkpoint.key_context || 'No context provided'}
Next: ${nextSteps}`;
}

/**
 * Validate required checkpoint fields
 * @param {object} checkpoint - Checkpoint data
 * @throws {Error} If validation fails
 */
function validateCheckpoint(checkpoint) {
  if (!checkpoint.task_title) throw new Error('task_title is required');
  if (!checkpoint.plan || !Array.isArray(checkpoint.plan)) throw new Error('plan must be an array');
  if (!checkpoint.progress) throw new Error('progress is required');
  if (checkpoint.phase === undefined || checkpoint.phase === null) throw new Error('phase is required');
}

/**
 * Create and store checkpoint in knowledge system
 * @param {object} checkpoint - Checkpoint data
 * @returns {Promise<{ checkpoint_id: number, created_at: number }>}
 */
async function createCheckpoint(checkpoint) {
  // Validate checkpoint
  validateCheckpoint(checkpoint);

  // Lazy-load dependencies
  const { knowledge } = require('./knowledge.js');
  const { generateEmbedding } = require('./embeddings.js');

  // Add timestamp if not present
  const now = Date.now();
  if (!checkpoint.created_at) {
    checkpoint.created_at = now;
  }

  // Generate semantic context
  const semanticContext = generateSemanticContext(checkpoint);

  // Generate embedding
  const embedding = await generateEmbedding(semanticContext);

  // Auto-prune stale entries if DB exceeds 10MB
  try {
    const { getDBPath } = require('./knowledge-db.js');
    const { pruneStaleEntries } = require('./knowledge-lifecycle.js');
    const dbPath = getDBPath('global');
    const dbStat = require('fs').statSync(dbPath);
    if (dbStat.size > 10 * 1024 * 1024) {
      const pruneConn = knowledge._getConnection('global');
      if (pruneConn.available) {
        const pruneResult = pruneStaleEntries(pruneConn.db, {
          threshold: 0.7,
          limit: 100,
          vectorEnabled: pruneConn.vectorEnabled || false
        });
        if (pruneResult.deleted > 0) {
          process.stderr.write('[knowledge-checkpoint] Auto-pruned ' + pruneResult.deleted + ' stale entries (DB > 10MB)\n');
        }
      }
    }
  } catch (_pruneErr) {
    // Size check or prune failed — not fatal, continue with checkpoint
  }

  // Insert as knowledge entry using high-level API
  const result = knowledge.add({
    content: JSON.stringify(checkpoint),
    type: 'checkpoint',
    scope: 'project',
    embedding: embedding,
    ttl_category: 'ephemeral',  // 24h TTL
    metadata: {
      phase: checkpoint.phase,
      plan_id: checkpoint.plan_id || null,
      task_title: checkpoint.task_title,
      semantic_context: semanticContext
    }
  });

  if (result.skipped) {
    throw new Error(`Failed to create checkpoint: ${result.reason}`);
  }

  return {
    checkpoint_id: result.id,
    created_at: checkpoint.created_at
  };
}

// ─── Checkpoint Retrieval ──────────────────────────────────────────────────

/**
 * Search for checkpoints using semantic search
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @param {number} [options.phase] - Filter by phase
 * @param {number} [options.limit=10] - Maximum results
 * @param {boolean} [options.include_complete=false] - Include completed checkpoints
 * @returns {Promise<Array>} Array of matching checkpoints
 */
async function searchCheckpoints(query, options = {}) {
  const { phase, limit = 10, include_complete = false } = options;

  // Lazy-load knowledge
  const { knowledge } = require('./knowledge.js');

  // Search using high-level API
  const results = knowledge.search(query, {
    limit,
    scope: 'project',
    types: ['checkpoint']
  });

  // Parse and filter results
  const checkpoints = [];
  for (const result of results) {
    try {
      const checkpoint = JSON.parse(result.content);

      // Filter by phase if specified
      if (phase !== undefined && checkpoint.phase !== phase) {
        continue;
      }

      // Filter out completed checkpoints if requested
      if (!include_complete && checkpoint.progress?.remaining?.length === 0) {
        continue;
      }

      checkpoints.push({
        id: result.id,
        checkpoint,
        similarity: result.similarity
      });
    } catch (err) {
      console.warn(`Failed to parse checkpoint ${result.id}:`, err.message);
    }
  }

  return checkpoints;
}

/**
 * Get checkpoint by ID
 * @param {number} id - Checkpoint ID
 * @returns {Promise<object|null>} Checkpoint data or null if not found
 */
async function getCheckpointById(id) {
  const { knowledge } = require('./knowledge.js');

  try {
    const result = knowledge.get(id, 'project');
    if (!result || result.type !== 'checkpoint') {
      return null;
    }

    return {
      id: result.id,
      checkpoint: JSON.parse(result.content),
      created_at: result.created_at,
      last_accessed: result.last_accessed
    };
  } catch (err) {
    console.warn(`Failed to get checkpoint ${id}:`, err.message);
    return null;
  }
}

/**
 * Get most recent checkpoint for a phase (and optionally plan)
 * @param {number} phase - Phase number
 * @param {string} [planId] - Optional plan ID
 * @returns {Promise<object|null>} Most recent checkpoint or null
 */
async function getLatestCheckpoint(phase, planId = null) {
  const { knowledge } = require('./knowledge.js');

  const conn = knowledge._getConnection('project');
  if (!conn.available) {
    return null;
  }

  try {
    // Query checkpoints filtered by phase
    const stmt = conn.db.prepare(`
      SELECT id, content, created_at, metadata
      FROM knowledge
      WHERE type = 'checkpoint' AND scope = 'project'
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const results = stmt.all();

    for (const row of results) {
      try {
        const checkpoint = JSON.parse(row.content);
        const metadata = JSON.parse(row.metadata || '{}');

        // Filter by phase
        if (checkpoint.phase !== phase) continue;

        // Filter by plan_id if specified
        if (planId && metadata.plan_id !== planId) continue;

        return {
          id: row.id,
          checkpoint,
          created_at: row.created_at
        };
      } catch (err) {
        console.warn(`Failed to parse checkpoint ${row.id}:`, err.message);
      }
    }

    return null;
  } catch (err) {
    console.warn('Failed to get latest checkpoint:', err.message);
    return null;
  }
}

/**
 * Clean up old or completed checkpoints
 * @param {object} options - Cleanup options
 * @param {number} [options.phase] - Filter by phase
 * @param {number} [options.older_than] - Delete older than timestamp (ms)
 * @param {boolean} [options.completed_only=false] - Only delete completed checkpoints
 * @returns {Promise<{ deleted_count: number }>}
 */
async function cleanupCheckpoints(options = {}) {
  const { phase, older_than, completed_only = false } = options;

  const { knowledge } = require('./knowledge.js');

  const conn = knowledge._getConnection('project');
  if (!conn.available) {
    return { deleted_count: 0 };
  }

  try {
    // Query all checkpoints
    const stmt = conn.db.prepare(`
      SELECT id, content, created_at
      FROM knowledge
      WHERE type = 'checkpoint' AND scope = 'project'
    `);

    const results = stmt.all();
    const toDelete = [];

    for (const row of results) {
      try {
        const checkpoint = JSON.parse(row.content);

        // Filter by phase if specified
        if (phase !== undefined && checkpoint.phase !== phase) continue;

        // Filter by age if specified
        if (older_than && row.created_at >= older_than) continue;

        // Filter by completion status if requested
        if (completed_only && checkpoint.progress?.remaining?.length > 0) continue;

        toDelete.push(row.id);
      } catch (err) {
        console.warn(`Failed to parse checkpoint ${row.id}:`, err.message);
      }
    }

    // Delete matching checkpoints
    if (toDelete.length > 0) {
      for (const id of toDelete) {
        knowledge.delete(id, 'project');
      }
    }

    return { deleted_count: toDelete.length };
  } catch (err) {
    console.warn('Failed to cleanup checkpoints:', err.message);
    return { deleted_count: 0 };
  }
}

// ─── Resume Functions ──────────────────────────────────────────────────────

/**
 * Find checkpoint to resume from
 * @param {number} phase - Phase number
 * @param {string} [query] - Optional search query (defaults to "incomplete {phase} tasks")
 * @returns {Promise<{ found: boolean, checkpoint?: object, resume_context?: object }>}
 */
async function findResumePoint(phase, query = null) {
  const defaultQuery = query || `incomplete phase ${phase} tasks`;

  // Search for incomplete checkpoints
  const results = await searchCheckpoints(defaultQuery, {
    phase,
    limit: 5,
    include_complete: false
  });

  if (results.length === 0) {
    return { found: false };
  }

  // Return most recent incomplete checkpoint
  const mostRecent = results[0];
  const checkpoint = mostRecent.checkpoint;

  const resumeContext = {
    task: checkpoint.task_title,
    current_step: checkpoint.progress.current,
    completed_steps: checkpoint.progress.completed || [],
    remaining_steps: checkpoint.progress.remaining || [],
    next_steps: checkpoint.next_steps || [],
    files_touched: checkpoint.files_touched || [],
    decisions: checkpoint.decisions || [],
    key_context: checkpoint.key_context || ''
  };

  return {
    found: true,
    checkpoint: mostRecent,
    resume_context: resumeContext
  };
}

/**
 * Generate prompt for resumed execution
 * @param {object} checkpoint - Checkpoint data
 * @returns {string} Formatted prompt content
 */
function buildResumePrompt(checkpoint) {
  const cp = checkpoint.checkpoint || checkpoint;

  const completedList = cp.progress.completed?.length > 0
    ? cp.progress.completed.map(s => `- [x] ${s}`).join('\n')
    : '- None yet';

  const remainingList = cp.progress.remaining?.length > 0
    ? cp.progress.remaining.map(s => `- [ ] ${s}`).join('\n')
    : '- None';

  const nextStepsList = cp.next_steps?.length > 0
    ? cp.next_steps.map(s => `- ${s}`).join('\n')
    : '- Continue with current step';

  return `# Resume Checkpoint: ${cp.task_title}

## Phase ${cp.phase} - Plan ${cp.plan_id || 'Unknown'}

### Context
${cp.key_context || 'No context provided'}

### Current Step
${cp.progress.current || 'Not started'}

### Completed Steps
${completedList}

### Remaining Steps
${remainingList}

### Files Touched
${cp.files_touched?.length > 0 ? cp.files_touched.map(f => `- ${f}`).join('\n') : '- None'}

### Decisions Made
${cp.decisions?.length > 0 ? cp.decisions.map(d => `- ${d}`).join('\n') : '- None'}

### Next Steps
${nextStepsList}

**Important:** Do not repeat completed steps. Continue from current step.
`;
}

/**
 * Mark checkpoint as completed
 * @param {number} checkpointId - Checkpoint ID
 * @returns {Promise<{ success: boolean }>}
 */
async function markCheckpointComplete(checkpointId) {
  try {
    const checkpoint = await getCheckpointById(checkpointId);
    if (!checkpoint) {
      return { success: false };
    }

    // Update progress
    const updated = checkpoint.checkpoint;
    updated.progress.remaining = [];
    updated.progress.current = 'completed';

    const { knowledge } = require('./knowledge.js');

    // Update in database
    const result = knowledge.update(checkpointId, {
      content: JSON.stringify(updated)
    }, 'project');

    if (!result.success) {
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.warn(`Failed to mark checkpoint ${checkpointId} complete:`, err.message);
    return { success: false };
  }
}

/**
 * Get all checkpoints for phase in chronological order
 * @param {number} phase - Phase number
 * @returns {Promise<Array>} Checkpoints sorted by created_at ascending
 */
async function getCheckpointHistory(phase) {
  const { knowledge } = require('./knowledge.js');

  const conn = knowledge._getConnection('project');
  if (!conn.available) {
    return [];
  }

  try {
    const stmt = conn.db.prepare(`
      SELECT id, content, created_at
      FROM knowledge
      WHERE type = 'checkpoint' AND scope = 'project'
      ORDER BY created_at ASC
    `);

    const results = stmt.all();
    const checkpoints = [];

    for (const row of results) {
      try {
        const checkpoint = JSON.parse(row.content);

        // Filter by phase
        if (checkpoint.phase !== phase) continue;

        checkpoints.push({
          id: row.id,
          checkpoint,
          created_at: row.created_at
        });
      } catch (err) {
        console.warn(`Failed to parse checkpoint ${row.id}:`, err.message);
      }
    }

    return checkpoints;
  } catch (err) {
    console.warn('Failed to get checkpoint history:', err.message);
    return [];
  }
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  CHECKPOINT_SCHEMA,
  createCheckpoint,
  searchCheckpoints,
  getCheckpointById,
  getLatestCheckpoint,
  cleanupCheckpoints,
  findResumePoint,
  buildResumePrompt,
  markCheckpointComplete,
  getCheckpointHistory
};
