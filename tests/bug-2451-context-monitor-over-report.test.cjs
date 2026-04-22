/**
 * Regression test for bug #2451
 *
 * The GSD context monitor hook over-reports usage by ~13 percentage points
 * compared to Claude Code's native /context command. The root cause:
 *
 * gsd-statusline.js writes two values to the bridge file:
 *   - remaining_percentage: raw remaining from CC (e.g. 35%)
 *   - used_pct: normalized "usable" percentage (e.g. 78%) — accounts for
 *     the 16.5% autocompact buffer by scaling: (100 - remaining - buffer) /
 *     (100 - buffer) * 100
 *
 * gsd-context-monitor.js displays used_pct (78%) in warning messages.
 * But CC's native /context shows raw used = 100 - remaining = 65%.
 * The 13-point gap is exactly the buffer normalization overhead.
 *
 * Fix: the bridge must write used_pct as the raw value (Math.round(100 -
 * remaining)), not the buffer-normalized value. The statusline progress bar
 * continues to use the normalized value for its own display; only the bridge
 * value that feeds the context monitor needs to be raw/CC-consistent.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'gsd-statusline.js');
const MONITOR_PATH = path.join(__dirname, '..', 'hooks', 'gsd-context-monitor.js');

/**
 * Run the statusline hook with a synthetic payload and return the full
 * bridge JSON object written to /tmp/claude-ctx-{sessionId}.json.
 */
function runStatuslineHook(remainingPct, totalTokens = 1_000_000, acwEnv = null) {
  const sessionId = `test-2451-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = JSON.stringify({
    model: { display_name: 'Claude' },
    workspace: { current_dir: os.tmpdir() },
    session_id: sessionId,
    context_window: {
      remaining_percentage: remainingPct,
      total_tokens: totalTokens,
    },
  });

  const env = { ...process.env };
  if (acwEnv != null) {
    env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = String(acwEnv);
  } else {
    delete env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
  }

  try {
    execFileSync(process.execPath, [HOOK_PATH], {
      input: payload,
      env,
      timeout: 4000,
    });
  } catch { /* non-zero exit is fine; we only need the bridge file */ }

  const bridgePath = path.join(os.tmpdir(), `claude-ctx-${sessionId}.json`);
  const bridge = JSON.parse(fs.readFileSync(bridgePath, 'utf-8'));
  fs.unlinkSync(bridgePath);
  return bridge;
}

/**
 * Run the context monitor hook with a pre-written bridge file and return
 * the parsed additionalContext string from its stdout.
 */
function runMonitorHook(remainingPct, usedPct) {
  const sessionId = `test-2451-mon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bridgePath = path.join(os.tmpdir(), `claude-ctx-${sessionId}.json`);
  fs.writeFileSync(bridgePath, JSON.stringify({
    session_id: sessionId,
    remaining_percentage: remainingPct,
    used_pct: usedPct,
    timestamp: Math.floor(Date.now() / 1000),
  }));

  const input = JSON.stringify({ session_id: sessionId, cwd: os.tmpdir() });
  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, [MONITOR_PATH], {
      input,
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch (e) {
    stdout = e.stdout || '';
  } finally {
    try { fs.unlinkSync(bridgePath); } catch { /* noop */ }
    try { fs.unlinkSync(path.join(os.tmpdir(), `claude-ctx-${sessionId}-warned.json`)); } catch { /* noop */ }
  }

  if (!stdout) return null;
  const out = JSON.parse(stdout);
  return out?.hookSpecificOutput?.additionalContext || null;
}

// ─── Bridge file used_pct accuracy ──────────────────────────────────────────

describe('bug #2451: bridge used_pct matches CC native reporting', () => {
  test('used_pct is raw (100 - remaining), not buffer-normalized', () => {
    // CC reports remaining_percentage=35 → CC native "used" = 100-35 = 65%
    // Buffer-normalized would give: (100 - (35-16.5)/(100-16.5)*100) ≈ 78%
    // The bridge used_pct must be 65 (raw), not 78 (normalized).
    const bridge = runStatuslineHook(35);
    assert.strictEqual(
      bridge.used_pct,
      65,
      `used_pct should be 65 (raw: 100 - 35) but got ${bridge.used_pct}. ` +
      'Buffer normalization must NOT be applied to the bridge used_pct, ' +
      'otherwise context monitor messages over-report usage by ~13 points ' +
      'compared to CC native /context (root cause of #2451).'
    );
  });

  test('used_pct is raw for high remaining (low usage scenario)', () => {
    // remaining=80 → raw used = 20
    const bridge = runStatuslineHook(80);
    assert.strictEqual(bridge.used_pct, 20,
      `used_pct should be 20 (raw: 100-80) but got ${bridge.used_pct}`);
  });

  test('used_pct is raw for near-critical remaining', () => {
    // remaining=20 → raw used = 80
    const bridge = runStatuslineHook(20);
    assert.strictEqual(bridge.used_pct, 80,
      `used_pct should be 80 (raw: 100-20) but got ${bridge.used_pct}`);
  });

  test('remaining_percentage in bridge matches raw CC value', () => {
    // The bridge remaining_percentage should be the exact raw value from CC
    const bridge = runStatuslineHook(42);
    assert.strictEqual(bridge.remaining_percentage, 42,
      'bridge remaining_percentage must be the raw CC value (no normalization)');
  });
});

// ─── Context monitor message accuracy ───────────────────────────────────────

describe('bug #2451: context monitor warning messages show CC-consistent percentages', () => {
  test('WARNING message shows raw used_pct consistent with CC reporting', () => {
    // remaining=30 → raw used=70; bridge stores used_pct=70
    // Monitor message must say "Usage at 70%", not a buffer-inflated value
    const msg = runMonitorHook(30, 70);
    assert.ok(msg, 'hook should emit a warning when remaining=30 (below WARNING_THRESHOLD=35)');
    assert.match(
      msg,
      /Usage at 70%/,
      `Warning message should say "Usage at 70%" (raw), got: ${msg}`
    );
  });

  test('CRITICAL message shows raw used_pct consistent with CC reporting', () => {
    // remaining=20 → raw used=80
    const msg = runMonitorHook(20, 80);
    assert.ok(msg, 'hook should emit a critical warning when remaining=20 (below CRITICAL_THRESHOLD=25)');
    assert.match(
      msg,
      /Usage at 80%/,
      `Critical message should say "Usage at 80%" (raw), got: ${msg}`
    );
  });

  test('gap between hook used_pct and raw CC value is at most 1 (rounding)', () => {
    // With the fix, the only acceptable deviation is ±1 due to Math.round
    const rawRemaining = 35;
    const bridge = runStatuslineHook(rawRemaining);
    const ccNativeUsed = 100 - rawRemaining; // 65
    const gap = Math.abs(bridge.used_pct - ccNativeUsed);
    assert.ok(
      gap <= 1,
      `Gap between hook used_pct (${bridge.used_pct}) and CC native used (${ccNativeUsed}) ` +
      `is ${gap} points — must be ≤1 (rounding). Larger gaps indicate buffer normalization ` +
      'is still being applied to bridge used_pct (root cause of #2451).'
    );
  });
});
