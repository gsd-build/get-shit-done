/**
 * Tests for --ws (workstream) flag support.
 *
 * Validates:
 * - CLI parsing of --ws flag
 * - Workstream name validation
 * - GSDOptions.workstream propagation
 * - GSDTools workstream-aware invocation
 * - Config path resolution with workstream
 * - ContextEngine workstream-aware planning dir
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ─── Workstream name validation ─────────────────────────────────────────────

import { validateWorkstreamName } from './workstream-utils.js';

describe('validateWorkstreamName', () => {
  it('accepts alphanumeric names', () => {
    expect(validateWorkstreamName('frontend')).toBe(true);
    expect(validateWorkstreamName('backend2')).toBe(true);
  });

  it('accepts names with hyphens', () => {
    expect(validateWorkstreamName('my-feature')).toBe(true);
  });

  it('accepts names with underscores', () => {
    expect(validateWorkstreamName('my_feature')).toBe(true);
  });

  it('accepts names with dots', () => {
    expect(validateWorkstreamName('v1.0')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(validateWorkstreamName('')).toBe(false);
  });

  it('rejects names with spaces', () => {
    expect(validateWorkstreamName('my feature')).toBe(false);
  });

  it('rejects names with slashes', () => {
    expect(validateWorkstreamName('my/feature')).toBe(false);
  });

  it('rejects names with special characters', () => {
    expect(validateWorkstreamName('feat@ure')).toBe(false);
    expect(validateWorkstreamName('feat!ure')).toBe(false);
    expect(validateWorkstreamName('feat#ure')).toBe(false);
  });

  it('rejects path traversal attempts', () => {
    expect(validateWorkstreamName('..')).toBe(false);
    expect(validateWorkstreamName('../etc')).toBe(false);
  });
});

// ─── relPlanningPath helper ─────────────────────────────────────────────────

import { relPlanningPath } from './workstream-utils.js';

describe('relPlanningPath', () => {
  it('returns .planning/ in flat mode (no workstream)', () => {
    expect(relPlanningPath()).toBe('.planning');
    expect(relPlanningPath(undefined)).toBe('.planning');
  });

  it('returns .planning/workstreams/<name>/ with workstream', () => {
    expect(relPlanningPath('frontend')).toBe('.planning/workstreams/frontend');
    expect(relPlanningPath('api-v2')).toBe('.planning/workstreams/api-v2');
  });
});

// ─── CLI --ws flag parsing ──────────────────────────────────────────────────

import { parseCliArgs } from './cli.js';

describe('parseCliArgs --ws flag', () => {
  it('parses --ws flag', () => {
    const result = parseCliArgs(['run', 'build auth', '--ws', 'frontend']);

    expect(result.ws).toBe('frontend');
  });

  it('ws is undefined when not provided', () => {
    const result = parseCliArgs(['run', 'build auth']);

    expect(result.ws).toBeUndefined();
  });

  it('works with other flags', () => {
    const result = parseCliArgs([
      'run', 'build auth',
      '--ws', 'backend',
      '--model', 'claude-sonnet-4-6',
      '--project-dir', '/tmp/test',
    ]);

    expect(result.ws).toBe('backend');
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.projectDir).toBe('/tmp/test');
  });
});

// ─── GSDOptions.workstream ──────────────────────────────────────────────────

describe('GSDOptions.workstream', () => {
  it('GSD class accepts workstream option', async () => {
    // This is a compile-time check -- if the type is wrong, TS will fail
    const { GSD } = await import('./index.js');
    const gsd = new GSD({
      projectDir: '/tmp/test-ws',
      workstream: 'frontend',
    });
    // If we get here without a type error, the option is accepted
    expect(gsd).toBeDefined();
  });
});

// ─── GSDTools workstream injection ──────────────────────────────────────────

describe('GSDTools workstream injection', () => {
  let tmpDir: string;
  let fixtureDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gsd-ws-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir, { recursive: true });
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function createScript(name: string, code: string): Promise<string> {
    const scriptPath = join(fixtureDir, name);
    await writeFile(scriptPath, code, { mode: 0o755 });
    return scriptPath;
  }

  it('passes --ws flag to gsd-tools.cjs when workstream is set', async () => {
    const { GSDTools } = await import('./gsd-tools.js');

    // Script echoes its arguments as JSON
    const scriptPath = await createScript(
      'echo-args.cjs',
      'process.stdout.write(JSON.stringify(process.argv.slice(2)));',
    );

    const tools = new GSDTools({
      projectDir: tmpDir,
      gsdToolsPath: scriptPath,
      workstream: 'frontend',
    });

    const result = await tools.exec('state', ['load']) as string[];

    // Should contain --ws frontend in the arguments
    expect(result).toContain('--ws');
    expect(result).toContain('frontend');
  });

  it('does not pass --ws when workstream is undefined', async () => {
    const { GSDTools } = await import('./gsd-tools.js');

    const scriptPath = await createScript(
      'echo-args-no-ws.cjs',
      'process.stdout.write(JSON.stringify(process.argv.slice(2)));',
    );

    const tools = new GSDTools({
      projectDir: tmpDir,
      gsdToolsPath: scriptPath,
    });

    const result = await tools.exec('state', ['load']) as string[];

    expect(result).not.toContain('--ws');
  });
});

// ─── Config workstream-aware path ───────────────────────────────────────────

import { loadConfig } from './config.js';

describe('loadConfig with workstream', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gsd-config-ws-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('loads config from workstream path when workstream is provided', async () => {
    const wsDir = join(tmpDir, '.planning', 'workstreams', 'frontend');
    await mkdir(wsDir, { recursive: true });
    await writeFile(
      join(wsDir, 'config.json'),
      JSON.stringify({ model_profile: 'performance' }),
    );

    const config = await loadConfig(tmpDir, 'frontend');

    expect(config.model_profile).toBe('performance');
  });

  it('falls back to root config when workstream config is missing', async () => {
    // Create root config but no workstream config
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );

    const config = await loadConfig(tmpDir, 'frontend');

    expect(config.model_profile).toBe('balanced');
  });

  it('loads from root .planning/ when workstream is undefined', async () => {
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'economy' }),
    );

    const config = await loadConfig(tmpDir);

    expect(config.model_profile).toBe('economy');
  });
});

// ─── ContextEngine workstream-aware planning dir ────────────────────────────

describe('ContextEngine with workstream', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gsd-ctx-ws-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('resolves files from workstream planning dir', async () => {
    const { ContextEngine } = await import('./context-engine.js');
    const { PhaseType } = await import('./types.js');

    const wsDir = join(tmpDir, '.planning', 'workstreams', 'backend');
    await mkdir(wsDir, { recursive: true });
    await writeFile(join(wsDir, 'STATE.md'), '# State\nPhase: 01');

    const engine = new ContextEngine(tmpDir, undefined, undefined, 'backend');
    const files = await engine.resolveContextFiles(PhaseType.Execute);

    expect(files.state).toContain('Phase: 01');
  });

  it('resolves files from root .planning/ without workstream', async () => {
    const { ContextEngine } = await import('./context-engine.js');
    const { PhaseType } = await import('./types.js');

    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\nPhase: 02');

    const engine = new ContextEngine(tmpDir);
    const files = await engine.resolveContextFiles(PhaseType.Execute);

    expect(files.state).toContain('Phase: 02');
  });
});
