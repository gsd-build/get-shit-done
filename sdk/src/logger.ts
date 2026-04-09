/**
 * Structured JSON logger for GSD debugging.
 *
 * Writes structured log entries to stderr (or configurable writable stream).
 * This is a debugging facility (R019), separate from the event stream.
 */

import type { Writable } from 'node:stream';
import type { PhaseType } from './types.js';

// ─── Log levels ──────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ─── Log entry ───────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  phase?: PhaseType;
  plan?: string;
  sessionId?: string;
  message: string;
  data?: Record<string, unknown>;
}

// ─── Logger options ──────────────────────────────────────────────────────────

export interface GSDLoggerOptions {
  /** Minimum log level to output. Default: 'info'. */
  level?: LogLevel;
  /** Output stream. Default: process.stderr. */
  output?: Writable;
  /** Phase context for all log entries. */
  phase?: PhaseType;
  /** Plan name context for all log entries. */
  plan?: string;
  /** Session ID context for all log entries. */
  sessionId?: string;
}

// ─── Logger class ────────────────────────────────────────────────────────────

export class GSDLogger {
  private readonly minLevel: number;
  private readonly output: Writable;
  private phase?: PhaseType;
  private plan?: string;
  private sessionId?: string;

  constructor(options: GSDLoggerOptions = {}) {
    this.minLevel = LOG_LEVEL_PRIORITY[options.level ?? 'info'];
    this.output = options.output ?? process.stderr;
    this.phase = options.phase;
    this.plan = options.plan;
    this.sessionId = options.sessionId;
  }

  /** Set phase context for subsequent log entries. */
  setPhase(phase: PhaseType | undefined): void {
    this.phase = phase;
  }

  /** Set plan context for subsequent log entries. */
  setPlan(plan: string | undefined): void {
    this.plan = plan;
  }

  /** Set session ID context for subsequent log entries. */
  setSessionId(sessionId: string | undefined): void {
    this.sessionId = sessionId;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (this.phase !== undefined) entry.phase = this.phase;
    if (this.plan !== undefined) entry.plan = this.plan;
    if (this.sessionId !== undefined) entry.sessionId = this.sessionId;
    if (data !== undefined) entry.data = data;

    this.output.write(JSON.stringify(entry) + '\n');
  }
}
