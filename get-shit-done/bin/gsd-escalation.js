#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Error weights per user decision (AUTO-12)
const ERROR_WEIGHTS = {
  COMPLETE_REJECTION: 1.0,  // Sonnet says "redo from scratch"
  VALIDATION_FIX: 0.5,      // Partial corrections needed
  RETRY: 0.25               // Transient failure (API timeout, etc)
};

// Aggressive escalation threshold (1-2 errors trigger escalation)
const ESCALATION_THRESHOLD = 1.0;

// Escalation ladder: haiku → sonnet → opus → null
const ESCALATION_LADDER = {
  haiku: 'sonnet',
  sonnet: 'opus',
  opus: null
};

/**
 * ErrorTracker - Tracks weighted errors and determines when to escalate
 */
class ErrorTracker {
  constructor(task) {
    this.task = task;
    this.errors = [];
    this.cumulativeScore = 0;
    this.escalations = [];
  }

  /**
   * Record an error with weighted scoring
   * @param {string} type - Error type (COMPLETE_REJECTION, VALIDATION_FIX, RETRY)
   * @param {string} explanation - What went wrong
   * @param {string|null} fix_attempted - Fix description (if any)
   */
  recordError(type, explanation, fix_attempted = null) {
    const weight = ERROR_WEIGHTS[type] || 0;
    const error = {
      type,
      weight,
      explanation,
      fix_attempted,
      timestamp: new Date().toISOString()
    };

    this.errors.push(error);
    this.cumulativeScore += weight;

    return error;
  }

  /**
   * Record an escalation event
   * @param {string} fromModel - Current model
   * @param {string} toModel - Escalated model
   * @param {string} reason - Why escalation occurred
   */
  recordEscalation(fromModel, toModel, reason) {
    const escalation = {
      from_model: fromModel,
      to_model: toModel,
      reason,
      cumulative_score: this.cumulativeScore,
      timestamp: new Date().toISOString()
    };

    this.escalations.push(escalation);

    // Log to escalation-log.jsonl
    logEscalation({
      task_id: this.task.id || this.task.name,
      error_type: this.errors[this.errors.length - 1]?.type || 'UNKNOWN',
      weight: this.errors[this.errors.length - 1]?.weight || 0,
      cumulative_score: this.cumulativeScore,
      from_model: fromModel,
      to_model: toModel,
      explanation: reason,
      timestamp: escalation.timestamp
    });

    return escalation;
  }

  /**
   * Check if cumulative score exceeds escalation threshold
   * @returns {boolean}
   */
  shouldEscalate() {
    return this.cumulativeScore >= ESCALATION_THRESHOLD;
  }

  /**
   * Get next model in escalation ladder
   * @param {string} currentModel - Current model (haiku, sonnet, opus)
   * @returns {string|null} - Next model or null if at top of ladder
   */
  getNextModel(currentModel) {
    return ESCALATION_LADDER[currentModel] || null;
  }

  /**
   * Get formatted summary of errors and escalations for end-of-execution display
   * @returns {string}
   */
  getEscalationSummary() {
    if (this.errors.length === 0) {
      return 'No errors encountered during execution.';
    }

    const lines = [];
    lines.push(`\nEscalation Summary for Task: ${this.task.id || this.task.name}`);
    lines.push(`Total Errors: ${this.errors.length}`);
    lines.push(`Cumulative Score: ${this.cumulativeScore.toFixed(2)} / ${ESCALATION_THRESHOLD}`);

    if (this.escalations.length > 0) {
      lines.push(`\nEscalation Path:`);
      this.escalations.forEach((esc, idx) => {
        lines.push(`  ${idx + 1}. ${esc.from_model} → ${esc.to_model}: ${esc.reason}`);
      });
    }

    lines.push(`\nError Breakdown:`);
    this.errors.forEach((err, idx) => {
      lines.push(`  ${idx + 1}. [${err.type}] (weight: ${err.weight}) - ${err.explanation}`);
      if (err.fix_attempted) {
        lines.push(`     Fix: ${err.fix_attempted}`);
      }
    });

    return lines.join('\n');
  }
}

