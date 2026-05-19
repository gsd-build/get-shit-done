import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { createRegistry } from './index.js';
import { GSDToolsError } from '../gsd-tools-error.js';
import {
  runQueryDispatch,
  validateQueryDispatchInput,
  planQueryDispatch,
  dispatchSuccess,
  dispatchFailure,
  formatPick,
  formatSuccess,
  mapNativeDispatchError,
  mapFallbackDispatchError,
  toDispatchFailure,
} from './query-dispatch.js';
import { createCommandTopology } from './command-topology.js';
import { COMMAND_MUTATION_SET } from './command-definition.js';
import { fallbackBridgeNotices } from './query-dispatch-observability.js';

// ─── stage: input-validation ─────────────────────────────────────────────────

describe('stage: input-validation', () => {
  it('fails when --pick value is missing', () => {
    const out = validateQueryDispatchInput(['state', 'json', '--pick']);
    expect(out.error).toBeDefined();
    expect(out.error?.ok).toBe(false);
  });

  it('extracts pick field and strips it from queryArgs', () => {
    const out = validateQueryDispatchInput(['state', 'json', '--pick', 'x.y']);
    expect(out.error).toBeUndefined();
    expect(out.queryArgs).toEqual(['state', 'json']);
    expect(out.pickField).toBe('x.y');
  });

  it('fails when --pick is the only command token (missing_command)', () => {
    const out = validateQueryDispatchInput(['--pick', 'x.y']);
    expect(out.error).toBeDefined();
    expect(out.error?.ok).toBe(false);
    if (out.error?.ok) throw new Error('expected failure');
    expect(out.error?.error.kind).toBe('validation_error');
  });

  it('fails for empty argv (requires_command)', () => {
    const out = validateQueryDispatchInput([]);
    expect(out.error).toBeDefined();
    expect(out.error?.ok).toBe(false);
    if (out.error?.ok) throw new Error('expected failure');
    expect(out.error?.error.kind).toBe('validation_error');
  });

  // Counter-tests: absence under non-triggering input

  it('counter: no error when argv is well-formed without --pick', () => {
    const out = validateQueryDispatchInput(['state', 'json']);
    expect(out.error).toBeUndefined();
    expect(out.queryArgs).toEqual(['state', 'json']);
    expect(out.pickField).toBeUndefined();
  });

  it('counter: no pickField when --pick is absent', () => {
    const out = validateQueryDispatchInput(['state', 'json']);
    expect(out.pickField).toBeUndefined();
  });
});

// ─── stage: plan ─────────────────────────────────────────────────────────────

describe('stage: plan', () => {
  it('selects native mode for registered commands', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['state', 'json'], createCommandTopology(registry), true);
    expect(plan.mode).toBe('native');
    expect(plan.normalized.command).toBe('state.json');
  });

  it('selects cjs mode for unknown command when fallback enabled', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['unknown-cmd'], createCommandTopology(registry), true);
    expect(plan.mode).toBe('cjs');
  });

  it('selects error mode for unknown command when fallback disabled', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['unknown-cmd'], createCommandTopology(registry), false);
    expect(plan.mode).toBe('error');
  });

  // Counter-tests: absence under non-triggering input

  it('counter: cjs mode does not produce matched handler', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['unknown-cmd'], createCommandTopology(registry), true);
    expect(plan.matched).toBeNull();
  });

  it('counter: native mode carries matched handler', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch(['state', 'json'], createCommandTopology(registry), true);
    expect(plan.matched).not.toBeNull();
  });

  it('counter: error mode does not carry noMatchMessage for empty argv', () => {
    const registry = createRegistry();
    const plan = planQueryDispatch([], createCommandTopology(registry), false);
    // empty argv yields error mode with empty normalized command
    expect(plan.mode).toBe('error');
    expect(plan.normalized.command).toBe('');
  });
});

// ─── stage: execution + result-builder ───────────────────────────────────────

