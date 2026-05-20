'use strict';
/**
 * Consolidated tests for the Runtime Artifact Layout Module (ADR-3660) — layout seam.
 *
 * Covers:
 *   - resolveRuntimeArtifactLayout — structural shape per runtime
 *   - resolveRuntimeArtifactLayout edge-cases (error paths, invalid input)
 *   - kind.stage() invocations per kind type
 *
 * Sources consolidated (3 files deleted):
 *   tests/runtime-artifact-layout-resolve.test.cjs
 *   tests/runtime-artifact-layout-edge-cases.test.cjs
 *   tests/runtime-artifact-layout-stage.test.cjs
 *
 * See also:
 *   runtime-artifact-layout-surface.test.cjs       — surface seam
 *   runtime-artifact-layout-install-profiles.test.cjs — install-profiles seam
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { resolveRuntimeArtifactLayout } = require('../get-shit-done/bin/lib/runtime-artifact-layout.cjs');

const FAKE_DIR = '/tmp/fake-config-dir';

// ─── resolveRuntimeArtifactLayout — structural shape ────────────────────────

describe('resolveRuntimeArtifactLayout — claude local', () => {
  test('returns correct layout for claude scope=local', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_DIR, 'local');
    assert.strictEqual(layout.runtime, 'claude');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 2);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
    assert.strictEqual(layout.kinds[0].destSubpath, 'commands/gsd');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
    assert.strictEqual(layout.kinds[1].kind, 'agents');
    assert.strictEqual(layout.kinds[1].destSubpath, 'agents');
    assert.strictEqual(layout.kinds[1].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[1].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — claude global', () => {
  test('returns correct layout for claude scope=global', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_DIR, 'global');
    assert.strictEqual(layout.runtime, 'claude');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — cursor', () => {
  test('returns correct layout for cursor', () => {
    const layout = resolveRuntimeArtifactLayout('cursor', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'cursor');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — gemini', () => {
  test('returns correct layout for gemini', () => {
    const layout = resolveRuntimeArtifactLayout('gemini', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'gemini');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
    assert.strictEqual(layout.kinds[0].destSubpath, 'commands/gsd');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — codex', () => {
  test('returns correct layout for codex', () => {
    const layout = resolveRuntimeArtifactLayout('codex', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'codex');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — copilot', () => {
  test('returns correct layout for copilot', () => {
    const layout = resolveRuntimeArtifactLayout('copilot', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'copilot');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — antigravity', () => {
  test('returns correct layout for antigravity', () => {
    const layout = resolveRuntimeArtifactLayout('antigravity', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'antigravity');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — windsurf', () => {
  test('returns correct layout for windsurf', () => {
    const layout = resolveRuntimeArtifactLayout('windsurf', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'windsurf');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — augment', () => {
  test('returns correct layout for augment', () => {
    const layout = resolveRuntimeArtifactLayout('augment', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'augment');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — trae', () => {
  test('returns correct layout for trae', () => {
    const layout = resolveRuntimeArtifactLayout('trae', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'trae');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — qwen', () => {
  test('returns correct layout for qwen', () => {
    const layout = resolveRuntimeArtifactLayout('qwen', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'qwen');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — hermes', () => {
  test('returns correct layout for hermes', () => {
    const layout = resolveRuntimeArtifactLayout('hermes', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'hermes');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills/gsd');
    assert.strictEqual(layout.kinds[0].prefix, '');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — codebuddy', () => {
  test('returns correct layout for codebuddy', () => {
    const layout = resolveRuntimeArtifactLayout('codebuddy', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'codebuddy');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — cline', () => {
  test('returns correct layout for cline', () => {
    const layout = resolveRuntimeArtifactLayout('cline', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'cline');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 0);
  });
});

describe('resolveRuntimeArtifactLayout — opencode', () => {
  test('returns correct layout for opencode', () => {
    const layout = resolveRuntimeArtifactLayout('opencode', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'opencode');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
    assert.strictEqual(layout.kinds[0].destSubpath, 'command');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — kilo', () => {
  test('returns correct layout for kilo', () => {
    const layout = resolveRuntimeArtifactLayout('kilo', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'kilo');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
    assert.strictEqual(layout.kinds[0].destSubpath, 'command');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

// ─── resolveRuntimeArtifactLayout — edge-cases ──────────────────────────────

describe('resolveRuntimeArtifactLayout edge-cases', () => {
  test('hermes has destSubpath skills/gsd and empty prefix', () => {
    const layout = resolveRuntimeArtifactLayout('hermes', '/tmp/x');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills/gsd');
    assert.strictEqual(layout.kinds[0].prefix, '');
  });

  test('cline has no kinds', () => {
    const layout = resolveRuntimeArtifactLayout('cline', '/tmp/x');
    assert.strictEqual(layout.kinds.length, 0);
  });

  test('gemini has one commands kind', () => {
    const layout = resolveRuntimeArtifactLayout('gemini', '/tmp/x');
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
  });

  test('claude local has both commands and agents kinds', () => {
    const layout = resolveRuntimeArtifactLayout('claude', '/tmp/x', 'local');
    const kindNames = layout.kinds.map(k => k.kind);
    assert.ok(kindNames.includes('commands'), 'should have commands kind');
    assert.ok(kindNames.includes('agents'), 'should have agents kind');
  });

  test('claude global has only skills kind', () => {
    const layout = resolveRuntimeArtifactLayout('claude', '/tmp/x', 'global');
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
  });

  test('unknown runtime grok throws TypeError containing runtime name', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('grok', '/tmp/x'),
      (err) => {
        assert.ok(err instanceof TypeError);
        assert.ok(err.message.includes('grok'), 'error message must contain the runtime name');
        return true;
      }
    );
  });

  test('unknown runtime xyzunknown throws TypeError', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('xyzunknown', '/tmp/x'),
      TypeError
    );
  });

  test('empty configDir throws TypeError', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('claude', ''),
      TypeError
    );
  });

  test('non-string configDir throws TypeError', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('claude', null),
      TypeError
    );
  });

  test('bad scope throws TypeError', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('claude', '/x', 'invalid'),
      TypeError
    );
  });
});

// ─── kind.stage() invocations ────────────────────────────────────────────────

const CORE_SKILLS = new Set(['help', 'phase', 'new-project']);
const CORE_AGENTS = new Set(['gsd-planner']);
const PROFILE_CORE = { skills: CORE_SKILLS, agents: CORE_AGENTS };
const PROFILE_FULL = { skills: '*', agents: new Set() };
const FAKE_STAGE_DIR = '/tmp/fake-config-dir-stage';

describe('stage — commands kind (gemini)', () => {
  test('stage returns a directory containing only the selected skill .md files', () => {
    const layout = resolveRuntimeArtifactLayout('gemini', FAKE_STAGE_DIR);
    const commandsKind = layout.kinds.find(k => k.kind === 'commands');
    assert.ok(commandsKind, 'should have a commands kind');

    const stagedDir = commandsKind.stage(PROFILE_CORE);
    const entries = fs.readdirSync(stagedDir).filter(f => f.endsWith('.md'));
    for (const entry of entries) {
      const stem = entry.slice(0, -3);
      assert.ok(CORE_SKILLS.has(stem), `unexpected skill staged: ${stem}`);
    }
    assert.ok(entries.length >= 1, 'at least one skill file should be staged');
  });
});

describe('stage — agents kind (claude local)', () => {
  test('stage returns a valid directory for the agents kind', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_STAGE_DIR, 'local');
    const agentsKind = layout.kinds.find(k => k.kind === 'agents');
    assert.ok(agentsKind, 'should have an agents kind');

    const stagedDir = agentsKind.stage(PROFILE_CORE);
    assert.ok(fs.existsSync(stagedDir), 'stagedDir must exist');
    assert.ok(fs.statSync(stagedDir).isDirectory(), 'stagedDir must be a directory');
  });
});

describe('stage — skills kind (claude global)', () => {
  test('stage returns a directory containing gsd-<stem>/SKILL.md entries', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_STAGE_DIR, 'global');
    const skillsKind = layout.kinds.find(k => k.kind === 'skills');
    assert.ok(skillsKind, 'should have a skills kind');

    const stagedDir = skillsKind.stage(PROFILE_CORE);
    assert.ok(fs.existsSync(stagedDir), 'stagedDir must exist');
    const entries = fs.readdirSync(stagedDir);
    for (const entry of entries) {
      assert.ok(entry.startsWith('gsd-'), `entry should start with gsd-: ${entry}`);
      const skillMd = path.join(stagedDir, entry, 'SKILL.md');
      assert.ok(fs.existsSync(skillMd), `SKILL.md must exist in ${entry}`);
    }
    assert.ok(entries.length >= 1, 'at least one skill dir should be staged');
  });

  test('stage with skills="*" stages all commands/gsd/*.md as skills', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_STAGE_DIR, 'global');
    const skillsKind = layout.kinds.find(k => k.kind === 'skills');
    assert.ok(skillsKind, 'should have a skills kind');

    const stagedDir = skillsKind.stage(PROFILE_FULL);
    assert.ok(fs.existsSync(stagedDir), 'stagedDir must exist');
    const entries = fs.readdirSync(stagedDir);
    assert.ok(entries.length > 10, `full profile should have many skills, got ${entries.length}`);
    for (const entry of entries) {
      assert.ok(entry.startsWith('gsd-'), `entry should start with gsd-: ${entry}`);
      const skillMd = path.join(stagedDir, entry, 'SKILL.md');
      assert.ok(fs.existsSync(skillMd), `SKILL.md must exist in ${entry}`);
    }
  });
});

describe('stage — opencode commands kind', () => {
  test('opencode stage returns directory with .md files for selected skills', () => {
    const layout = resolveRuntimeArtifactLayout('opencode', FAKE_STAGE_DIR);
    const commandsKind = layout.kinds.find(k => k.kind === 'commands');
    assert.ok(commandsKind, 'should have a commands kind');

    const stagedDir = commandsKind.stage(PROFILE_CORE);
    assert.ok(fs.existsSync(stagedDir), 'stagedDir must exist');
    const entries = fs.readdirSync(stagedDir).filter(f => f.endsWith('.md'));
    for (const entry of entries) {
      const stem = entry.slice(0, -3);
      assert.ok(CORE_SKILLS.has(stem), `unexpected skill staged: ${stem}`);
    }
  });
});
