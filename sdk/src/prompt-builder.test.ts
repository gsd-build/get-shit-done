/**
 * Unit tests for prompt-builder.ts
 */

import { describe, it, expect } from 'vitest';
import {
  buildExecutorPrompt,
  parseAgentTools,
  parseAgentRole,
  DEFAULT_ALLOWED_TOOLS,
} from './prompt-builder.js';
import type { ParsedPlan, PlanFrontmatter, MustHaves } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<ParsedPlan> = {}): ParsedPlan {
  const defaultFrontmatter: PlanFrontmatter = {
    phase: '01-auth',
    plan: '01',
    type: 'execute',
    wave: 1,
    depends_on: [],
    files_modified: [],
    autonomous: true,
    requirements: ['AUTH-01'],
    must_haves: { truths: [], artifacts: [], key_links: [] },
  };

  return {
    frontmatter: { ...defaultFrontmatter, ...overrides.frontmatter },
    objective: overrides.objective ?? 'Implement JWT authentication with refresh tokens',
    execution_context: overrides.execution_context ?? [],
    context_refs: overrides.context_refs ?? [],
    tasks: overrides.tasks ?? [
      {
        type: 'auto',
        name: 'Create auth module',
        files: ['src/auth.ts'],
        read_first: ['src/types.ts'],
        action: 'Create the auth module with login and refresh endpoints',
        verify: 'npm test -- --filter auth',
        acceptance_criteria: ['JWT tokens issued on login', 'Refresh tokens rotate correctly'],
        done: 'Auth module created and tests pass',
      },
      {
        type: 'auto',
        name: 'Add middleware',
        files: ['src/middleware.ts'],
        read_first: [],
        action: 'Create auth middleware for protected routes',
        verify: 'npm test -- --filter middleware',
        acceptance_criteria: [],
        done: 'Middleware validates JWT on protected routes',
      },
    ],
    raw: '',
  };
}

const SAMPLE_AGENT_DEF = `---
name: gsd-executor
description: Executes GSD plans
tools: Read, Write, Edit, Bash, Grep, Glob
permissionMode: acceptEdits
---

<role>
You are a GSD plan executor. You execute PLAN.md files atomically.
</role>

<execution_flow>
Some flow content
</execution_flow>`;

// ─── parseAgentTools ─────────────────────────────────────────────────────────

describe('parseAgentTools', () => {
  it('extracts tools from agent definition frontmatter', () => {
    const tools = parseAgentTools(SAMPLE_AGENT_DEF);
    expect(tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);
  });

  it('returns defaults when no frontmatter found', () => {
    const tools = parseAgentTools('Just some text without frontmatter');
    expect(tools).toEqual(DEFAULT_ALLOWED_TOOLS);
  });

  it('returns defaults when frontmatter has no tools key', () => {
    const def = `---\nname: test\n---\nContent`;
    const tools = parseAgentTools(def);
    expect(tools).toEqual(DEFAULT_ALLOWED_TOOLS);
  });

  it('handles empty tools value', () => {
    const def = `---\ntools: \n---`;
    const tools = parseAgentTools(def);
    expect(tools).toEqual(DEFAULT_ALLOWED_TOOLS);
  });
});

// ─── parseAgentRole ──────────────────────────────────────────────────────────

describe('parseAgentRole', () => {
  it('extracts role content from agent definition', () => {
    const role = parseAgentRole(SAMPLE_AGENT_DEF);
    expect(role).toContain('GSD plan executor');
    expect(role).toContain('PLAN.md files atomically');
  });

  it('returns empty string when no role block', () => {
    expect(parseAgentRole('No role block here')).toBe('');
  });
});

// ─── buildExecutorPrompt ─────────────────────────────────────────────────────

