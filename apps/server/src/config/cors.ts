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

function isLocalhostOrigin(origin: string): boolean {
  return (
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('https://127.0.0.1')
  );
}

function splitOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function getAllowedOrigins(): string[] {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const allowLocalhostInProd = process.env['ALLOW_LOCALHOST_CORS'] === 'true';

  const envDerivedOrigins = [
    process.env['WEB_URL'],
    process.env['NEXT_PUBLIC_WEB_URL'],
    process.env['APP_URL'],
    process.env['FRONTEND_URL'],
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));

  const envOrigins = [
    ...splitOrigins(process.env['CORS_ORIGINS']),
    ...splitOrigins(process.env['CORS_ORIGIN']),
    ...envDerivedOrigins,
  ];

  const uniqueOrigins = Array.from(new Set(envOrigins));
  const filteredOrigins =
    isProduction && !allowLocalhostInProd
      ? uniqueOrigins.filter((origin) => !isLocalhostOrigin(origin))
      : uniqueOrigins;

  if (filteredOrigins.length > 0) {
    return filteredOrigins;
  }

  if (isProduction) {
    return [];
  }

  return DEFAULT_ORIGINS;
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }

  // Safe local fallback when no explicit origins are configured.
  if (allowedOrigins.length === 0) {
    return isLocalhostOrigin(origin);
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
    if (allowedOrigins.includes('*')) return '*';
    return allowedOrigins[0] ?? null;
  }

  if (allowedOrigins.length === 0) {
    return isLocalhostOrigin(origin) ? origin : null;
  }

  if (allowedOrigins.includes('*')) {
    return '*';
  }

  return allowedOrigins.includes(origin) ? origin : null;
}
