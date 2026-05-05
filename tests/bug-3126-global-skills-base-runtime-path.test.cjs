'use strict';
// allow-test-rule: last three tests read init.cjs source to verify delegation contract to runtime-homes.cjs — structural guard, no behavioral IR exposed

// Regression guard for bug #3126.
//
// buildAgentSkillsBlock() in init.cjs hardcoded `globalSkillsBase` to
// `~/.claude/skills` regardless of the active runtime. On a Cursor install,
// global: skills live under `~/.cursor/skills`, causing every global: lookup
// to silently fail with:
//   [agent-skills] WARNING: Global skill not found at "~/.cursor/skills/X/SKILL.md" — skipping
//
// Fix introduces get-shit-done/bin/lib/runtime-homes.cjs with first-class
// support for all 15 supported runtimes, including:
//   - hermes: nested skills/gsd/<skillName>/ layout (#2841)
//   - cline: rules-based, returns null (no skills directory)
//   - CLAUDE_CONFIG_DIR env var for Claude (was missing)
//   - All other runtime-specific env vars

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const {
  getGlobalConfigDir,
  getGlobalSkillsBase,
  getGlobalSkillDir,
  getGlobalSkillDisplayPath,
} = require(path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'runtime-homes.cjs'));

// Helper: run fn with an env var temporarily set
function withEnv(key, value, fn) {
  const orig = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try { return fn(); }
  finally {
    if (orig === undefined) delete process.env[key];
    else process.env[key] = orig;
  }
}

describe('bug #3126: runtime-homes getGlobalConfigDir — defaults', () => {
  const defaults = [
    ['claude',      path.join(os.homedir(), '.claude')],
    ['cursor',      path.join(os.homedir(), '.cursor')],
    ['gemini',      path.join(os.homedir(), '.gemini')],
    ['codex',       path.join(os.homedir(), '.codex')],
    ['copilot',     path.join(os.homedir(), '.copilot')],
    ['antigravity', path.join(os.homedir(), '.gemini', 'antigravity')],
    ['windsurf',    path.join(os.homedir(), '.codeium', 'windsurf')],
    ['augment',     path.join(os.homedir(), '.augment')],
    ['trae',        path.join(os.homedir(), '.trae')],
    ['qwen',        path.join(os.homedir(), '.qwen')],
    ['hermes',      path.join(os.homedir(), '.hermes')],
    ['codebuddy',   path.join(os.homedir(), '.codebuddy')],
    ['cline',       path.join(os.homedir(), '.cline')],
    ['opencode',    path.join(os.homedir(), '.config', 'opencode')],
    ['kilo',        path.join(os.homedir(), '.config', 'kilo')],
  ];
  for (const [runtime, expected] of defaults) {
    test(`${runtime} default configDir`, () => {
      // Clear all env vars for this runtime
      const envKeys = ['CLAUDE_CONFIG_DIR','CURSOR_CONFIG_DIR','GEMINI_CONFIG_DIR',
        'CODEX_HOME','COPILOT_CONFIG_DIR','ANTIGRAVITY_CONFIG_DIR','WINDSURF_CONFIG_DIR',
        'AUGMENT_CONFIG_DIR','TRAE_CONFIG_DIR','QWEN_CONFIG_DIR','HERMES_HOME',
        'CODEBUDDY_CONFIG_DIR','CLINE_CONFIG_DIR','OPENCODE_CONFIG_DIR','KILO_CONFIG_DIR',
        'XDG_CONFIG_HOME'];
      const saved = {};
      for (const k of envKeys) { saved[k] = process.env[k]; delete process.env[k]; }
      try {
        assert.strictEqual(getGlobalConfigDir(runtime), expected);
      } finally {
        for (const k of envKeys) {
          if (saved[k] !== undefined) process.env[k] = saved[k];
        }
      }
    });
  }
  test('unknown runtime falls back to ~/.claude', () => {
    withEnv('CLAUDE_CONFIG_DIR', undefined, () => {
      assert.strictEqual(getGlobalConfigDir('unknown-xyz'), path.join(os.homedir(), '.claude'));
    });
  });
});

