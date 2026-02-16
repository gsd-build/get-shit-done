#!/usr/bin/env node

/**
 * Token Budget Monitor
 *
 * Tracks token usage per phase and cumulatively during roadmap execution.
 * Alerts at 80% utilization before reaching hard limits.
 *
 * Pattern: Token Budget Monitoring with 80% Alert Threshold
 * Source: Phase 7 Research - Pattern 1
 */

const TOKEN_LIMITS = {
  haiku: 200000,
  sonnet: 200000,
  opus: 200000
};

const ALERT_THRESHOLDS = {
  warn: 0.80,      // 160k tokens - trigger context compression
  critical: 0.90,  // 180k tokens - escalate to user
  stop: 0.95       // 190k tokens - halt execution
};

class TokenBudgetMonitor {
  constructor(model = 'opus', maxTokens = 200000) {
    this.model = model;
    this.maxTokens = maxTokens || TOKEN_LIMITS[model] || 200000;
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
      model: this.model,
      current_usage: this.currentUsage,
      max_tokens: this.maxTokens,
      utilization_percent: (this.currentUsage / this.maxTokens * 100).toFixed(1),
      remaining_tokens: this.maxTokens - this.currentUsage,
      phase_breakdown: Object.fromEntries(this.phaseUsage),
      active_alerts: this.alerts.filter(a => a.level !== 'WARN'),
      all_alerts: this.alerts
    };
  }

  /**
   * Reset for new session
   */
  reset() {
    this.currentUsage = 0;
    this.phaseUsage.clear();
    this.alerts = [];
  }

  /**
   * Serialize to JSON for file storage
   */
  toJSON() {
    return {
      model: this.model,
      maxTokens: this.maxTokens,
      currentUsage: this.currentUsage,
      phaseUsage: Object.fromEntries(this.phaseUsage),
      alerts: this.alerts
    };
  }

  /**
   * Restore from JSON
   * @param {object} data - Serialized budget data
   */
  static fromJSON(data) {
    const monitor = new TokenBudgetMonitor(data.model, data.maxTokens);
    monitor.currentUsage = data.currentUsage || 0;
    monitor.phaseUsage = new Map(Object.entries(data.phaseUsage || {}));
    monitor.alerts = data.alerts || [];
    return monitor;
  }
}

/**
 * Estimate tokens needed for a phase
 * Heuristic-based estimation
 *
 * @param {object} phase - Phase object with requirements and success_criteria
 * @returns {number} - Estimated token count
 */
function estimatePhaseTokens(phase) {
  // Base tokens for task setup
  const baseTokens = 10000;

  // Count requirements (if array or newline-separated string)
  let reqCount = 0;
  if (Array.isArray(phase.requirements)) {
    reqCount = phase.requirements.length;
  } else if (typeof phase.requirements === 'string') {
    reqCount = phase.requirements.split('\n').filter(l => l.trim()).length;
  }

  // Count success criteria (if array or newline-separated string)
  let criteriaCount = 0;
  if (Array.isArray(phase.success_criteria)) {
    criteriaCount = phase.success_criteria.length;
  } else if (typeof phase.success_criteria === 'string') {
    criteriaCount = phase.success_criteria.split('\n').filter(l => l.trim()).length;
  }

  // Requirements signal: 1000 tokens per requirement
  const reqTokens = reqCount * 1000;

  // Success criteria signal: 500 tokens per criterion
  const criteriaTokens = criteriaCount * 500;

  return baseTokens + reqTokens + criteriaTokens;
}

module.exports = {
  TokenBudgetMonitor,
  estimatePhaseTokens,
  ALERT_THRESHOLDS,
  TOKEN_LIMITS
};
