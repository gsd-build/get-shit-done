import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { checkConfigGates } from './config-gates.js';

function cleanupTempDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

describe('checkConfigGates', () => {
  it('returns merged workflow defaults when config is absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-cg-'));
    try {
      await mkdir(join(dir, '.planning'), { recursive: true });
      const { data } = await checkConfigGates([], dir);
      expect(data).toMatchObject({
        workflow: null,
        research_enabled: true,
        plan_checker_enabled: true,
        nyquist_validation: true,
        ui_phase: true,
        auto_advance: false,
        auto_chain_active: false,
        code_review: true,
        context_window: 200000,
      });
    } finally {
      cleanupTempDir(dir);
    }
  });

  it('treats string "false" as false and honors plan_checker alias', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-cg-'));
    try {
      await mkdir(join(dir, '.planning'), { recursive: true });
      await writeFile(
        join(dir, '.planning', 'config.json'),
        JSON.stringify({
          workflow: {
            nyquist_validation: 'false',
            plan_checker: false,
          },
        }),
        'utf-8',
      );
      const { data } = await checkConfigGates([], dir);
      expect(data.nyquist_validation).toBe(false);
      expect(data.plan_checker_enabled).toBe(false);
      expect(data.plan_check).toBe(false);
    } finally {
      cleanupTempDir(dir);
    }
  });

  it('reflects workflow overrides from config.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-cg-'));
    try {
      await mkdir(join(dir, '.planning'), { recursive: true });
      await writeFile(
        join(dir, '.planning', 'config.json'),
        JSON.stringify({
          workflow: {
            research: false,
            auto_advance: true,
            _auto_chain_active: true,
          },
          context_window: 100000,
        }),
        'utf-8',
      );
      const { data } = await checkConfigGates(['plan-phase'], dir);
      expect(data).toMatchObject({
        workflow: 'plan-phase',
        research_enabled: false,
        auto_advance: true,
        auto_chain_active: true,
        context_window: 100000,
      });
    } finally {
      cleanupTempDir(dir);
    }
  });
});
