#!/usr/bin/env node

/**
 * Task Chunker
 *
 * Detects large tasks that exceed single context capacity and splits them
 * into manageable batches. Enables autonomous execution to handle operations
 * like "update 350 tests" without context exhaustion.
 *
 * Pattern: Task Chunking with Large Task Detection
 * Source: Phase 7 Research - Pattern 3
 */

const CHUNK_STRATEGIES = {
  BATCH: 'batch',           // Split by operation count (e.g., 350 tests -> 10x35)
  FILE_BATCH: 'file-batch', // Split by file count
  RECURSIVE_SEARCH: 'recursive-search', // Search -> analyze -> execute stages
  SEMANTIC: 'semantic'      // Divide into logical parts
};

const COMPLEXITY_LEVELS = {
  SIMPLE: 'simple',         // < 20k tokens
  MODERATE: 'moderate',     // 20k - 70k tokens
  COMPLEX: 'complex',       // 70k - 140k tokens
  VERY_COMPLEX: 'very-complex' // >= 140k tokens
};

class TaskChunker {
  /**
   * @param {number} contextLimit - Maximum context window size (default: 200000)
   */
  constructor(contextLimit = 200000) {
    this.contextLimit = contextLimit;
    this.safeContextUsage = contextLimit * 0.7; // 140k tokens threshold
  }

  /**
   * Estimate token usage for a task using multi-signal heuristics
   * @param {Object} task - Task object with description, files, dependencies
   * @returns {Object} - Estimated tokens, signals, and complexity
   */
  estimateTaskTokens(task) {
    const signals = {
      isRepetitive: false,
      requiresSearch: false,
      fileCount: 0,
      operationCount: 0
    };

    // Base tokens for task setup
    let tokens = 5000;

    // File operations: 500 tokens per file
    const fileCount = task.files?.length || 0;
    signals.fileCount = fileCount;
    tokens += fileCount * 500;

    // Description complexity: ~1 token per 4 characters
    const description = task.description || '';
    tokens += Math.ceil(description.length / 4);

    // Detect repetitive operations
    const repetitivePattern = /update.*tests?|migrate|refactor|rename|replace|convert/i;
    if (repetitivePattern.test(description)) {
      signals.isRepetitive = true;
      const operationCount = this.extractOperationCount(description);
      signals.operationCount = operationCount;
      // Add 100 tokens per operation in repetitive tasks
      tokens += operationCount * 100;
    }

    // Dependencies: 2000 tokens per dependency
    const depCount = task.dependencies?.length || 0;
    tokens += depCount * 2000;

    // Search operations detection
    const searchPattern = /find|search|grep|scan|locate|discover/i;
    if (searchPattern.test(description)) {
      signals.requiresSearch = true;
      tokens += 10000; // Search operations need more context
    }

    // Large file count adjustment
    if (fileCount > 50) {
      tokens += fileCount * 200; // Additional overhead for many files
    }

    const complexity = this.classifyComplexity(tokens);

    return {
      tokens,
      signals,
      complexity
    };
  }

  /**
   * Extract operation count from task description
   * @param {string} description - Task description
   * @returns {number} - Extracted count or default
   */
  extractOperationCount(description) {
    // Match patterns like "update 350 tests", "rename 50 files"
    const match = description.match(/(\d+)\s*(test|file|component|function|module|endpoint|migration|item)s?/i);
    return match ? parseInt(match[1], 10) : 10;
  }

  /**
   * Classify complexity based on token count
   * @param {number} tokens - Estimated token count
   * @returns {string} - Complexity level
   */
  classifyComplexity(tokens) {
    if (tokens < 20000) return COMPLEXITY_LEVELS.SIMPLE;
    if (tokens < 70000) return COMPLEXITY_LEVELS.MODERATE;
    if (tokens < this.safeContextUsage) return COMPLEXITY_LEVELS.COMPLEX;
    return COMPLEXITY_LEVELS.VERY_COMPLEX;
  }

  /**
   * Analyze a task and determine if chunking is needed
   * @param {Object} task - Task object
   * @returns {Object} - Analysis result with chunking recommendation
   */
  analyzeTask(task) {
    const estimate = this.estimateTaskTokens(task);
    const needsChunking = estimate.tokens >= this.safeContextUsage;

    if (!needsChunking) {
      return {
        needsChunking: false,
        estimatedTokens: estimate.tokens,
        chunkCount: 1,
        strategy: 'single-pass',
        complexity: estimate.complexity,
        signals: estimate.signals
      };
    }

    const strategy = this.selectChunkingStrategy(task, estimate);
    const chunkCount = this.calculateChunkCount(estimate.tokens, strategy, estimate.signals);
    const chunks = this.createChunks(task, strategy, chunkCount, estimate.signals);

    return {
      needsChunking: true,
      estimatedTokens: estimate.tokens,
      chunkCount,
      strategy,
      complexity: estimate.complexity,
      signals: estimate.signals,
      chunks
    };
  }

