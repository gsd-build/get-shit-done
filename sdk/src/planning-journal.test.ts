import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PlanningJournal } from './planning-journal.js';

describe('PlanningJournal', () => {
  it('appends events with monotonic source sequence numbers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-journal-'));
    const journal = new PlanningJournal({ projectDir: dir, sourceId: 'daemon-1', runId: 'run-1' });

    const first = await journal.append({
      projectId: 'project-1',
      type: 'plan.next',
      actor: { type: 'agent', id: 'agent-1' },
      payload: { itemId: 'item-1' },
      idempotencyKey: 'next-1',
    });
    const second = await journal.append({
      projectId: 'project-1',
      type: 'plan.done',
      actor: { type: 'agent', id: 'agent-1' },
      payload: { itemId: 'item-1' },
      idempotencyKey: 'done-1',
    });

    expect(first.source.seq).toBe(1);
    expect(second.source.seq).toBe(2);
    expect(await journal.readAll()).toHaveLength(2);
  });

  it('replays an existing event for duplicate idempotency keys', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-journal-'));
    const journal = new PlanningJournal({ projectDir: dir, sourceId: 'sdk-1', runId: 'run-1' });

    const first = await journal.append({
      projectId: 'project-1',
      type: 'plan.checkpoint',
      actor: { type: 'agent', id: 'agent-1' },
      payload: { summary: 'Progress' },
      idempotencyKey: 'checkpoint-1',
    });
    const replay = await journal.append({
      projectId: 'project-1',
      type: 'plan.checkpoint',
      actor: { type: 'agent', id: 'agent-1' },
      payload: { summary: 'Progress' },
      idempotencyKey: 'checkpoint-1',
    });

    expect(replay.id).toBe(first.id);
    expect(await journal.readAll()).toHaveLength(1);
  });

  it('writes jsonl under .gsd/journal.jsonl', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-journal-'));
    const journal = new PlanningJournal({ projectDir: dir, sourceId: 'sdk-1', runId: 'run-1' });
    await journal.append({
      projectId: 'project-1',
      type: 'plan.status',
      actor: { type: 'agent', id: 'agent-1' },
      payload: {},
      idempotencyKey: 'status-1',
    });

    const raw = await readFile(join(dir, '.gsd', 'journal.jsonl'), 'utf8');
    expect(raw.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(raw).schemaVersion).toBe(1);
  });
});
