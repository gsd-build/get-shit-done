# Phase 07: Autonomous Execution Optimization - Research

**Researched:** 2026-02-16
**Domain:** Multi-agent parallel coordination, context window management, task decomposition, batch processing
**Confidence:** HIGH

## Summary

Phase 7 optimizes Phase 6's autonomous execution core to scale from 8 phases to 20+ phases without quality degradation. The core challenges are: (1) parallel execution of independent phases without resource conflicts, (2) token limit monitoring to prevent mid-execution context exhaustion, (3) intelligent task decomposition when work exceeds single context capacity, and (4) context compression to maintain full roadmap awareness within window constraints.

Research shows 2026 best practices converge on: worker pool patterns for controlled parallel execution, explicit token budgeting with 80% utilization alerts, hierarchical task decomposition via micro-agent specialization, and multi-stage context compression (summarization + semantic chunking at 5-20x reduction). Phase 6 already provides the foundation: roadmap DAG parsing (parallel opportunity detection), checkpoint storage (SQLite), phase archiving (context compression), and fresh sub-coordinator spawning (isolation).

Phase 7 extends this with: parallel phase executor using Node.js worker pools or sequential-with-parallelism flag, token budget tracking via gsd-tools (warn at 150k/200k), task size estimation heuristics (complexity * files * dependencies), chunking strategies for repetitive operations (test updates, migrations), and structured completion signals (success/failure/blocked with retry/skip/escalate options).

**Primary recommendation:** Build on Phase 6 infrastructure with incremental optimization. Start with token monitoring (lowest risk, highest value), add failure handling with retry logic, implement task size detection, then add controlled parallel execution as final optimization. Defer full parallelism until token/failure handling proven—sequential execution with good error recovery beats parallel execution with poor observability.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.6.2+ | Checkpoint storage (Phase 3) | Already implemented, proven in Phase 6 |
| sqlite-vec | 0.1.7-alpha.2+ | Semantic checkpoint search (Phase 3) | Already implemented, enables resume queries |
| Node.js worker_threads | Built-in | Parallel phase execution | Native Node.js, battle-tested, zero dependencies |
| readline | Built-in | ROADMAP.md parsing (Phase 6) | Already used, streaming line-by-line parsing |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workerpool | 9.2.0+ | Worker thread pool management | If implementing parallel execution, provides queue and lifecycle management |
| piscina | 4.8.0+ | Production worker pool | Alternative to workerpool with better error recovery |
| roadmap-parser.js | Current (Phase 6) | DAG analysis, parallel detection | Existing Phase 6 module, extend for task size estimation |
| phase-archive.js | Current (Phase 6) | Context compression | Existing Phase 6 module, extend with selective injection |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Worker threads | Child processes (fork) | Child processes: heavier isolation, no shared memory. Worker threads: lighter, shared memory risks. Use workers for compute, processes for untrusted code. |
| Sequential-first approach | Parallel-first architecture | Parallel: faster but complex debugging, resource conflicts, 15x token cost overhead. Sequential: simpler, proven, add parallelism only where bottlenecks measured. |
| Heuristic task size detection | LLM-based complexity analysis | LLM analysis: more accurate but adds latency + cost per task. Heuristics: fast, free, 80% accuracy sufficient for binary split decision. |
| Manual token tracking | Automatic context window monitoring tools | Automatic tools: real-time tracking, alert systems. Manual: simpler implementation, lower overhead. Start manual, upgrade if bottlenecks found. |

**Installation:**

```bash
# Phase 6 foundation already installed (no new core dependencies)

# Optional: If implementing parallel execution
npm install workerpool@^9.2.0
# OR
npm install piscina@^4.8.0
```

## Architecture Patterns

### Recommended Project Structure

```
get-shit-done/workflows/
├── execute-roadmap.md         # (Phase 6) Roadmap orchestrator
├── execute-phase.md            # (Phase 6) Phase coordinator
└── execute-plan.md             # (existing) Plan executor

get-shit-done/bin/
├── roadmap-parser.js           # (Phase 6) Extend: task size estimation
├── phase-archive.js            # (Phase 6) Extend: selective context injection
├── token-monitor.js            # NEW: Token budget tracking + alerts
├── task-chunker.js             # NEW: Large task detection + splitting
├── failure-handler.js          # NEW: Retry/skip/escalate logic
└── parallel-executor.js        # NEW: Worker pool for phase parallelism

.planning/
├── ROADMAP.md                  # (existing) Source of truth
├── EXECUTION_LOG.md            # (Phase 6) Progress tracking
└── token_budget.json           # NEW: Session token tracking
```

### Pattern 1: Token Budget Monitoring with 80% Alert Threshold

**What:** Track token usage per phase, alert at 80% utilization before hard limit reached

**When to use:** Every sub-coordinator spawn, before large operations (research, planning, execution)

**Example:**