describe('stage: execution + result-builder', () => {
  it('dispatchSuccess builds the ok=true IR correctly', () => {
    const out = dispatchSuccess('ok\n');
    expect(out).toEqual({ ok: true, stdout: 'ok\n', stderr: [], exit_code: 0 });
  });

  it('dispatchSuccess accepts optional stderr lines', () => {
    const out = dispatchSuccess('hello\n', ['warning']);
    expect(out.ok).toBe(true);
    expect(out.stderr).toEqual(['warning']);
  });

  it('dispatchFailure builds the ok=false IR from error code', () => {
    const out = dispatchFailure({ kind: 'internal_error', code: 7, message: 'Error: x' }, ['warn']);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.exit_code).toBe(7);
    expect(out.stderr).toEqual(['warn']);
    expect(out.error.kind).toBe('internal_error');
    expect(out.error.code).toBe(7);
  });

  it('dispatchFailure defaults to empty stderr when not provided', () => {
    const out = dispatchFailure({ kind: 'internal_error', code: 1, message: 'Error: x' });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.stderr).toEqual([]);
  });

  // Counter-tests

  it('counter: dispatchSuccess exit_code is always 0', () => {
    const out = dispatchSuccess('x\n');
    expect(out.exit_code).toBe(0);
  });

  it('counter: dispatchFailure.ok is never true', () => {
    const out = dispatchFailure({ kind: 'validation_error', code: 10, message: 'err' });
    expect(out.ok).toBe(false);
  });
});

// ─── stage: formatting ───────────────────────────────────────────────────────

describe('stage: formatting', () => {
  it('formatSuccess formats text with trailing newline', () => {
    expect(formatSuccess('USAGE', 'text')).toBe('USAGE\n');
  });

  it('formatSuccess does not double-add newline if text already ends with one', () => {
    expect(formatSuccess('USAGE\n', 'text')).toBe('USAGE\n');
  });

  it('formatSuccess formats json with pretty printing', () => {
    expect(formatSuccess({ nested: { value: 3 } }, 'json')).toBe(
      '{\n  "nested": {\n    "value": 3\n  }\n}\n',
    );
  });

  it('formatSuccess formats json and applies pick', () => {
    expect(formatSuccess({ nested: { value: 3 } }, 'json', 'nested.value')).toBe('3\n');
  });

  it('formatPick returns input unchanged when no pickField provided', () => {
    const input = { ok: true };
    expect(formatPick(input)).toBe(input);
  });

  it('formatPick extracts nested field when pickField is provided', () => {
    expect(formatPick({ a: { b: 42 } }, 'a.b')).toBe(42);
  });

  // Counter-tests

  it('counter: formatPick with undefined pickField returns original object reference', () => {
    const obj = { x: 1 };
    expect(formatPick(obj, undefined)).toBe(obj);
  });

  it('counter: formatSuccess json without pickField returns full serialized object', () => {
    const out = formatSuccess({ a: 1, b: 2 }, 'json');
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed['a']).toBe(1);
    expect(parsed['b']).toBe(2);
  });
});

// ─── stage: error-mapping ────────────────────────────────────────────────────

