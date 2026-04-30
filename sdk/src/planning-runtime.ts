import { PlanningJournal, type PlanningEventActor } from './planning-journal.js';

type RuntimeOptions = {
  projectDir: string;
  projectId: string;
  runId: string;
  sourceId: string;
  actor: PlanningEventActor;
};

type RuntimeMeta = {
  idempotencyKey: string;
  planId?: string;
  itemId?: string;
};

type NextInput = RuntimeMeta & {
  selector?: { itemId?: string; titleIncludes?: string };
  createPlan?: { title: string; items: Array<{ title: string; description?: string; dependsOn?: string[] }> };
};

type CheckpointInput = RuntimeMeta & {
  summary?: string;
  subTasks?: Array<{ id?: string; text: string }>;
  agentCriteria?: Array<{ id?: string; text: string }>;
  criteriaMet?: string[];
  blocked?: { reason: string; nextAction?: string };
};

type DoneInput = RuntimeMeta & {
  summary: string;
  blockers?: string[];
  criteriaMet?: string[];
  evidenceRefs?: string[];
  evidencePolicy?: 'auto' | 'explicit' | 'waive';
  evidenceWaiverReason?: string;
  advance?: boolean;
};

export class PlanningRuntime {
  readonly journal: PlanningJournal;

  constructor(private readonly options: RuntimeOptions) {
    this.journal = new PlanningJournal({
      projectDir: options.projectDir,
      sourceId: options.sourceId,
      runId: options.runId,
      sourceKind: 'sdk',
    });
  }

  status(input: RuntimeMeta) {
    return this.record('plan.status', input, {});
  }

  next(input: NextInput) {
    return this.record('plan.next', input, {
      selector: input.selector,
      createPlan: input.createPlan,
    });
  }

  checkpoint(input: CheckpointInput) {
    return this.record('plan.checkpoint', input, {
      summary: input.summary,
      subTasks: input.subTasks,
      agentCriteria: input.agentCriteria,
      criteriaMet: input.criteriaMet,
      blocked: input.blocked,
    });
  }

  sync(input: RuntimeMeta & { cursor?: string }) {
    return this.record('plan.sync', input, { cursor: input.cursor });
  }

  done(input: DoneInput) {
    return this.record('plan.done', input, {
      summary: input.summary,
      blockers: input.blockers,
      criteriaMet: input.criteriaMet,
      evidenceRefs: input.evidenceRefs,
      evidencePolicy: input.evidencePolicy ?? 'auto',
      evidenceWaiverReason: input.evidenceWaiverReason,
      advance: input.advance ?? true,
    });
  }

  private record(type: string, input: RuntimeMeta, payload: Record<string, unknown>) {
    return this.journal.append({
      projectId: this.options.projectId,
      type,
      actor: this.options.actor,
      planId: input.planId,
      itemId: input.itemId,
      idempotencyKey: input.idempotencyKey,
      payload,
    });
  }
}
