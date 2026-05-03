import { GSDError, exitCodeFor } from './errors.js';
import { GSDToolsError } from './gsd-tools-error.js';

/**
 * Module owning projection of internal errors to GSDToolsError contract.
 */
export function toGSDToolsError(command: string, args: string[], err: unknown): GSDToolsError {
  if (err instanceof GSDError) {
    return new GSDToolsError(
      err.message,
      command,
      args,
      exitCodeFor(err.classification),
      '',
      { cause: err },
    );
  }

  const msg = err instanceof Error ? err.message : String(err);
  return new GSDToolsError(
    msg,
    command,
    args,
    1,
    '',
    err instanceof Error ? { cause: err } : undefined,
  );
}
