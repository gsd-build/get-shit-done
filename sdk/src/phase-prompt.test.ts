import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PromptFactory, extractBlock, extractSteps, PHASE_WORKFLOW_MAP } from './phase-prompt.js';
import { PhaseType } from './types.js';
import type { ContextFiles, ParsedPlan, PlanFrontmatter } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'gsd-prompt-'));
}

function makeWorkflowContent(purpose: string, steps: string[]): string {
  const stepBlocks = steps
    .map((s, i) => `<step name="step_${i + 1}">\n${s}\n</step>`)
    .join('\n\n');
  return `<purpose>\n${purpose}\n</purpose>\n\n<process>\n${stepBlocks}\n</process>`;
}

function makeAgentDef(name: string, tools: string, role: string): string {
  return `---\nname: ${name}\ntools: ${tools}\n---\n\n<role>\n${role}\n</role>`;
}

function makeParsedPlan(overrides?: Partial<ParsedPlan>): ParsedPlan {
  return {
    frontmatter: {
      phase: 'execute',
      plan: 'test-plan',
      type: 'feature',
      wave: 1,
      depends_on: [],
      files_modified: [],
      autonomous: true,
      requirements: [],
      must_haves: { truths: [], artifacts: [], key_links: [] },
    } as PlanFrontmatter,
    objective: 'Test objective',
    execution_context: [],
    context_refs: [],
    tasks: [],
    raw: '',
    ...overrides,
  };
}

// ─── extractBlock tests ──────────────────────────────────────────────────────

describe('extractBlock', () => {
  it('extracts content from a simple block', () => {
    const content = '<purpose>\nDo the thing.\n</purpose>';
    expect(extractBlock(content, 'purpose')).toBe('Do the thing.');
  });

  it('extracts content from block with attributes', () => {
    const content = '<step name="init" priority="first">\nLoad context.\n</step>';
    expect(extractBlock(content, 'step')).toBe('Load context.');
  });

  it('returns empty string for missing block', () => {
    const content = '<purpose>Something</purpose>';
    expect(extractBlock(content, 'role')).toBe('');
  });

  it('extracts multiline content', () => {
    const content = '<role>\nLine 1\nLine 2\nLine 3\n</role>';
    expect(extractBlock(content, 'role')).toBe('Line 1\nLine 2\nLine 3');
  });
});

describe('extractSteps', () => {
  it('extracts multiple steps from process content', () => {
    const process = `
<step name="init">Initialize</step>
<step name="execute">Run tasks</step>
<step name="verify">Check results</step>`;

    const steps = extractSteps(process);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ name: 'init', content: 'Initialize' });
    expect(steps[1]).toEqual({ name: 'execute', content: 'Run tasks' });
    expect(steps[2]).toEqual({ name: 'verify', content: 'Check results' });
  });

  it('returns empty array for no steps', () => {
    expect(extractSteps('no steps here')).toEqual([]);
  });

  it('handles steps with priority attributes', () => {
    const process = '<step name="init" priority="first">\nDo first.\n</step>';
    const steps = extractSteps(process);
    expect(steps).toHaveLength(1);
    expect(steps[0].name).toBe('init');
    expect(steps[0].content).toBe('Do first.');
  });
});

// ─── PromptFactory tests ─────────────────────────────────────────────────────

