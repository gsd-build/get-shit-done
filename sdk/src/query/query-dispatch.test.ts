import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { createRegistry } from './index.js';
import { GSDToolsError } from '../gsd-tools-error.js';
import { runQueryDispatch } from './query-dispatch.js';
import { createCommandTopology } from './command-topology.js';
import { COMMAND_MUTATION_SET } from './command-definition.js';
describe('runQueryDispatch', () => {
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
    expect(typeof parsed.help).toBe('string');
    expect(parsed.help).toContain('milestone.complete');

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
    expect(typeof parsed.help).toBe('string');

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