  /**
   * Select the best chunking strategy for a task
   * @param {Object} task - Task object
   * @param {Object} estimate - Token estimate result
   * @returns {string} - Selected strategy
   */
  selectChunkingStrategy(task, estimate) {
    if (estimate.signals.isRepetitive) {
      return CHUNK_STRATEGIES.BATCH;
    }
    if (estimate.signals.requiresSearch) {
      return CHUNK_STRATEGIES.RECURSIVE_SEARCH;
    }
    if (estimate.signals.fileCount > 50) {
      return CHUNK_STRATEGIES.FILE_BATCH;
    }
    return CHUNK_STRATEGIES.SEMANTIC;
  }

  /**
   * Calculate number of chunks needed
   * @param {number} tokens - Total estimated tokens
   * @param {string} strategy - Chunking strategy
   * @param {Object} signals - Task signals
   * @returns {number} - Number of chunks
   */
  calculateChunkCount(tokens, strategy, signals) {
    // Target: each chunk should be ~50% of safe context usage for overhead room
    const targetChunkSize = this.safeContextUsage * 0.5; // 70k tokens
    const baseChunks = Math.ceil(tokens / targetChunkSize);

    // Adjust based on strategy
    if (strategy === CHUNK_STRATEGIES.BATCH && signals.operationCount > 0) {
      // Ensure reasonable batch sizes (10-50 operations per batch)
      const opsPerBatch = Math.ceil(signals.operationCount / baseChunks);
      if (opsPerBatch > 50) {
        return Math.ceil(signals.operationCount / 35);
      }
    }

    return Math.max(2, baseChunks); // Minimum 2 chunks
  }

  /**
   * Create chunk definitions for a task
   * @param {Object} task - Task object
   * @param {string} strategy - Chunking strategy
   * @param {number} chunkCount - Number of chunks
   * @param {Object} signals - Task signals
   * @returns {Array} - Array of chunk definitions
   */
  createChunks(task, strategy, chunkCount, signals) {
    switch (strategy) {
      case CHUNK_STRATEGIES.BATCH:
        return this.createBatchChunks(task, chunkCount, signals);
      case CHUNK_STRATEGIES.FILE_BATCH:
        return this.createFileChunks(task, chunkCount);
      case CHUNK_STRATEGIES.RECURSIVE_SEARCH:
        return this.createRecursiveChunks(task);
      case CHUNK_STRATEGIES.SEMANTIC:
      default:
        return this.createSemanticChunks(task, chunkCount);
    }
  }

  /**
   * Create batch chunks for repetitive operations
   */
  createBatchChunks(task, chunkCount, signals) {
    const totalOps = signals.operationCount || 100;
    const opsPerChunk = Math.ceil(totalOps / chunkCount);
    const chunks = [];

    for (let i = 0; i < chunkCount; i++) {
      const start = i * opsPerChunk + 1;
      const end = Math.min((i + 1) * opsPerChunk, totalOps);
      chunks.push({
        id: `chunk-${i + 1}`,
        description: `${task.description} (items ${start}-${end})`,
        range: { start, end },
        estimatedTokens: Math.ceil(this.safeContextUsage * 0.5)
      });
    }

    return chunks;
  }

  /**
   * Create file-based chunks
   */
  createFileChunks(task, chunkCount) {
    const files = task.files || [];
    const filesPerChunk = Math.ceil(files.length / chunkCount);
    const chunks = [];

    for (let i = 0; i < chunkCount; i++) {
      const start = i * filesPerChunk;
      const end = Math.min((i + 1) * filesPerChunk, files.length);
      const chunkFiles = files.slice(start, end);
      chunks.push({
        id: `chunk-${i + 1}`,
        description: `${task.description} (files ${start + 1}-${end})`,
        files: chunkFiles,
        estimatedTokens: Math.ceil(this.safeContextUsage * 0.5)
      });
    }

    return chunks;
  }

  /**
   * Create recursive search chunks (search -> analyze -> execute)
   */
  createRecursiveChunks(task) {
    return [
      {
        id: 'chunk-search',
        description: `Search phase: ${task.description}`,
        stage: 'search',
        estimatedTokens: Math.ceil(this.safeContextUsage * 0.3)
      },
      {
        id: 'chunk-analyze',
        description: `Analyze phase: Review search results`,
        stage: 'analyze',
        estimatedTokens: Math.ceil(this.safeContextUsage * 0.3)
      },
      {
        id: 'chunk-execute',
        description: `Execute phase: Apply changes`,
        stage: 'execute',
        estimatedTokens: Math.ceil(this.safeContextUsage * 0.4)
      }
    ];
  }

  /**
   * Create semantic chunks by dividing task logically
   */
  createSemanticChunks(task, chunkCount) {
    const chunks = [];

    for (let i = 0; i < chunkCount; i++) {
      chunks.push({
        id: `chunk-${i + 1}`,
        description: `${task.description} (part ${i + 1} of ${chunkCount})`,
        part: i + 1,
        total: chunkCount,
        estimatedTokens: Math.ceil(this.safeContextUsage * 0.5)
      });
    }

    return chunks;
  }
}

