'use strict';

/**
 * Regression test for #2687 — loadConfig must not emit "unknown config key"
 * warnings for keys that are registered in DYNAMIC_KEY_PATTERNS (e.g. review,
 * model_profile_overrides, claude_md_assembly). These keys were absent from
 * the hand-maintained KNOWN_TOP_LEVEL set in core.cjs, causing false-positive
 * warnings on every read.
 *
 * We trigger loadConfig via `resolve-model` (which calls loadConfig internally)
 * and assert that stderr is EMPTY on success — a typed-IR equivalent of
 * "no warning was emitted" without grepping for specific warning text. The
 * absence of any stderr output IS the contract: loadConfig prints nothing
 * to stderr when every top-level key in config.json is recognized.
 *
 * Migrated from substring `.includes('unknown config key')` text matching
 * to typed empty-stderr assertions per #2974.
 */

const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createTempProject, cleanup, TOOLS_PATH } = require('./helpers.cjs');

const TEST_ENV_BASE = {
  GSD_SESSION_KEY: '',
  CODEX_THREAD_ID: '',
  CLAUDE_SESSION_ID: '',
  CLAUDE_CODE_SSE_PORT: '',
  OPENCODE_SESSION_ID: '',
  GEMINI_SESSION_ID: '',
  CURSOR_SESSION_ID: '',
  WINDSURF_SESSION_ID: '',
  TERM_SESSION_ID: '',
  WT_SESSION: '',
  TMUX_PANE: '',
  ZELLIJ_SESSION_NAME: '',
  TTY: '',
  SSH_TTY: '',
};

/**
 * Run gsd-tools and return { stdout, stderr, status }.
 * Captures stderr even when the process exits 0 (unlike runGsdTools which only
 * surfaces stderr via result.error on non-zero exit).
 */
function runWithStderr(args, cwd) {
  const result = spawnSync(process.execPath, [TOOLS_PATH, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...TEST_ENV_BASE },
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  };
}

describe('bug-2687 — no warning for dynamic-pattern containers in loadConfig', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('review — loadConfig emits no warning when config.json contains review key', () => {
    tmpDir = createTempProject('gsd-2687-review-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ review: { models: { 'test-cli': 'test-command' } } }, null, 2),
      'utf-8'
    );

    // resolve-model calls loadConfig internally, triggering the KNOWN_TOP_LEVEL check
    const result = runWithStderr(['resolve-model', 'planner'], tmpDir);

    assert.equal(
      result.stderr.trim(),
      '',
      `loadConfig must emit no stderr output for valid dynamic-pattern keys (#2687) — got: ${result.stderr}`
    );
  });

  test('model_profile_overrides — loadConfig emits no warning when config.json contains model_profile_overrides key', () => {
    tmpDir = createTempProject('gsd-2687-mpo-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ model_profile_overrides: { codex: { sonnet: 'claude-sonnet-4' } } }, null, 2),
      'utf-8'
    );

    // resolve-model calls loadConfig internally, triggering the KNOWN_TOP_LEVEL check
    const result = runWithStderr(['resolve-model', 'planner'], tmpDir);

    assert.equal(
      result.stderr.trim(),
      '',
      `loadConfig must emit no stderr output for valid dynamic-pattern keys (#2687) — got: ${result.stderr}`
    );
  });

  test('claude_md_assembly — loadConfig emits no warning when config.json contains claude_md_assembly key', () => {
    tmpDir = createTempProject('gsd-2687-cma-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ claude_md_assembly: { mode: 'custom', blocks: { identity: true } } }, null, 2),
      'utf-8'
    );

    // resolve-model calls loadConfig internally, triggering the KNOWN_TOP_LEVEL check
    const result = runWithStderr(['resolve-model', 'planner'], tmpDir);

    assert.equal(
      result.stderr.trim(),
      '',
      `loadConfig must emit no stderr output for valid dynamic-pattern keys (#2687) — got: ${result.stderr}`
    );
  });
});