describe('buildExecutorPrompt', () => {
  it('includes the objective text', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('Implement JWT authentication with refresh tokens');
  });

  it('includes all task names', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('Create auth module');
    expect(prompt).toContain('Add middleware');
  });

  it('includes task actions', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('Create the auth module with login and refresh endpoints');
    expect(prompt).toContain('Create auth middleware for protected routes');
  });

  it('includes task verification commands', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('npm test -- --filter auth');
    expect(prompt).toContain('npm test -- --filter middleware');
  });

  it('includes task file references', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('src/auth.ts');
    expect(prompt).toContain('src/types.ts');
  });

  it('includes acceptance criteria', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('JWT tokens issued on login');
    expect(prompt).toContain('Refresh tokens rotate correctly');
  });

  it('includes SUMMARY.md creation instruction with derived filename', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('01-01-SUMMARY.md');
  });

  it('includes phaseDir in SUMMARY path when provided', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan, { phaseDir: '.planning/phases/01-auth' });
    expect(prompt).toContain('.planning/phases/01-auth/01-01-SUMMARY.md');
  });

  it('uses bare SUMMARY.md when phase/plan numbers missing', () => {
    const plan = makePlan({ frontmatter: { phase: '', plan: '', type: 'execute', wave: 1, depends_on: [], files_modified: [], autonomous: true, requirements: [], must_haves: { truths: [], artifacts: [], key_links: [] } } });
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('SUMMARY.md');
    expect(prompt).not.toContain('/SUMMARY.md');
  });

  it('includes sequential execution instruction', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('Execute these tasks sequentially');
  });

  it('handles plan with no tasks gracefully', () => {
    const plan = makePlan({ tasks: [] });
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('No tasks defined');
    expect(prompt).toContain('SUMMARY.md');
    // Should not throw
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('includes context references when present', () => {
    const plan = makePlan({
      context_refs: ['src/config.ts', 'docs/architecture.md'],
    });
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('@src/config.ts');
    expect(prompt).toContain('@docs/architecture.md');
    expect(prompt).toContain('Read these files for context');
  });

  it('omits context section when no refs', () => {
    const plan = makePlan({ context_refs: [] });
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).not.toContain('Context Files');
  });

  it('includes plan metadata', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('Phase: 01-auth');
    expect(prompt).toContain('Plan: 01');
  });

  it('includes must-have truths when present', () => {
    const plan = makePlan({
      frontmatter: {
        phase: '01',
        plan: '01',
        type: 'execute',
        wave: 1,
        depends_on: [],
        files_modified: [],
        autonomous: true,
        requirements: [],
        must_haves: {
          truths: ['All endpoints require JWT auth', 'Tokens expire after 15 minutes'],
          artifacts: [],
          key_links: [],
        },
      },
    });
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('All endpoints require JWT auth');
    expect(prompt).toContain('Tokens expire after 15 minutes');
  });

  it('includes must-have artifacts', () => {
    const plan = makePlan({
      frontmatter: {
        phase: '01',
        plan: '01',
        type: 'execute',
        wave: 1,
        depends_on: [],
        files_modified: [],
        autonomous: true,
        requirements: [],
        must_haves: {
          truths: [],
          artifacts: [{ path: 'src/auth.ts', provides: 'JWT auth module' }],
          key_links: [],
        },
      },
    });
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('`src/auth.ts`');
    expect(prompt).toContain('JWT auth module');
  });

  it('includes must-have key_links', () => {
    const plan = makePlan({
      frontmatter: {
        phase: '01',
        plan: '01',
        type: 'execute',
        wave: 1,
        depends_on: [],
        files_modified: [],
        autonomous: true,
        requirements: [],
        must_haves: {
          truths: [],
          artifacts: [],
          key_links: [{ from: 'auth.ts', to: 'middleware.ts', via: 'import' }],
        },
      },
    });
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('auth.ts → middleware.ts via import');
  });

  it('includes role from agent definition when provided', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan, SAMPLE_AGENT_DEF);
    expect(prompt).toContain('## Role');
    expect(prompt).toContain('GSD plan executor');
  });

  it('works without agent definition', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    // Should still produce a valid prompt without role section
    expect(prompt).toContain('## Objective');
    expect(prompt).toContain('## Tasks');
    expect(prompt).not.toContain('## Role');
  });

  it('provides fallback objective when plan has empty objective', () => {
    const plan = makePlan({ objective: '' });
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('Execute plan: 01');
  });

  it('includes done criteria for tasks', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('Auth module created and tests pass');
    expect(prompt).toContain('Middleware validates JWT on protected routes');
  });

  it('includes commit instruction in completion section', () => {
    const plan = makePlan();
    const prompt = buildExecutorPrompt(plan);
    expect(prompt).toContain('Commit the SUMMARY.md');
  });
});