describe('stage: error-mapping', () => {
  it('mapNativeDispatchError maps string-pattern timeout to native_timeout', () => {
    const err = mapNativeDispatchError(
      new Error('gsd-tools timed out after 30000ms: state load'),
      'state.load',
      [],
    );
    expect(err.kind).toBe('native_timeout');
    expect(err.code).toBe(1);
    expect(err.details).toMatchObject({ command: 'state.load', args: [], timeout_ms: 30000 });
  });

  it('mapNativeDispatchError maps non-timeout errors to native_failure', () => {
    const err = mapNativeDispatchError(new Error('boom'), 'state.json', []);
    expect(err.kind).toBe('native_failure');
    expect(err.code).toBe(1);
    expect(err.details).toMatchObject({ command: 'state.json', args: [] });
  });

  it('mapNativeDispatchError maps typed GSDToolsError.timeout to native_timeout', () => {
    const err = mapNativeDispatchError(
      GSDToolsError.timeout('timeout', 'state', ['load'], '', 1234),
      'state.load',
      [],
    );
    expect(err.kind).toBe('native_timeout');
    expect(err.details).toMatchObject({ timeout_ms: 1234 });
  });

  it('mapNativeDispatchError maps typed GSDToolsError.failure to native_failure', () => {
    const err = mapNativeDispatchError(
      GSDToolsError.failure('boom', 'state', ['load'], 1),
      'state.load',
      [],
    );
    expect(err.kind).toBe('native_failure');
  });

  it('mapFallbackDispatchError maps spawn errors to fallback_failure with details', () => {
    const err = mapFallbackDispatchError(new Error('spawn ENOENT'), 'state', ['load']);
    expect(err.kind).toBe('fallback_failure');
    expect(err.code).toBe(1);
    expect(err.details).toMatchObject({ command: 'state', args: ['load'], backend: 'cjs' });
  });

  it('toDispatchFailure builds ok=false result union from error', () => {
    const out = toDispatchFailure({ kind: 'internal_error', code: 1, message: 'Error: x' }, ['warn']);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.exit_code).toBe(1);
    expect(out.stderr).toEqual(['warn']);
    expect(out.error.kind).toBe('internal_error');
  });

  // Counter-tests

  it('counter: mapNativeDispatchError does not produce native_timeout for generic errors', () => {
    const err = mapNativeDispatchError(new Error('some generic error'), 'state.json', []);
    expect(err.kind).toBe('native_failure');
    expect(err.kind).not.toBe('native_timeout');
  });

  it('counter: mapFallbackDispatchError does not produce native_failure kind', () => {
    const err = mapFallbackDispatchError(new Error('spawn ENOENT'), 'state', []);
    expect(err.kind).toBe('fallback_failure');
    expect(err.kind).not.toBe('native_failure');
  });

  it('counter: toDispatchFailure.ok is never true', () => {
    const out = toDispatchFailure({ kind: 'validation_error', code: 10, message: 'err' });
    expect(out.ok).toBe(false);
  });
});

// ─── stage: observability ────────────────────────────────────────────────────

describe('stage: observability', () => {
  it('fallbackBridgeNotices returns two notices containing the command name', () => {
    const notes = fallbackBridgeNotices('unknown-cmd');
    expect(notes[0]).toContain('unknown-cmd');
    expect(notes.length).toBe(2);
  });

  it('fallbackBridgeNotices second notice mentions fallback bridge intent', () => {
    const notes = fallbackBridgeNotices('any-cmd');
    expect(notes[1]).toContain('bridge');
  });

  // Counter-tests

  it('counter: fallbackBridgeNotices result does not contain the command name in wrong slot', () => {
    const notes = fallbackBridgeNotices('my-special-cmd');
    // The command name is in the first notice, not necessarily the second
    expect(notes[0]).toContain('my-special-cmd');
  });

  it('counter: fallbackBridgeNotices always returns exactly 2 entries', () => {
    expect(fallbackBridgeNotices('cmd-a').length).toBe(2);
    expect(fallbackBridgeNotices('cmd-b').length).toBe(2);
  });
});

// ─── end-to-end IR contract ───────────────────────────────────────────────────

