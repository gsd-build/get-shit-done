/**
 * Error classification system for the GSD SDK.
 *
 * Provides a taxonomy of error types with semantic exit codes,
 * enabling CLI consumers and agents to distinguish between
 * validation failures, execution errors, blocked states, and
 * interruptions.
 *
 * @example
 * ```typescript
 * import { GSDError, ErrorClassification, exitCodeFor } from './errors.js';
 *
 * throw new GSDError('missing required arg', ErrorClassification.Validation);
 * // CLI catch handler: process.exitCode = exitCodeFor(err.classification); // 10
 * ```
 */

// ─── Error Classification ───────────────────────────────────────────────────

/** Classifies SDK errors into semantic categories for exit code mapping. */
export enum ErrorClassification {
  /** Bad input, missing args, schema violations. Exit code 10. */
  Validation = 'validation',

  /** Runtime failure, file I/O, parse errors. Exit code 1. */
  Execution = 'execution',

  /** Dependency missing, phase not found. Exit code 11. */
  Blocked = 'blocked',

  /** Timeout, signal, user cancel. Exit code 1. */
  Interruption = 'interruption',
}

// ─── GSDError ───────────────────────────────────────────────────────────────

/**
 * Base error class for the GSD SDK with classification support.
 *
 * @param message - Human-readable error description
 * @param classification - Error category for exit code mapping
 */
export class GSDError extends Error {
  readonly name = 'GSDError';
  readonly classification: ErrorClassification;

  constructor(message: string, classification: ErrorClassification) {
    super(message);
    this.classification = classification;
  }
}

// ─── Exit code mapping ──────────────────────────────────────────────────────

/**
 * Maps an error classification to a semantic exit code.
 *
 * @param classification - The error classification to map
 * @returns Numeric exit code: 10 (validation), 11 (blocked), 1 (execution/interruption)
 */
export function exitCodeFor(classification: ErrorClassification): number {
  switch (classification) {
    case ErrorClassification.Validation:
      return 10;
    case ErrorClassification.Blocked:
      return 11;
    case ErrorClassification.Execution:
    case ErrorClassification.Interruption:
    default:
      return 1;
  }
}
