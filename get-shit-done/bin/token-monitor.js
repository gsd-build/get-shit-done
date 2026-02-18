const fs = require('fs');
const path = require('path');

const TOKEN_LIMITS = {
  haiku: 200000,
  sonnet: 200000,
  opus: 200000
};

const ALERT_THRESHOLDS = {
  warn: 0.80,      // 80% - trigger compression recommendation
  critical: 0.90,  // 90% - escalate warnings
  stop: 0.95       // 95% - halt execution
};

class TokenBudgetMonitor {
  constructor(model = 'opus', maxTokens = 200000) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.currentUsage = 0;
    this.phaseUsage = new Map();
    this.alerts = [];
    this.thresholdsPassed = [];
    this.graduatedAlerts = [];
    this.telegramEnabled = false;
  }

  // Reserve tokens before operation, returns { canProceed, utilization, recommendation }
  reserve(estimatedTokens, operation) {
    const projectedUsage = this.currentUsage + estimatedTokens;
    const utilization = projectedUsage / this.maxTokens;

    let recommendation = null;
    let canProceed = true;

    // At 80% utilization: recommend compression
    if (utilization >= ALERT_THRESHOLDS.warn) {
      recommendation = 'Token budget at ' + Math.round(utilization * 100) + '%. Consider enabling compression: `node /Users/ollorin/.claude/get-shit-done/bin/gsd-tools.js compress enable`';
    }

    // At 95%: block execution
    if (utilization >= ALERT_THRESHOLDS.stop) {
      canProceed = false;
    }

    return { canProceed, utilization, recommendation, operation, projectedTokens: projectedUsage };
  }

  // Record actual token usage after operation
  recordUsage(actualTokens, phase) {
    this.currentUsage += actualTokens;
    const existing = this.phaseUsage.get(phase) || 0;
    this.phaseUsage.set(phase, existing + actualTokens);

    // Check for graduated alerts
    const utilization = this.currentUsage / this.maxTokens;
    this._checkGraduatedAlerts(utilization, phase);

    return { recorded: actualTokens, phase, newUtilization: utilization };
  }

  _checkGraduatedAlerts(utilization, phase) {
    const levels = [
      { threshold: 0.50, level: 'INFO', action: 'Log warning' },
      { threshold: 0.65, level: 'INFO', action: 'Monitor closely' },
      { threshold: 0.80, level: 'WARN', action: 'Enable compression' },
      { threshold: 0.90, level: 'ERROR', action: 'Prepare to halt' },
      { threshold: 0.95, level: 'CRITICAL', action: 'Stop execution' }
    ];

    for (const alert of levels) {
      const key = Math.round(alert.threshold * 100) + '%';
      if (utilization >= alert.threshold && !this.thresholdsPassed.includes(key)) {
        this.thresholdsPassed.push(key);
        this.graduatedAlerts.push({
          level: alert.level,
          threshold: key,
          action: alert.action,
          utilization: (utilization * 100).toFixed(1) + '%',
          tokens_used: this.currentUsage,
          tokens_remaining: this.maxTokens - this.currentUsage,
          phase,
          timestamp: new Date().toISOString()
        });

        // Auto-enable compression at 80% threshold (Gap 2: token monitor -> compression wiring)
        if (alert.threshold === 0.80) {
          try {
            const hookConfigPath = require('path').join(
              process.env.HOME, '.claude', 'get-shit-done', 'bin', 'hooks', 'config'
            );
            const { loadHookConfig, saveHookConfig } = require(hookConfigPath);
            const cfg = loadHookConfig();
            if (!cfg.compression.enabled) {
              cfg.compression.enabled = true;
              saveHookConfig(cfg);
              process.stderr.write('[token-monitor] Auto-enabled compression at 80% token threshold\n');
            }
          } catch (_) {
            // hooks not installed or config unavailable - skip silently
          }
        }
      }
    }
  }

  // Get usage report
  getReport() {
    const utilization = this.currentUsage / this.maxTokens;
    const phaseBreakdown = {};
    for (const [phase, tokens] of this.phaseUsage) {
      phaseBreakdown[phase] = tokens;
    }

    return {
      model: this.model,
      current_usage: this.currentUsage,
      max_tokens: this.maxTokens,
      utilization_percent: (utilization * 100).toFixed(1) + '%',
      remaining_tokens: this.maxTokens - this.currentUsage,
      phase_breakdown: phaseBreakdown,
      active_alerts: this.graduatedAlerts.filter(a => a.level !== 'INFO'),
      thresholds_passed: this.thresholdsPassed
    };
  }

  // Persist to JSON
  toJSON() {
    const phaseUsage = {};
    for (const [k, v] of this.phaseUsage) {
      phaseUsage[k] = v;
    }
    return {
      model: this.model,
      maxTokens: this.maxTokens,
      currentUsage: this.currentUsage,
      phaseUsage,
      alerts: this.alerts,
      thresholdsPassed: this.thresholdsPassed,
      graduatedAlerts: this.graduatedAlerts,
      telegramEnabled: this.telegramEnabled
    };
  }

  static fromJSON(data) {
    const monitor = new TokenBudgetMonitor(data.model || 'opus', data.maxTokens || 200000);
    // CRITICAL: Preserve existing state
    monitor.currentUsage = data.currentUsage || 0;
    monitor.alerts = data.alerts || [];
    monitor.thresholdsPassed = data.thresholdsPassed || [];
    monitor.graduatedAlerts = data.graduatedAlerts || [];
    monitor.telegramEnabled = data.telegramEnabled || false;

    // Convert phaseUsage object to Map
    if (data.phaseUsage) {
      for (const [k, v] of Object.entries(data.phaseUsage)) {
        monitor.phaseUsage.set(k, v);
      }
    }
    return monitor;
  }

  save(projectPath) {
    const filePath = path.join(projectPath, '.planning', 'token_budget.json');
    fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2));
    return filePath;
  }

  static load(projectPath, model = 'opus') {
    const filePath = path.join(projectPath, '.planning', 'token_budget.json');
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        // Preserve existing state - do NOT reset
        return TokenBudgetMonitor.fromJSON(data);
      }
    } catch (e) {
      // File missing or corrupt - create new
    }
    return new TokenBudgetMonitor(model, TOKEN_LIMITS[model] || 200000);
  }

  static selfTest() {
    const results = [];

    // Test 1: Below threshold - no recommendation
    const monitor1 = new TokenBudgetMonitor('opus', 200000);
    monitor1.currentUsage = 150000; // 75%
    const below = monitor1.reserve(1000, 'test1'); // 75.5%
    results.push({
      test: 'Below 80% threshold',
      passed: !below.recommendation,
      utilization: below.utilization,
      recommendation: below.recommendation
    });

    // Test 2: At 80% - must recommend compression
    const monitor2 = new TokenBudgetMonitor('opus', 200000);
    monitor2.currentUsage = 159000; // 79.5%
    const at80 = monitor2.reserve(2000, 'test2'); // Would push to 80.5%
    results.push({
      test: 'At 80% threshold',
      passed: at80.recommendation && at80.recommendation.includes('compress'),
      utilization: at80.utilization,
      recommendation: at80.recommendation
    });

    // Test 3: Verify exact command in recommendation
    results.push({
      test: 'Recommendation includes compress enable command',
      passed: at80.recommendation && at80.recommendation.includes('compress enable'),
      recommendation: at80.recommendation
    });

    // Test 4: State preservation (simulate load/save cycle)
    const monitor3 = new TokenBudgetMonitor('opus', 200000);
    monitor3.currentUsage = 50000;
    monitor3.phaseUsage.set('test-phase', 50000);
    const json = monitor3.toJSON();
    const restored = TokenBudgetMonitor.fromJSON(json);
    results.push({
      test: 'State preserved through JSON cycle',
      passed: restored.currentUsage === 50000 && restored.phaseUsage.get('test-phase') === 50000,
      currentUsage: restored.currentUsage,
      phaseUsage: Object.fromEntries(restored.phaseUsage)
    });

    const allPassed = results.every(r => r.passed);
    return {
      passed: allPassed,
      tests: results.length,
      results,
      error: allPassed ? null : results.find(r => !r.passed)?.test
    };
  }

  static integrationTest(projectPath = '.') {
    const fs = require('fs');
    const { execSync } = require('child_process');
    const gsdTools = '/Users/ollorin/.claude/get-shit-done/bin/gsd-tools.js';

    const results = [];

    // Test 1: reserve() at 80%+ returns recommendation with compress command
    const monitor = new TokenBudgetMonitor('opus', 200000);
    monitor.currentUsage = 165000; // 82.5%
    const reserveResult = monitor.reserve(1000, 'integration-test');

    results.push({
      test: 'reserve() returns compress command at 80%',
      passed: reserveResult.recommendation && reserveResult.recommendation.includes('gsd-tools.js compress enable'),
      recommendation: reserveResult.recommendation
    });

    // Test 2: Recommended command is executable (compress enable exists)
    try {
      const statusBefore = execSync(`node ${gsdTools} compress status`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      results.push({
        test: 'compress status command exists',
        passed: true,
        output: statusBefore.trim().slice(0, 100)
      });
    } catch (e) {
      results.push({
        test: 'compress status command exists',
        passed: false,
        error: e.message
      });
    }

    // Test 3: Can execute compress enable (the recommended action)
    try {
      const enableResult = execSync(`node ${gsdTools} compress enable`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const parsed = JSON.parse(enableResult);
      results.push({
        test: 'compress enable executes successfully',
        passed: parsed.enabled === true || parsed.compression_enabled === true,
        output: parsed
      });
    } catch (e) {
      results.push({
        test: 'compress enable executes successfully',
        passed: false,
        error: e.message
      });
    }

    // Test 4: After enabling, status reflects compression is on
    try {
      const statusAfter = execSync(`node ${gsdTools} compress status`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const parsed = JSON.parse(statusAfter);
      results.push({
        test: 'compress status shows enabled after enable',
        passed: parsed.enabled === true || parsed.compression_enabled === true,
        status: parsed
      });
    } catch (e) {
      results.push({
        test: 'compress status shows enabled after enable',
        passed: false,
        error: e.message
      });
    }

    // Test 5: Disable compression to restore state
    try {
      execSync(`node ${gsdTools} compress disable`, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      results.push({
        test: 'compress disable restores state',
        passed: true
      });
    } catch (e) {
      results.push({
        test: 'compress disable restores state',
        passed: false,
        error: e.message
      });
    }

    const allPassed = results.every(r => r.passed);
    return {
      passed: allPassed,
      tests: results.length,
      results,
      summary: allPassed
        ? 'Token budget and compression systems integrate correctly'
        : 'Integration issues detected - see results'
    };
  }
}

module.exports = { TokenBudgetMonitor, TOKEN_LIMITS, ALERT_THRESHOLDS };