describe('bug #3126: runtime-homes env-var overrides', () => {
  test('claude respects CLAUDE_CONFIG_DIR (was missing in old code)', () => {
    withEnv('CLAUDE_CONFIG_DIR', '/custom/claude', () => {
      assert.strictEqual(getGlobalConfigDir('claude'), '/custom/claude');
    });
  });
  test('cursor respects CURSOR_CONFIG_DIR', () => {
    withEnv('CURSOR_CONFIG_DIR', '/custom/cursor', () => {
      assert.strictEqual(getGlobalConfigDir('cursor'), '/custom/cursor');
    });
  });
  test('opencode respects OPENCODE_CONFIG_DIR', () => {
    withEnv('OPENCODE_CONFIG_DIR', '/custom/opencode', () => {
      withEnv('XDG_CONFIG_HOME', undefined, () => {
        assert.strictEqual(getGlobalConfigDir('opencode'), '/custom/opencode');
      });
    });
  });
  test('opencode uses XDG_CONFIG_HOME when OPENCODE_CONFIG_DIR absent', () => {
    withEnv('OPENCODE_CONFIG_DIR', undefined, () => {
      withEnv('XDG_CONFIG_HOME', '/xdg', () => {
        assert.strictEqual(getGlobalConfigDir('opencode'), '/xdg/opencode');
      });
    });
  });
  test('kilo uses XDG_CONFIG_HOME when KILO_CONFIG_DIR absent', () => {
    withEnv('KILO_CONFIG_DIR', undefined, () => {
      withEnv('XDG_CONFIG_HOME', '/xdg', () => {
        assert.strictEqual(getGlobalConfigDir('kilo'), '/xdg/kilo');
      });
    });
  });
});

describe('bug #3126: runtime-homes getGlobalSkillsBase', () => {
  test('most runtimes: skills at <configDir>/skills', () => {
    withEnv('CURSOR_CONFIG_DIR', undefined, () => {
      assert.strictEqual(
        getGlobalSkillsBase('cursor'),
        path.join(os.homedir(), '.cursor', 'skills'),
      );
    });
  });
  test('hermes: skills at <configDir>/skills/gsd (nested layout #2841)', () => {
    withEnv('HERMES_HOME', undefined, () => {
      assert.strictEqual(
        getGlobalSkillsBase('hermes'),
        path.join(os.homedir(), '.hermes', 'skills', 'gsd'),
      );
    });
  });
  test('cline: returns null (rules-based, no skills directory)', () => {
    assert.strictEqual(getGlobalSkillsBase('cline'), null);
  });
});

describe('bug #3126: runtime-homes getGlobalSkillDir', () => {
  test('cursor: <configDir>/skills/<skillName>', () => {
    withEnv('CURSOR_CONFIG_DIR', undefined, () => {
      assert.strictEqual(
        getGlobalSkillDir('cursor', 'gsd-executor'),
        path.join(os.homedir(), '.cursor', 'skills', 'gsd-executor'),
      );
    });
  });
  test('hermes: <configDir>/skills/gsd/<skillName>', () => {
    withEnv('HERMES_HOME', undefined, () => {
      assert.strictEqual(
        getGlobalSkillDir('hermes', 'gsd-executor'),
        path.join(os.homedir(), '.hermes', 'skills', 'gsd', 'gsd-executor'),
      );
    });
  });
  test('cline: returns null', () => {
    assert.strictEqual(getGlobalSkillDir('cline', 'gsd-executor'), null);
  });
});

describe('bug #3126: init.cjs uses runtime-homes not hardcoded .claude', () => {
  test('init.cjs has no hardcoded globalSkillsBase assignment to ~/.claude/skills', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(
      path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'init.cjs'),
      'utf8',
    );
    assert.ok(
      !src.includes("const globalSkillsBase = path.join(os.homedir(), '.claude', 'skills')"),
      'init.cjs still assigns globalSkillsBase to hardcoded ~/.claude/skills — fix not applied',
    );
  });
  test('init.cjs requires runtime-homes', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(
      path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'init.cjs'),
      'utf8',
    );
    assert.ok(
      src.includes('runtime-homes'),
      'init.cjs does not require runtime-homes.cjs',
    );
  });
  test('init.cjs warning message no longer hardcodes ~/.claude/skills', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(
      path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'init.cjs'),
      'utf8',
    );
    assert.ok(
      !src.includes("~/.claude/skills/${skillName}/SKILL.md"),
      'init.cjs warning message still hardcodes ~/.claude/skills path',
    );
  });
});
