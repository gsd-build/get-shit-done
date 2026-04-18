/**
 * Unit tests for shared query helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError } from '../errors.js';
import {
  escapeRegex,
  normalizePhaseName,
  comparePhaseNum,
  extractPhaseToken,
  phaseTokenMatches,
  toPosixPath,
  stateExtractField,
  planningPaths,
  normalizeMd,
  resolvePathUnderProject,
  resolveAgentsDir,
  getRuntimeConfigDir,
  detectRuntime,
  SUPPORTED_RUNTIMES,
  type Runtime,
} from './helpers.js';
import { homedir } from 'node:os';

// ─── escapeRegex ────────────────────────────────────────────────────────────

describe('escapeRegex', () => {
  it('escapes dots', () => {
    expect(escapeRegex('foo.bar')).toBe('foo\\.bar');
  });

  it('escapes brackets', () => {
    expect(escapeRegex('test[0]')).toBe('test\\[0\\]');
  });

  it('escapes all regex special characters', () => {
    expect(escapeRegex('a.*+?^${}()|[]\\')).toBe('a\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeRegex('hello')).toBe('hello');
  });
});

// ─── normalizePhaseName ─────────────────────────────────────────────────────

describe('normalizePhaseName', () => {
  it('pads single digit to 2 digits', () => {
    expect(normalizePhaseName('9')).toBe('09');
  });

  it('strips project code prefix', () => {
    expect(normalizePhaseName('CK-01')).toBe('01');
  });

  it('preserves letter suffix', () => {
    expect(normalizePhaseName('12A')).toBe('12A');
  });

  it('preserves decimal parts', () => {
    expect(normalizePhaseName('12.1')).toBe('12.1');
  });

  it('strips project code and normalizes numeric part', () => {
    // PROJ-42 -> strip PROJ- prefix -> 42 -> pad to 42
    expect(normalizePhaseName('PROJ-42')).toBe('42');
  });

  it('handles already-padded numbers', () => {
    expect(normalizePhaseName('01')).toBe('01');
  });
});

// ─── comparePhaseNum ────────────────────────────────────────────────────────

describe('comparePhaseNum', () => {
  it('compares numeric phases', () => {
    expect(comparePhaseNum('01-foo', '02-bar')).toBeLessThan(0);
  });

  it('compares letter suffixes', () => {
    expect(comparePhaseNum('12A-foo', '12B-bar')).toBeLessThan(0);
  });

  it('sorts no-decimal before decimal', () => {
    expect(comparePhaseNum('12-foo', '12.1-bar')).toBeLessThan(0);
  });

  it('returns 0 for equal phases', () => {
    expect(comparePhaseNum('01-name', '01-other')).toBe(0);
  });

  it('falls back to string comparison for custom IDs', () => {
    const result = comparePhaseNum('AUTH-name', 'PROJ-name');
    expect(typeof result).toBe('number');
  });
});

// ─── extractPhaseToken ──────────────────────────────────────────────────────

describe('extractPhaseToken', () => {
  it('extracts plain numeric token', () => {
    expect(extractPhaseToken('01-foundation')).toBe('01');
  });

  it('extracts project-code-prefixed token', () => {
    expect(extractPhaseToken('CK-01-name')).toBe('CK-01');
  });

  it('extracts letter suffix token', () => {
    expect(extractPhaseToken('12A-name')).toBe('12A');
  });

  it('extracts decimal token', () => {
    expect(extractPhaseToken('999.6-name')).toBe('999.6');
  });
});

// ─── phaseTokenMatches ──────────────────────────────────────────────────────

describe('phaseTokenMatches', () => {
  it('matches normalized numeric phase', () => {
    expect(phaseTokenMatches('09-foundation', '09')).toBe(true);
  });

  it('matches after stripping project code', () => {
    expect(phaseTokenMatches('CK-01-name', '01')).toBe(true);
  });

  it('does not match different phases', () => {
    expect(phaseTokenMatches('09-foundation', '10')).toBe(false);
  });
});

// ─── toPosixPath ────────────────────────────────────────────────────────────

describe('toPosixPath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(toPosixPath('a\\b\\c')).toBe('a/b/c');
  });

  it('preserves already-posix paths', () => {
    expect(toPosixPath('a/b/c')).toBe('a/b/c');
  });
});

// ─── stateExtractField ──────────────────────────────────────────────────────

describe('stateExtractField', () => {
  it('extracts bold field value', () => {
    const content = '**Phase:** 10\n**Plan:** 1';
    expect(stateExtractField(content, 'Phase')).toBe('10');
  });

  it('extracts plain field value', () => {
    const content = 'Status: executing\nPlan: 1';
    expect(stateExtractField(content, 'Status')).toBe('executing');
  });

  it('returns null for missing field', () => {
    expect(stateExtractField('no fields here', 'Missing')).toBeNull();
  });

  it('is case-insensitive', () => {
    const content = '**phase:** 10';
    expect(stateExtractField(content, 'Phase')).toBe('10');
  });
});

// ─── planningPaths ──────────────────────────────────────────────────────────

describe('planningPaths', () => {
  it('returns all expected keys', () => {
    const paths = planningPaths('/proj');
    expect(paths).toHaveProperty('planning');
    expect(paths).toHaveProperty('state');
    expect(paths).toHaveProperty('roadmap');
    expect(paths).toHaveProperty('project');
    expect(paths).toHaveProperty('config');
    expect(paths).toHaveProperty('phases');
    expect(paths).toHaveProperty('requirements');
  });

  it('uses posix paths', () => {
    const paths = planningPaths('/proj');
    expect(paths.state).toContain('.planning/STATE.md');
    expect(paths.config).toContain('.planning/config.json');
  });
});

// ─── normalizeMd ───────────────────────────────────────────────────────────

describe('normalizeMd', () => {
  it('converts CRLF to LF', () => {
    const result = normalizeMd('line1\r\nline2\r\n');
    expect(result).not.toContain('\r');
    expect(result).toContain('line1\nline2');
  });

  it('ensures terminal newline', () => {
    const result = normalizeMd('no trailing newline');
    expect(result).toMatch(/\n$/);
  });

  it('collapses 3+ consecutive blank lines to 2', () => {
    const result = normalizeMd('a\n\n\n\nb');
    // Should have at most 2 consecutive newlines (1 blank line between)
    expect(result).not.toContain('\n\n\n');
  });

  it('preserves content inside code fences', () => {
    const input = '```\n  code with trailing spaces   \n```\n';
    const result = normalizeMd(input);
    expect(result).toContain('  code with trailing spaces   ');
  });

  it('adds blank line before headings when missing', () => {
    const result = normalizeMd('some text\n# Heading\n');
    expect(result).toContain('some text\n\n# Heading');
  });

  it('returns empty-ish content unchanged', () => {
    expect(normalizeMd('')).toBe('');
    expect(normalizeMd(null as unknown as string)).toBe(null);
  });

  it('handles normal markdown without changes', () => {
    const input = '# Title\n\nSome text.\n\n## Section\n\nMore text.\n';
    const result = normalizeMd(input);
    expect(result).toBe(input);
  });
});

// ─── resolvePathUnderProject ────────────────────────────────────────────────

describe('resolvePathUnderProject', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-path-'));
    await writeFile(join(tmpDir, 'safe.md'), 'x', 'utf-8');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('resolves a relative file under the project root', async () => {
    const p = await resolvePathUnderProject(tmpDir, 'safe.md');
    expect(p.endsWith('safe.md')).toBe(true);
  });

  it('rejects paths that escape the project root', async () => {
    await expect(resolvePathUnderProject(tmpDir, '../../etc/passwd')).rejects.toThrow(GSDError);
  });
});

// ─── Runtime-aware agents dir resolution (#2402) ───────────────────────────

const RUNTIME_ENV_VARS = [
  'GSD_AGENTS_DIR', 'GSD_RUNTIME', 'CLAUDE_CONFIG_DIR', 'OPENCODE_CONFIG_DIR',
  'OPENCODE_CONFIG', 'KILO_CONFIG_DIR', 'KILO_CONFIG', 'XDG_CONFIG_HOME',
  'GEMINI_CONFIG_DIR', 'CODEX_HOME', 'COPILOT_CONFIG_DIR', 'ANTIGRAVITY_CONFIG_DIR',
  'CURSOR_CONFIG_DIR', 'WINDSURF_CONFIG_DIR', 'AUGMENT_CONFIG_DIR', 'TRAE_CONFIG_DIR',
  'QWEN_CONFIG_DIR', 'CODEBUDDY_CONFIG_DIR', 'CLINE_CONFIG_DIR',
] as const;

describe('getRuntimeConfigDir', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of RUNTIME_ENV_VARS) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of RUNTIME_ENV_VARS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const defaults: Record<Runtime, string> = {
    claude: join(homedir(), '.claude'),
    opencode: join(homedir(), '.config', 'opencode'),
    kilo: join(homedir(), '.config', 'kilo'),
    gemini: join(homedir(), '.gemini'),
    codex: join(homedir(), '.codex'),
    copilot: join(homedir(), '.copilot'),
    antigravity: join(homedir(), '.gemini', 'antigravity'),
    cursor: join(homedir(), '.cursor'),
    windsurf: join(homedir(), '.codeium', 'windsurf'),
    augment: join(homedir(), '.augment'),
    trae: join(homedir(), '.trae'),
    qwen: join(homedir(), '.qwen'),
    codebuddy: join(homedir(), '.codebuddy'),
    cline: join(homedir(), '.cline'),
  };

  for (const runtime of SUPPORTED_RUNTIMES) {
    it(`resolves default path for ${runtime}`, () => {
      expect(getRuntimeConfigDir(runtime)).toBe(defaults[runtime]);
    });
  }

  const envOverrides: Array<[Runtime, string, string]> = [
    ['claude', 'CLAUDE_CONFIG_DIR', '/x/claude'],
    ['gemini', 'GEMINI_CONFIG_DIR', '/x/gemini'],
    ['codex', 'CODEX_HOME', '/x/codex'],
    ['copilot', 'COPILOT_CONFIG_DIR', '/x/copilot'],
    ['antigravity', 'ANTIGRAVITY_CONFIG_DIR', '/x/antigravity'],
    ['cursor', 'CURSOR_CONFIG_DIR', '/x/cursor'],
    ['windsurf', 'WINDSURF_CONFIG_DIR', '/x/windsurf'],
    ['augment', 'AUGMENT_CONFIG_DIR', '/x/augment'],
    ['trae', 'TRAE_CONFIG_DIR', '/x/trae'],
    ['qwen', 'QWEN_CONFIG_DIR', '/x/qwen'],
    ['codebuddy', 'CODEBUDDY_CONFIG_DIR', '/x/codebuddy'],
    ['cline', 'CLINE_CONFIG_DIR', '/x/cline'],
    ['opencode', 'OPENCODE_CONFIG_DIR', '/x/opencode'],
    ['kilo', 'KILO_CONFIG_DIR', '/x/kilo'],
  ];
  for (const [runtime, envVar, value] of envOverrides) {
    it(`${runtime} honors ${envVar}`, () => {
      process.env[envVar] = value;
      expect(getRuntimeConfigDir(runtime)).toBe(value);
    });
  }

  it('opencode uses XDG_CONFIG_HOME when direct vars unset', () => {
    process.env.XDG_CONFIG_HOME = '/xdg';
    expect(getRuntimeConfigDir('opencode')).toBe(join('/xdg', 'opencode'));
  });

  it('opencode OPENCODE_CONFIG uses dirname', () => {
    process.env.OPENCODE_CONFIG = '/cfg/opencode.json';
    expect(getRuntimeConfigDir('opencode')).toBe('/cfg');
  });

  it('kilo uses XDG_CONFIG_HOME when direct vars unset', () => {
    process.env.XDG_CONFIG_HOME = '/xdg';
    expect(getRuntimeConfigDir('kilo')).toBe(join('/xdg', 'kilo'));
  });
});

describe('detectRuntime', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of RUNTIME_ENV_VARS) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of RUNTIME_ENV_VARS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('defaults to claude with no signals', () => {
    expect(detectRuntime()).toBe('claude');
  });

  it('uses GSD_RUNTIME when set to a known runtime', () => {
    process.env.GSD_RUNTIME = 'codex';
    expect(detectRuntime()).toBe('codex');
  });

  it('falls back to config.runtime when GSD_RUNTIME unset', () => {
    expect(detectRuntime({ runtime: 'gemini' })).toBe('gemini');
  });

  it('GSD_RUNTIME wins over config.runtime', () => {
    process.env.GSD_RUNTIME = 'codex';
    expect(detectRuntime({ runtime: 'gemini' })).toBe('codex');
  });

  it('unknown GSD_RUNTIME falls through to config then claude', () => {
    process.env.GSD_RUNTIME = 'bogus';
    expect(detectRuntime({ runtime: 'gemini' })).toBe('gemini');
    expect(detectRuntime()).toBe('claude');
  });

  it('unknown config.runtime falls through to claude', () => {
    expect(detectRuntime({ runtime: 'bogus' })).toBe('claude');
  });
});

describe('resolveAgentsDir (runtime-aware)', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of RUNTIME_ENV_VARS) { saved[k] = process.env[k]; delete process.env[k]; }
  });
  afterEach(() => {
    for (const k of RUNTIME_ENV_VARS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('defaults to Claude agents dir with no args', () => {
    expect(resolveAgentsDir()).toBe(join(homedir(), '.claude', 'agents'));
  });

  it('GSD_AGENTS_DIR short-circuits regardless of runtime', () => {
    process.env.GSD_AGENTS_DIR = '/explicit/agents';
    expect(resolveAgentsDir('codex')).toBe('/explicit/agents');
    expect(resolveAgentsDir('claude')).toBe('/explicit/agents');
  });

  it('appends /agents to the per-runtime config dir', () => {
    process.env.CODEX_HOME = '/codex';
    expect(resolveAgentsDir('codex')).toBe(join('/codex', 'agents'));
  });
});
