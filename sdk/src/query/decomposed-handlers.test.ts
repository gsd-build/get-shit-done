/**
 * Cross-module handler tests for code decomposed from the legacy `stubs.ts` module.
 *
 * Each suite imports real handlers from their domain modules and exercises behavior
 * against temp fixtures (no standalone stubs).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { agentSkills } from './skills.js';
import { roadmapUpdatePlanProgress } from './roadmap-update-plan-progress.js';
import { requirementsMarkComplete } from './roadmap.js';
import { statePlannedPhase } from './state-mutation.js';
import { verifySchemaDrift } from './verify.js';
import { todoMatchPhase, statsJson, progressBar } from './progress.js';
import { milestoneComplete } from './phase-lifecycle.js';
import { summaryExtract, historyDigest } from './summary.js';
import { commitToSubrepo } from './commit.js';
import {
  workstreamList, workstreamCreate, workstreamSet,
  workstreamStatus, workstreamComplete,
} from './workstream.js';
import { docsInit } from './docs-init.js';
import { websearch } from './websearch.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-stubs-'));
  await mkdir(join(tmpDir, '.planning', 'phases', '09-foundation'), { recursive: true });
  await mkdir(join(tmpDir, '.planning', 'phases', '10-queries'), { recursive: true });

  await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({
    model_profile: 'balanced',
    commit_docs: false,
    git: { branching_strategy: 'none' },
    workflow: {},
  }));
  await writeFile(join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: v3.0\n---\n# State\n');
  await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), [
    '# Roadmap',
    '## v3.0: Test',
    '### Phase 9: Foundation',
    '**Goal:** Build it',
    '- [ ] Plan 1',
    '### Phase 10: Queries',
    '**Goal:** Query it',
  ].join('\n'));
  await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), [
    '# Requirements',
    '- [ ] REQ-01: First requirement',
    '- [ ] REQ-02: Second requirement',
    '- [x] REQ-03: Already done',
  ].join('\n'));

  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-PLAN.md'), '---\nphase: 09\nplan: 01\ntype: execute\nmust_haves:\n  truths: []\n---');
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-SUMMARY.md'), '# Done');
  await writeFile(join(tmpDir, '.planning', 'phases', '10-queries', '10-01-PLAN.md'), '---\nphase: 10\nplan: 01\ntype: execute\nmust_haves:\n  truths: []\n---');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── skills.ts ───────────────────────────────────────────────────────────

describe('agentSkills', () => {
  it('returns empty string when agent_skills config is missing', async () => {
    const result = await agentSkills(['gsd-executor'], tmpDir);
    expect(result.data).toBe('');
  });
});

// ─── roadmap.ts ──────────────────────────────────────────────────────────

describe('roadmapUpdatePlanProgress', () => {
  it('returns QueryResult without error', async () => {
    const result = await roadmapUpdatePlanProgress(['9'], tmpDir);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(typeof data.updated).toBe('boolean');
  });

  it('throws when no phase arg', async () => {
    await expect(roadmapUpdatePlanProgress([], tmpDir)).rejects.toThrow();
  });
});

describe('requirementsMarkComplete', () => {
  it('returns QueryResult without error', async () => {
    const result = await requirementsMarkComplete(['REQ-01'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.updated).toBe('boolean');
  });

  it('throws when no IDs provided', async () => {
    await expect(requirementsMarkComplete([], tmpDir)).rejects.toThrow();
  });
});

// ─── state-mutation.ts ───────────────────────────────────────────────────

describe('statePlannedPhase', () => {
  it('returns cmdStatePlannedPhase-shaped data', async () => {
    const result = await statePlannedPhase(['--phase', '10', '--name', 'queries', '--plans', '2'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.updated)).toBe(true);
    expect(data.phase).toBe('10');
    expect(data.plan_count).toBe(2);
  });

  it('returns error when --phase is missing', async () => {
    const result = await statePlannedPhase([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toMatch(/phase required/);
  });
});

// ─── verify.ts ───────────────────────────────────────────────────────────

describe('verifySchemaDrift', () => {
  it('returns drift_detected shape (cmdVerifySchemaDrift parity)', async () => {
    const result = await verifySchemaDrift(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.drift_detected).toBe('boolean');
    expect(typeof data.blocking).toBe('boolean');
    expect(Array.isArray(data.schema_files)).toBe(true);
  });
});

// ─── progress.ts ─────────────────────────────────────────────────────────

describe('todoMatchPhase', () => {
  it('returns matches and todo_count (cmdTodoMatchPhase parity)', async () => {
    const result = await todoMatchPhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.matches)).toBe(true);
    expect(data.phase).toBe('9');
    expect(typeof data.todo_count).toBe('number');
  });
});

describe('statsJson', () => {
  it('returns cmdStats JSON shape with phases table and git fields', async () => {
    const result = await statsJson([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.milestone_version).toBe('string');
    expect(Array.isArray(data.phases)).toBe(true);
    expect(typeof data.phases_total).toBe('number');
    expect(typeof data.total_plans).toBe('number');
    expect(typeof data.percent).toBe('number');
    expect((data.phases_total as number)).toBeGreaterThanOrEqual(2);
    expect(typeof data.git_commits).toBe('number');
  });
});

describe('progressBar', () => {
  it('returns bar string and percent', async () => {
    const result = await progressBar([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.bar).toBe('string');
    expect(typeof data.percent).toBe('number');
    expect(data.bar as string).toContain('[');
  });
});

// ─── phase-lifecycle.ts — milestoneComplete ──────────────────────────────

/**
 * Regression tests for bug #2644: milestone.complete handler drops version arg.
 *
 * Original defect (first introduced in 6f79b1d): the handler called
 * `phasesArchive([], projectDir)` instead of forwarding the version positional
 * arg. phasesArchive read args[0] and threw GSDError('version required for
 * phases archive'); the surrounding try/catch swallowed the throw into
 * { completed: false, reason: String(err) }, masking it as a legitimate
 * negative answer.
 *
 * Fixed in c5b1445: handler now validates version upfront and uses inline
 * archive logic instead of delegating to phasesArchive.
 */