describe('PromptFactory', () => {
  let tempDir: string;
  let workflowsDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    workflowsDir = join(tempDir, 'workflows');
    agentsDir = join(tempDir, 'agents');
    await mkdir(workflowsDir, { recursive: true });
    await mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeFactory(): PromptFactory {
    // sdkPromptsDir points to a non-existent temp subdir so real sdk/prompts/ files
    // don't interfere — tests control exactly which files exist on disk.
    return new PromptFactory({
      gsdInstallDir: tempDir,
      agentsDir,
      sdkPromptsDir: join(tempDir, 'sdk-prompts-does-not-exist'),
    });
  }

  describe('buildPrompt', () => {
    it('assembles research prompt with role + purpose + process + context', async () => {
      await writeFile(
        join(workflowsDir, 'research-phase.md'),
        makeWorkflowContent('Research the phase.', ['Gather info', 'Analyze findings']),
      );
      await writeFile(
        join(agentsDir, 'gsd-phase-researcher.md'),
        makeAgentDef('gsd-phase-researcher', 'Read, Grep, Bash', 'You are a researcher.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = {
        state: '# State\nproject: test',
        roadmap: '# Roadmap\nphases listed',
      };

      const prompt = await factory.buildPrompt(PhaseType.Research, null, contextFiles);

      expect(prompt).toContain('## Role');
      expect(prompt).toContain('You are a researcher.');
      expect(prompt).toContain('## Purpose');
      expect(prompt).toContain('Research the phase.');
      expect(prompt).toContain('## Process');
      expect(prompt).toContain('Gather info');
      expect(prompt).toContain('## Context');
      expect(prompt).toContain('# State');
      expect(prompt).toContain('# Roadmap');
      expect(prompt).toContain('## Phase Instructions');

      // Cache-friendly ordering (#1614): stable prefix before variable context
      const phaseInstrIdx = prompt.indexOf('## Phase Instructions');
      const contextIdx = prompt.indexOf('## Context');
      expect(phaseInstrIdx).toBeLessThan(contextIdx);
    });

    it('assembles plan prompt with all context files', async () => {
      await writeFile(
        join(workflowsDir, 'plan-phase.md'),
        makeWorkflowContent('Plan the implementation.', ['Break down tasks']),
      );
      await writeFile(
        join(agentsDir, 'gsd-planner.md'),
        makeAgentDef('gsd-planner', 'Read, Write, Bash', 'You are a planner.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = {
        state: '# State',
        roadmap: '# Roadmap',
        context: '# Context',
        research: '# Research',
        requirements: '# Requirements',
      };

      const prompt = await factory.buildPrompt(PhaseType.Plan, null, contextFiles);

      expect(prompt).toContain('You are a planner.');
      expect(prompt).toContain('Plan the implementation.');
      expect(prompt).toContain('# State');
      expect(prompt).toContain('# Research');
      expect(prompt).toContain('# Requirements');
      expect(prompt).toContain('executable plans');
    });

    it('delegates execute phase with plan to buildExecutorPrompt', async () => {
      await writeFile(
        join(agentsDir, 'gsd-executor.md'),
        makeAgentDef('gsd-executor', 'Read, Write, Edit, Bash', 'You are an executor.'),
      );

      const factory = makeFactory();
      const plan = makeParsedPlan({ objective: 'Build the auth system' });
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Execute, plan, contextFiles);

      // buildExecutorPrompt produces structured output with ## Objective
      expect(prompt).toContain('## Objective');
      expect(prompt).toContain('Build the auth system');
      expect(prompt).toContain('## Role');
      expect(prompt).toContain('You are an executor.');
    });

    it('handles execute phase without plan (non-delegation path)', async () => {
      await writeFile(
        join(workflowsDir, 'execute-plan.md'),
        makeWorkflowContent('Execute the plan.', ['Run tasks']),
      );
      await writeFile(
        join(agentsDir, 'gsd-executor.md'),
        makeAgentDef('gsd-executor', 'Read, Write, Edit, Bash', 'You are an executor.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Execute, null, contextFiles);

      // Falls through to general assembly path
      expect(prompt).toContain('## Role');
      expect(prompt).toContain('You are an executor.');
      expect(prompt).toContain('## Purpose');
      expect(prompt).toContain('Execute the plan.');
    });

    it('assembles verify prompt with phase instructions', async () => {
      await writeFile(
        join(workflowsDir, 'verify-phase.md'),
        makeWorkflowContent('Verify phase goals.', ['Check artifacts', 'Run tests']),
      );
      await writeFile(
        join(agentsDir, 'gsd-verifier.md'),
        makeAgentDef('gsd-verifier', 'Read, Bash, Grep', 'You are a verifier.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = {
        state: '# State',
        roadmap: '# Roadmap',
        requirements: '# Requirements',
      };

      const prompt = await factory.buildPrompt(PhaseType.Verify, null, contextFiles);

      expect(prompt).toContain('You are a verifier.');
      expect(prompt).toContain('Verify phase goals.');
      expect(prompt).toContain('goal achievement');
    });

    it('assembles discuss prompt without agent role (no dedicated agent)', async () => {
      await writeFile(
        join(workflowsDir, 'discuss-phase.md'),
        makeWorkflowContent('Discuss implementation decisions.', ['Identify areas']),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Discuss, null, contextFiles);

      // Discuss has no agent, so no Role section
      expect(prompt).not.toContain('## Role');
      expect(prompt).toContain('## Purpose');
      expect(prompt).toContain('Discuss implementation decisions.');
      expect(prompt).toContain('## Phase Instructions');
      expect(prompt).toContain('Extract implementation decisions');
    });

    it('handles missing workflow file gracefully', async () => {
      // No workflow files on disk
      await writeFile(
        join(agentsDir, 'gsd-phase-researcher.md'),
        makeAgentDef('gsd-phase-researcher', 'Read, Bash', 'You are a researcher.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Research, null, contextFiles);

      // Should still produce a prompt with role and context
      expect(prompt).toContain('## Role');
      expect(prompt).toContain('## Context');
      expect(prompt).not.toContain('## Purpose');
    });

    it('handles missing agent def gracefully', async () => {
      await writeFile(
        join(workflowsDir, 'research-phase.md'),
        makeWorkflowContent('Research the phase.', ['Gather info']),
      );
      // No agent file on disk

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Research, null, contextFiles);

      expect(prompt).not.toContain('## Role');
      expect(prompt).toContain('## Purpose');
      expect(prompt).toContain('Research the phase.');
    });

    it('omits empty context section when no files provided', async () => {
      await writeFile(
        join(workflowsDir, 'discuss-phase.md'),
        makeWorkflowContent('Discuss things.', ['Talk']),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = {};

      const prompt = await factory.buildPrompt(PhaseType.Discuss, null, contextFiles);

      expect(prompt).not.toContain('## Context');
    });
  });

  describe('loadWorkflowFile', () => {
    it('loads existing workflow file', async () => {
      await writeFile(
        join(workflowsDir, 'research-phase.md'),
        'workflow content',
      );

      const factory = makeFactory();
      const content = await factory.loadWorkflowFile(PhaseType.Research);
      expect(content).toBe('workflow content');
    });

    it('returns undefined for missing workflow file', async () => {
      const factory = makeFactory();
      const content = await factory.loadWorkflowFile(PhaseType.Research);
      expect(content).toBeUndefined();
    });
  });

  describe('loadAgentDef', () => {
    it('loads agent def from agents dir', async () => {
      await writeFile(
        join(agentsDir, 'gsd-executor.md'),
        'agent content',
      );

      const factory = makeFactory();
      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('agent content');
    });

    it('returns undefined for phases with no agent (discuss)', async () => {
      const factory = makeFactory();
      const content = await factory.loadAgentDef(PhaseType.Discuss);
      expect(content).toBeUndefined();
    });

    it('falls back to project agents dir', async () => {
      const projectAgentsDir = join(tempDir, 'project-agents');
      await mkdir(projectAgentsDir, { recursive: true });
      await writeFile(
        join(projectAgentsDir, 'gsd-executor.md'),
        'project agent content',
      );

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        projectAgentsDir,
        sdkPromptsDir: join(tempDir, 'sdk-prompts-does-not-exist'),
      });

      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('project agent content');
    });

    it('prefers user agents dir over project agents dir', async () => {
      const projectAgentsDir = join(tempDir, 'project-agents');
      await mkdir(projectAgentsDir, { recursive: true });
      await writeFile(join(agentsDir, 'gsd-executor.md'), 'user agent');
      await writeFile(join(projectAgentsDir, 'gsd-executor.md'), 'project agent');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        projectAgentsDir,
        sdkPromptsDir: join(tempDir, 'sdk-prompts-does-not-exist'),
      });

      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('user agent');
    });
  });

  // ─── Headless prompt loading ─────────────────────────────────────────────

  describe('headless prompt loading', () => {
    it('loadWorkflowFile prefers sdkPromptsDir over GSD-1 workflowsDir', async () => {
      const sdkDir = join(tempDir, 'sdk-prompts');
      await mkdir(join(sdkDir, 'workflows'), { recursive: true });

      // Write both: GSD-1 original and SDK headless version
      await writeFile(join(workflowsDir, 'research-phase.md'), 'GSD-1 original');
      await writeFile(join(sdkDir, 'workflows', 'research-phase.md'), 'SDK headless version');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        sdkPromptsDir: sdkDir,
      });

      const content = await factory.loadWorkflowFile(PhaseType.Research);
      expect(content).toBe('SDK headless version');
    });

    it('loadWorkflowFile falls back to GSD-1 when sdkPromptsDir file missing', async () => {
      const sdkDir = join(tempDir, 'sdk-prompts');
      await mkdir(join(sdkDir, 'workflows'), { recursive: true });

      // Only GSD-1 original exists, no SDK version
      await writeFile(join(workflowsDir, 'research-phase.md'), 'GSD-1 original');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        sdkPromptsDir: sdkDir,
      });

      const content = await factory.loadWorkflowFile(PhaseType.Research);
      expect(content).toBe('GSD-1 original');
    });

    it('loadAgentDef prefers sdkPromptsDir over user agents dir', async () => {
      const sdkDir = join(tempDir, 'sdk-prompts');
      await mkdir(join(sdkDir, 'agents'), { recursive: true });

      // Write both: user agent and SDK headless agent
      await writeFile(join(agentsDir, 'gsd-executor.md'), 'user agent');
      await writeFile(join(sdkDir, 'agents', 'gsd-executor.md'), 'SDK headless agent');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        sdkPromptsDir: sdkDir,
      });

      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('SDK headless agent');
    });

    it('loadAgentDef falls back to user agents when sdkPromptsDir file missing', async () => {
      const sdkDir = join(tempDir, 'sdk-prompts');
      await mkdir(join(sdkDir, 'agents'), { recursive: true });

      // Only user agent exists, no SDK version
      await writeFile(join(agentsDir, 'gsd-executor.md'), 'user agent');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        sdkPromptsDir: sdkDir,
      });

      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('user agent');
    });

    it('buildPrompt sanitizes interactive patterns from output', async () => {
      // Use separate lines so non-interactive content survives stripping
      await writeFile(
        join(workflowsDir, 'research-phase.md'),
        makeWorkflowContent('Research the codebase thoroughly.', [
          'Gather data from the project.\nAskUserQuestion("what?")\nAnalyze findings.',
          'Run the analysis.\n/gsd:analyze --deep\nDocument results.',
        ]),
      );
      await writeFile(
        join(agentsDir, 'gsd-phase-researcher.md'),
        makeAgentDef('gsd-phase-researcher', 'Read, Bash', 'You are a researcher.\nSTOP and wait for user input.\nBe thorough.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Research, null, contextFiles);

      // Interactive patterns should be stripped by sanitizePrompt()
      expect(prompt).not.toContain('AskUserQuestion');
      expect(prompt).not.toContain('/gsd:');
      expect(prompt).not.toMatch(/\bSTOP\s+and\s+wait/);

      // Non-interactive content on separate lines should remain
      expect(prompt).toContain('You are a researcher.');
      expect(prompt).toContain('Be thorough.');
      expect(prompt).toContain('Gather data from the project.');
      expect(prompt).toContain('Analyze findings.');
    });

    it('buildPrompt with execute+plan sanitizes output from buildExecutorPrompt', async () => {
      await writeFile(
        join(agentsDir, 'gsd-executor.md'),
        makeAgentDef('gsd-executor', 'Read, Write, Edit, Bash', 'You are an executor.\nSTOP and wait for user.\nExecute thoroughly.'),
      );

      const factory = makeFactory();
      const plan = makeParsedPlan({ objective: 'Build the auth system' });
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Execute, plan, contextFiles);

      // Objective should remain (no interactive pattern on that line)
      expect(prompt).toContain('Build the auth system');
      // The role's STOP directive should be stripped
      expect(prompt).not.toMatch(/\bSTOP\s+and\s+wait/);
      // Non-interactive role content should remain
      expect(prompt).toContain('You are an executor.');
    });
  });
});

describe('PHASE_WORKFLOW_MAP', () => {
  it('maps all phase types to workflow filenames', () => {
    for (const phase of Object.values(PhaseType)) {
      expect(PHASE_WORKFLOW_MAP[phase]).toBeDefined();
      expect(PHASE_WORKFLOW_MAP[phase]).toMatch(/\.md$/);
    }
  });

  it('execute phase maps to execute-plan.md (not execute-phase.md)', () => {
    expect(PHASE_WORKFLOW_MAP[PhaseType.Execute]).toBe('execute-plan.md');
  });
});