/**
 * Execute task with automatic escalation on validation failure
 * @param {Object} task - Task object with id/name
 * @param {Function} executeFn - Function to execute task (async, returns result)
 * @param {Function} validateFn - Function to validate result (async, returns {verdict, explanation, score})
 * @returns {Promise<{result: any, tracker: ErrorTracker}>}
 */
async function executeWithEscalation(task, executeFn, validateFn) {
  const tracker = new ErrorTracker(task);
  let currentModel = task.assigned_model || 'haiku';
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    attempt++;

    try {
      // Execute task
      const result = await executeFn(currentModel);

      // Validate if model is haiku (per plan: validate haiku with Sonnet)
      if (currentModel === 'haiku' && validateFn) {
        const validation = await validateFn(result);

        if (validation.verdict === 'REDO') {
          // Complete rejection - record and check escalation
          tracker.recordError('COMPLETE_REJECTION', validation.explanation);

          if (tracker.shouldEscalate()) {
            const nextModel = tracker.getNextModel(currentModel);
            if (!nextModel) {
              throw new Error(`Escalation failed: already at top of ladder (${currentModel}). Errors: ${tracker.getEscalationSummary()}`);
            }

            tracker.recordEscalation(currentModel, nextModel, `Validation score: ${validation.score}/100 - ${validation.explanation}`);
            currentModel = nextModel;
            continue; // Retry with stronger model
          } else {
            // Below threshold, retry with same model
            continue;
          }
        } else if (validation.verdict === 'FIX') {
          // Partial fix needed
          tracker.recordError('VALIDATION_FIX', validation.explanation);

          // Apply fixes (executeFn should handle fix mode)
          const fixedResult = await executeFn(currentModel, { fix: true, issues: validation.explanation });

          // Re-validate to verify fix worked
          const revalidation = await validateFn(fixedResult);

          if (revalidation.verdict === 'PASS') {
            // Fix worked, return success
            return { result: fixedResult, tracker };
          } else {
            // Fix didn't work, check escalation
            if (tracker.shouldEscalate()) {
              const nextModel = tracker.getNextModel(currentModel);
              if (!nextModel) {
                throw new Error(`Escalation failed: already at top of ladder (${currentModel}). Errors: ${tracker.getEscalationSummary()}`);
              }

              tracker.recordEscalation(currentModel, nextModel, `Fix failed - ${revalidation.explanation}`);
              currentModel = nextModel;
              continue;
            }
          }
        } else if (validation.verdict === 'PASS') {
          // Success
          return { result, tracker };
        }
      } else {
        // No validation needed or not haiku
        return { result, tracker };
      }
    } catch (error) {
      // Transient failure (API timeout, network error, etc)
      tracker.recordError('RETRY', `Execution error: ${error.message}`);

      if (tracker.shouldEscalate()) {
        const nextModel = tracker.getNextModel(currentModel);
        if (!nextModel) {
          throw new Error(`Escalation failed after retry: ${error.message}. ${tracker.getEscalationSummary()}`);
        }

        tracker.recordEscalation(currentModel, nextModel, `Execution failed: ${error.message}`);
        currentModel = nextModel;
      }

      if (attempt >= maxAttempts) {
        throw new Error(`Max attempts (${maxAttempts}) exceeded. ${tracker.getEscalationSummary()}`);
      }
    }
  }

  throw new Error(`Execution failed after ${maxAttempts} attempts. ${tracker.getEscalationSummary()}`);
}

/**
 * Log escalation event to escalation-log.jsonl
 * @param {Object} entry - Escalation entry
 */
function logEscalation(entry) {
  const logPath = path.join(process.cwd(), '.planning', 'validation', 'escalation-log.jsonl');
  const logDir = path.dirname(logPath);

  // Ensure directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Append entry as JSONL
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

/**
 * Display escalation history from tracker (for end-of-execution summary)
 * @param {ErrorTracker} tracker - ErrorTracker instance
 * @returns {string} - Formatted escalation summary
 */
function displayEscalationHistory(tracker) {
  return tracker.getEscalationSummary();
}

module.exports = {
  ErrorTracker,
  executeWithEscalation,
  logEscalation,
  displayEscalationHistory,
  ERROR_WEIGHTS,
  ESCALATION_THRESHOLD,
  ESCALATION_LADDER
};