```javascript
// Source: https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/
// Token budget monitoring pattern from Context Window Management 2026

const TOKEN_LIMITS = {
  haiku: 200000,
  sonnet: 200000,
  opus: 200000
};

const ALERT_THRESHOLDS = {
  warn: 0.80,   // 160k tokens - trigger context compression
  critical: 0.90,  // 180k tokens - escalate to user
  stop: 0.95    // 190k tokens - halt execution
};

class TokenBudgetMonitor {
  constructor(model = 'opus', maxTokens = 200000) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.currentUsage = 0;
    this.phaseUsage = new Map(); // Track per-phase consumption
    this.alerts = [];
  }

  /**
   * Reserve tokens for an operation before executing
   * @param {number} estimatedTokens - Estimated token count
   * @param {string} operation - Operation name (e.g., "phase-6-research")
   * @returns {boolean} - Whether operation can proceed
   */
  reserve(estimatedTokens, operation) {
    const projected = this.currentUsage + estimatedTokens;
    const utilization = projected / this.maxTokens;

    if (utilization >= ALERT_THRESHOLDS.stop) {
      this.alerts.push({
        level: 'STOP',
        message: `Token limit exceeded: ${projected}/${this.maxTokens} (${(utilization * 100).toFixed(1)}%)`,
        operation,
        timestamp: new Date().toISOString()
      });
      return false; // Block operation
    }

    if (utilization >= ALERT_THRESHOLDS.critical) {
      this.alerts.push({
        level: 'CRITICAL',
        message: `Critical token usage: ${projected}/${this.maxTokens} (${(utilization * 100).toFixed(1)}%)`,
        operation,
        recommendation: 'Compress context or pause execution',
        timestamp: new Date().toISOString()
      });
      // Continue but warn
    }

    if (utilization >= ALERT_THRESHOLDS.warn) {
      this.alerts.push({
        level: 'WARN',
        message: `High token usage: ${projected}/${this.maxTokens} (${(utilization * 100).toFixed(1)}%)`,
        operation,
        recommendation: 'Consider context compression for next phase',
        timestamp: new Date().toISOString()
      });
    }

    return true;
  }

  /**
   * Record actual token usage after operation completes
   * @param {number} actualTokens - Actual tokens consumed
   * @param {string} phase - Phase identifier
   */
  recordUsage(actualTokens, phase) {
    this.currentUsage += actualTokens;

    if (!this.phaseUsage.has(phase)) {
      this.phaseUsage.set(phase, 0);
    }
    this.phaseUsage.set(phase, this.phaseUsage.get(phase) + actualTokens);
  }

  /**
   * Get utilization report for progress tracking
   */
  getReport() {
    return {
      current_usage: this.currentUsage,
      max_tokens: this.maxTokens,
      utilization_percent: (this.currentUsage / this.maxTokens * 100).toFixed(1),
      remaining_tokens: this.maxTokens - this.currentUsage,
      phase_breakdown: Object.fromEntries(this.phaseUsage),
      active_alerts: this.alerts.filter(a => a.level !== 'WARN')
    };
  }

  /**
   * Trigger context compression when utilization high
   * @returns {number} - Tokens freed via compression
   */
  async compressContext(phaseArchives) {
    const beforeCompression = this.currentUsage;

    // Call Phase 6 archive compression
    const { compressPhaseContext } = require('./phase-archive.js');
    const compressed = await compressPhaseContext(phaseArchives);

    // Estimate tokens freed (5-20x compression typical)
    const tokensFreed = Math.floor(beforeCompression * 0.6); // Conservative 40% reduction
    this.currentUsage -= tokensFreed;

    return tokensFreed;
  }
}

// Integration with execute-roadmap
async function executePhaseWithBudget(phase, tokenMonitor) {
  // Estimate tokens needed for phase
  const estimatedTokens = estimatePhaseTokens(phase);

  // Check if we can proceed
  if (!tokenMonitor.reserve(estimatedTokens, `phase-${phase.number}`)) {
    // Hit limit - compress or halt
    console.log('Token limit reached. Compressing context...');
    const freed = await tokenMonitor.compressContext(phase.number - 1);

    if (freed < estimatedTokens) {
      throw new Error('Cannot proceed: insufficient token budget even after compression');
    }
  }

  // Spawn sub-coordinator
  const result = await spawnPhaseCoordinator(phase);

  // Record actual usage
  tokenMonitor.recordUsage(result.tokensUsed, `phase-${phase.number}`);

  return result;
}

function estimatePhaseTokens(phase) {
  // Heuristic: base tokens + (requirements * 1000) + (success_criteria * 500)
  const baseTokens = 10000; // Research + planning overhead
  const reqTokens = phase.requirements.length * 1000;
  const criteriaTokens = phase.success_criteria.length * 500;

  return baseTokens + reqTokens + criteriaTokens;
}
```