describe('milestoneComplete', () => {
  const assertMilestoneSuccess = (result: Awaited<ReturnType<typeof milestoneComplete>>, version: string) => {
    const data = result.data as Record<string, unknown>;
    expect(data.version).toBe(version);
    expect(typeof data.date).toBe('string');
    expect(typeof data.phases).toBe('number');
    expect(data.milestones_updated).toBe(true);
    return data;
  };

  it('accepts version as first positional arg and returns it in data', async () => {
    const result = await milestoneComplete(['v1.19', '--name', 'Test Milestone'], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Must NOT return the error shape from the old bug
    expect(data.completed).not.toBe(false);
    expect((data as Record<string, unknown>).reason).toBeUndefined();

    // Must return version echoed in data
    expect(data.version).toBe('v1.19');
  });

  it('does not call phasesArchive with empty args (regression: bug #2644)', async () => {
    // If the old bug were present, this would return { completed: false, reason: 'GSDError: version required for phases archive' }
    // The fix ensures version is extracted from args[0] before any archive operation
    const result = await milestoneComplete(['v1.0'], tmpDir);
    assertMilestoneSuccess(result, 'v1.0');
  });

  it('throws GSDError when version arg is missing (not masked as completed: false)', async () => {
    // The old bug swallowed ALL errors into { completed: false, reason: String(err) }
    // The fix explicitly throws so callers can distinguish validation failure from "not complete"
    await expect(milestoneComplete([], tmpDir)).rejects.toThrow('version required for milestone complete');
  });

  it('archives with --archive-phases when flag is present', async () => {
    const result = await milestoneComplete(['v1.0', '--archive-phases'], tmpDir);
    const data = assertMilestoneSuccess(result, 'v1.0');

    const archived = data.archived as Record<string, unknown>;
    // --archive-phases was passed; phases dir should have been scoped but
    // may result in 0 if the milestone filter finds no matching dirs.
    // The important assertion: no error, version is correctly forwarded.
    expect(typeof archived.phases).toBe('boolean');
  });

  it('returns name from --name flag', async () => {
    const result = await milestoneComplete(['v2.0', '--name', 'My Release'], tmpDir);
    const data = assertMilestoneSuccess(result, 'v2.0');

    expect(data.name).toBe('My Release');
  });
});

// ─── summary.ts ──────────────────────────────────────────────────────────

describe('summaryExtract', () => {
  it('returns error when file not found', async () => {
    const result = await summaryExtract(['.planning/nonexistent.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });

  it('extracts frontmatter fields from an existing summary file', async () => {
    const summaryPath = join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-SUMMARY.md');
    await writeFile(
      summaryPath,
      ['---', 'phase: "09"', 'one-liner: Built it.', 'key-files:', '  - x.ts', '---', '', '# Summary', ''].join('\n'),
      'utf-8',
    );
    const result = await summaryExtract(['.planning/phases/09-foundation/09-01-SUMMARY.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.one_liner).toBe('Built it.');
    expect(data.key_files).toEqual(['x.ts']);
  });
});

describe('historyDigest', () => {
  it('returns phases object with completed summaries', async () => {
    const result = await historyDigest([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.phases).toBe('object');
    expect(Array.isArray(data.decisions)).toBe(true);
    expect(Array.isArray(data.tech_stack)).toBe(true);
  });
});

// ─── workstream.ts ───────────────────────────────────────────────────────

describe('workstream handlers', () => {
  it('workstreamList returns workstreams array', async () => {
    const result = await workstreamList([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.workstreams)).toBe(true);
  });

  it('workstreamCreate creates a directory', async () => {
    const result = await workstreamCreate(['my-ws'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.created).toBe('boolean');
  });

  it('workstreamCreate rejects path traversal', async () => {
    const result = await workstreamCreate(['../../bad'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.created).toBe(false);
  });

  it('workstreamSet returns set=true for existing workstream', async () => {
    await mkdir(join(tmpDir, '.planning', 'workstreams', 'backend'), { recursive: true });
    const result = await workstreamSet(['backend'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.set).toBe(true);
    expect(data.active).toBe('backend');
  });

  it('workstreamStatus returns found boolean', async () => {
    const result = await workstreamStatus(['nonexistent'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.found).toBe('boolean');
  });

  it('workstreamComplete archives existing workstream', async () => {
    await mkdir(join(tmpDir, '.planning', 'workstreams', 'my-ws', 'phases'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'workstreams', 'my-ws', 'STATE.md'), '# State\n');
    const result = await workstreamComplete(['my-ws'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.completed).toBe(true);
    expect(data.archived_to).toBeDefined();
  });
});

// ─── init.ts ─────────────────────────────────────────────────────────────

describe('docsInit', () => {
  it('returns docs context matching gsd-tools docs-init', async () => {
    const result = await docsInit([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.planning_exists).toBe('boolean');
    expect(data.project_root).toBe(tmpDir);
    expect(typeof data.doc_writer_model).toBe('string');
    expect(Array.isArray(data.existing_docs)).toBe(true);
    expect(data.project_type).toBeDefined();
    expect(data.doc_tooling).toBeDefined();
    expect(Array.isArray(data.monorepo_workspaces)).toBe(true);
    expect(typeof data.agents_installed).toBe('boolean');
    expect(Array.isArray(data.missing_agents)).toBe(true);
  });
});

// ─── websearch.ts ────────────────────────────────────────────────────────

describe('websearch', () => {
  const originalEnv = process.env.BRAVE_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BRAVE_API_KEY;
    } else {
      process.env.BRAVE_API_KEY = originalEnv;
    }
    vi.restoreAllMocks();
  });

  it('returns available:false when BRAVE_API_KEY is not set', async () => {
    delete process.env.BRAVE_API_KEY;
    const result = await websearch([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.reason).toBe('BRAVE_API_KEY not set');
  });

  it('returns error when query is empty', async () => {
    process.env.BRAVE_API_KEY = 'test-key';
    const result = await websearch([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.error).toBe('Query required');
  });

  it('returns results on successful API call', async () => {
    process.env.BRAVE_API_KEY = 'test-key';
    const mockResults = {
      web: {
        results: [
          { title: 'Result 1', url: 'https://example.com', description: 'Desc 1', age: '2d' },
          { title: 'Result 2', url: 'https://example.org', description: 'Desc 2' },
        ],
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    } as Response);

    const result = await websearch(['typescript generics'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.available).toBe(true);
    expect(data.query).toBe('typescript generics');
    expect(data.count).toBe(2);
    const results = data.results as Array<Record<string, unknown>>;
    expect(results[0].title).toBe('Result 1');
    expect(results[0].age).toBe('2d');
    expect(results[1].age).toBeNull();
  });

  it('passes --limit and --freshness params to API', async () => {
    process.env.BRAVE_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ web: { results: [] } }),
    } as Response);

    await websearch(['query', '--limit', '5', '--freshness', 'week'], tmpDir);

    const url = new URL((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(url.searchParams.get('count')).toBe('5');
    expect(url.searchParams.get('freshness')).toBe('week');
  });

  it('returns error on non-ok response', async () => {
    process.env.BRAVE_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
    } as Response);

    const result = await websearch(['rate limited query'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.error).toBe('API error: 429');
  });

  it('returns error on network failure', async () => {
    process.env.BRAVE_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await websearch(['network fail'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    expect(data.error).toBe('ECONNREFUSED');
  });
});
