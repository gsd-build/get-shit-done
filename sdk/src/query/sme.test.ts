/**
 * Unit tests for SME query handlers: smeList, smeDetectProcesses, smeContextBlock.
 *
 * Covers SDK-01 (smeList), SDK-02 (smeDetectProcesses), SDK-03 (smeContextBlock).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { smeList, smeDetectProcesses, smeContextBlock } from './sme.js';

// ─── Shared fixture content ───────────────────────────────────────────────────

const paymentsSmeContent = [
  '---',
  'process_name: payments',
  'last_analyzed_commit: abc123',
  'block_mode: strict',
  'created_date: 2026-04-29',
  'finding_counts:',
  '  blocker: 1',
  '  warning: 2',
  '  watch: 0',
  '---',
  '',
  '# payments SME Document',
  '',
  '## Process Overview',
  '',
  'Payment processing handles all billing transactions.',
  '',
  '## Identified Risks',
  '',
  '[BLOCKER] **Race condition in charge**',
  '',
  '## Test Gaps',
  '',
  '[WARNING] **No test for refund edge case**',
  '',
  '## Outdated Logic',
  '',
  '## Edge Cases',
  '',
  '[WARNING] **Zero-amount charge passes validation**',
  '',
  '## Known Blockers',
].join('\n');

const enrollmentSmeContent = [
  '---',
  'process_name: enrollment',
  'last_analyzed_commit: def456',
  'block_mode: soft',
  'created_date: 2026-04-29',
  'finding_counts:',
  '  blocker: 0',
  '  warning: 1',
  '  watch: 2',
  '---',
  '',
  '# enrollment SME Document',
  '',
  '## Process Overview',
  '',
  'Enrollment handles new member sign-up.',
  '',
  '## Identified Risks',
  '',
  '## Test Gaps',
  '',
  '[WARNING] **No test for duplicate enrollment**',
  '',
  '## Outdated Logic',
  '',
  '## Edge Cases',
  '',
  '## Known Blockers',
].join('\n');

// ─── Helper to create test project dir ───────────────────────────────────────

function makeTmpDir(label: string): string {
  return join(tmpdir(), `gsd-sme-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

// ─── smeList ─────────────────────────────────────────────────────────────────

describe('smeList', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = makeTmpDir('list');
    await mkdir(join(projectDir, '.planning', 'smes'), { recursive: true });
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { use_sme_agents: true } }),
      'utf-8',
    );
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('returns { enabled: false, smes: [] } when use_sme_agents is false', async () => {
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { use_sme_agents: false } }),
      'utf-8',
    );
    const { data } = await smeList([], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.enabled).toBe(false);
    expect(d.smes).toEqual([]);
  });

  it('returns { enabled: false, smes: [] } when config.json does not exist', async () => {
    const bareDir = makeTmpDir('list-noconfig');
    await mkdir(join(bareDir, '.planning', 'smes'), { recursive: true });
    try {
      const { data } = await smeList([], bareDir);
      const d = data as Record<string, unknown>;
      expect(d.enabled).toBe(false);
      expect(d.smes).toEqual([]);
    } finally {
      await rm(bareDir, { recursive: true, force: true });
    }
  });

  it('returns { enabled: true, smes: [] } when smes directory does not exist', async () => {
    const noSmesDir = makeTmpDir('list-nosmes');
    await mkdir(join(noSmesDir, '.planning'), { recursive: true });
    await writeFile(
      join(noSmesDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { use_sme_agents: true } }),
      'utf-8',
    );
    try {
      const { data } = await smeList([], noSmesDir);
      const d = data as Record<string, unknown>;
      expect(d.enabled).toBe(true);
      expect(d.smes).toEqual([]);
    } finally {
      await rm(noSmesDir, { recursive: true, force: true });
    }
  });

  it('returns { enabled: true, smes: [] } when smes directory is empty', async () => {
    const { data } = await smeList([], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.enabled).toBe(true);
    expect(d.smes).toEqual([]);
  });

  it('returns sme entries with correct metadata for each *-SME.md file', async () => {
    await writeFile(join(projectDir, '.planning', 'smes', 'payments-SME.md'), paymentsSmeContent, 'utf-8');

    const { data } = await smeList([], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.enabled).toBe(true);
    const smes = d.smes as Array<Record<string, unknown>>;
    expect(smes.length).toBe(1);
    expect(smes[0].file).toBe('payments-SME.md');
    expect(smes[0].process_name).toBe('payments');
    expect(smes[0].block_mode).toBe('strict');
    expect(smes[0].last_analyzed_commit).toBe('abc123');
    const findingCounts = smes[0].finding_counts as Record<string, number>;
    expect(findingCounts.blocker).toBe(1);
    expect(findingCounts.warning).toBe(2);
    expect(findingCounts.watch).toBe(0);
  });

  it('ignores non-SME.md files in smes directory', async () => {
    await writeFile(join(projectDir, '.planning', 'smes', 'payments-SME.md'), paymentsSmeContent, 'utf-8');
    await writeFile(join(projectDir, '.planning', 'smes', 'README.md'), '# readme', 'utf-8');
    await writeFile(join(projectDir, '.planning', 'smes', 'notes.txt'), 'notes', 'utf-8');

    const { data } = await smeList([], projectDir);
    const d = data as Record<string, unknown>;
    const smes = d.smes as Array<Record<string, unknown>>;
    expect(smes.length).toBe(1);
    expect(smes[0].file).toBe('payments-SME.md');
  });

  it('sorts sme entries alphabetically by filename', async () => {
    await writeFile(join(projectDir, '.planning', 'smes', 'payments-SME.md'), paymentsSmeContent, 'utf-8');
    await writeFile(join(projectDir, '.planning', 'smes', 'enrollment-SME.md'), enrollmentSmeContent, 'utf-8');

    const { data } = await smeList([], projectDir);
    const d = data as Record<string, unknown>;
    const smes = d.smes as Array<Record<string, unknown>>;
    expect(smes.length).toBe(2);
    expect(smes[0].file).toBe('enrollment-SME.md');
    expect(smes[1].file).toBe('payments-SME.md');
  });
});

// ─── smeDetectProcesses ───────────────────────────────────────────────────────

describe('smeDetectProcesses', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = makeTmpDir('detect');
    await mkdir(join(projectDir, '.planning', 'smes'), { recursive: true });
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { use_sme_agents: true } }),
      'utf-8',
    );
    await writeFile(join(projectDir, '.planning', 'smes', 'payments-SME.md'), paymentsSmeContent, 'utf-8');
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('returns { enabled: false, matches: [] } when use_sme_agents is false', async () => {
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { use_sme_agents: false } }),
      'utf-8',
    );
    const { data } = await smeDetectProcesses(
      ['--file-paths', 'src/billing/charge.ts', '--goal', 'update payment processing'],
      projectDir,
    );
    const d = data as Record<string, unknown>;
    expect(d.enabled).toBe(false);
    expect(d.matches).toEqual([]);
  });

  it('returns { enabled: true, matches: [] } when smes directory does not exist', async () => {
    const noSmesDir = makeTmpDir('detect-nosmes');
    await mkdir(join(noSmesDir, '.planning'), { recursive: true });
    await writeFile(
      join(noSmesDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { use_sme_agents: true } }),
      'utf-8',
    );
    try {
      const { data } = await smeDetectProcesses(
        ['--file-paths', 'src/billing/charge.ts'],
        noSmesDir,
      );
      const d = data as Record<string, unknown>;
      expect(d.enabled).toBe(true);
      expect(d.matches).toEqual([]);
    } finally {
      await rm(noSmesDir, { recursive: true, force: true });
    }
  });

  it('returns { enabled: true, matches: [] } when no SME process_name matches any file path or keyword', async () => {
    const { data } = await smeDetectProcesses(
      ['--file-paths', 'src/reporting/dashboard.ts', '--goal', 'update dashboard UI'],
      projectDir,
    );
    const d = data as Record<string, unknown>;
    expect(d.enabled).toBe(true);
    expect(d.matches).toEqual([]);
  });

  it('matches a process when a file path contains the process_name (case-insensitive)', async () => {
    const { data } = await smeDetectProcesses(
      ['--file-paths', 'src/PAYMENTS/charge.ts', '--goal', 'update dashboard UI'],
      projectDir,
    );
    const d = data as Record<string, unknown>;
    expect(d.enabled).toBe(true);
    const matches = d.matches as Array<Record<string, unknown>>;
    expect(matches.length).toBe(1);
    expect(matches[0].process_name).toBe('payments');
    expect(matches[0].match_source).toBe('file-path');
  });

  it('matches a process when goal keyword contains the process_name (case-insensitive)', async () => {
    const { data } = await smeDetectProcesses(
      ['--file-paths', 'src/reporting/report.ts', '--goal', 'update PAYMENTS processing flow'],
      projectDir,
    );
    const d = data as Record<string, unknown>;
    const matches = d.matches as Array<Record<string, unknown>>;
    expect(matches.length).toBe(1);
    expect(matches[0].process_name).toBe('payments');
    expect(matches[0].match_source).toBe('keyword');
  });

  it('returns matched process metadata with file, process_name, block_mode, match_source', async () => {
    const { data } = await smeDetectProcesses(
      ['--file-paths', 'src/billing/payments/charge.ts', '--goal', 'update billing flow'],
      projectDir,
    );
    const d = data as Record<string, unknown>;
    const matches = d.matches as Array<Record<string, unknown>>;
    expect(matches.length).toBe(1);
    const match = matches[0];
    expect(match.file).toBe('payments-SME.md');
    expect(match.process_name).toBe('payments');
    expect(match.block_mode).toBe('strict');
    expect(match.match_source).toBeDefined();
  });

  it('does not return duplicate matches when process matches both file path and keyword', async () => {
    const { data } = await smeDetectProcesses(
      ['--file-paths', 'src/billing/payments/charge.ts', '--goal', 'update payments processing'],
      projectDir,
    );
    const d = data as Record<string, unknown>;
    const matches = d.matches as Array<Record<string, unknown>>;
    expect(matches.length).toBe(1);
    expect(matches[0].match_source).toBe('both');
  });
});

// ─── smeContextBlock ─────────────────────────────────────────────────────────

describe('smeContextBlock', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = makeTmpDir('context');
    await mkdir(join(projectDir, '.planning', 'smes'), { recursive: true });
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { use_sme_agents: true } }),
      'utf-8',
    );
    await writeFile(join(projectDir, '.planning', 'smes', 'payments-SME.md'), paymentsSmeContent, 'utf-8');
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('throws GSDError(Validation) when process name argument is missing', async () => {
    await expect(smeContextBlock([], projectDir)).rejects.toThrow();
  });

  it('returns { enabled: false, found: false, process, block: "" } when use_sme_agents is false', async () => {
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { use_sme_agents: false } }),
      'utf-8',
    );
    const { data } = await smeContextBlock(['payments'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.enabled).toBe(false);
    expect(d.found).toBe(false);
    expect(d.process).toBe('payments');
    expect(d.block).toBe('');
  });

  it('returns { found: false, process, block: "" } when no SME file exists for the given process name', async () => {
    const { data } = await smeContextBlock(['nonexistent'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.found).toBe(false);
    expect(d.process).toBe('nonexistent');
    expect(d.block).toBe('');
  });

  it('returns { found: true, process, block } with full document content wrapped in XML when SME exists', async () => {
    const { data } = await smeContextBlock(['payments'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.found).toBe(true);
    expect(d.process).toBe('payments');
    const block = d.block as string;
    expect(block).toContain('<sme_context');
    expect(block).toContain('</sme_context>');
    expect(block).toContain('payments');
  });

  it('the XML block includes the process_name and block_mode as attributes', async () => {
    const { data } = await smeContextBlock(['payments'], projectDir);
    const d = data as Record<string, unknown>;
    const block = d.block as string;
    expect(block).toContain('process="payments"');
    expect(block).toContain('block_mode="strict"');
  });
});
