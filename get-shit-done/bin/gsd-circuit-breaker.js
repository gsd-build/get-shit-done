#!/usr/bin/env node

const CircuitBreaker = require('opossum');
const fs = require('fs');
const path = require('path');

// Base thresholds per model (user decision: configurable per model)
const BASE_THRESHOLDS = {
  haiku: { timeout_ms: 20 * 60 * 1000, iterations: 15 },  // 20min
  sonnet: { timeout_ms: 40 * 60 * 1000, iterations: 20 }, // 40min
  opus: { timeout_ms: 60 * 60 * 1000, iterations: 25 }    // 60min
};

// Default complexity keywords for task complexity estimation
const DEFAULT_COMPLEXITY_KEYWORDS = [
  'database', 'migration', 'architecture', 'integration', 'security',
  'schema', 'payment', 'transaction'
];

/**
 * Get path to thresholds.json
 */
function getThresholdsPath() {
  const planningDir = path.join(process.cwd(), '.planning', 'circuit-breaker');
  return path.join(planningDir, 'thresholds.json');
}

/**
 * Get path to timeout-log.jsonl
 */
function getTimeoutLogPath() {
  const planningDir = path.join(process.cwd(), '.planning', 'circuit-breaker');
  return path.join(planningDir, 'timeout-log.jsonl');
}

/**
 * Load thresholds from thresholds.json
 */
