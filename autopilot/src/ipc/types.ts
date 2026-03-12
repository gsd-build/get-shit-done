// Shared IPC type contracts for file-based communication
// between the autopilot process and the standalone dashboard process.

import { join } from 'node:path';

/** Paths for IPC files relative to project .planning/autopilot/ directory */
export const IPC_PATHS = {
  /** Autopilot state file (already exists, written by StateStore) */
  state: (projectDir: string) => join(projectDir, '.planning', 'autopilot', 'state.json'),
  /** NDJSON event log for SSE streaming */
  events: (projectDir: string) => join(projectDir, '.planning', 'autopilot', 'log', 'events.ndjson'),
  /** Heartbeat file for liveness detection */
  heartbeat: (projectDir: string) => join(projectDir, '.planning', 'autopilot', 'heartbeat.json'),
  /** Directory for answer files (dashboard writes, autopilot reads) */
  answersDir: (projectDir: string) => join(projectDir, '.planning', 'autopilot', 'answers'),
  /** Individual answer file */
  answer: (projectDir: string, questionId: string) =>
    join(projectDir, '.planning', 'autopilot', 'answers', `${questionId}.json`),
  /** Per-worker event log file for parallel execution */
  workerEvents: (projectDir: string, phaseNumber: number) =>
    join(projectDir, '.planning', 'autopilot', 'log', `events-phase-${phaseNumber}.ndjson`),
} as const;

/** Event written to the NDJSON event log */
export interface IPCEvent {
  seq: number;
  timestamp: string;
  event: string;
  data: unknown;
  /** Phase number of the worker that emitted this event (parallel execution) */
  phaseNumber?: number;
  /** Identifier of the worker that emitted this event (parallel execution) */
  workerId?: string;
  /** Name of the step within the phase (e.g., 'plan', 'execute') */
  stepName?: string;
}

/** Answer file written by the dashboard, read by the autopilot */
export interface IPCAnswer {
  questionId: string;
  answers: Record<string, string>;
  answeredAt: string;
}

/** Heartbeat file written by the autopilot every 5 seconds */
export interface IPCHeartbeat {
  pid: number;
  timestamp: string;
  status: string;
}

/** Staleness threshold: if heartbeat is older than this, autopilot is presumed dead */
export const HEARTBEAT_STALE_MS = 15_000;

/** Heartbeat write interval */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/** Answer poll interval */
export const ANSWER_POLL_INTERVAL_MS = 1_000;
