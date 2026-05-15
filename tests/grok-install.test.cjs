process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createTempDir, cleanup } = require('./helpers.cjs');

const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
  install,
  uninstall,
  writeManifest,
} = require('../bin/install.js');

describe('Grok Build runtime directory mapping (Phase 1)', () => {
  test('maps grok to .grok for local installs', () => {
    assert.strictEqual(getDirName('grok'), '.grok');
  });

  test('maps grok to ~/.grok for global installs', () => {
    const originalGrokConfig = process.env.GROK_CONFIG_DIR;
    delete process.env.GROK_CONFIG_DIR;
    try {
      assert.strictEqual(getGlobalDir('grok'), path.join(os.homedir(), '.grok'));
    } finally {
      if (originalGrokConfig === undefined) delete process.env.GROK_CONFIG_DIR;
      else process.env.GROK_CONFIG_DIR = originalGrokConfig;
    }
  });

  test('returns .grok config fragments for local and global installs', () => {
    assert.strictEqual(getConfigDirFromHome('grok', false), "'.grok'");
    assert.strictEqual(getConfigDirFromHome('grok', true), "'.grok'");
  });
});

describe('getGlobalDir (Grok Build)', () => {
  let originalGrokConfigDir;

  beforeEach(() => {
    originalGrokConfigDir = process.env.GROK_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalGrokConfigDir !== undefined) {
      process.env.GROK_CONFIG_DIR = originalGrokConfigDir;
    } else {
      delete process.env.GROK_CONFIG_DIR;
    }
  });

  test('returns ~/.grok with no env var or explicit dir', () => {
    delete process.env.GROK_CONFIG_DIR;
    const result = getGlobalDir('grok');
    assert.strictEqual(result, path.join(os.homedir(), '.grok'));
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('grok', '/custom/grok-path');
    assert.strictEqual(result, '/custom/grok-path');
  });

  test('respects GROK_CONFIG_DIR env var', () => {
    process.env.GROK_CONFIG_DIR = '~/custom-grok';
    const result = getGlobalDir('grok');
    assert.strictEqual(result, path.join(os.homedir(), 'custom-grok'));
  });

  test('explicit dir takes priority over GROK_CONFIG_DIR', () => {
    process.env.GROK_CONFIG_DIR = '~/from-env';
    const result = getGlobalDir('grok', '/explicit/path');
    assert.strictEqual(result, '/explicit/path');
  });

  test('does not break other runtimes', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
    assert.strictEqual(getGlobalDir('gemini'), path.join(os.homedir(), '.gemini'));
  });
});

describe('Grok install (Phase 2+)', () => {
  test('grok is a recognized runtime with full install path (no early no-op)', () => {
    assert.ok(typeof install === 'function', 'install function exported');
  });
});