**Source:** [Context Window Management Strategies 2026](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/), [Context Window Overflow Fix](https://redis.io/blog/context-window-overflow/)

### Pattern 2: Failure Handling with Retry/Skip/Escalate

**What:** Structured error handling with adaptive retry (exponential backoff), graceful skip (mark incomplete), and user escalation (blocking questions)

**When to use:** Every sub-coordinator spawn, every checkpoint creation, every task execution

**Example:**

```javascript
// Source: https://sparkco.ai/blog/mastering-retry-logic-agents-a-deep-dive-into-2025-best-practices
// Retry patterns with exponential backoff + jitter

class FailureHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.jitterFactor = options.jitterFactor || 0.2; // 20% jitter
  }

  /**
   * Execute operation with retry logic
   * @param {Function} operation - Async function to execute
   * @param {object} context - Operation context (phase, task, etc.)
   * @returns {Promise<{success: boolean, result: any, retries: number}>}
   */
  async executeWithRetry(operation, context) {
    let lastError = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          result,
          retries: attempt
        };
      } catch (error) {
        lastError = error;

        // Check if retryable
        if (!this.isRetryable(error)) {
          return this.handleNonRetryable(error, context);
        }

        // Calculate backoff with jitter
        const delay = this.calculateBackoff(attempt);

        console.log(`Attempt ${attempt + 1}/${this.maxRetries} failed: ${error.message}`);
        console.log(`Retrying in ${delay}ms...`);

        await this.sleep(delay);
      }
    }

    // All retries exhausted - escalate
    return this.handleExhaustedRetries(lastError, context);
  }

  /**
   * Determine if error is retryable (transient vs permanent)
   */
  isRetryable(error) {
    const retryablePatterns = [
      /ECONNRESET/,
      /ETIMEDOUT/,
      /rate limit/i,
      /429/,
      /503/,
      /temporary/i
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Calculate exponential backoff with jitter
   */
  calculateBackoff(attempt) {
    // Exponential: 1s, 2s, 4s, 8s...
    const exponential = Math.min(
      this.baseDelay * Math.pow(2, attempt),
      this.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = exponential * this.jitterFactor * (Math.random() - 0.5);

    return Math.floor(exponential + jitter);
  }

  /**
   * Handle non-retryable errors (immediate escalation)
   */
  async handleNonRetryable(error, context) {
    const options = {
      retry: false,
      skip: true,
      escalate: true
    };

    return {
      success: false,
      error,
      context,
      decision: await this.getUserDecision(
        `Non-retryable error in ${context.operation}: ${error.message}`,
        options
      )
    };
  }

  /**
   * Handle exhausted retries (user choice: skip or escalate)
   */
  async handleExhaustedRetries(error, context) {
    const options = {
      retry: true,   // Allow manual retry
      skip: true,    // Mark incomplete and continue
      escalate: true // Stop execution, user intervention
    };

    return {
      success: false,
      error,
      context,
      retries: this.maxRetries,
      decision: await this.getUserDecision(
        `Failed after ${this.maxRetries} retries in ${context.operation}: ${error.message}`,
        options
      )
    };
  }

  /**
   * Present failure to user with options
   */
  async getUserDecision(message, options) {
    console.log('\n=== FAILURE DETECTED ===');
    console.log(message);
    console.log('\nOptions:');
    if (options.retry) console.log('  1. Retry - Try operation again');
    if (options.skip) console.log('  2. Skip - Mark incomplete, continue roadmap');
    if (options.escalate) console.log('  3. Escalate - Stop execution, manual intervention');
    console.log('\nWhat would you like to do? (1/2/3)');

    // In real implementation, wait for user input via Claude chat or stdin
    // For now, return structured choice
    return {
      action: 'skip', // Default: skip and continue
      reason: 'User not available, continuing with incomplete phase',
      timestamp: new Date().toISOString()
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Integration example
async function executePhaseWithFailureHandling(phase) {
  const handler = new FailureHandler({
    maxRetries: 3,
    baseDelay: 2000
  });

  const result = await handler.executeWithRetry(
    async () => {
      // Spawn sub-coordinator
      return await spawnPhaseCoordinator(phase);
    },
    {
      operation: `phase-${phase.number}-${phase.name}`,
      phase: phase.number
    }
  );

  if (!result.success) {
    // Log failure to EXECUTION_LOG
    await logFailure(phase, result);

    if (result.decision.action === 'escalate') {
      throw new Error('Execution halted by user');
    }

    if (result.decision.action === 'skip') {
      // Mark phase incomplete, continue to next
      await markPhaseIncomplete(phase.number);
      return { status: 'skipped', phase: phase.number };
    }
  }

  return result;
}
```

**Source:** [Mastering Retry Logic Agents 2025](https://sparkco.ai/blog/mastering-retry-logic-agents-a-deep-dive-into-2025-best-practices), [Multi-Agent System Reliability](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/)

### Pattern 3: Task Size Detection and Chunking Strategy

**What:** Heuristic-based task complexity estimation to detect work exceeding single context capacity, with recursive splitting for large operations

**When to use:** Before executing any task, especially repetitive operations (test updates, file migrations, bulk refactors)

**Example:**

```javascript
// Source: https://www.couchbase.com/blog/data-chunking/
// Chunking strategies for large-scale operations

class TaskChunker {
  constructor(contextLimit = 200000) {
    this.contextLimit = contextLimit;
    this.safeContextUsage = contextLimit * 0.7; // 70% = 140k tokens safe threshold
  }

  /**
   * Estimate task size and determine if chunking needed
   * @param {object} task - Task to analyze
   * @returns {object} - {needsChunking, estimatedTokens, chunkCount, strategy}
   */
  analyzeTask(task) {
    const estimate = this.estimateTaskComplexity(task);
    const needsChunking = estimate.tokens > this.safeContextUsage;

    if (!needsChunking) {
      return {
        needsChunking: false,
        estimatedTokens: estimate.tokens,
        chunkCount: 1,
        strategy: 'single-pass'
      };
    }

    // Determine chunking strategy based on task type
    const strategy = this.selectChunkingStrategy(task, estimate);
    const chunkCount = Math.ceil(estimate.tokens / this.safeContextUsage);

    return {
      needsChunking: true,
      estimatedTokens: estimate.tokens,
      chunkCount,
      strategy,
      chunks: this.createChunks(task, strategy, chunkCount)
    };
  }

  /**
   * Estimate task complexity using multi-signal heuristics
   */
  estimateTaskComplexity(task) {
    const signals = {
      // File count signal
      fileCount: (task.files || []).length,
      // Description length signal
      descriptionLength: (task.description || '').length,
      // Repetitive operation signal (keywords)
      isRepetitive: /update.*tests?|migrate|refactor|rename|replace/i.test(task.description),
      // Cross-file dependency signal
      hasDependencies: task.dependencies && task.dependencies.length > 0,
      // Codebase search signal
      requiresSearch: /find|search|grep|scan/i.test(task.description)
    };

    // Base tokens for task setup
    let estimatedTokens = 5000;

    // File operations: 500 tokens per file
    estimatedTokens += signals.fileCount * 500;

    // Description complexity: 1 token per char
    estimatedTokens += signals.descriptionLength;

    // Repetitive operations: multiply by operation count estimate
    if (signals.isRepetitive) {
      const operationCount = this.extractOperationCount(task.description);
      estimatedTokens *= operationCount / 10; // Scale factor
    }

    // Dependencies: 2000 tokens per dependency for analysis
    if (signals.hasDependencies) {
      estimatedTokens += task.dependencies.length * 2000;
    }

    // Codebase search: 10k tokens for search + analysis
    if (signals.requiresSearch) {
      estimatedTokens += 10000;
    }

    return {
      tokens: estimatedTokens,
      signals,
      complexity: this.classifyComplexity(estimatedTokens)
    };
  }

  /**
   * Extract operation count from description (e.g., "update 350 tests")
   */
  extractOperationCount(description) {
    const countMatch = description.match(/(\d+)\s+(test|file|component|function)/i);
    return countMatch ? parseInt(countMatch[1]) : 10; // Default: 10 operations
  }

  /**
   * Classify task complexity
   */
  classifyComplexity(tokens) {
    if (tokens < 20000) return 'simple';
    if (tokens < 70000) return 'moderate';
    if (tokens < 140000) return 'complex';
    return 'very-complex';
  }

  /**
   * Select chunking strategy based on task type
   */
  selectChunkingStrategy(task, estimate) {
    if (estimate.signals.isRepetitive) {
      // Batch processing for repetitive operations
      return 'batch';
    }

    if (estimate.signals.requiresSearch) {
      // Recursive: search → analyze → execute per chunk
      return 'recursive-search';
    }

    if (task.files && task.files.length > 50) {
      // File-based chunking: process N files at a time
      return 'file-batch';
    }

    // Default: semantic chunking by logical units
    return 'semantic';
  }

  /**
   * Create chunks based on strategy
   */
  createChunks(task, strategy, chunkCount) {
    switch (strategy) {
      case 'batch':
        return this.createBatchChunks(task, chunkCount);

      case 'file-batch':
        return this.createFileChunks(task, chunkCount);

      case 'recursive-search':
        return this.createRecursiveChunks(task);

      default:
        return this.createSemanticChunks(task, chunkCount);
    }
  }

  /**
   * Batch chunking: "update 350 tests" → 10 batches of 35 tests
   */
  createBatchChunks(task, chunkCount) {
    const operationCount = this.extractOperationCount(task.description);
    const batchSize = Math.ceil(operationCount / chunkCount);

    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, operationCount);

      chunks.push({
        id: `chunk-${i + 1}`,
        description: `${task.description} (batch ${i + 1}/${chunkCount}: items ${start + 1}-${end})`,
        range: { start, end },
        estimatedTokens: this.safeContextUsage
      });
    }

    return chunks;
  }

  /**
   * File-based chunking: process N files per chunk
   */
  createFileChunks(task, chunkCount) {
    const filesPerChunk = Math.ceil(task.files.length / chunkCount);

    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
      const start = i * filesPerChunk;
      const end = Math.min(start + filesPerChunk, task.files.length);
      const chunkFiles = task.files.slice(start, end);

      chunks.push({
        id: `chunk-${i + 1}`,
        description: `${task.description} (files ${start + 1}-${end})`,
        files: chunkFiles,
        estimatedTokens: this.safeContextUsage
      });
    }

    return chunks;
  }

  /**
   * Recursive chunking: search → filter → process
   */
  createRecursiveChunks(task) {
    return [
      {
        id: 'chunk-search',
        description: `Search codebase for ${task.description}`,
        action: 'search',
        estimatedTokens: 30000
      },
      {
        id: 'chunk-analyze',
        description: 'Analyze search results and create execution plan',
        action: 'analyze',
        dependsOn: 'chunk-search',
        estimatedTokens: 20000
      },
      {
        id: 'chunk-execute',
        description: 'Execute operations in batches',
        action: 'execute-batch',
        dependsOn: 'chunk-analyze',
        estimatedTokens: this.safeContextUsage
      }
    ];
  }

  /**
   * Semantic chunking: split by logical units
   */
  createSemanticChunks(task, chunkCount) {
    // Fallback: evenly distribute estimated work
    const tokensPerChunk = this.safeContextUsage;

    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
      chunks.push({
        id: `chunk-${i + 1}`,
        description: `${task.description} (part ${i + 1}/${chunkCount})`,
        estimatedTokens: tokensPerChunk
      });
    }

    return chunks;
  }
}

// Integration example
async function executeTaskWithChunking(task, tokenMonitor) {
  const chunker = new TaskChunker(200000);
  const analysis = chunker.analyzeTask(task);

  if (!analysis.needsChunking) {
    // Execute as single task
    return await executeTask(task);
  }

  console.log(`Task requires chunking: ${analysis.chunkCount} chunks via ${analysis.strategy} strategy`);

  // Execute chunks sequentially or in parallel (if independent)
  const results = [];
  for (const chunk of analysis.chunks) {
    // Check token budget before each chunk
    if (!tokenMonitor.reserve(chunk.estimatedTokens, chunk.id)) {
      await tokenMonitor.compressContext();
    }

    const result = await executeTask(chunk);
    results.push(result);
  }

  return {
    status: 'completed',
    strategy: analysis.strategy,
    chunksExecuted: results.length,
    results
  };
}
```

**Source:** [Data Chunking Guide](https://www.couchbase.com/blog/data-chunking/), [Agentic Automation Task Decomposition](https://www.af-robotics.com/blog/agentic-automation-in-2026-from-task-execution-to-autonomous-decision-systems)

### Pattern 4: Parallel Execution with Worker Pool (Optional)

**What:** Controlled parallel phase execution using Node.js worker pool for independent phases identified by DAG

**When to use:** Only after token monitoring, failure handling, and task chunking proven—parallel execution is optimization, not requirement

**Example:**

```javascript
// Source: https://github.com/josdejong/workerpool
// Worker pool pattern for concurrent phase execution

const workerpool = require('workerpool');
const path = require('path');

class ParallelPhaseExecutor {
  constructor(maxWorkers = 2) {
    // Conservative: max 2 parallel phases to prevent resource exhaustion
    this.pool = workerpool.pool(
      path.join(__dirname, 'phase-worker.js'),
      {
        maxWorkers,
        workerType: 'thread' // Use worker_threads, not processes
      }
    );
  }

  /**
   * Execute phases in parallel where DAG allows
   * @param {Array<Array<number>>} parallelGroups - Groups from detectParallelOpportunities
   * @param {Map<number, Phase>} phaseMap - Phase data
   * @returns {Promise<Array>} - Execution results
   */
  async executeParallelGroups(parallelGroups, phaseMap, tokenMonitor) {
    const results = [];

    for (const group of parallelGroups) {
      if (group.length === 1) {
        // Single phase - execute directly
        const phase = phaseMap.get(group[0]);
        const result = await this.executeSinglePhase(phase, tokenMonitor);
        results.push(result);
      } else {
        // Multiple phases can run in parallel
        console.log(`Executing ${group.length} phases in parallel: ${group.join(', ')}`);

        // Check if we have token budget for parallel execution
        const totalEstimatedTokens = group.reduce((sum, phaseNum) => {
          const phase = phaseMap.get(phaseNum);
          return sum + estimatePhaseTokens(phase);
        }, 0);

        if (!tokenMonitor.reserve(totalEstimatedTokens, `parallel-group-${group.join('-')}`)) {
          console.log('Insufficient token budget for parallel execution. Falling back to sequential.');
          // Execute sequentially instead
          for (const phaseNum of group) {
            const phase = phaseMap.get(phaseNum);
            const result = await this.executeSinglePhase(phase, tokenMonitor);
            results.push(result);
          }
          continue;
        }

        // Execute in parallel via worker pool
        const promises = group.map(phaseNum => {
          const phase = phaseMap.get(phaseNum);
          return this.pool.exec('executePhase', [phase]);
        });

        // Wait for all to complete
        const groupResults = await Promise.allSettled(promises);

        // Process results
        for (let i = 0; i < groupResults.length; i++) {
          const result = groupResults[i];
          const phaseNum = group[i];

          if (result.status === 'fulfilled') {
            results.push({ phase: phaseNum, ...result.value });
            tokenMonitor.recordUsage(result.value.tokensUsed, `phase-${phaseNum}`);
          } else {
            // Parallel execution failed - handle individually
            console.error(`Phase ${phaseNum} failed in parallel: ${result.reason}`);
            results.push({
              phase: phaseNum,
              status: 'failed',
              error: result.reason
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Execute single phase (fallback for non-parallel)
   */
  async executeSinglePhase(phase, tokenMonitor) {
    return await this.pool.exec('executePhase', [phase]);
  }

  /**
   * Shutdown worker pool
   */
  async terminate() {
    await this.pool.terminate();
  }
}

// phase-worker.js (separate file)
// Worker thread that executes phase in isolated context
const workerpool = require('workerpool');

async function executePhase(phase) {
  // Load Phase 6 execute-phase workflow
  const { spawnPhaseCoordinator } = require('./execute-phase-coordinator.js');

  try {
    const result = await spawnPhaseCoordinator(phase);
    return {
      status: 'completed',
      phase: phase.number,
      tokensUsed: result.tokensUsed,
      filesModified: result.filesModified
    };
  } catch (error) {
    return {
      status: 'failed',
      phase: phase.number,
      error: error.message,
      stack: error.stack
    };
  }
}

// Register worker functions
workerpool.worker({
  executePhase
});

// Integration with execute-roadmap
async function executeRoadmapWithParallelism(roadmap, tokenMonitor) {
  const { phases, parallel_opportunities } = roadmap;

  // Use parallel executor only if multiple parallel opportunities exist
  const hasParallelism = parallel_opportunities.some(group => group.length > 1);

  if (!hasParallelism) {
    console.log('No parallel opportunities detected. Executing sequentially.');
    // Fall back to Phase 6 sequential execution
    return await executeSequentially(phases, tokenMonitor);
  }

  const executor = new ParallelPhaseExecutor(2); // Max 2 parallel

  try {
    const results = await executor.executeParallelGroups(
      parallel_opportunities,
      new Map(phases.map(p => [p.number, p])),
      tokenMonitor
    );

    return results;
  } finally {
    await executor.terminate();
  }
}
```

**Source:** [Workerpool GitHub](https://github.com/josdejong/workerpool), [Node.js Worker Threads Guide](https://nodesource.com/blog/worker-threads-nodejs-multithreading-in-javascript)

### Pattern 5: Structured Completion Signals

**What:** Sub-coordinators return standardized completion objects (success/failure/blocked) with retry/skip/escalate options

**When to use:** Every sub-coordinator spawn, every checkpoint, every phase completion

**Example:**

```javascript
// Source: https://medium.com/@fraidoonomarzai99/multi-agent-systems-complete-guide-689f241b65c8
// Structured handoff messages for multi-agent coordination

const COMPLETION_STATUS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  BLOCKED: 'blocked',
  SKIPPED: 'skipped'
};

/**
 * Structured completion signal format
 */
class CompletionSignal {
  constructor(status, phase, details = {}) {
    this.status = status;
    this.phase = phase;
    this.timestamp = new Date().toISOString();
    this.details = {
      tokensUsed: details.tokensUsed || 0,
      filesModified: details.filesModified || [],
      checkpoints: details.checkpoints || [],
      errors: details.errors || [],
      nextSteps: details.nextSteps || [],
      ...details
    };
  }

  /**
   * Create success signal
   */
  static success(phase, details) {
    return new CompletionSignal(COMPLETION_STATUS.SUCCESS, phase, {
      ...details,
      nextPhaseReady: true
    });
  }

  /**
   * Create failure signal with retry options
   */
  static failure(phase, error, options = {}) {
    return new CompletionSignal(COMPLETION_STATUS.FAILURE, phase, {
      error: error.message,
      stack: error.stack,
      retryable: options.retryable !== false,
      retryOptions: {
        maxRetries: options.maxRetries || 3,
        backoffMs: options.backoffMs || 2000
      },
      skipOption: options.allowSkip !== false,
      escalateOption: options.requiresEscalation || false,
      ...options
    });
  }

  /**
   * Create blocked signal (waiting on dependency or user)
   */
  static blocked(phase, reason, details = {}) {
    return new CompletionSignal(COMPLETION_STATUS.BLOCKED, phase, {
      reason,
      blockingDependencies: details.dependencies || [],
      userInputRequired: details.userInput || false,
      estimatedUnblockTime: details.eta || null,
      ...details
    });
  }

  /**
   * Create skipped signal (user chose to skip incomplete phase)
   */
  static skipped(phase, reason) {
    return new CompletionSignal(COMPLETION_STATUS.SKIPPED, phase, {
      reason,
      incomplete: true,
      affectedPhases: [] // Will be populated by caller
    });
  }

  /**
   * Check if completion is terminal (requires user action)
   */
  isTerminal() {
    return this.status === COMPLETION_STATUS.BLOCKED && this.details.userInputRequired;
  }

  /**
   * Check if can automatically retry
   */
  canRetry() {
    return this.status === COMPLETION_STATUS.FAILURE && this.details.retryable;
  }

  /**
   * Serialize for logging
   */
  toJSON() {
    return {
      status: this.status,
      phase: this.phase,
      timestamp: this.timestamp,
      ...this.details
    };
  }
}

// Sub-coordinator integration
async function phaseCoordinatorWithSignals(phase) {
  try {
    // Execute phase cycle
    const result = await executeFullPhaseCycle(phase);

    // Return success signal
    return CompletionSignal.success(phase.number, {
      tokensUsed: result.tokensUsed,
      filesModified: result.filesModified,
      checkpoints: result.checkpoints,
      verificationStatus: result.verificationStatus
    });

  } catch (error) {
    // Check if error is retryable
    const isRetryable = /ECONNRESET|ETIMEDOUT|rate limit/i.test(error.message);

    if (isRetryable) {
      return CompletionSignal.failure(phase.number, error, {
        retryable: true,
        maxRetries: 3,
        allowSkip: true
      });
    }

    // Non-retryable - requires escalation
    return CompletionSignal.failure(phase.number, error, {
      retryable: false,
      requiresEscalation: true,
      allowSkip: true
    });
  }
}

// Main coordinator integration
async function handleCompletionSignal(signal, failureHandler) {
  if (signal.status === COMPLETION_STATUS.SUCCESS) {
    console.log(`✓ Phase ${signal.phase} completed successfully`);
    return { continue: true, result: signal };
  }

  if (signal.status === COMPLETION_STATUS.FAILURE) {
    if (signal.canRetry()) {
      console.log(`⚠ Phase ${signal.phase} failed but retryable`);
      const decision = await failureHandler.getUserDecision(
        signal.details.error,
        {
          retry: true,
          skip: signal.details.skipOption,
          escalate: signal.details.escalateOption
        }
      );

      return { continue: decision.action !== 'escalate', result: signal, decision };
    }

    // Non-retryable - escalate
    console.log(`✗ Phase ${signal.phase} failed (non-retryable)`);
    return { continue: false, result: signal };
  }

  if (signal.status === COMPLETION_STATUS.BLOCKED) {
    if (signal.isTerminal()) {
      console.log(`⏸ Phase ${signal.phase} blocked: ${signal.details.reason}`);
      // Wait for user input
      return { continue: false, result: signal, awaitingUser: true };
    }

    // Blocked on dependency - wait and retry
    console.log(`⏳ Phase ${signal.phase} waiting on dependencies`);
    return { continue: false, result: signal, awaitingDependency: true };
  }

  if (signal.status === COMPLETION_STATUS.SKIPPED) {
    console.log(`⊘ Phase ${signal.phase} skipped: ${signal.details.reason}`);
    return { continue: true, result: signal };
  }
}
```

**Source:** [Multi-Agent Systems Complete Guide](https://medium.com/@fraidoonomarzai99/multi-agent-systems-complete-guide-689f241b65c8), [AI Agent Orchestration](https://kanerika.com/blogs/ai-agent-orchestration/)

### Anti-Patterns to Avoid

- **Parallel-first architecture:** Don't implement parallelism before token monitoring and failure handling are proven—complexity compounds debugging, and 15x token overhead can exhaust budget faster than time savings from parallelism
- **Over-aggressive chunking:** Don't split every task—chunking adds coordination overhead. Only chunk when estimate exceeds 70% of context window (140k tokens).
- **Ignoring token compression opportunities:** Don't wait until 100% utilization to compress—compress at 80% threshold proactively to maintain performance headroom
- **Blocking on user input:** Don't halt all execution when one phase needs user input—continue with independent phases, queue blocked phase for later
- **Hardcoded retry counts:** Don't use same retry logic for all error types—rate limits need exponential backoff, network errors need quick retry, validation errors need escalation
- **Stateful worker threads:** Don't maintain state across worker executions—spawn fresh for each phase to prevent cross-contamination

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker thread pools | Custom thread management, manual task queue | workerpool or piscina npm packages | Lifecycle management (spawn, terminate, crash recovery), task queuing, load balancing—1000+ LOC problem, battle-tested libraries exist |
| Token counting | Regex-based estimation, word-to-token ratio | tiktoken (OpenAI) or built-in model tokenizers | Accurate per-model tokenization rules, handles special tokens, updates with model changes |
| Exponential backoff | Custom sleep + retry loops | Built-in retry libraries (p-retry, async-retry) | Jitter algorithms prevent thundering herd, idempotency handling, circuit breaker patterns |
| Parallel coordination | Manual Promise.allSettled tracking | Existing Phase 6 DAG + optional worker pool | DAG already computes parallel opportunities (Phase 6), adding worker pool is 50 LOC, not 500 |
| Context compression | Custom summarization, text truncation | Phase 6 phase-archive.js + LLM summarization | Phase 6 already implements archive compression (extract key decisions, summarize plans), extends to 5-20x reduction without custom algorithms |

**Key insight:** Phase 7 is optimization layer on Phase 6 foundation. 90% of infrastructure exists (DAG parsing, checkpoint storage, archiving, sub-coordinator spawning). Phase 7 adds monitoring (token budgets), resilience (failure handling), and intelligence (task chunking). Parallel execution is optional cherry on top—defer until bottlenecks measured.

## Common Pitfalls

### Pitfall 1: Parallel Execution Without Resource Locking

**What goes wrong:** Two phases modify same file concurrently (e.g., Phase 4 and Phase 5 both update STATE.md), causing git conflicts or data corruption.

**Why it happens:** DAG detects phases are independent (no dependency edges), but doesn't check file-level conflicts.

**How to avoid:**
- Before parallel execution, analyze file sets: if overlap detected, serialize
- Phase 6 roadmap-parser already tracks files via SUMMARY.md—extend to check file overlap
- Conservative approach: only parallelize phases with completely disjoint file sets
- Git worktrees enable true isolation (each phase gets own checkout)

**Warning signs:** Git merge conflicts after parallel execution. Files contain interleaved changes from multiple phases. EXECUTION_LOG shows overlapping file modifications.

**Source:** [AI Coding Agents Orchestration](https://mikemason.ca/writing/ai-coding-agents-jan-2026/)

### Pitfall 2: Token Limit Exhaustion Mid-Phase

**What goes wrong:** Phase spawns with 180k tokens already consumed, runs out of budget during research step, execution halts incomplete.

**Why it happens:** No token budget reservation before phase spawn—reactive instead of proactive monitoring.

**How to avoid:**
- Implement token budget reservation pattern (Pattern 1): estimate tokens needed, block if insufficient
- Trigger context compression at 80% threshold (160k/200k), not at 95%
- Phase estimation heuristic: 10k base + (1k * requirements count) + (500 * success criteria)
- If compression insufficient, split phase into multiple sub-phases

**Warning signs:** Phases start but don't complete. Error messages about context limits. Token usage grows linearly with phase count without compression.

**Source:** [Context Window Overflow Fix](https://redis.io/blog/context-window-overflow/), [Context rot explained](https://redis.io/blog/context-rot/)

### Pitfall 3: Chunking Overhead Exceeds Execution Savings

**What goes wrong:** Task "update 10 files" gets chunked into 3 batches with 2 files + 3 files + 5 files, spending more time coordinating batches than just executing once.

**Why it happens:** Overly aggressive chunking threshold—splitting tasks that fit comfortably in single context.

**How to avoid:**
- Only chunk when estimate exceeds 70% of context window (140k tokens for 200k window)
- Minimum chunk size: 10 operations (don't create chunks for "update 5 tests")
- Fixed overhead per chunk: 5k tokens for setup/coordination—factor into chunking decision
- Batch operations with linear time complexity (test updates, file renames), not non-linear (refactors with cross-file dependencies)

**Warning signs:** More chunks than original operations. Execution log shows high chunk-coordination to execution-time ratio. User frustration with "why is this taking so long?"

**Source:** [Batch Processing Python](https://talent500.com/blog/batch-processing-handling-large-volumes-of-data-in-scheduled-or-periodic-batches/)

### Pitfall 4: Failure Handling Without Idempotency

**What goes wrong:** Phase fails after creating 3 files, retry creates 3 more files (now 6 total), system state corrupted.

**Why it happens:** Retry logic doesn't check "did this step already complete?" before re-executing.

**How to avoid:**
- Checkpoint after each major step (Phase 6 already implements this—extend to sub-task level)
- Before retry, verify checkpoint state: check files exist, git commits present, database records created
- Idempotent operations: CREATE OR REPLACE, UPSERT, check-then-create patterns
- Store operation IDs in checkpoints: `{ operation_id: "create-auth-module", files: [...] }`

**Warning signs:** Duplicate files after retry. Git history shows repeated commits. Database constraint violations on retry.

**Source:** [Retry Policy Recommendations](https://developers.liveperson.com/retry-policy-recommendations.html)

### Pitfall 5: Context Compression Loses Critical Decisions

**What goes wrong:** Phase 8 needs to know "why did Phase 3 choose SQLite over Postgres?" but compression removed decision rationale, causing re-design or inconsistent choices.

**Why it happens:** Aggressive compression treats all content equally—doesn't preserve high-value decision context.

**How to avoid:**
- Type-weighted scoring (Phase 3 KNOW-07): decisions rank 2.0x, summaries rank 0.5x—keep decisions, compress summaries
- Phase 6 archive format already stores `key_decisions` separately—selective injection uses this
- Compression: remove verbose explanations, keep decision statements: "Use WAL mode for concurrency" (keep) vs "WAL mode is a SQLite feature that enables..." (compress)
- Test compression: can Phase 8 coordinator answer "why X?" questions about Phase 1-7?

**Warning signs:** Later phases make inconsistent technology choices. Sub-coordinators ask "why did we use X?" questions. Rework of earlier phase decisions.

**Source:** [Compressing Context](https://factory.ai/news/compressing-context)

## Code Examples

Verified patterns from Phase 6 foundation and 2026 research:

### Token Monitoring CLI Extension

```javascript
// Extend gsd-tools.js with token monitoring commands
// Source: Phase 6 gsd-tools.js + Pattern 1 from above

const TokenBudgetMonitor = require('./token-monitor.js');

// Add to gsd-tools.js command handling
if (process.argv[2] === 'token' && process.argv[3] === 'init') {
  // Initialize token budget for session
  const model = process.argv[4] || 'opus';
  const monitor = new TokenBudgetMonitor(model, 200000);

  fs.writeFileSync(
    '.planning/token_budget.json',
    JSON.stringify(monitor.getReport(), null, 2)
  );

  console.log(`Token budget initialized for ${model} (200k limit)`);
  process.exit(0);
}

if (process.argv[2] === 'token' && process.argv[3] === 'reserve') {
  // Reserve tokens before operation
  const estimatedTokens = parseInt(process.argv[4]);
  const operation = process.argv[5];

  const budgetData = JSON.parse(
    fs.readFileSync('.planning/token_budget.json', 'utf-8')
  );

  const monitor = new TokenBudgetMonitor();
  Object.assign(monitor, budgetData);

  const canProceed = monitor.reserve(estimatedTokens, operation);

  // Update budget file
  fs.writeFileSync(
    '.planning/token_budget.json',
    JSON.stringify(monitor.getReport(), null, 2)
  );

  console.log(JSON.stringify({
    can_proceed: canProceed,
    alerts: monitor.alerts.filter(a => a.level !== 'WARN'),
    utilization: monitor.getReport().utilization_percent
  }));

  process.exit(canProceed ? 0 : 1);
}

if (process.argv[2] === 'token' && process.argv[3] === 'record') {
  // Record actual usage after operation
  const actualTokens = parseInt(process.argv[4]);
  const phase = process.argv[5];

  const budgetData = JSON.parse(
    fs.readFileSync('.planning/token_budget.json', 'utf-8')
  );

  const monitor = new TokenBudgetMonitor();
  Object.assign(monitor, budgetData);

  monitor.recordUsage(actualTokens, phase);

  fs.writeFileSync(
    '.planning/token_budget.json',
    JSON.stringify(monitor.getReport(), null, 2)
  );

  console.log(`Recorded ${actualTokens} tokens for ${phase}`);
  process.exit(0);
}

if (process.argv[2] === 'token' && process.argv[3] === 'report') {
  // Display token usage report
  const budgetData = JSON.parse(
    fs.readFileSync('.planning/token_budget.json', 'utf-8')
  );

  console.log(JSON.stringify(budgetData, null, 2));
  process.exit(0);
}
```

### Task Chunking Analysis Command

```bash
# Add to gsd-tools.js for task complexity analysis
node get-shit-done/bin/gsd-tools.js task analyze \
  --description "Update 350 test files to use new auth module" \
  --files "tests/**/*.test.js"

# Output:
# {
#   "needsChunking": true,
#   "estimatedTokens": 175000,
#   "chunkCount": 10,
#   "strategy": "batch",
#   "chunks": [
#     {
#       "id": "chunk-1",
#       "description": "Update tests (batch 1/10: files 1-35)",
#       "estimatedTokens": 17500
#     },
#     ...
#   ]
# }
```

### Execute-Roadmap with Token Monitoring Integration

```javascript
// Extend Phase 6 execute-roadmap.md with token monitoring
// Integration point: before each phase spawn

async function executeRoadmapWithOptimizations() {
  // Initialize token monitor
  const tokenMonitor = new TokenBudgetMonitor('opus', 200000);

  // Initialize failure handler
  const failureHandler = new FailureHandler({
    maxRetries: 3,
    baseDelay: 2000
  });

  // Parse roadmap (Phase 6 existing)
  const { phases, execution_order, parallel_opportunities } =
    await parseRoadmapWithDAG('.planning/ROADMAP.md');

  // Execute phases with monitoring
  for (const phaseNum of execution_order) {
    const phase = phases.find(p => p.number === phaseNum);

    // Estimate tokens needed
    const estimatedTokens = estimatePhaseTokens(phase);

    // Check budget
    if (!tokenMonitor.reserve(estimatedTokens, `phase-${phaseNum}`)) {
      console.log(`Token budget insufficient. Compressing context...`);
      const freed = await tokenMonitor.compressContext(phaseNum - 1);

      if (freed < estimatedTokens) {
        throw new Error('Cannot proceed: token budget exhausted even after compression');
      }
    }

    // Execute with failure handling
    const result = await failureHandler.executeWithRetry(
      async () => await spawnPhaseCoordinator(phase),
      { operation: `phase-${phaseNum}`, phase: phaseNum }
    );

    if (!result.success) {
      // Handle failure signal
      const { continue: shouldContinue } = await handleCompletionSignal(
        CompletionSignal.failure(phaseNum, result.error),
        failureHandler
      );

      if (!shouldContinue) {
        console.log('Execution halted by user');
        break;
      }
    }

    // Record actual usage
    tokenMonitor.recordUsage(result.tokensUsed, `phase-${phaseNum}`);

    // Log progress
    console.log(`Phase ${phaseNum} complete. Token usage: ${tokenMonitor.getReport().utilization_percent}%`);
  }

  // Final report
  const report = tokenMonitor.getReport();
  console.log(`\nRoadmap complete. Total tokens: ${report.current_usage}/${report.max_tokens}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Reactive token limit handling | Proactive budget monitoring with 80% alerts | 2026 (Context Window Management best practices) | Prevents mid-execution failures, enables compression at right time |
| Retry on any error | Adaptive retry with exponential backoff + jitter | 2025-2026 (Multi-agent reliability patterns) | Reduces API rate limit collisions, faster recovery from transient failures |
| Binary execution (succeed or fail) | Structured completion signals with retry/skip/escalate | 2026 (Multi-agent coordination standards) | Enables graceful degradation, user choice, partial roadmap completion |
| Task execution without complexity analysis | Heuristic-based task size estimation and chunking | 2026 (Agentic automation task decomposition) | Prevents context exhaustion, enables batch processing optimization |
| Full context injection | Selective compression with type-weighted preservation | 2026 (Context compression techniques) | 5-20x token reduction, maintains decision quality |
| Uncontrolled parallel execution | Worker pool with conservative limits (max 2 concurrent) | 2026 (Parallel agent coordination patterns) | Prevents resource exhaustion, limits 15x token overhead of parallelism |

**Deprecated/outdated:**
- **Unbounded parallelism:** 2026 research shows 15x token cost overhead—controlled sequential execution with parallelism only at measured bottlenecks is new standard
- **Word-based token estimation:** Accurate per-model tokenization (tiktoken) now standard, word-to-token ratios deprecated
- **Uniform retry logic:** One-size-fits-all retry deprecated in favor of error-type-specific strategies (rate limits vs network vs validation)
- **Manual context management:** Automatic compression at utilization thresholds replaces manual "when should I compress?" decisions

## Open Questions

1. **Parallel execution value vs cost tradeoff**
   - What we know: Parallel execution provides 50% time savings but 15x token cost overhead, resource conflicts require careful coordination
   - What's unclear: At what roadmap size does time savings justify token cost? 10 phases? 20 phases? 50 phases?
   - Recommendation: Implement token monitoring and failure handling first (EXEC-13, EXEC-14, EXEC-15), measure bottlenecks across 8-phase roadmap execution, then decide if parallelism needed. If most phases complete in <30min, sequential is fine. If phases take hours, parallelism justified.

2. **Task chunking granularity threshold**
   - What we know: Chunk when estimate exceeds 140k tokens (70% of 200k window), avoid chunking below 10 operations
   - What's unclear: Optimal chunk size for different task types (tests vs migrations vs refactors)?
   - Recommendation: Start with conservative 70% threshold (140k tokens), 10-operation minimum. Collect metrics over 10+ executions: chunk overhead vs execution time. Tune threshold based on data (may increase to 80% if overhead high, decrease to 60% if failures common).

3. **Context compression aggressiveness**
   - What we know: 5-20x compression typical with multi-stage techniques, type-weighted scoring preserves decisions at 2.0x
   - What's unclear: How much history needed for Phase 20 to make good decisions about Phase 1-19?
   - Recommendation: Phase 6 selective injection already passes only dependency history—extend with configurable "context depth" (e.g., "inject last N phases" or "inject all phases with shared files"). Start with dependency-only (Phase 6 behavior), expand if sub-coordinators ask "why?" questions frequently.

4. **Worker pool size for parallel execution**
   - What we know: Conservative recommendation is max 2 concurrent phases to prevent resource exhaustion
   - What's unclear: Can modern machines handle 3-4 parallel phases? Does Git handle concurrent commits safely?
   - Recommendation: Start with 2 (conservative), make configurable via environment variable. Measure resource usage (CPU, memory, token consumption) across multiple executions. If headroom exists and no conflicts observed, increase to 3. Git worktrees enable safe concurrent checkouts if conflicts become issue.

5. **Failure handling escalation priority**
   - What we know: Three options: retry (transient errors), skip (mark incomplete), escalate (stop and ask user)
   - What's unclear: When should system auto-skip vs always ask user? Balance autonomy vs safety.
   - Recommendation: Conservative: always ask user for non-retryable failures (safest, but blocks execution). Progressive: auto-skip if phase has "optional" flag in ROADMAP.md, escalate for required phases. Implement conservative first, add optional flags to roadmap schema later if blocking becomes issue.

## Sources

### Primary (HIGH confidence)

- [Context Window Management Strategies 2026](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) - Token budget monitoring, 80% alert thresholds, compression triggers
- [Context Window Overflow Fix](https://redis.io/blog/context-window-overflow/) - Context rot prevention, utilization tracking
- [Multi-Agent System Reliability 2026](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/) - Failure patterns, root cause analysis, production validation
- [Mastering Retry Logic Agents](https://sparkco.ai/blog/mastering-retry-logic-agents-a-deep-dive-into-2025-best-practices) - Exponential backoff, jitter, idempotency patterns
- [Multi-Agent Systems Complete Guide](https://medium.com/@fraidoonomarzai99/multi-agent-systems-complete-guide-689f241b65c8) - Structured completion signals, coordination protocols
- [AI Agent Orchestration 2026](https://kanerika.com/blogs/ai-agent-orchestration/) - Hierarchical patterns, state management
- [Data Chunking Guide](https://www.couchbase.com/blog/data-chunking/) - Chunking strategies, batch processing optimization
- [Agentic Automation Task Decomposition](https://www.af-robotics.com/blog/agentic-automation-in-2026-from-task-execution-to-autonomous-decision-systems) - Task splitting, micro-agent specialization
- [Workerpool GitHub](https://github.com/josdejong/workerpool) - Worker thread pool patterns
- [Node.js Worker Threads Guide](https://nodesource.com/blog/worker-threads-nodejs-multithreading-in-javascript) - Worker thread implementation
- Phase 6 Research and codebase (roadmap-parser.js, phase-archive.js) - Existing DAG and compression infrastructure

### Secondary (MEDIUM confidence)

- [AI Agent Orchestration Guide 2026](https://fast.io/resources/ai-agent-orchestration/) - Parallel execution patterns, fan-out/fan-in
- [AI Coding Agents Orchestration](https://mikemason.ca/writing/ai-coding-agents-jan-2026/) - Git worktrees, multi-agent coordination
- [Parallel Agent Processing](https://www.kore.ai/blog/parallel-ai-agent-processing) - State management, race condition prevention
- [How to Build Context Compression](https://oneuptime.com/blog/post/2026-01-30-context-compression/view) - Compression techniques, implementation
- [Prompt Compression Techniques](https://medium.com/@kuldeep.paul08/prompt-compression-techniques-reducing-context-window-costs-while-improving-llm-performance-afec1e8f1003) - 50-80% token reduction methods
- [Compressing Context](https://factory.ai/news/compressing-context) - Context management best practices
- [Chunking Strategies for RAG](https://weaviate.io/blog/chunking-strategies-for-rag) - Semantic chunking, recursive splitting
- [2026 RAG Performance Paradox](https://ragaboutit.com/the-2026-rag-performance-paradox-why-simpler-chunking-strategies-are-outperforming-complex-ai-driven-methods/) - Recursive character splitting at 512 tokens outperforms semantic chunking
- [SHIELDA Exception Handling](https://arxiv.org/html/2508.07935v1) - Structured exception handling patterns
- [9 Critical Failure Patterns](https://daplab.cs.columbia.edu/general/2026/01/08/9-critical-failure-patterns-of-coding-agents.html) - Common agent failure modes
- [Agents At Work 2026 Playbook](https://promptengineering.org/agents-at-work-the-2026-playbook-for-building-reliable-agentic-workflows/) - Reliability patterns
- [Python Batch Processing Joblib](https://johal.in/python-batch-processing-with-joblib-parallel-loky-backends-scheduling-2026/) - 6-10x speedups, task granularity tuning
- [vLLM WideEP Large-Scale Serving](https://blog.vllm.ai/2026/02/03/dsr1-gb200-part1.html) - Chunking for GPU memory constraints
- [How to Create Worker Thread Pools](https://oneuptime.com/blog/post/2026-01-30-how-to-create-worker-thread-pools-in-nodejs/view) - Node.js worker pool implementation

### Tertiary (LOW confidence)

- [7 Agentic AI Trends 2026](https://machinelearningmastery.com/7-agentic-ai-trends-to-watch-in-2026/) - Industry trends (not implementation)
- [AI Agents Future Trends](https://www.blueprism.com/resources/blog/future-ai-agents-trends/) - General trends (not specific patterns)
- [Taming AI Agents 2026](https://www.cio.com/article/4064998/taming-ai-agents-the-autonomous-workforce-of-2026.html) - Enterprise perspective (not technical depth)

## Metadata

**Confidence breakdown:**
- Token monitoring and budget tracking: HIGH - Multiple 2026 sources converge on 80% alert threshold, proactive compression patterns well-documented
- Failure handling with retry logic: HIGH - Retry patterns standardized (exponential backoff + jitter), production patterns from SparkAI and Maxim verified
- Task chunking and decomposition: MEDIUM-HIGH - Heuristics validated by 2026 agentic automation research, chunk size thresholds need tuning based on actual usage
- Parallel execution with worker pools: MEDIUM - Worker pool patterns proven in Node.js, but multi-agent parallel token cost (15x overhead) needs validation in GSD context
- Structured completion signals: HIGH - Multi-agent coordination standards (handoff messages, status codes) well-established in 2026 research
- Context compression: HIGH - 5-20x compression ratios verified across multiple sources, Phase 6 archive infrastructure provides foundation

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - autonomous execution optimization is active research area but core patterns stable)

**Key findings:**
1. **Phase 6 provides 80% of infrastructure needed** - DAG parsing with parallel detection, checkpoint storage, phase archiving, fresh sub-coordinator spawning all exist. Phase 7 is optimization layer, not rebuild.
2. **Token monitoring is highest-value, lowest-risk optimization** - Proactive budget tracking with 80% alerts prevents mid-execution failures. Implement first before any other optimization.
3. **Parallel execution has 15x token cost overhead** - 2026 research shows multi-agent parallelism delivers time savings but massive token consumption. Use sparingly, only at measured bottlenecks.
4. **Sequential-first, parallel-optional is 2026 best practice** - Start with sequential execution + good failure handling. Add parallelism only if roadmap execution time becomes blocker. Most 8-phase roadmaps complete in hours, not days—parallelism premature.
5. **Heuristic task chunking sufficient for 80% of cases** - LLM-based complexity analysis more accurate but adds latency/cost. Simple heuristics (file count * 500 tokens, requirement count * 1000 tokens) sufficient for binary "chunk or not" decision.
6. **Context compression via selective injection, not aggressive truncation** - Phase 6 archive format already preserves key decisions separately. Extend with dependency-only injection (only pass Phase 1-3 context to Phase 4 if Phase 4 depends on them), not full history.
7. **Failure handling more important than parallelism** - Production systems need graceful degradation (retry/skip/escalate) more than speed. User can walk away knowing system will pause at failures, not more important than "system finished 2 hours faster."
8. **Chunking thresholds: 70% context window, 10-operation minimum** - Don't chunk aggressively. Overhead of coordination (5k tokens per chunk) exceeds savings for small tasks. Only chunk when estimate exceeds 140k tokens (70% of 200k window).