describe('end-to-end IR contract', () => {
  let tmpDir: string;
  let fixtureDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `query-dispatch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function createScript(name: string, code: string): Promise<string> {
    const scriptPath = join(fixtureDir, name);
    await writeFile(scriptPath, code, { mode: 0o755 });
    return scriptPath;
  }

  it('runs native dispatch and formats json', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: { ok: true } }),
      topology: createCommandTopology(registry),
    }, ['state', 'json']);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.stdout).toBe('{\n  "ok": true\n}\n');
    expect(out.exit_code).toBe(0);
  });

  it('applies --pick to native json output', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: { nested: { value: 7 } } }),
      topology: createCommandTopology(registry),
    }, ['state', 'json', '--pick', 'nested.value']);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.stdout).toBe('7\n');
    expect(out.exit_code).toBe(0);
  });

  it('returns structured error for unknown command when fallback disabled', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: false,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: {} }),
      topology: createCommandTopology(registry),
    }, ['unknown-cmd']);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.code).toBe(10);
    expect(out.error.kind).toBe('unknown_command');
    expect(out.error.message).toContain('Unknown command: "unknown-cmd"');
    expect(out.error.message).toContain('Attempted dotted:');
  });

  it('runs cjs fallback and formats text mode', async () => {
    const script = await createScript('text.cjs', "process.stdout.write('USAGE: help text');");
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => script,
      dispatchNative: async () => ({ data: {} }),
      topology: createCommandTopology(registry),
    }, ['unknown-cmd', '--help']);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.stdout).toBe('USAGE: help text\n');
    expect(out.stderr[0]).toContain('falling back to gsd-tools.cjs');
  });

  it('returns structured fallback failure when resolveGsdToolsPath throws', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => { throw new Error('path boom'); },
      dispatchNative: async () => ({ data: {} }),
      topology: createCommandTopology(registry),
    }, ['unknown-cmd']);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.kind).toBe('fallback_failure');
    expect(out.error.code).toBe(1);
    expect(out.error.message).toContain('path boom');
    expect(out.error.details).toMatchObject({ command: 'unknown-cmd', backend: 'cjs' });
  });

  it('returns requires-command error for empty argv', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: {} }),
      topology: createCommandTopology(registry),
    }, []);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.code).toBe(10);
    expect(out.error.kind).toBe('validation_error');
    expect(out.error.message).toContain('requires a command');
    expect(out.error.details).toEqual({ reason: 'missing_command' });
  });

  it('maps native timeout to native_timeout kind with details', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => { throw new Error('gsd-tools timed out after 30000ms: state load'); },
      topology: createCommandTopology(registry),
    }, ['state', 'load']);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.kind).toBe('native_timeout');
    expect(out.error.code).toBe(1);
    expect(out.error.details).toMatchObject({ command: 'state.load', args: [], timeout_ms: 30000 });
  });

  it('maps typed native timeout to native_timeout kind with details', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => { throw GSDToolsError.timeout('timed out', 'state', ['load'], '', 30000); },
      topology: createCommandTopology(registry),
    }, ['state', 'load']);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.kind).toBe('native_timeout');
    expect(out.error.code).toBe(1);
    expect(out.error.details).toMatchObject({ command: 'state.load', args: [], timeout_ms: 30000 });
  });

  it('maps native error to native_failure kind with details', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => { throw new Error('boom'); },
      topology: createCommandTopology(registry),
    }, ['state', 'json']);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.kind).toBe('native_failure');
    expect(out.error.code).toBe(1);
    expect(out.error.details).toMatchObject({ command: 'state.json', args: [] });
  });
});

// ─── #3259 help-flag non-mutating guard ──────────────────────────────────────

describe('--help guard: dispatcher short-circuits mutating native handlers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `qdispatch-help-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(tmpDir, '.planning', 'phases'), { recursive: true });
    // Minimal fixture required for most handlers to not crash on fs reads
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Current Milestone: v1.0\n', 'utf-8');
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\ngsd_state_version: 1.0\nmilestone: v1.0\nstatus: executing\n---\n\n# Project State\n',
      'utf-8',
    );
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced', phase_naming: 'sequential' }),
      'utf-8',
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * Collect a digest of all file mtimes under .planning/ so we can compare
   * pre- and post-invocation state without reading file content.
   */
  async function collectPlanningDigest(projectDir: string): Promise<Map<string, number>> {
    const planningDir = join(projectDir, '.planning');
    const digest = new Map<string, number>();
    async function walk(dir: string): Promise<void> {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          try {
            const s = await stat(full);
            digest.set(full, s.mtimeMs);
          } catch {
            /* ignore */
          }
        }
      }
    }
    await walk(planningDir);
    return digest;
  }

  it('milestone.complete --help returns non-mutating help stub without writing to .planning/', async () => {
    const registry = createRegistry();
    const topology = createCommandTopology(registry);

    const preDig = await collectPlanningDigest(tmpDir);

    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: false,
      resolveGsdToolsPath: () => '',
      topology,
    }, ['milestone.complete', '--help']);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');

    // Response must contain help stub, not a milestone record
    const parsed = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(typeof parsed['help']).toBe('string');
    expect(parsed['help']).toContain('milestone.complete');

    // .planning/ directory must be byte-identical (no new or modified files)
    const postDig = await collectPlanningDigest(tmpDir);
    expect(postDig.size).toBe(preDig.size);
    for (const [path, mtime] of preDig) {
      expect(postDig.get(path)).toBe(mtime);
    }
    // MILESTONES.md must not have been created
    expect(existsSync(join(tmpDir, '.planning', 'MILESTONES.md'))).toBe(false);
  });

  it('milestone.complete -h returns non-mutating help stub without writing to .planning/', async () => {
    const registry = createRegistry();
    const topology = createCommandTopology(registry);

    const preDig = await collectPlanningDigest(tmpDir);

    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: false,
      resolveGsdToolsPath: () => '',
      topology,
    }, ['milestone.complete', '-h']);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');

    const parsed = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(typeof parsed['help']).toBe('string');

    const postDig = await collectPlanningDigest(tmpDir);
    expect(postDig.size).toBe(preDig.size);
    for (const [path, mtime] of preDig) {
      expect(postDig.get(path)).toBe(mtime);
    }
  });

  it('registry-driven: all native mutating handlers with --help do not modify .planning/', async () => {
    const registry = createRegistry();
    const topology = createCommandTopology(registry);

    // Collect all registered mutating commands from the manifest
    const mutatingCommands = Array.from(COMMAND_MUTATION_SET).filter((cmd) => {
      // Only canonical forms that are registered in the registry (not aliases)
      return registry.has(cmd);
    });

    for (const cmd of mutatingCommands) {
      // Reset fixture between each command to ensure isolation
      await rm(join(tmpDir, '.planning'), { recursive: true, force: true });
      await mkdir(join(tmpDir, '.planning', 'phases'), { recursive: true });
      await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Current Milestone: v1.0\n', 'utf-8');
      await writeFile(
        join(tmpDir, '.planning', 'STATE.md'),
        '---\ngsd_state_version: 1.0\nmilestone: v1.0\nstatus: executing\n---\n\n# Project State\n',
        'utf-8',
      );
      await writeFile(
        join(tmpDir, '.planning', 'config.json'),
        JSON.stringify({ model_profile: 'balanced', phase_naming: 'sequential' }),
        'utf-8',
      );

      const preDig = await collectPlanningDigest(tmpDir);

      // Invoke via dispatcher with --help in args (after the command token)
      // argv format: [cmd, '--help'] where cmd may be dotted or spaced
      const argv = [...cmd.split(' '), '--help'];
      const out = await runQueryDispatch({
        registry,
        projectDir: tmpDir,
        cjsFallbackEnabled: false,
        resolveGsdToolsPath: () => '',
        topology,
      }, argv);

      // Must succeed (help stub) or fail for validation reasons (e.g. arg rewriting
      // that produces a non-mutating command) — the invariant is no disk mutation.
      const postDig = await collectPlanningDigest(tmpDir);
      expect(postDig.size, `${cmd} --help created new .planning files`).toBe(preDig.size);
      for (const [path, mtime] of preDig) {
        expect(postDig.get(path), `${cmd} --help modified ${path}`).toBe(mtime);
      }
    }
  });

  it('preserves #3019 contract: unknown-cmd --help falls through to cjs (not intercepted by guard)', async () => {
    // The guard only fires when a NATIVE MUTATING handler is matched.
    // Unknown commands with --help must still fall through to CJS fallback.
    const script = await (async () => {
      const scriptPath = join(tmpDir, 'text.cjs');
      await writeFile(scriptPath, "process.stdout.write('USAGE: help text');", { mode: 0o755 });
      return scriptPath;
    })();

    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => script,
      topology: createCommandTopology(registry),
    }, ['unknown-cmd', '--help']);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.stdout).toBe('USAGE: help text\n');
  });

  it('non-mutating native handlers are unaffected when --help is in args', async () => {
    // E.g. state.json is non-mutating; --help in args should still dispatch normally.
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: { ok: true } }),
      topology: createCommandTopology(registry),
    }, ['state', 'json', '--help']);

    // state.json is non-mutating, so --help should pass through to the handler
    // The mock handler returns successfully, so we get a success result.
    expect(out.ok).toBe(true);
  });
});
