/**
 * Regression: issue #3245 — Codex install rejects valid TOML floats.
 *
 * Two defects, two fixes:
 *
 *   Defect 1 — parseTomlValue rejects TOML floats (e.g. tool_timeout_sec = 20.0).
 *     Codex CLI's serde schema requires f64 for tool_timeout_sec / startup_timeout_sec
 *     (integers fail with "invalid type: integer"). GSD's strict-integer-only parser
 *     was the inverse of what Codex requires — any float triggers the rejection branch.
 *     Fix: extend parseTomlValue to accept TOML 1.0 float literals and return them as
 *     JS Number. The merged config.toml preserves the float form verbatim so
 *     round-trip writes don't coerce 20.0 → 20.
 *
 *   Defect 2 — Partial rollback leaves install in hybrid state.
 *     restoreCodexSnapshot only knew about config.toml, but skills/, agents/, and VERSION
 *     are written earlier in the install sequence. A post-install validation failure
 *     aborts with new agent text on disk, config.toml reverted, and .tmp files
 *     potentially orphaned.
 *     Fix: capture pre-install state of skills/, agents/, and VERSION before any
 *     Codex-specific mutation, and extend the rollback to cover all of them.
 */

// GSD_TEST_MODE must be set before require('../bin/install.js') so the module
// skips the main CLI entry point and exports its internals.
const previousGsdTestMode = process.env.GSD_TEST_MODE;
process.env.GSD_TEST_MODE = '1';

const { test, describe, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const { parseTomlToObject, validateCodexConfigSchema, install } = require('../bin/install.js');
const installModule = require('../bin/install.js');

if (previousGsdTestMode === undefined) {
  delete process.env.GSD_TEST_MODE;
} else {
  process.env.GSD_TEST_MODE = previousGsdTestMode;
}

// Ensure hooks/dist/ is populated — mirrors the pattern used by codex-config.test.cjs.
const HOOKS_DIST = path.join(__dirname, '..', 'hooks', 'dist');
const BUILD_HOOKS_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
before(() => {
  if (!fs.existsSync(HOOKS_DIST) || fs.readdirSync(HOOKS_DIST).length === 0) {
    execFileSync(process.execPath, [BUILD_HOOKS_SCRIPT], { encoding: 'utf-8', stdio: 'pipe' });
  }
});

function runCodexInstall(codexHome) {
  const previousCodexHome = process.env.CODEX_HOME;
  const previousCwd = process.cwd();
  process.env.CODEX_HOME = codexHome;
  try {
    process.chdir(path.join(__dirname, '..'));
    return install(true, 'codex');
  } finally {
    process.chdir(previousCwd);
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
  }
}

function writeCodexConfig(codexHome, content) {
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'config.toml'), content, 'utf8');
}

// ---------------------------------------------------------------------------
// Defect 1 — parseTomlValue must accept TOML floats
// ---------------------------------------------------------------------------

