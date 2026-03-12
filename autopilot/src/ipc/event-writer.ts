// EventWriter - appends NDJSON event lines to the event log file.
// Used by the autopilot process to persist events for the dashboard to tail.

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { IPC_PATHS } from './types.js';
import type { IPCEvent } from './types.js';

/** Options for configuring an EventWriter with worker metadata */
export interface EventWriterOptions {
  /** Phase number for per-worker file routing */
  phaseNumber?: number;
  /** Worker identifier included in event entries */
  workerId?: string;
}

export class EventWriter {
  private seq = 0;
  private readonly filePath: string;
  private initialized = false;
  private readonly metadata: EventWriterOptions;

  constructor(projectDir: string, options?: EventWriterOptions) {
    this.metadata = options ?? {};
    this.filePath =
      this.metadata.phaseNumber != null
        ? IPC_PATHS.workerEvents(projectDir, this.metadata.phaseNumber)
        : IPC_PATHS.events(projectDir);
  }

  /** Ensures the parent directory exists */
  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    this.initialized = true;
  }

  /** Appends an event to the NDJSON file */
  async write(event: string, data: unknown, stepName?: string): Promise<void> {
    await this.ensureDir();
    this.seq++;
    const entry: IPCEvent = {
      seq: this.seq,
      timestamp: new Date().toISOString(),
      event,
      data,
      ...(this.metadata.phaseNumber != null && { phaseNumber: this.metadata.phaseNumber }),
      ...(this.metadata.workerId != null && { workerId: this.metadata.workerId }),
      ...(stepName != null && { stepName }),
    };
    await appendFile(this.filePath, JSON.stringify(entry) + '\n', 'utf-8');
  }

  /** Returns the current sequence number */
  get currentSeq(): number {
    return this.seq;
  }

  /** Returns the file path for the event log */
  get path(): string {
    return this.filePath;
  }
}
