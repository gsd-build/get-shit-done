import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { CLITransport } from './cli-transport.js';
import { GSDEventType, type GSDEvent, type GSDEventBase } from './types.js';

// ─── ANSI constants (mirror the source for readable assertions) ──────────────

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[90m';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBase(overrides: Partial<GSDEventBase> = {}): Omit<GSDEventBase, 'type'> {
  return {
    timestamp: '2025-06-15T14:30:45.123Z',
    sessionId: 'test-session',
    ...overrides,
  };
}

function readOutput(stream: PassThrough): string {
  const chunks: Buffer[] = [];
  let chunk: Buffer | null;
  while ((chunk = stream.read() as Buffer | null) !== null) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CLITransport', () => {
  it('formats SessionInit event correctly', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.SessionInit,
      model: 'claude-sonnet-4-20250514',
      tools: ['Read', 'Write', 'Bash'],
      cwd: '/home/project',
    } as GSDEvent);

    const output = readOutput(stream);
    expect(output).toBe(
      '[14:30:45] [INIT] Session started — model: claude-sonnet-4-20250514, tools: 3, cwd: /home/project',
    );
  });

  it('formats SessionComplete in green with checkmark', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.SessionComplete,
      success: true,
      totalCostUsd: 1.234,
      durationMs: 45600,
      numTurns: 12,
      result: 'done',
    } as GSDEvent);

    const output = readOutput(stream);
    expect(output).toBe(
      `[14:30:45] ${GREEN}✓ Session complete — cost: $1.23, turns: 12, duration: 45.6s${RESET}`,
    );
  });

  it('formats SessionError in red with ✗ marker', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.SessionError,
      success: false,
      totalCostUsd: 0.5,
      durationMs: 3000,
      numTurns: 2,
      errorSubtype: 'tool_error',
      errors: ['file not found', 'permission denied'],
    } as GSDEvent);

    const output = readOutput(stream);
    expect(output).toBe(
      `[14:30:45] ${RED}✗ Session failed — subtype: tool_error, errors: [file not found, permission denied]${RESET}`,
    );
  });

  it('formats PhaseStart as bold cyan banner and PhaseComplete with running cost', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.PhaseStart,
      phaseNumber: '01',
      phaseName: 'Authentication',
    } as GSDEvent);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.PhaseComplete,
      phaseNumber: '01',
      phaseName: 'Authentication',
      success: true,
      totalCostUsd: 2.50,
      totalDurationMs: 60000,
      stepsCompleted: 5,
    } as GSDEvent);

    const output = readOutput(stream);
    const lines = output.split('\n');
    expect(lines[0]).toBe(`${BOLD}${CYAN}━━━ GSD ► PHASE 01: Authentication ━━━${RESET}`);
    expect(lines[1]).toBe('[14:30:45] [PHASE] Phase 01 complete — success: true, cost: $2.50, running: $0.00');
  });

  it('formats ToolCall with truncated input', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    const longInput = { content: 'x'.repeat(200) };

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.ToolCall,
      toolName: 'Write',
      toolUseId: 'tool-123',
      input: longInput,
    } as GSDEvent);

    const output = readOutput(stream);
    expect(output).toMatch(/^\[14:30:45\] \[TOOL\] Write\(.+…\)$/);
    // The truncated input portion (inside parens) should be ≤80 chars
    const insideParens = output.match(/Write\((.+)\)/)![1]!;
    expect(insideParens.length).toBeLessThanOrEqual(80);
  });

  it('formats MilestoneStart as bold banner and MilestoneComplete with running cost', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.MilestoneStart,
      phaseCount: 3,
      prompt: 'build the app',
    } as GSDEvent);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.MilestoneComplete,
      success: true,
      totalCostUsd: 8.75,
      totalDurationMs: 300000,
      phasesCompleted: 3,
    } as GSDEvent);

    const output = readOutput(stream);
    const lines = output.split('\n');
    // MilestoneStart emits 3 lines (top bar, text, bottom bar)
    expect(lines[0]).toBe(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    expect(lines[1]).toBe(`${BOLD}  GSD Milestone — 3 phases${RESET}`);
    expect(lines[2]).toBe(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    expect(lines[3]).toBe(`${BOLD}━━━ Milestone complete — success: true, cost: $8.75, running: $0.00 ━━━${RESET}`);
  });

  it('close() is callable without error', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);
    expect(() => transport.close()).not.toThrow();
  });

  it('onEvent does not throw on unknown event type variant', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    // Use a known event type that hits the default/fallback branch
    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.ToolProgress,
      toolName: 'Bash',
      toolUseId: 'tool-456',
      elapsedSeconds: 12,
    } as GSDEvent);

    const output = readOutput(stream);
    expect(output).toBe('[14:30:45] [EVENT] tool_progress');
  });

  it('formats AssistantText as dim with truncation at 200 chars', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    const longText = 'A'.repeat(300);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.AssistantText,
      text: longText,
    } as GSDEvent);

    const output = readOutput(stream);
    expect(output).toMatch(new RegExp(`^${escRe(DIM)}\\[14:30:45\\] A+…${escRe(RESET)}$`));
    // Strip ANSI to check text length
    const stripped = stripAnsi(output);
    const agentText = stripped.split('] ')[1]!;
    expect(agentText.length).toBeLessThanOrEqual(200);
  });

  it('formats WaveStart in yellow and WaveComplete with colored counts', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.WaveStart,
      phaseNumber: '01',
      waveNumber: 2,
      planCount: 4,
      planIds: ['plan-a', 'plan-b', 'plan-c', 'plan-d'],
    } as GSDEvent);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.WaveComplete,
      phaseNumber: '01',
      waveNumber: 2,
      successCount: 3,
      failureCount: 1,
      durationMs: 25000,
    } as GSDEvent);

    const output = readOutput(stream);
    const lines = output.split('\n');
    expect(lines[0]).toBe(`${YELLOW}⟫ Wave 2 (4 plans)${RESET}`);
    expect(lines[1]).toBe(
      `[14:30:45] [WAVE] Wave 2 complete — ${GREEN}3 success${RESET}, ${RED}1 failed${RESET}, 25000ms`,
    );
  });

  // ─── New tests for rich formatting ─────────────────────────────────────────

  it('formats PhaseStepStart in cyan with ◆ indicator', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.PhaseStepStart,
      phaseNumber: '01',
      step: 'research',
    } as GSDEvent);

    const output = readOutput(stream);
    expect(output).toBe(`${CYAN}◆ research${RESET}`);
  });

  it('formats PhaseStepComplete green ✓ on success, red ✗ on failure', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.PhaseStepComplete,
      phaseNumber: '01',
      step: 'plan',
      success: true,
      durationMs: 5200,
    } as GSDEvent);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.PhaseStepComplete,
      phaseNumber: '01',
      step: 'execute',
      success: false,
      durationMs: 12000,
    } as GSDEvent);

    const output = readOutput(stream);
    const lines = output.split('\n');
    expect(lines[0]).toBe(`${GREEN}✓ plan${RESET} ${DIM}5200ms${RESET}`);
    expect(lines[1]).toBe(`${RED}✗ execute${RESET} ${DIM}12000ms${RESET}`);
  });

  it('formats InitResearchSpawn in cyan with ◆ and session count', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.InitResearchSpawn,
      sessionCount: 4,
      researchTypes: ['stack', 'features', 'architecture', 'pitfalls'],
    } as GSDEvent);

    const output = readOutput(stream);
    expect(output).toBe(`${CYAN}◆ Spawning 4 researchers...${RESET}`);
  });

  it('tracks running cost across CostUpdate events', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    // First cost update
    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.CostUpdate,
      sessionCostUsd: 0.50,
      cumulativeCostUsd: 0.50,
    } as GSDEvent);

    // Second cost update
    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.CostUpdate,
      sessionCostUsd: 0.75,
      cumulativeCostUsd: 1.25,
    } as GSDEvent);

    const output = readOutput(stream);
    const lines = output.split('\n');
    expect(lines[0]).toBe(`${DIM}[14:30:45] Cost: session $0.50, running $0.50${RESET}`);
    expect(lines[1]).toBe(`${DIM}[14:30:45] Cost: session $0.75, running $1.25${RESET}`);
  });

  it('shows running cost in PhaseComplete and MilestoneComplete after CostUpdates', () => {
    const stream = new PassThrough();
    const transport = new CLITransport(stream);

    // Accumulate some cost
    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.CostUpdate,
      sessionCostUsd: 1.50,
      cumulativeCostUsd: 1.50,
    } as GSDEvent);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.PhaseComplete,
      phaseNumber: '02',
      phaseName: 'Build',
      success: true,
      totalCostUsd: 1.50,
      totalDurationMs: 30000,
      stepsCompleted: 3,
    } as GSDEvent);

    transport.onEvent({
      ...makeBase(),
      type: GSDEventType.MilestoneComplete,
      success: true,
      totalCostUsd: 1.50,
      totalDurationMs: 30000,
      phasesCompleted: 2,
    } as GSDEvent);

    const output = readOutput(stream);
    const lines = output.split('\n');
    // CostUpdate line
    expect(lines[0]).toContain('running $1.50');
    // PhaseComplete includes running cost
    expect(lines[1]).toContain('running: $1.50');
    // MilestoneComplete includes running cost
    expect(lines[2]).toContain('running: $1.50');
  });
});

// ─── Test utilities ──────────────────────────────────────────────────────────

/** Escape a string for use in a RegExp. */
function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip ANSI escape sequences from a string. */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}
