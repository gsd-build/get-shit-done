/**
 * Unit tests for `detect.phase-type` (decision-routing audit §3.6).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectPhaseType } from './detect-phase-type.js';

describe('detectPhaseType', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `gsd-detect-phase-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(projectDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('throws when phase arg is missing', async () => {
    await expect(detectPhaseType([], projectDir)).rejects.toThrow();
  });

  it('returns all false/null/[] when phase dir does not exist', async () => {
    const { data } = await detectPhaseType(['99'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.has_frontend).toBe(false);
    expect(d.has_schema).toBe(false);
    expect(d.schema_orm).toBeNull();
    expect(d.schema_files).toEqual([]);
    expect(d.frontend_indicators).toEqual([]);
    expect(d.has_api).toBe(false);
    expect(d.has_infra).toBe(false);
  });

  it('sets has_frontend true when ROADMAP heading contains UI keyword', async () => {
    const roadmapContent = `# Project Roadmap\n\n## Phase 01: UI Dashboard\n\nSome content\n`;
    await writeFile(join(projectDir, '.planning', 'ROADMAP.md'), roadmapContent, 'utf-8');
    await mkdir(join(projectDir, '.planning', 'phases', '01-ui-dashboard'), { recursive: true });

    const { data } = await detectPhaseType(['1'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.has_frontend).toBe(true);
    expect((d.frontend_indicators as string[]).length).toBeGreaterThan(0);
  });

  it('sets has_schema true and schema_orm prisma when prisma schema file found', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '02-database');
    await mkdir(join(phaseDir, 'prisma'), { recursive: true });
    await writeFile(join(phaseDir, 'prisma', 'schema.prisma'), 'model User {}', 'utf-8');

    const { data } = await detectPhaseType(['2'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.has_schema).toBe(true);
    expect(d.schema_orm).toBe('prisma');
    expect((d.schema_files as string[]).length).toBeGreaterThan(0);
  });

  it('sets has_frontend true when UI-SPEC.md is present in phase dir', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '03-features');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, 'UI-SPEC.md'), '# UI Spec', 'utf-8');

    const { data } = await detectPhaseType(['3'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.has_frontend).toBe(true);
  });

  it('sets has_api true when route file found in phase dir', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '04-api');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, 'user.route.ts'), 'export {}', 'utf-8');

    const { data } = await detectPhaseType(['4'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.has_api).toBe(true);
  });

  it('sets has_infra true when docker file found in phase dir', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '05-infra');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, 'dockerfile.yml'), '', 'utf-8');

    const { data } = await detectPhaseType(['5'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.has_infra).toBe(true);
  });

  it('returns push_command null (reserved field)', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '06-misc'), { recursive: true });
    const { data } = await detectPhaseType(['6'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.push_command).toBeNull();
  });

  it('returns correct phase field in output', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '07-test'), { recursive: true });
    const { data } = await detectPhaseType(['7'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.phase).toBe('07');
  });
});
