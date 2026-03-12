/**
 * CORS origin helpers shared by REST and Socket.IO.
 *
 * Supports:
 * - CORS_ORIGINS: comma-separated list
 * - CORS_ORIGIN: single origin (backward-compatible)
 *
 * Wildcard "*" is supported for development convenience.
 */

const DEFAULT_ORIGINS = ['http://localhost:3000'];

function splitOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function getAllowedOrigins(): string[] {
  const envOrigins = [
    ...splitOrigins(process.env['CORS_ORIGINS']),
    ...splitOrigins(process.env['CORS_ORIGIN']),
  ];

  if (envOrigins.length > 0) {
    return Array.from(new Set(envOrigins));
  }

  return DEFAULT_ORIGINS;
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes('*')) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

export function resolveCorsOrigin(
  origin: string | undefined,
  allowedOrigins: string[]
): string | null {
  if (!origin) {
    return allowedOrigins.includes('*') ? '*' : allowedOrigins[0] ?? null;
  }

  if (allowedOrigins.includes('*')) {
    return '*';
  }

  return allowedOrigins.includes(origin) ? origin : null;
}
