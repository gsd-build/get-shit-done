/**
 * Contract test: assembled prompts from PromptFactory.buildPrompt() and
 * InitRunner.build*Prompt() must contain zero interactive patterns.
 *
 * Unlike headless-prompts.test.ts (which scans raw .md files on disk),
 * these tests exercise the full assembly pipeline:
 *   file loading → role extraction → context injection → sanitizePrompt()
 *
 * If any assembly step reintroduces interactive patterns that sanitizePrompt()
 * doesn't catch, these tests will fail.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { PromptFactory } from './phase-prompt.js';
import { InitRunner } from './init-runner.js';
import { PhaseType } from './types.js';
import type { ParsedPlan, ContextFiles, GSDEvent } from './types.js';
import type { GSDTools } from './gsd-tools.js';
import type { GSDEventStream } from './event-stream.js';

// ─── Paths ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const sdkPromptsDir = join(__dirname, '..', 'prompts');

// ─── Blocked patterns (aligned with headless-prompts.test.ts) ────────────────

const BLOCKED_PATTERNS: Array<[string, RegExp]> = [
  ['AskUserQuestion', /AskUserQuestion\s*\(/],
  ['SlashCommand', /SlashCommand\s*\(/],
  ['/gsd: command', /\/gsd:\S+/],
  ['@file: reference', /@file:\S+/],
  ['STOP + wait directive', /\bSTOP\b\s+(?:and\s+)?(?:wait|ask)/i],
  ['bare STOP directive', /^\s*STOP\s*[.!]?\s*$/m],
  ['wait for user', /\bwait\s+for\s+(?:the\s+)?user\b/i],
  ['ask the user', /\bask\s+the\s+user\b/i],
];

// ─── Minimal fixtures ────────────────────────────────────────────────────────

const MINIMAL_PLAN: ParsedPlan = {
  frontmatter: {
    phase: '01',
    plan: 'test-plan',
    type: 'feature',
    wave: 1,
    depends_on: [],
    files_modified: ['src/index.ts'],
    autonomous: true,
    requirements: ['R001'],
    must_haves: {
      truths: ['It works'],
      artifacts: [{ path: 'src/index.ts', provides: 'entry point' }],
      key_links: [],
    },
  },
  objective: 'Test objective for assembled prompt contract test',
  execution_context: ['This is a test context line'],
  context_refs: [],
  tasks: [
    {
      type: 'create',
      name: 'Create test file',
      files: ['src/test.ts'],
      read_first: [],
      action: 'Create a test file',
      verify: 'File exists',
      acceptance_criteria: ['File created'],
      done: 'src/test.ts exists',
    },
  ],
  raw: '# Test Plan\n\nMinimal plan for testing.',
};

const EMPTY_CONTEXT: ContextFiles = {};

// ─── Helper ──────────────────────────────────────────────────────────────────

function assertNoBlockedPatterns(output: string, label: string): void {
  for (const [patternLabel, pattern] of BLOCKED_PATTERNS) {
    const matches = output.match(new RegExp(pattern.source, pattern.flags + 'g'));
    expect(
      matches,
      `Found ${patternLabel} in ${label}: ${matches?.join(', ')}`,
    ).toBeNull();
  }
}

// ─── PromptFactory assembled output ──────────────────────────────────────────

describe('PromptFactory assembled output', () => {
  let factory: PromptFactory;

  beforeAll(() => {
    factory = new PromptFactory({ sdkPromptsDir });
  });

  const phaseTypes = Object.values(PhaseType) as PhaseType[];

  for (const phaseType of phaseTypes) {
    describe(`${phaseType} phase`, () => {
      let output: string;

      beforeAll(async () => {
        output = await factory.buildPrompt(phaseType, MINIMAL_PLAN, EMPTY_CONTEXT);
      });

      it('produces non-empty output', () => {
        expect(output.length).toBeGreaterThan(0);
      });

      for (const [label, pattern] of BLOCKED_PATTERNS) {
        it(`contains no ${label}`, () => {
          const matches = output.match(new RegExp(pattern.source, pattern.flags + 'g'));
          expect(
            matches,
            `Found ${label} in ${phaseType} assembled prompt: ${matches?.join(', ')}`,
          ).toBeNull();
        });
      }
    });
  }

  it('includes role section for phases with agents', async () => {
    // Research, Plan, Execute, Verify all have agents; Discuss does not
    const researchOutput = await factory.buildPrompt(PhaseType.Research, null, EMPTY_CONTEXT);
    expect(researchOutput).toContain('## Agent Instructions');
  });

  it('includes purpose section from workflow files', async () => {
    const planOutput = await factory.buildPrompt(PhaseType.Plan, null, EMPTY_CONTEXT);
    // Plan phase should have purpose from plan-phase.md
    expect(planOutput).toContain('## Purpose');
  });

  it('includes context section when context files provided', async () => {
    const contextFiles: ContextFiles = {
      state: '# State\ncurrent_phase: 01',
      roadmap: '# Roadmap\n## Phase 01',
    };
    const output = await factory.buildPrompt(PhaseType.Research, null, contextFiles);
    expect(output).toContain('## Context');
    expect(output).toContain('Project State');
  });
});

// ─── InitRunner assembled output ─────────────────────────────────────────────

describe('InitRunner assembled output', () => {
  let tmpDir: string;
  let runner: InitRunner;

  // Minimal stub tools and event stream — we only call build*Prompt(), not run()
  const stubTools: GSDTools = {
    initNewProject: async () => ({
      researcher_model: 'test',
      synthesizer_model: 'test',
      roadmapper_model: 'test',
      commit_docs: false,
      project_exists: false,
      has_codebase_map: false,
      has_git: true,
    }),
    configSet: async () => {},
    commit: async () => {},
  } as unknown as GSDTools;

  const stubEventStream: GSDEventStream = {
    emitEvent: (_event: GSDEvent) => {},
  } as unknown as GSDEventStream;

  beforeAll(async () => {
    // Create temp directory with .planning/ structure for InitRunner file reads
    tmpDir = await mkdtemp(join(tmpdir(), 'assembled-prompts-'));
    const planningDir = join(tmpDir, '.planning');
    const researchDir = join(planningDir, 'research');
    await mkdir(researchDir, { recursive: true });

    // Write minimal stubs that InitRunner reads
    await writeFile(
      join(planningDir, 'PROJECT.md'),
      '# Test Project\n\nA minimal test project for contract testing.\n',
    );
    await writeFile(
      join(planningDir, 'config.json'),
      JSON.stringify({ mode: 'yolo', parallelization: true }, null, 2),
    );
    await writeFile(
      join(planningDir, 'REQUIREMENTS.md'),
      '# Requirements\n\n## R001 — Test Requirement\n',
    );
    await writeFile(
      join(researchDir, 'STACK.md'),
      '# Stack Research\n\nTypeScript + Node.js\n',
    );
    await writeFile(
      join(researchDir, 'FEATURES.md'),
      '# Features Research\n\nCore features identified.\n',
    );
    await writeFile(
      join(researchDir, 'ARCHITECTURE.md'),
      '# Architecture Research\n\nModular architecture.\n',
    );
    await writeFile(
      join(researchDir, 'PITFALLS.md'),
      '# Pitfalls Research\n\nCommon pitfalls noted.\n',
    );
    await writeFile(
      join(researchDir, 'SUMMARY.md'),
      '# Research Summary\n\nAll research synthesized.\n',
    );

    runner = new InitRunner({
      projectDir: tmpDir,
      tools: stubTools,
      eventStream: stubEventStream,
      sdkPromptsDir,
    });
  });

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  // Access private methods via (runner as any) — standard pattern for testing
  // private methods in TypeScript without subclassing or mocking

  describe('buildProjectPrompt', () => {
    let output: string;

    beforeAll(async () => {
      output = await (runner as any).buildProjectPrompt('Build a CLI tool');
    });

    it('produces non-empty output', () => {
      expect(output.length).toBeGreaterThan(0);
    });

    it('contains project template content', () => {
      expect(output).toContain('PROJECT.md');
    });

    it('contains user input', () => {
      expect(output).toContain('Build a CLI tool');
    });

    it('contains zero blocked patterns', () => {
      assertNoBlockedPatterns(output, 'buildProjectPrompt');
    });
  });

  describe('buildResearchPrompt', () => {
    const researchTypes = ['STACK', 'FEATURES', 'ARCHITECTURE', 'PITFALLS'] as const;

    for (const researchType of researchTypes) {
      describe(`${researchType} research`, () => {
        let output: string;

        beforeAll(async () => {
          output = await (runner as any).buildResearchPrompt(researchType, 'Build a CLI tool');
        });

        it('produces non-empty output', () => {
          expect(output.length).toBeGreaterThan(0);
        });

        it('references the research type', () => {
          expect(output).toContain(researchType);
        });

        it('contains zero blocked patterns', () => {
          assertNoBlockedPatterns(output, `buildResearchPrompt(${researchType})`);
        });
      });
    }
  });

  describe('buildSynthesisPrompt', () => {
    let output: string;

    beforeAll(async () => {
      output = await (runner as any).buildSynthesisPrompt();
    });

    it('produces non-empty output', () => {
      expect(output.length).toBeGreaterThan(0);
    });

    it('contains research content from temp files', () => {
      // The synthesis prompt reads research files from disk — our stubs should appear
      expect(output).toContain('Stack Research');
    });

    it('contains zero blocked patterns', () => {
      assertNoBlockedPatterns(output, 'buildSynthesisPrompt');
    });
  });

  describe('buildRequirementsPrompt', () => {
    let output: string;

    beforeAll(async () => {
      output = await (runner as any).buildRequirementsPrompt();
    });

    it('produces non-empty output', () => {
      expect(output.length).toBeGreaterThan(0);
    });

    it('contains project context from temp files', () => {
      expect(output).toContain('Test Project');
    });

    it('contains zero blocked patterns', () => {
      assertNoBlockedPatterns(output, 'buildRequirementsPrompt');
    });
  });

  describe('buildRoadmapPrompt', () => {
    let output: string;

    beforeAll(async () => {
      output = await (runner as any).buildRoadmapPrompt();
    });

    it('produces non-empty output', () => {
      expect(output.length).toBeGreaterThan(0);
    });

    it('contains agent definition content', () => {
      // Roadmap prompt loads gsd-roadmapper.md
      expect(output).toContain('agent_definition');
    });

    it('contains project file content', () => {
      expect(output).toContain('Test Project');
    });

    it('contains zero blocked patterns', () => {
      assertNoBlockedPatterns(output, 'buildRoadmapPrompt');
    });
  });
});