/**
 * Batch Coordinator
 *
 * Manages execution state across multiple chunks, tracking progress
 * and enabling checkpoint-based resumption.
 */
class BatchCoordinator {
  /**
   * @param {Array} chunks - Array of chunk definitions
   * @param {Function} progressCallback - Optional callback for progress updates
   */
  constructor(chunks, progressCallback = null) {
    this.chunks = chunks || [];
    this.progressCallback = progressCallback;
    this.completedChunks = [];
    this.failedChunks = [];
    this.currentChunk = null;
    this.startTime = new Date().toISOString();
  }

  /**
   * Get the next unstarted chunk
   * @returns {Object|null} - Next chunk or null if all complete
   */
  getNextChunk() {
    const completedIds = new Set(this.completedChunks.map(c => c.id));
    const failedIds = new Set(this.failedChunks.map(c => c.chunkId));
    const currentId = this.currentChunk?.id;

    for (const chunk of this.chunks) {
      if (!completedIds.has(chunk.id) &&
          !failedIds.has(chunk.id) &&
          chunk.id !== currentId) {
        this.currentChunk = chunk;
        return chunk;
      }
    }

    return null;
  }

  /**
   * Mark a chunk as completed
   * @param {string} chunkId - Chunk identifier
   * @param {Object} result - Execution result
   */
  markComplete(chunkId, result = {}) {
    const chunk = this.chunks.find(c => c.id === chunkId);
    if (!chunk) return;

    this.completedChunks.push({
      id: chunkId,
      completedAt: new Date().toISOString(),
      tokensUsed: result.tokensUsed || 0,
      filesModified: result.filesModified || []
    });

    if (this.currentChunk?.id === chunkId) {
      this.currentChunk = null;
    }

    if (this.progressCallback) {
      this.progressCallback(this.getProgress());
    }
  }

  /**
   * Mark a chunk as failed
   * @param {string} chunkId - Chunk identifier
   * @param {string} error - Error message
   * @returns {Object} - Failure handling recommendation
   */
  markFailed(chunkId, error) {
    const chunk = this.chunks.find(c => c.id === chunkId);
    if (!chunk) return { retry: false, skip: false };

    this.failedChunks.push({
      chunkId,
      error,
      failedAt: new Date().toISOString()
    });

    if (this.currentChunk?.id === chunkId) {
      this.currentChunk = null;
    }

    // Recommend retry for transient errors
    const isTransient = /timeout|network|temporary/i.test(error);
    return {
      retry: isTransient,
      skip: !isTransient,
      reason: isTransient ? 'Transient error detected' : 'Permanent failure'
    };
  }

  /**
   * Get current progress
   * @returns {Object} - Progress statistics
   */
  getProgress() {
    const total = this.chunks.length;
    const completed = this.completedChunks.length;
    const failed = this.failedChunks.length;
    const remaining = total - completed - failed;
    const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      failed,
      remaining,
      percentComplete,
      currentChunk: this.currentChunk?.id || null,
      startTime: this.startTime
    };
  }

  /**
   * Serialize state for checkpoint persistence
   * @returns {Object} - Serializable state
   */
  toJSON() {
    return {
      chunks: this.chunks,
      completedChunks: this.completedChunks,
      failedChunks: this.failedChunks,
      currentChunk: this.currentChunk,
      startTime: this.startTime
    };
  }

  /**
   * Restore state from checkpoint
   * @param {Object} data - Serialized state
   * @returns {BatchCoordinator} - Restored instance
   */
  static fromJSON(data) {
    const coordinator = new BatchCoordinator(data.chunks);
    coordinator.completedChunks = data.completedChunks || [];
    coordinator.failedChunks = data.failedChunks || [];
    coordinator.currentChunk = data.currentChunk || null;
    coordinator.startTime = data.startTime;
    return coordinator;
  }
}

// Standalone function wrappers for CLI use
function analyzeTask(task) {
  const chunker = new TaskChunker();
  return chunker.analyzeTask(task);
}

function estimateTaskTokens(task) {
  const chunker = new TaskChunker();
  return chunker.estimateTaskTokens(task);
}

// Exports
module.exports = {
  TaskChunker,
  BatchCoordinator,
  analyzeTask,
  estimateTaskTokens,
  CHUNK_STRATEGIES,
  COMPLEXITY_LEVELS
};

// CLI interface when run directly
if (require.main === module) {
  console.log('TaskChunker module loaded successfully');
  console.log('Exports:', Object.keys(module.exports).join(', '));

  // Quick test
  const result = analyzeTask({
    description: 'Update 350 test files to use new auth module',
    files: []
  });
  console.log('Test analysis:', JSON.stringify(result, null, 2));
}