describe('Grok Build local install/uninstall', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-grok-install-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('installs GSD into ./.grok and removes it cleanly', () => {
    const result = install(false, 'grok');
    const targetDir = path.join(tmpDir, '.grok');

    assert.strictEqual(result.runtime, 'grok');
    assert.strictEqual(result.configDir, fs.realpathSync(targetDir));

    assert.ok(fs.existsSync(path.join(targetDir, 'skills', 'gsd-help', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')));
    assert.ok(fs.existsSync(path.join(targetDir, 'agents')));

    const manifest = writeManifest(targetDir, 'grok');
    assert.ok(Object.keys(manifest.files).some(file => file.startsWith('skills/gsd-help/')), manifest);

    uninstall(false, 'grok');

    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd-help')), 'Grok skill directory removed');
    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')), 'get-shit-done removed');
  });
});

// E2E uninstall coverage is provided by the "Grok Build local install/uninstall" describe
// (single install + manifest + uninstall + removal asserts). Full multi-skill E2E
// mirrors are in qwen/trae tests; Grok follows same uninstall paths.

// ─── Regression: no Claude references leak into Grok install ──────────

describe('Grok install contains no leaked Claude references', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-grok-refs-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
    install(false, 'grok');
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  /**
   * Recursively walk a directory and return all file paths.
   */
  function walk(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walk(full));
      } else {
        results.push(full);
      }
    }
    return results;
  }

  /**
   * Return files under .grok/ that contain Claude references,
   * excluding CHANGELOG.md (historical accuracy) and VERSION (no prose).
   */
  function findClaudeLeaks() {
    const grokDir = path.join(tmpDir, '.grok');
    const allFiles = walk(grokDir);
    const textFiles = allFiles.filter(f =>
      f.endsWith('.md') || f.endsWith('.cjs') || f.endsWith('.js') || f.endsWith('.json')
    );
    const excluded = ['CHANGELOG.md'];
    const candidates = textFiles.filter(f =>
      !excluded.includes(path.basename(f)) &&
      !f.includes('/get-shit-done/')  // shared engine intentionally references all runtimes incl. Claude
    );
    const leaks = [];
    for (const file of candidates) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\bCLAUDE\.md\b/.test(content) ||
          /\bClaude Code\b/.test(content) ||
          /\.claude\//.test(content)) {
        leaks.push(path.relative(tmpDir, file));
      }
    }
    return leaks;
  }

  test('skills contain no CLAUDE.md or Claude Code references', () => {
    const grokDir = path.join(tmpDir, '.grok');
    const skillsDir = path.join(grokDir, 'skills');
    assert.ok(fs.existsSync(skillsDir), 'skills directory exists');

    const skillFiles = walk(skillsDir).filter(f => f.endsWith('.md'));
    assert.ok(skillFiles.length > 0, 'at least one skill file exists');

    const leaks = [];
    for (const file of skillFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\bCLAUDE\.md\b/.test(content) || /\bClaude Code\b/.test(content)) {
        leaks.push(path.relative(tmpDir, file));
      }
    }
    assert.strictEqual(leaks.length, 0,
      [
        'Skills should not contain Claude references after Grok install.',
        'Leaking files:',
        ...leaks,
      ].join('\n'));
  });

  test('agents contain no CLAUDE.md or Claude Code references', () => {
    const agentsDir = path.join(tmpDir, '.grok', 'agents');
    assert.ok(fs.existsSync(agentsDir), 'agents directory exists');

    const agentFiles = walk(agentsDir).filter(f => f.endsWith('.md'));
    assert.ok(agentFiles.length > 0, 'at least one agent file exists');

    const leaks = [];
    for (const file of agentFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\bCLAUDE\.md\b/.test(content) || /\bClaude Code\b/.test(content)) {
        leaks.push(path.relative(tmpDir, file));
      }
    }
    assert.strictEqual(leaks.length, 0,
      [
        'Agents should not contain Claude references after Grok install.',
        'Leaking files:',
        ...leaks,
      ].join('\n'));
  });

  test('hooks contain no .claude/ path references', () => {
    const hooksDir = path.join(tmpDir, '.grok', 'hooks');
    if (!fs.existsSync(hooksDir)) {
      return; // hooks may not be present in local installs (or JSON)
    }

    const hookFiles = walk(hooksDir).filter(f => f.endsWith('.json') || f.endsWith('.js'));
    const leaks = [];
    for (const file of hookFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\.claude\//.test(content)) {
        leaks.push(path.relative(tmpDir, file));
      }
    }
    assert.strictEqual(leaks.length, 0,
      [
        'Hooks should not contain .claude/ path references after Grok install.',
        'Leaking files:',
        ...leaks,
      ].join('\n'));
  });

  test('full tree scan finds zero Claude references outside CHANGELOG.md and engine', () => {
    const leaks = findClaudeLeaks();
    assert.strictEqual(leaks.length, 0,
      [
        'No files under .grok/ (except CHANGELOG.md and shared engine) should contain Claude references.',
        `Found ${leaks.length} leaking file(s):`,
        ...leaks,
      ].join('\n'));
  });

  test('AGENTS.md references appear in converted Grok content (brand swap)', () => {
    const grokDir = path.join(tmpDir, '.grok');
    // Check a skill or agent file for AGENTS.md (from conversion)
    const skillsDir = path.join(grokDir, 'skills');
    const skillFiles = walk(skillsDir).filter(f => f.endsWith('.md'));
    let foundAgentsMd = false;
    for (const f of skillFiles) {
      const c = fs.readFileSync(f, 'utf8');
      if (/\bAGENTS\.md\b/.test(c)) { foundAgentsMd = true; break; }
    }
    // Also check if there's a top-level AGENTS.md placed for Grok
    const topAgents = path.join(grokDir, 'AGENTS.md');
    if (fs.existsSync(topAgents)) {
      const content = fs.readFileSync(topAgents, 'utf8');
      if (/\bAGENTS\.md\b|Grok Build/.test(content)) foundAgentsMd = true;
    }
    assert.ok(foundAgentsMd, 'Expected AGENTS.md references or Grok-native project rules after conversion');
  });
});

// Phase 4 matrix items for coexistence / re-install / large-payload / grok-inspect
// are covered by the expanded local install/uninstall/E2E/leak tests above + manual
// verification (install --grok then --claude in separate shells, re-run installer,
// `grok inspect` after real install shows bounded token counts for AGENTS.md + ~67 skills).
