/**
 * Unit tests for template.ts — templateSelect and templateFill handlers.
 *
 * Also tests event emission wiring in createRegistry.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { templateSelect, templateFill } from './template.js';
import { createRegistry } from './index.js';
import { GSDEventStream } from '../event-stream.js';
import { GSDEventType } from '../types.js';
import type { GSDEvent } from '../types.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = join(tmpdir(), `gsd-template-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(tmpDir, '.planning', 'phases', '09-foundation'), { recursive: true });
  // Create minimal STATE.md
  await writeFile(join(tmpDir, '.planning', 'STATE.md'), '---\nstatus: executing\n---\n\n# Project State\n');
  // Create minimal config.json
  await writeFile(join(tmpDir, '.planning', 'config.json'), '{}');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('templateSelect', () => {
  it('returns "plan" as default when phase dir has no plans', async () => {
    const result = await templateSelect([], tmpDir);
    expect((result.data as Record<string, unknown>).template).toBe('plan');
  });

  it('returns "summary" when PLAN exists but no SUMMARY', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '09-foundation');
    await writeFile(join(phaseDir, '09-01-PLAN.md'), '---\nphase: 09\n---\n# Plan');
    const result = await templateSelect(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.template).toBe('summary');
  });

  it('returns "verification" when all plans have summaries', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '09-foundation');
    await writeFile(join(phaseDir, '09-01-PLAN.md'), '---\nphase: 09\n---\n# Plan');
    await writeFile(join(phaseDir, '09-01-SUMMARY.md'), '---\nphase: 09\n---\n# Summary');
    const result = await templateSelect(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.template).toBe('verification');
  });

  it('returns "plan" when phase dir not found', async () => {
    const result = await templateSelect(['99'], tmpDir);
    expect((result.data as Record<string, unknown>).template).toBe('plan');
  });
});

describe('templateFill', () => {
  it('creates summary file with expected frontmatter fields', async () => {
    const outPath = join(tmpDir, 'test-summary.md');
    const result = await templateFill(['summary', outPath], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.created).toBe(true);

    const content = await readFile(outPath, 'utf-8');
    expect(content).toContain('phase:');
    expect(content).toContain('plan:');
    expect(content).toContain('subsystem:');
    expect(content).toContain('tags:');
    expect(content).toContain('## Performance');
    expect(content).toContain('## Accomplishments');
  });

  it('creates plan file with plan frontmatter skeleton', async () => {
    const outPath = join(tmpDir, 'test-plan.md');
    const result = await templateFill(['plan', outPath], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.created).toBe(true);

    const content = await readFile(outPath, 'utf-8');
    expect(content).toContain('type: execute');
    expect(content).toContain('wave: 1');
    expect(content).toContain('autonomous: true');
    expect(content).toContain('<objective>');
    expect(content).toContain('<tasks>');
  });

  it('creates verification file with verification skeleton', async () => {
    const outPath = join(tmpDir, 'test-verification.md');
    const result = await templateFill(['verification', outPath], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.created).toBe(true);

    const content = await readFile(outPath, 'utf-8');
    expect(content).toContain('status: pending');
    expect(content).toContain('## Must-Have Checks');
    expect(content).toContain('## Result');
  });

  it('applies key=value overrides to frontmatter', async () => {
    const outPath = join(tmpDir, 'test-override.md');
    const result = await templateFill(['summary', outPath, 'phase=11-testing', 'plan=02'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.created).toBe(true);

    const content = await readFile(outPath, 'utf-8');
    expect(content).toContain('phase: 11-testing');
    expect(content).toContain('plan: 02');
  });

  it('rejects path traversal attempts with .. segments', async () => {
    const outPath = join(tmpDir, '..', 'escape.md');
    await expect(templateFill(['summary', outPath], tmpDir)).rejects.toThrow();
  });
});

describe('event emission wiring', () => {
  it('emits StateMutation event for state.update dispatch', async () => {
    // Create a proper STATE.md for state.update to work with
    const stateContent = [
      '---',
      'status: executing',
      '---',
      '',
      '# Project State',
      '',
      '## Current Position',
      '',
      'Status: Ready',
    ].join('\n');
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), stateContent);

    const eventStream = new GSDEventStream();
    const events: GSDEvent[] = [];
    eventStream.on('event', (e: GSDEvent) => events.push(e));

    const registry = createRegistry(eventStream, 'corr-xyz');
    await registry.dispatch('state.update', ['status', 'Executing'], tmpDir);

    const mutationEvents = events.filter(e => e.type === GSDEventType.StateMutation);
    expect(mutationEvents.length).toBe(1);
    const evt = mutationEvents[0] as { type: string; command: string; success: boolean; sessionId?: string };
    expect(evt.command).toBe('state.update');
    expect(evt.success).toBe(true);
    expect(evt.sessionId).toBe('corr-xyz');
  });

  it('emits ConfigMutation event for config-set dispatch', async () => {
    await writeFile(join(tmpDir, '.planning', 'config.json'), '{"model_profile":"balanced"}');

    const eventStream = new GSDEventStream();
    const events: GSDEvent[] = [];
    eventStream.on('event', (e: GSDEvent) => events.push(e));

    const registry = createRegistry(eventStream);
    await registry.dispatch('config-set', ['model_profile', 'quality'], tmpDir);

    const mutationEvents = events.filter(e => e.type === GSDEventType.ConfigMutation);
    expect(mutationEvents.length).toBe(1);
    const evt = mutationEvents[0] as { type: string; command: string; success: boolean };
    expect(evt.command).toBe('config-set');
    expect(evt.success).toBe(true);
  });

  it('emits TemplateFill event for template.fill dispatch', async () => {
    const outPath = join(tmpDir, 'event-test.md');
    const eventStream = new GSDEventStream();
    const events: GSDEvent[] = [];
    eventStream.on('event', (e: GSDEvent) => events.push(e));

    const registry = createRegistry(eventStream);
    await registry.dispatch('template.fill', ['summary', outPath], tmpDir);

    const templateEvents = events.filter(e => e.type === GSDEventType.TemplateFill);
    expect(templateEvents.length).toBe(1);
  });
});
