import { validatePath, SecurityConfig, auditLog } from '@gsd/gsd-core';

/**
 * Security middleware configuration.
 * Used for REST API and Socket.IO file operations.
 */
export interface SecurityMiddlewareConfig {
  projectRoot: string;
  symlinkPolicy?: 'allow' | 'deny' | 'project-only' | undefined;
}

/**
 * Create security configuration from middleware config.
 * Uses defaults from CONTEXT.md.
 */
export function createSecurityConfig(
  config: SecurityMiddlewareConfig
): SecurityConfig {
  return {
    projectRoot: config.projectRoot,
    symlinkPolicy: config.symlinkPolicy ?? 'allow',
    // Default denylist from security.ts
  };
}

/**
 * Validate a path for file operations.
 * Returns validated path or throws with structured error.
 *
 * @param path - Requested file path
 * @param config - Security configuration
 * @returns Resolved path if valid
 * @throws Error with code 'EACCES' if invalid
 */
export async function assertSecurePath(
  path: string,
  config: SecurityConfig
): Promise<string> {
  const result = await validatePath(path, config);

  if (!result.valid) {
    const error = new Error(result.reason);
    Object.assign(error, {
      code: 'EACCES',
      path,
      resolvedPath: result.resolvedPath,
      isSymlink: result.isSymlink,
    });
    throw error;
  }

  return result.resolvedPath;
}

/**
 * Get current security metrics.
 */
export function getSecurityMetrics() {
  return auditLog.getMetrics();
}
