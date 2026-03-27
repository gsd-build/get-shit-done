import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GSDTools, GSDToolsError } from './gsd-tools.js';
import {
  PhaseStepType,
  GSDEventType,
  PhaseType,
  type PhaseOpInfo,
  type PhaseStepResult,
  type PhaseRunnerResult,
  type HumanGateCallbacks,
  type PhaseRunnerOptions,
  type GSDPhaseStartEvent,
  type GSDPhaseStepStartEvent,
  type GSDPhaseStepCompleteEvent,
  type GSDPhaseCompleteEvent,
} from './types.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Phase lifecycle types', () => {
  // ─── PhaseStepType enum ────────────────────────────────────────────────

  describe('PhaseStepType', () => {
    it('has all expected step values', () => {
      expect(PhaseStepType.Discuss).toBe('discuss');
      expect(PhaseStepType.Research).toBe('research');
      expect(PhaseStepType.Plan).toBe('plan');
      expect(PhaseStepType.Execute).toBe('execute');
      expect(PhaseStepType.Verify).toBe('verify');
      expect(PhaseStepType.Advance).toBe('advance');
    });

    it('has exactly 7 members', () => {
      const values = Object.values(PhaseStepType);
      expect(values).toHaveLength(7);
    });
  });

  // ─── GSDEventType phase lifecycle values ───────────────────────────────

  describe('GSDEventType phase lifecycle events', () => {
    it('includes PhaseStart', () => {
      expect(GSDEventType.PhaseStart).toBe('phase_start');
    });

    it('includes PhaseStepStart', () => {
      expect(GSDEventType.PhaseStepStart).toBe('phase_step_start');
    });

    it('includes PhaseStepComplete', () => {
      expect(GSDEventType.PhaseStepComplete).toBe('phase_step_complete');
    });

    it('includes PhaseComplete', () => {
      expect(GSDEventType.PhaseComplete).toBe('phase_complete');
    });
  });

  // ─── PhaseOpInfo shape validation ──────────────────────────────────────

  describe('PhaseOpInfo interface', () => {
    it('accepts a valid phase-op output object', () => {
      const info: PhaseOpInfo = {
        phase_found: true,
        phase_dir: '.planning/phases/05-Skill-Scaffolding',
        phase_number: '5',
        phase_name: 'Skill Scaffolding',
        phase_slug: 'skill-scaffolding',
        padded_phase: '05',
        has_research: false,
        has_context: false,
        has_plans: false,
        has_verification: false,
        plan_count: 0,
        roadmap_exists: true,
        planning_exists: true,
        commit_docs: true,
        context_path: '.planning/phases/05-Skill-Scaffolding/CONTEXT.md',
        research_path: '.planning/phases/05-Skill-Scaffolding/RESEARCH.md',
      };

      expect(info.phase_found).toBe(true);
      expect(info.phase_number).toBe('5');
      expect(info.plan_count).toBe(0);
      expect(info.has_context).toBe(false);
    });

    it('matches the documented init phase-op JSON shape', () => {
      // Simulate parsing JSON from gsd-tools.cjs
      const raw = JSON.parse(JSON.stringify({
        phase_found: true,
        phase_dir: '.planning/phases/03-Auth',
        phase_number: '3',
        phase_name: 'Auth',
        phase_slug: 'auth',
        padded_phase: '03',
        has_research: true,
        has_context: true,
        has_plans: true,
        has_verification: false,
        plan_count: 2,
        roadmap_exists: true,
        planning_exists: true,
        commit_docs: true,
        context_path: '.planning/phases/03-Auth/CONTEXT.md',
        research_path: '.planning/phases/03-Auth/RESEARCH.md',
      }));

      const info = raw as PhaseOpInfo;
      expect(info.phase_found).toBe(true);
      expect(info.has_plans).toBe(true);
      expect(info.plan_count).toBe(2);
      expect(typeof info.phase_dir).toBe('string');
      expect(typeof info.padded_phase).toBe('string');
    });
  });

  // ─── Phase result types ────────────────────────────────────────────────

  describe('PhaseStepResult', () => {
    it('can represent a successful step', () => {
      const result: PhaseStepResult = {
        step: PhaseStepType.Research,
        success: true,
        durationMs: 5000,
      };
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('can represent a failed step with error', () => {
      const result: PhaseStepResult = {
        step: PhaseStepType.Execute,
        success: false,
        durationMs: 12000,
        error: 'Session timed out',
        planResults: [],
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session timed out');
    });
  });

  describe('PhaseRunnerResult', () => {
    it('can represent a complete phase run', () => {
      const result: PhaseRunnerResult = {
        phaseNumber: '3',
        phaseName: 'Auth',
        steps: [
          { step: PhaseStepType.Research, success: true, durationMs: 5000 },
          { step: PhaseStepType.Plan, success: true, durationMs: 3000 },
          { step: PhaseStepType.Execute, success: true, durationMs: 60000 },
        ],
        success: true,
        totalCostUsd: 1.5,
        totalDurationMs: 68000,
      };
      expect(result.steps).toHaveLength(3);
      expect(result.success).toBe(true);
    });
  });

  describe('HumanGateCallbacks', () => {
    it('accepts an object with all optional callbacks', () => {
      const callbacks: HumanGateCallbacks = {
        onDiscussApproval: async () => 'approve',
        onVerificationReview: async () => 'accept',
        onBlockerDecision: async () => 'retry',
      };
      expect(callbacks.onDiscussApproval).toBeDefined();
    });

    it('accepts an empty object (all callbacks optional)', () => {
      const callbacks: HumanGateCallbacks = {};
      expect(callbacks.onDiscussApproval).toBeUndefined();
    });
  });

  describe('PhaseRunnerOptions', () => {
    it('accepts full options', () => {
      const options: PhaseRunnerOptions = {
        callbacks: {},
        maxBudgetPerStep: 3.0,
        maxTurnsPerStep: 30,
        model: 'claude-sonnet-4-6',
      };
      expect(options.maxBudgetPerStep).toBe(3.0);
    });

    it('accepts empty options (all fields optional)', () => {
      const options: PhaseRunnerOptions = {};
      expect(options.callbacks).toBeUndefined();
    });
  });

  // ─── Phase lifecycle event interfaces ──────────────────────────────────

  describe('Phase lifecycle event interfaces', () => {
    it('GSDPhaseStartEvent has correct shape', () => {
      const event: GSDPhaseStartEvent = {
        type: GSDEventType.PhaseStart,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        phaseName: 'Auth',
      };
      expect(event.type).toBe('phase_start');
      expect(event.phaseNumber).toBe('3');
    });

    it('GSDPhaseStepStartEvent has correct shape', () => {
      const event: GSDPhaseStepStartEvent = {
        type: GSDEventType.PhaseStepStart,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        step: PhaseStepType.Research,
      };
      expect(event.type).toBe('phase_step_start');
      expect(event.step).toBe('research');
    });

    it('GSDPhaseStepCompleteEvent has correct shape', () => {
      const event: GSDPhaseStepCompleteEvent = {
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        step: PhaseStepType.Execute,
        success: true,
        durationMs: 45000,
      };
      expect(event.type).toBe('phase_step_complete');
      expect(event.success).toBe(true);
    });

    it('GSDPhaseStepCompleteEvent can include error', () => {
      const event: GSDPhaseStepCompleteEvent = {
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        step: PhaseStepType.Verify,
        success: false,
        durationMs: 2000,
        error: 'Verification failed',
      };
      expect(event.error).toBe('Verification failed');
    });

    it('GSDPhaseCompleteEvent has correct shape', () => {
      const event: GSDPhaseCompleteEvent = {
        type: GSDEventType.PhaseComplete,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        phaseName: 'Auth',
        success: true,
        totalCostUsd: 2.5,
        totalDurationMs: 120000,
        stepsCompleted: 5,
      };
      expect(event.type).toBe('phase_complete');
      expect(event.stepsCompleted).toBe(5);
    });
  });
});

// ─── GSDTools typed methods ──────────────────────────────────────────────────

describe('GSDTools typed methods', () => {
  let tmpDir: string;
  let fixtureDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gsd-tools-phase-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

  describe('initPhaseOp()', () => {
    it('returns typed PhaseOpInfo from gsd-tools output', async () => {
      const mockOutput: PhaseOpInfo = {
        phase_found: true,
        phase_dir: '.planning/phases/05-Skill-Scaffolding',
        phase_number: '5',
        phase_name: 'Skill Scaffolding',
        phase_slug: 'skill-scaffolding',
        padded_phase: '05',
        has_research: false,
        has_context: true,
        has_plans: true,
        has_verification: false,
        plan_count: 3,
        roadmap_exists: true,
        planning_exists: true,
        commit_docs: true,
        context_path: '.planning/phases/05-Skill-Scaffolding/CONTEXT.md',
        research_path: '.planning/phases/05-Skill-Scaffolding/RESEARCH.md',
      };

      const scriptPath = await createScript(
        'init-phase-op.cjs',
        `
        const args = process.argv.slice(2);
        // Script receives: init phase-op 5 --raw
        if (args[0] === 'init' && args[1] === 'phase-op' && args[2] === '5') {
          process.stdout.write(JSON.stringify(${JSON.stringify(mockOutput)}));
        } else {
          process.stderr.write('unexpected args: ' + args.join(' '));
          process.exit(1);
        }
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath });
      const result = await tools.initPhaseOp('5');

      expect(result.phase_found).toBe(true);
      expect(result.phase_number).toBe('5');
      expect(result.phase_name).toBe('Skill Scaffolding');
      expect(result.plan_count).toBe(3);
      expect(result.has_context).toBe(true);
      expect(result.has_plans).toBe(true);
      expect(result.context_path).toContain('CONTEXT.md');
    });

    it('calls exec with correct args (init phase-op <N>)', async () => {
      const scriptPath = await createScript(
        'init-phase-op-args.cjs',
        `
        const args = process.argv.slice(2);
        process.stdout.write(JSON.stringify({ received_args: args }));
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath });
      const result = await tools.initPhaseOp('7') as { received_args: string[] };

      expect(result.received_args).toContain('init');
      expect(result.received_args).toContain('phase-op');
      expect(result.received_args).toContain('7');
      // exec() no longer appends --raw (only execRaw does)
      expect(result.received_args).not.toContain('--raw');
    });
  });

  describe('configGet()', () => {
    it('returns string value from gsd-tools config', async () => {
      const scriptPath = await createScript(
        'config-get.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'config' && args[1] === 'get' && args[2] === 'model_profile') {
          process.stdout.write(JSON.stringify('balanced'));
        } else {
          process.exit(1);
        }
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath });
      const result = await tools.configGet('model_profile');

      expect(result).toBe('balanced');
    });

    it('returns null when key not found', async () => {
      const scriptPath = await createScript(
        'config-get-null.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'config' && args[1] === 'get') {
          process.stdout.write('null');
        } else {
          process.exit(1);
        }
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath });
      const result = await tools.configGet('nonexistent_key');

      expect(result).toBeNull();
    });
  });

  describe('stateBeginPhase()', () => {
    it('calls state begin-phase with correct args', async () => {
      const scriptPath = await createScript(
        'state-begin-phase.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'state' && args[1] === 'begin-phase' && args[2] === '--phase' && args[3] === '3') {
          process.stdout.write('ok');
        } else {
          process.stderr.write('unexpected args: ' + args.join(' '));
          process.exit(1);
        }
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath });
      const result = await tools.stateBeginPhase('3');

      expect(result).toBe('ok');
    });
  });
});