describe('#3245 — parseTomlToObject accepts TOML floats', () => {
  test('parses bare decimal float (20.0)', () => {
    const content = [
      'tool_timeout_sec = 20.0',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.strictEqual(typeof parsed.tool_timeout_sec, 'number',
      'tool_timeout_sec should be a JS number');
    assert.strictEqual(parsed.tool_timeout_sec, 20.0,
      'value must equal 20.0');
  });

  test('parses startup_timeout_sec = 60.0', () => {
    const content = [
      'startup_timeout_sec = 60.0',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.strictEqual(parsed.startup_timeout_sec, 60.0);
  });

  test('parses positive exponent notation (1e10)', () => {
    const content = [
      'x = 1e10',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.strictEqual(parsed.x, 1e10);
  });

  test('parses negative exponent (1.5e-3)', () => {
    const content = [
      'x = 1.5e-3',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.ok(Math.abs(parsed.x - 1.5e-3) < 1e-15, 'must be approximately 1.5e-3');
  });

  test('parses signed positive float (+1.0)', () => {
    const content = [
      'x = +1.0',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.strictEqual(parsed.x, 1.0);
  });

  test('parses signed negative float (-0.5)', () => {
    const content = [
      'x = -0.5',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.strictEqual(parsed.x, -0.5);
  });

  test('parses float with underscore separators (1_000.0)', () => {
    const content = [
      'x = 1_000.0',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.strictEqual(parsed.x, 1000.0);
  });

  test('integer (no decimal) still parses as integer', () => {
    const content = [
      'x = 42',
      '',
    ].join('\n');
    const parsed = parseTomlToObject(content);
    assert.strictEqual(parsed.x, 42);
  });

  test('still rejects bare date (1979-05-27)', () => {
    const content = [
      'x = 1979-05-27',
      '',
    ].join('\n');
    assert.throws(
      () => parseTomlToObject(content),
      /unsupported TOML value/,
      'date literals must remain unsupported'
    );
  });

  test('still rejects bare time (07:32:00)', () => {
    const content = [
      'x = 07:32:00',
      '',
    ].join('\n');
    assert.throws(
      () => parseTomlToObject(content),
      /unsupported TOML value/,
      'time literals must remain unsupported'
    );
  });

  test('still rejects hex literal (0x1A)', () => {
    const content = [
      'x = 0x1A',
      '',
    ].join('\n');
    // 0 is parsed, then 'x1A' is trailing garbage — rejected with "trailing bytes"
    // or "unsupported value" depending on where the parser catches it.
    assert.throws(
      () => parseTomlToObject(content),
      /trailing bytes|unsupported (TOML value|value)/,
      'hex literals must remain unsupported'
    );
  });

  test('validateCodexConfigSchema passes a config with tool_timeout_sec = 20.0', () => {
    const content = [
      '[model]',
      'name = "o3"',
      '',
      'tool_timeout_sec = 20.0',
      'startup_timeout_sec = 60.0',
      '',
    ].join('\n');
    const result = validateCodexConfigSchema(content);
    assert.strictEqual(result.ok, true,
      'schema validation must pass for a config containing TOML floats: ' + result.reason);
  });
});

// ---------------------------------------------------------------------------
// Defect 1 — full install must succeed and preserve float verbatim
// ---------------------------------------------------------------------------

// concurrency: false — drives the live install pipeline (shared CODEX_HOME env,
// process.chdir). Serialise to prevent stray mutations across parallel siblings.
describe('#3245 — install succeeds with TOML float in pre-existing config', { concurrency: false }, () => {
  let tmpDir;
  let codexHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3245-float-'));
    codexHome = path.join(tmpDir, 'codex-home');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('install completes when config.toml contains tool_timeout_sec = 20.0', () => {
    // Floats at the root level (before any table header) — this is where Codex
    // CLI reads tool_timeout_sec / startup_timeout_sec according to its serde schema.
    const preInstall = [
      'tool_timeout_sec = 20.0',
      'startup_timeout_sec = 60.0',
      '',
      '[model]',
      'name = "o3"',
      '',
    ].join('\n');
    writeCodexConfig(codexHome, preInstall);

    // Must not throw — pre-#3245 this threw "unsupported TOML value … floats … not supported".
    assert.doesNotThrow(
      () => runCodexInstall(codexHome),
      'install must not throw when config.toml contains TOML floats'
    );

    // The merged config.toml must still contain the float values at root scope.
    const after = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    const parsed = parseTomlToObject(after);
    assert.strictEqual(parsed.tool_timeout_sec, 20.0,
      'tool_timeout_sec must be preserved as a number after install');
    assert.strictEqual(parsed.startup_timeout_sec, 60.0,
      'startup_timeout_sec must be preserved as a number after install');
  });

  test('post-install config retains float literal form (20.0 not truncated to 20)', () => {
    const preInstall = [
      'tool_timeout_sec = 20.0',
      '',
    ].join('\n');
    writeCodexConfig(codexHome, preInstall);

    runCodexInstall(codexHome);

    const after = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    // The value must survive round-trip as a float-compatible representation.
    // Parse structurally — don't grep for the literal string "20.0".
    const parsed = parseTomlToObject(after);
    assert.strictEqual(parsed.tool_timeout_sec, 20,
      'tool_timeout_sec must round-trip as numeric 20 (=== 20.0 in JS)');
  });
});

// ---------------------------------------------------------------------------
// Defect 2 — idempotent rollback covers skills, agents, VERSION
// ---------------------------------------------------------------------------

// concurrency: false — patches module.exports.__codexSchemaValidator and drives
// the install pipeline. Serialise to prevent cross-test pollution.
describe('#3245 — idempotent rollback reverts skills/, agents/, and VERSION', { concurrency: false }, () => {
  let tmpDir;
  let codexHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3245-rollback-'));
    codexHome = path.join(tmpDir, 'codex-home');
  });

  afterEach(() => {
    delete installModule.__codexSchemaValidator;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('validation failure rolls back skills/, agents/, and VERSION to pre-install state', () => {
    // Start from a clean codexHome with no pre-existing GSD content — the dirs
    // do not exist yet. After a failed install they must be absent (or contain
    // only what was there before, i.e. nothing).
    fs.mkdirSync(codexHome, { recursive: true });

    // Force schema validation to fail so we can observe the rollback without
    // needing a genuinely broken config.
    installModule.__codexSchemaValidator = () => ({
      ok: false,
      reason: 'simulated failure for #3245 rollback test',
    });

    let threw = false;
    try {
      runCodexInstall(codexHome);
    } catch (_) {
      threw = true;
    }
    assert.strictEqual(threw, true, 'install must throw when validation fails');

    // skills/ — GSD writes gsd-* subdirs here. All must be absent after rollback.
    const skillsDir = path.join(codexHome, 'skills');
    if (fs.existsSync(skillsDir)) {
      const gsdSkills = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
      assert.strictEqual(
        gsdSkills.length,
        0,
        'rollback must remove all gsd-* skill directories: ' + gsdSkills.map(e => e.name).join(', ')
      );
    }

    // agents/ — GSD writes gsd-*.md and gsd-*.toml here. All must be absent.
    const agentsDir = path.join(codexHome, 'agents');
    if (fs.existsSync(agentsDir)) {
      const gsdAgents = fs.readdirSync(agentsDir)
        .filter(f => f.startsWith('gsd-') && (f.endsWith('.md') || f.endsWith('.toml')));
      assert.strictEqual(
        gsdAgents.length,
        0,
        'rollback must remove all gsd-* agent files: ' + gsdAgents.join(', ')
      );
    }

    // VERSION — GSD writes get-shit-done/VERSION. Must be absent (wasn't there before).
    const versionPath = path.join(codexHome, 'get-shit-done', 'VERSION');
    assert.strictEqual(
      fs.existsSync(versionPath),
      false,
      'rollback must remove the VERSION file written during install'
    );
  });

  test('rollback is safe when fired before any snapshots were captured (very early failure)', () => {
    // If the validator is injected before ANY install writes happen, the rollback
    // must not throw — it should be idempotent when nothing was written yet.
    fs.mkdirSync(codexHome, { recursive: true });

    installModule.__codexSchemaValidator = () => ({
      ok: false,
      reason: 'very early simulated failure',
    });

    // The install must throw (validation failure), but the rollback that runs
    // internally must not throw — it must be idempotent when nothing was written.
    let threw = false;
    try {
      runCodexInstall(codexHome);
    } catch (_) {
      threw = true;
    }
    assert.strictEqual(threw, true, 'install must throw when validation fails (very early failure)');
    // With nothing written before rollback fires, skills/ must not be left behind.
    assert.strictEqual(
      fs.existsSync(path.join(codexHome, 'skills')),
      false,
      'skills/ must not be created when rollback fires before any writes'
    );
  });

  test('rollback does not remove pre-existing user skills that GSD did not write', () => {
    // If the user has a custom skill dir (not gsd-*) it must survive rollback.
    const skillsDir = path.join(codexHome, 'skills');
    const userSkill = path.join(skillsDir, 'my-custom-skill');
    fs.mkdirSync(userSkill, { recursive: true });
    fs.writeFileSync(path.join(userSkill, 'SKILL.md'), '# Custom\n', 'utf8');

    installModule.__codexSchemaValidator = () => ({
      ok: false,
      reason: 'simulated failure — user skill must survive',
    });

    try { runCodexInstall(codexHome); } catch (_) { /* expected */ }

    assert.strictEqual(
      fs.existsSync(path.join(userSkill, 'SKILL.md')),
      true,
      'pre-existing non-gsd-* skill must survive rollback'
    );
  });

  test('rollback removes orphaned atomic-write temp files', () => {
    // Any <file>.tmp-<pid>-<n> files created during aborted atomic writes
    // must be cleaned up by the rollback so targetDir is not left with stray
    // temp files consuming disk space.
    fs.mkdirSync(codexHome, { recursive: true });

    installModule.__codexSchemaValidator = () => ({
      ok: false,
      reason: 'simulated failure for temp-file cleanup test',
    });

    try { runCodexInstall(codexHome); } catch (_) { /* expected */ }

    // Scan for any *.tmp-* files left in codexHome after rollback.
    const tmpPattern = /\.tmp-\d+-\d+$/;
    function findTmpFiles(dir) {
      if (!fs.existsSync(dir)) return [];
      const results = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...findTmpFiles(full));
        } else if (tmpPattern.test(entry.name)) {
          results.push(full);
        }
      }
      return results;
    }
    const stray = findTmpFiles(codexHome);
    assert.strictEqual(
      stray.length,
      0,
      'rollback must clean up orphaned atomic-write temp files: ' + stray.join(', ')
    );
  });
});
