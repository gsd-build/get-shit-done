import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PlanningRuntime } from './planning-runtime.js';

describe('PlanningRuntime', () => {
  it('records intent events through the durable journal', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-runtime-'));
    const runtime = new PlanningRuntime({
      projectDir: dir,
      projectId: 'project-1',
      runId: 'run-1',
      sourceId: 'sdk-1',
      actor: { type: 'agent', id: 'agent-1', role: 'executor' },
    });

    await runtime.status({ idempotencyKey: 'status-1' });
    await runtime.next({ idempotencyKey: 'next-1', createPlan: { title: 'Plan', items: [{ title: 'Item' }] } });
    await runtime.checkpoint({ idempotencyKey: 'checkpoint-1', summary: 'Progress' });

    const events = await runtime.journal.readAll();
    expect(events.map((event) => event.type)).toEqual([
      'plan.status',
      'plan.next',
      'plan.checkpoint',
    ]);
  });
});
