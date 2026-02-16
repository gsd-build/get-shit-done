#!/usr/bin/env node

/**
 * Graduated Budget Alerts
 *
 * Extends TokenBudgetMonitor with 50/80/90/100% thresholds.
 * Pattern: Progressive alerts with escalating actions
 * Source: Phase 8 Research - Pattern 4
 */

const { TokenBudgetMonitor } = require('./token-monitor.js');

const GRADUATED_THRESHOLDS = {
  early_warning: 0.50,      // 100k tokens - log warning
  compression_trigger: 0.80, // 160k tokens - trigger context compression
  escalation: 0.90,          // 180k tokens - notify user via Telegram
  halt: 1.00                 // 200k tokens - stop execution
};

class GraduatedBudgetMonitor extends TokenBudgetMonitor {
  constructor(model = 'opus', maxTokens = 200000, options = {}) {
    super(model, maxTokens);
    this.telegramEnabled = options.telegramEnabled || false;
    this.thresholdsPassed = new Set();
    this.graduatedAlerts = [];
  }

  /**
   * Override recordUsage to check graduated thresholds
   */
  recordUsage(actualTokens, phase) {
    super.recordUsage(actualTokens, phase);
    this.checkGraduatedThresholds(phase);
  }

  /**
   * Check all graduated thresholds after usage recording
   */
  checkGraduatedThresholds(phase) {
    const utilization = this.currentUsage / this.maxTokens;

    // Check each threshold in order (only trigger once)
    if (utilization >= GRADUATED_THRESHOLDS.early_warning &&
        !this.thresholdsPassed.has('early_warning')) {
      this.thresholdsPassed.add('early_warning');
      this.handleEarlyWarning(utilization, phase);
    }

    if (utilization >= GRADUATED_THRESHOLDS.compression_trigger &&
        !this.thresholdsPassed.has('compression_trigger')) {
      this.thresholdsPassed.add('compression_trigger');
      this.handleCompressionTrigger(utilization, phase);
    }

    if (utilization >= GRADUATED_THRESHOLDS.escalation &&
        !this.thresholdsPassed.has('escalation')) {
      this.thresholdsPassed.add('escalation');
      this.handleEscalation(utilization, phase);
    }

    if (utilization >= GRADUATED_THRESHOLDS.halt &&
        !this.thresholdsPassed.has('halt')) {
      this.thresholdsPassed.add('halt');
      this.handleHalt(utilization, phase);
    }
  }

  handleEarlyWarning(utilization, phase) {
    const alert = {
      level: 'INFO',
      threshold: '50%',
      action: 'Log warning',
      utilization: `${(utilization * 100).toFixed(1)}%`,
      tokens_used: this.currentUsage,
      tokens_remaining: this.maxTokens - this.currentUsage,
      phase,
      timestamp: new Date().toISOString()
    };

    this.graduatedAlerts.push(alert);
    console.log(`[BUDGET] 50% threshold reached (${this.currentUsage}/${this.maxTokens} tokens)`);
  }

  handleCompressionTrigger(utilization, phase) {
    const alert = {
      level: 'WARN',
      threshold: '80%',
      action: 'Trigger context compression for next phase',
      utilization: `${(utilization * 100).toFixed(1)}%`,
      tokens_used: this.currentUsage,
      tokens_remaining: this.maxTokens - this.currentUsage,
      phase,
      timestamp: new Date().toISOString()
    };

    this.graduatedAlerts.push(alert);
    console.warn(`[BUDGET] 80% threshold - context compression recommended`);
  }

  async handleEscalation(utilization, phase) {
    const alert = {
      level: 'CRITICAL',
      threshold: '90%',
      action: 'Notify user via Telegram',
      utilization: `${(utilization * 100).toFixed(1)}%`,
      tokens_used: this.currentUsage,
      tokens_remaining: this.maxTokens - this.currentUsage,
      phase,
      timestamp: new Date().toISOString()
    };

    this.graduatedAlerts.push(alert);
    console.error(`[BUDGET] 90% threshold reached - escalating to user`);

    // Send Telegram notification if enabled
    if (this.telegramEnabled) {
      try {
        const { sendBlockingQuestion } = require('./telegram-bot.js');
        await sendBlockingQuestion(
          `Token Budget Alert (90%)\n\n` +
          `Usage: ${this.currentUsage} / ${this.maxTokens} tokens\n` +
          `Phase: ${phase}\n\n` +
          `Options:\n` +
          `1. Continue (may fail if next phase is large)\n` +
          `2. Pause and checkpoint\n` +
          `3. Restart with fresh context`,
          { choices: ['Continue', 'Pause', 'Restart'] }
        );
      } catch (error) {
        console.error('Failed to send Telegram alert:', error.message);
      }
    }
  }

  handleHalt(utilization, phase) {
    const alert = {
      level: 'STOP',
      threshold: '100%',
      action: 'Halt execution, checkpoint state',
      utilization: `${(utilization * 100).toFixed(1)}%`,
      tokens_used: this.currentUsage,
      tokens_remaining: 0,
      phase,
      timestamp: new Date().toISOString()
    };

    this.graduatedAlerts.push(alert);
    console.error(`[BUDGET] 100% limit reached - halting execution`);

    throw new Error(
      `Token budget exhausted (${this.currentUsage}/${this.maxTokens}). ` +
      `Checkpoint saved. Resume with fresh context.`
    );
  }

  /**
   * Get graduated alerts report
   */
  getGraduatedReport() {
    return {
      ...super.getReport(),
      graduated_thresholds: GRADUATED_THRESHOLDS,
      thresholds_passed: Array.from(this.thresholdsPassed),
      graduated_alerts: this.graduatedAlerts
    };
  }

  /**
   * Reset including graduated state
   */
  reset() {
    super.reset();
    this.thresholdsPassed.clear();
    this.graduatedAlerts = [];
  }

  /**
   * Serialize to JSON including graduated state
   */
  toJSON() {
    return {
      ...super.toJSON(),
      thresholdsPassed: Array.from(this.thresholdsPassed),
      graduatedAlerts: this.graduatedAlerts,
      telegramEnabled: this.telegramEnabled
    };
  }

  /**
   * Restore from JSON including graduated state
   */
  static fromJSON(data) {
    const monitor = new GraduatedBudgetMonitor(data.model, data.maxTokens, {
      telegramEnabled: data.telegramEnabled
    });
    monitor.currentUsage = data.currentUsage || 0;
    monitor.phaseUsage = new Map(Object.entries(data.phaseUsage || {}));
    monitor.alerts = data.alerts || [];
    monitor.thresholdsPassed = new Set(data.thresholdsPassed || []);
    monitor.graduatedAlerts = data.graduatedAlerts || [];
    return monitor;
  }
}

module.exports = {
  GraduatedBudgetMonitor,
  GRADUATED_THRESHOLDS
};
