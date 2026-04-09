/**
 * Contract test: all headless prompt files in sdk/prompts/ must contain
 * zero instances of blocked interactive patterns.
 *
 * This prevents regression — any new prompt file or edit that reintroduces
 * interactive mechanics will fail this test.
 */
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

// ─── Paths ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = join(__dirname, '..', 'prompts');
const workflowsDir = join(promptsDir, 'workflows');
const agentsDir = join(promptsDir, 'agents');

// ─── Blocked patterns ────────────────────────────────────────────────────────

/**
 * Patterns that MUST NOT appear in headless prompts.
 * Each entry: [label for reporting, regex].
 */
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

// ─── Expected files ──────────────────────────────────────────────────────────

const EXPECTED_WORKFLOWS = [
  'execute-plan.md',
  'research-phase.md',
  'plan-phase.md',
  'verify-phase.md',
  'discuss-phase.md',
];

const EXPECTED_AGENTS = [
  'gsd-executor.md',
  'gsd-phase-researcher.md',
  'gsd-planner.md',
  'gsd-verifier.md',
  'gsd-plan-checker.md',
  'gsd-project-researcher.md',
  'gsd-research-synthesizer.md',
  'gsd-roadmapper.md',
];

const templatesDir = join(promptsDir, 'templates');
const researchTemplatesDir = join(templatesDir, 'research-project');

const EXPECTED_TEMPLATES = [
  'project.md',
  'requirements.md',
  'roadmap.md',
  'state.md',
];

const EXPECTED_RESEARCH_TEMPLATES = [
  'ARCHITECTURE.md',
  'FEATURES.md',
  'PITFALLS.md',
  'STACK.md',
  'SUMMARY.md',
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('headless prompt contract', () => {
  describe('file inventory', () => {
    it('has all expected workflow files', () => {
      const actual = readdirSync(workflowsDir).sort();
      expect(actual).toEqual(EXPECTED_WORKFLOWS.sort());
    });

    it('has all expected agent files', () => {
      const actual = readdirSync(agentsDir).sort();
      expect(actual).toEqual(EXPECTED_AGENTS.sort());
    });
  });

  describe('zero interactive patterns in workflow prompts', () => {
    for (const filename of EXPECTED_WORKFLOWS) {
      describe(filename, () => {
        for (const [label, pattern] of BLOCKED_PATTERNS) {
          it(`contains no ${label}`, async () => {
            const content = await readFile(join(workflowsDir, filename), 'utf-8');
            const matches = content.match(new RegExp(pattern.source, pattern.flags + 'g'));
            expect(matches, `Found ${label} in ${filename}: ${matches?.join(', ')}`).toBeNull();
          });
        }
      });
    }
  });

  describe('zero interactive patterns in agent prompts', () => {
    for (const filename of EXPECTED_AGENTS) {
      describe(filename, () => {
        for (const [label, pattern] of BLOCKED_PATTERNS) {
          it(`contains no ${label}`, async () => {
            const content = await readFile(join(agentsDir, filename), 'utf-8');
            const matches = content.match(new RegExp(pattern.source, pattern.flags + 'g'));
            expect(matches, `Found ${label} in ${filename}: ${matches?.join(', ')}`).toBeNull();
          });
        }
      });
    }
  });

  describe('template file inventory', () => {
    it('has all expected top-level template files', () => {
      const actual = readdirSync(templatesDir).filter(f => f.endsWith('.md')).sort();
      expect(actual).toEqual(EXPECTED_TEMPLATES.sort());
    });

    it('has all expected research-project template files', () => {
      const actual = readdirSync(researchTemplatesDir).sort();
      expect(actual).toEqual(EXPECTED_RESEARCH_TEMPLATES.sort());
    });
  });

  describe('zero interactive patterns in template prompts', () => {
    for (const filename of EXPECTED_TEMPLATES) {
      describe(filename, () => {
        for (const [label, pattern] of BLOCKED_PATTERNS) {
          it(`contains no ${label}`, async () => {
            const content = await readFile(join(templatesDir, filename), 'utf-8');
            const matches = content.match(new RegExp(pattern.source, pattern.flags + 'g'));
            expect(matches, `Found ${label} in ${filename}: ${matches?.join(', ')}`).toBeNull();
          });
        }
      });
    }
  });

  describe('zero interactive patterns in research-project templates', () => {
    for (const filename of EXPECTED_RESEARCH_TEMPLATES) {
      describe(filename, () => {
        for (const [label, pattern] of BLOCKED_PATTERNS) {
          it(`contains no ${label}`, async () => {
            const content = await readFile(join(researchTemplatesDir, filename), 'utf-8');
            const matches = content.match(new RegExp(pattern.source, pattern.flags + 'g'));
            expect(matches, `Found ${label} in ${filename}: ${matches?.join(', ')}`).toBeNull();
          });
        }
      });
    }
  });
});