function loadThresholds() {
  const thresholdsPath = getThresholdsPath();

  try {
    if (fs.existsSync(thresholdsPath)) {
      const content = fs.readFileSync(thresholdsPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading thresholds:', err.message);
  }

  // Return default structure if file doesn't exist or error
  return {
    version: '1.0',
    created: new Date().toISOString(),
    base: BASE_THRESHOLDS,
    learned: {},
    complexity_keywords: DEFAULT_COMPLEXITY_KEYWORDS
  };
}

/**
 * Save thresholds to thresholds.json
 */
function saveThresholds(thresholds) {
  const thresholdsPath = getThresholdsPath();
  const dir = path.dirname(thresholdsPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(thresholdsPath, JSON.stringify(thresholds, null, 2));
}

/**
 * Estimate task complexity based on keywords
 */
function estimateComplexity(task, complexityKeywords) {
  if (!task || typeof task !== 'string') {
    return 1.0; // No multiplier
  }

  const taskLower = task.toLowerCase();
  const keywords = complexityKeywords || DEFAULT_COMPLEXITY_KEYWORDS;

  // Check if any complexity keyword is in the task
  const isComplex = keywords.some(keyword => taskLower.includes(keyword));

  // Complex tasks get +50% limits per user decision
  return isComplex ? 1.5 : 1.0;
}

/**
 * Find learned multiplier for task pattern
 */
function findLearnedMultiplier(task, learnedPatterns) {
  if (!task || !learnedPatterns || typeof task !== 'string') {
    return 1.0;
  }

  const taskLower = task.toLowerCase();

  // Find matching patterns
  for (const [pattern, multiplier] of Object.entries(learnedPatterns)) {
    if (taskLower.includes(pattern.toLowerCase())) {
      return multiplier;
    }
  }

  return 1.0;
}

/**
 * Get adaptive thresholds for a task and model
 * Returns thresholds adjusted by complexity and learned multipliers
 */
function getAdaptiveThresholds(task, model) {
  const modelLower = (model || 'sonnet').toLowerCase();
  const thresholds = loadThresholds();

  // Get base thresholds for model
  const base = thresholds.base[modelLower] || BASE_THRESHOLDS.sonnet;

  // Calculate complexity multiplier
  const complexityMultiplier = estimateComplexity(task, thresholds.complexity_keywords);

  // Calculate learned multiplier
  const learnedMultiplier = findLearnedMultiplier(task, thresholds.learned);

  // Apply multipliers (learned takes precedence if higher)
  const finalMultiplier = Math.max(complexityMultiplier, learnedMultiplier);

  return {
    timeout_ms: Math.floor(base.timeout_ms * finalMultiplier),
    iterations: Math.floor(base.iterations * finalMultiplier),
    complexity_multiplier: complexityMultiplier,
    learned_multiplier: learnedMultiplier,
    final_multiplier: finalMultiplier,
    base_timeout_ms: base.timeout_ms,
    base_iterations: base.iterations
  };
}

/**
 * Log timeout event to timeout-log.jsonl
 */
function logTimeout(entry) {
  const logPath = getTimeoutLogPath();
  const dir = path.dirname(logPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Append to JSONL
  const logEntry = {
    timestamp: entry.timestamp || new Date().toISOString(),
    task_id: entry.task_id,
    model: entry.model,
    timeout_ms: entry.timeout_ms,
    iterations: entry.iterations,
    reason: entry.reason || 'timeout'
  };

  fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
}

/**
 * Salvage or escalate when circuit breaker trips
 * (Placeholder - actual escalation logic in Plan 03)
 */
function salvageOrEscalate(task, model, err) {
  console.error(`Circuit breaker tripped for task: ${task}`);
  console.error(`Model: ${model}`);
  console.error(`Error: ${err.message}`);

  // Log timeout
  logTimeout({
    task_id: task,
    model: model,
    timeout_ms: err.timeout || 'unknown',
    iterations: 0,
    reason: err.message
  });

  // Return placeholder result
  return {
    complete: false,
    salvaged: false,
    escalated: true,
    error: err.message,
    message: 'Circuit breaker tripped - escalation not yet implemented (Plan 03)'
  };
}

/**
 * Create circuit breaker for a task function
 * Wraps task function in opossum circuit breaker with timeout handling
 */
function createTaskBreaker(taskFn, task, model) {
  const thresholds = getAdaptiveThresholds(task, model);

  // Opossum circuit breaker options
  const options = {
    timeout: thresholds.timeout_ms,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  };

  const breaker = new CircuitBreaker(taskFn, options);

  // Event handlers
  breaker.on('timeout', () => {
    console.error(`Task timeout after ${thresholds.timeout_ms}ms`);
    logTimeout({
      task_id: task,
      model: model,
      timeout_ms: thresholds.timeout_ms,
      iterations: 0,
      reason: 'timeout'
    });
  });

  breaker.on('failure', (err) => {
    console.error(`Task failed: ${err.message}`);
  });

  breaker.on('success', () => {
    console.log(`Task completed successfully: ${task}`);
  });

  // Fallback function
  breaker.fallback((err) => {
    return salvageOrEscalate(task, model, err);
  });

  return breaker;
}

/**
 * Execute task with iteration cap (primary safety net)
 * User decision: iteration cap has HIGHER priority than time limits
 */
async function executeWithIterationCap(taskStepFn, task, model, maxIterations) {
  const thresholds = getAdaptiveThresholds(task, model);
  const iterations = maxIterations || thresholds.iterations;

  let result = { complete: false };
  let i = 0;

  // Loop with iteration counter
  for (i = 0; i < iterations; i++) {
    // Log warning at 80% of cap
    if (i >= iterations * 0.8 && i < iterations * 0.8 + 1) {
      console.warn(`Task approaching iteration cap: ${i}/${iterations} (80%)`);
    }

    try {
      // Execute task step
      result = await taskStepFn(i);

      // Check if complete
      if (result && result.complete) {
        console.log(`Task completed at iteration ${i + 1}/${iterations}`);
        return result;
      }
    } catch (err) {
      console.error(`Error at iteration ${i}: ${err.message}`);
      throw err;
    }
  }

  // If we get here, we exceeded the iteration cap
  const error = new Error(`Task exceeded iteration cap (${iterations})`);

  // Log timeout
  logTimeout({
    task_id: task,
    model: model,
    timeout_ms: thresholds.timeout_ms,
    iterations: iterations,
    reason: `iteration_cap_exceeded_${iterations}`
  });

  throw error;
}

// Exports
module.exports = {
  createTaskBreaker,
  executeWithIterationCap,
  getAdaptiveThresholds,
  loadThresholds,
  saveThresholds,
  logTimeout
};
