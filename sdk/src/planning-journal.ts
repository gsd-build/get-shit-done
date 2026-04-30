import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';

export type PlanningEventActor = {
  type: 'human' | 'agent' | 'runtime' | 'verifier' | 'system';
  id: string;
  role?: string;
  sessionId?: string;
  taskId?: string;
};

export type PlanningEvent = {
  id: string;
  schemaVersion: 1;
  projectionVersion: number;
  projectId: string;
  source: { id: string; kind: 'sdk' | 'daemon' | 'cloud' | 'import'; seq: number; cursor?: string };
  runId: string;
  workstreamId?: string;
  planId?: string;
  itemId?: string;
  actor: PlanningEventActor;
  authority: 'local' | 'cloud' | 'human_approved' | 'system';
  type: string;
  idempotencyKey: string;
  causationId?: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  evidenceIds: string[];
  parentEventIds: string[];
  trace: Record<string, unknown>;
  requestHash: string;
};

export type PlanningJournalAppendInput = {
  projectId: string;
  type: string;
  actor: PlanningEventActor;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  planId?: string;
  itemId?: string;
  workstreamId?: string;
  evidenceIds?: string[];
  parentEventIds?: string[];
  causationId?: string;
  trace?: Record<string, unknown>;
};

export class PlanningJournal {
  private readonly path: string;

  constructor(
    private readonly options: {
      projectDir: string;
      sourceId: string;
      runId: string;
      sourceKind?: 'sdk' | 'daemon' | 'cloud' | 'import';
      projectionVersion?: number;
    },
  ) {
    this.path = join(options.projectDir, '.gsd', 'journal.jsonl');
  }

  async append(input: PlanningJournalAppendInput): Promise<PlanningEvent> {
    const existing = await this.findByIdempotency(input.idempotencyKey);
    const requestHash = hashRequest(input);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new Error(`conflicting idempotency key: ${input.idempotencyKey}`);
      }
      return existing;
    }

    const events = await this.readAll();
    const event: PlanningEvent = {
      id: randomUUID(),
      schemaVersion: 1,
      projectionVersion: this.options.projectionVersion ?? 1,
      projectId: input.projectId,
      source: {
        id: this.options.sourceId,
        kind: this.options.sourceKind ?? 'sdk',
        seq: events.filter((candidate) => candidate.source.id === this.options.sourceId).length + 1,
      },
      runId: this.options.runId,
      workstreamId: input.workstreamId,
      planId: input.planId,
      itemId: input.itemId,
      actor: input.actor,
      authority: 'local',
      type: input.type,
      idempotencyKey: input.idempotencyKey,
      causationId: input.causationId,
      occurredAt: new Date().toISOString(),
      payload: input.payload,
      evidenceIds: input.evidenceIds ?? [],
      parentEventIds: input.parentEventIds ?? [],
      trace: input.trace ?? {},
      requestHash,
    };

    await mkdir(join(this.options.projectDir, '.gsd'), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(event)}\n`, 'utf8');
    return event;
  }

  async readAll(): Promise<PlanningEvent[]> {
    let raw = '';
    try {
      raw = await readFile(this.path, 'utf8');
    } catch {
      return [];
    }
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PlanningEvent);
  }

  async compact(events: PlanningEvent[]): Promise<void> {
    await mkdir(join(this.options.projectDir, '.gsd'), { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(
      tmp,
      events.map((event) => JSON.stringify(event)).join('\n') + (events.length ? '\n' : ''),
      'utf8',
    );
    await rename(tmp, this.path);
  }

  private async findByIdempotency(idempotencyKey: string): Promise<PlanningEvent | null> {
    const events = await this.readAll();
    return events.find((event) => event.idempotencyKey === idempotencyKey) ?? null;
  }
}

function hashRequest(input: PlanningJournalAppendInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        projectId: input.projectId,
        type: input.type,
        payload: input.payload,
        planId: input.planId,
        itemId: input.itemId,
        actor: input.actor,
      }),
    )
    .digest('hex');
}
