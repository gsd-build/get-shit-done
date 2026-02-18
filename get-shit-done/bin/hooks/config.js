const fs = require('fs');
const path = require('path');
const { minimatch } = require('minimatch');

const CONFIG_PATH = path.join(process.env.HOME, '.claude', 'get-shit-done', 'hook-config.json');
const STATE_PATH = path.join(process.env.HOME, '.claude', 'get-shit-done', 'compression-state.json');

const DEFAULT_HOOK_CONFIG = {
  enabled: true,
  compression: {
    enabled: true,
    strategy: 'header-extraction',
    min_file_lines: 500,           // Skip files smaller than 500 lines
    target_reduction: 65,           // Aim for 65% reduction
    cache_ttl: 300,                 // 5 minutes cache TTL
    patterns: [
      '**/*-RESEARCH.md',
      '**/*-PLAN.md',
      '**/*-CONTEXT.md',
      '**/STATE.md',
      '**/ROADMAP.md',
      '**/PROJECT.md'
    ],
    exclude: [
      '**/*-SUMMARY.md',           // Already compressed
      '**/README.md'               // Usually short
    ],
    fallback: 'pass-through',      // On error: pass-through (don't block)
    circuit_breaker: {
      enabled: true,
      failure_threshold: 3,        // Disable after 3 consecutive failures
      reset_timeout: 300,          // Re-enable after 5 minutes (300 seconds)
      state: 'closed',             // closed (normal) | open (disabled) | half-open (testing)
      failure_count: 0,
      last_failure: null,
      opened_at: null
    }
  }
};

/**
 * Load hook configuration from disk or create defaults
 * @returns {Object} Merged configuration (defaults + user overrides)
 */
function loadHookConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const userConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      // Deep merge user config with defaults
      return {
        ...DEFAULT_HOOK_CONFIG,
        compression: {
          ...DEFAULT_HOOK_CONFIG.compression,
          ...(userConfig.compression || {})
        }
      };
    } else {
      // Create default config file
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_HOOK_CONFIG, null, 2));
      return DEFAULT_HOOK_CONFIG;
    }
  } catch (error) {
    // If config loading fails, return defaults
    console.error(`[config] Error loading hook config: ${error.message}`);
    return DEFAULT_HOOK_CONFIG;
  }
}

/**
 * Save hook configuration to disk
 * @param {Object} config - Configuration object to save
 */
function saveHookConfig(config) {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error(`[config] Error saving hook config: ${error.message}`);
    return false;
  }
}

/**
 * Check if a file path matches any of the patterns and doesn't match excludes
 * @param {string} filePath - File path to check
 * @param {Array<string>} patterns - Glob patterns to match
 * @param {Array<string>} excludes - Glob patterns to exclude
 * @returns {boolean} True if matches patterns and not excluded
 */
function matchesPattern(filePath, patterns, excludes = []) {
  const basename = path.basename(filePath);

  // Check excludes first (more efficient)
  for (const exclude of excludes) {
    // Try both full path and basename matching
    if (minimatch(filePath, exclude) || minimatch(basename, exclude)) {
      return false;
    }
  }

  // Check patterns
  for (const pattern of patterns) {
    // Try both full path and basename matching
    if (minimatch(filePath, pattern) || minimatch(basename, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Load circuit breaker state from disk
 * @returns {Object} Circuit breaker state
 */
function loadCircuitBreakerState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch (error) {
    console.error(`[config] Error loading circuit breaker state: ${error.message}`);
  }
  return DEFAULT_HOOK_CONFIG.compression.circuit_breaker;
}

/**
 * Save circuit breaker state to disk
 * @param {Object} state - Circuit breaker state to save
 */
function saveCircuitBreakerState(state) {
  try {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error(`[config] Error saving circuit breaker state: ${error.message}`);
  }
}

/**
 * Check if compression should proceed based on circuit breaker state
 * @returns {boolean} True if compression should proceed
 */
function checkCircuitBreaker() {
  const state = loadCircuitBreakerState();

  if (!state.enabled) {
    // Circuit breaker disabled, always allow
    return true;
  }

  const now = Date.now();

  // Check if circuit is open
  if (state.state === 'open') {
    // Check if reset timeout has elapsed
    if (state.opened_at && (now - state.opened_at) >= (state.reset_timeout * 1000)) {
      // Move to half-open state (allow one test request)
      state.state = 'half-open';
      state.failure_count = 0;
      saveCircuitBreakerState(state);
      return true;
    }
    // Circuit still open
    return false;
  }

  // Circuit is closed or half-open, allow compression
  return true;
}

/**
 * Record a successful compression
 */
function recordSuccess() {
  const state = loadCircuitBreakerState();

  // Reset failure count
  state.failure_count = 0;
  state.last_failure = null;

  // If was half-open, close the circuit
  if (state.state === 'half-open') {
    state.state = 'closed';
    state.opened_at = null;
  }

  saveCircuitBreakerState(state);
}

/**
 * Record a compression failure
 */
function recordFailure() {
  const state = loadCircuitBreakerState();

  if (!state.enabled) {
    return;
  }

  const now = Date.now();
  state.failure_count++;
  state.last_failure = now;

  // Check if threshold reached
  if (state.failure_count >= state.failure_threshold) {
    state.state = 'open';
    state.opened_at = now;
  }

  saveCircuitBreakerState(state);
}

/**
 * Get current circuit breaker status
 * @returns {Object} Status with state and remaining reset time
 */
function getCircuitBreakerStatus() {
  const state = loadCircuitBreakerState();
  const now = Date.now();

  let remainingResetTime = null;
  if (state.state === 'open' && state.opened_at) {
    const elapsed = now - state.opened_at;
    const resetTimeMs = state.reset_timeout * 1000;
    remainingResetTime = Math.max(0, Math.ceil((resetTimeMs - elapsed) / 1000));
  }

  return {
    enabled: state.enabled,
    state: state.state,
    failure_count: state.failure_count,
    failure_threshold: state.failure_threshold,
    reset_timeout: state.reset_timeout,
    remaining_reset_time: remainingResetTime,
    last_failure: state.last_failure
  };
}

/**
 * Reset circuit breaker to closed state
 */
function resetCircuitBreaker() {
  const state = loadCircuitBreakerState();
  state.state = 'closed';
  state.failure_count = 0;
  state.last_failure = null;
  state.opened_at = null;
  saveCircuitBreakerState(state);
}

module.exports = {
  DEFAULT_HOOK_CONFIG,
  loadHookConfig,
  saveHookConfig,
  matchesPattern,
  CONFIG_PATH,
  STATE_PATH,
  checkCircuitBreaker,
  recordSuccess,
  recordFailure,
  getCircuitBreakerStatus,
  resetCircuitBreaker
};
