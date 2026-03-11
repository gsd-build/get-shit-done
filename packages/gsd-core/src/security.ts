import { resolve, relative, isAbsolute } from 'path';
import { realpath, lstat } from 'fs/promises';
import { auditLog } from './audit.js';

/**
 * Security configuration per CONTEXT.md:
 * - Project root only
 * - Hardcoded denylist
 * - Configurable symlink policy
 */
export interface SecurityConfig {
  projectRoot: string;
  symlinkPolicy: 'allow' | 'deny' | 'project-only';
  /** Patterns to deny. Defaults per CONTEXT.md: ['.env*', '*.pem', '*.key', 'secrets/**'] */
  denylist?: string[] | undefined;
}

const DEFAULT_DENYLIST = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  'secrets/**',
  '**/.git/config', // Protect git credentials
  '**/credentials.json',
];

/**
 * Result of path validation.
 */
export interface ValidationResult {
  valid: boolean;
  resolvedPath: string;
  reason?: string | undefined;
  isSymlink: boolean;
}

/**
 * Check if path matches a denylist pattern.
 * Supports: *, **, ? wildcards
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regex = pattern
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/{{GLOBSTAR}}/g, '.*');

  // Match against filename or full path
  const fileName = filePath.split('/').pop() ?? '';
  const fullPathRegex = new RegExp(`^${regex}$`);
  const fileNameRegex = new RegExp(`^${regex}$`);

  return fullPathRegex.test(filePath) || fileNameRegex.test(fileName);
}

/**
 * Validate a file path per CONTEXT.md security decisions:
 * - Check against denylist BEFORE resolving symlinks
 * - Resolve symlinks and verify target is within project root
 * - Apply symlink policy (allow/deny/project-only)
 *
 * @param requestedPath - Path to validate (absolute or relative to projectRoot)
 * @param config - Security configuration
 * @returns Validation result
 */
export async function validatePath(
  requestedPath: string,
  config: SecurityConfig
): Promise<ValidationResult> {
  const { projectRoot, symlinkPolicy } = config;
  const denylist = config.denylist ?? DEFAULT_DENYLIST;

  // Normalize to absolute path
  const absolutePath = isAbsolute(requestedPath)
    ? requestedPath
    : resolve(projectRoot, requestedPath);

  // Check denylist BEFORE resolving symlinks per RESEARCH.md
  for (const pattern of denylist) {
    if (matchesPattern(absolutePath, pattern)) {
      const reason = `Path matches denylist pattern: ${pattern}`;

      auditLog.log({
        path: absolutePath,
        reason,
        action: 'blocked',
        isSymlink: false,
      });

      return {
        valid: false,
        resolvedPath: absolutePath,
        reason,
        isSymlink: false,
      };
    }
  }

  // Check if path exists and resolve symlinks
  let resolvedPath = absolutePath;
  let isSymlink = false;

  try {
    const stats = await lstat(absolutePath);
    isSymlink = stats.isSymbolicLink();

    if (isSymlink) {
      // Apply symlink policy
      if (symlinkPolicy === 'deny') {
        const reason = 'Symlinks are denied by policy';

        auditLog.log({
          path: absolutePath,
          reason,
          action: 'blocked',
          isSymlink: true,
        });

        return {
          valid: false,
          resolvedPath: absolutePath,
          reason,
          isSymlink: true,
        };
      }

      // Resolve symlink to actual target
      resolvedPath = await realpath(absolutePath);
    }
  } catch {
    // File doesn't exist yet - validate requested path only
    // This allows creating new files within project root
    resolvedPath = absolutePath;
  }

  // Validate resolved path is within project root
  const relativePath = relative(projectRoot, resolvedPath);
  const escapesRoot = relativePath.startsWith('..') || isAbsolute(relativePath);

  if (escapesRoot) {
    const reason = `Path escapes project root: ${resolvedPath}`;

    auditLog.log({
      path: absolutePath,
      reason,
      action: 'blocked',
      isSymlink,
      resolvedPath,
    });

    return {
      valid: false,
      resolvedPath,
      reason,
      isSymlink,
    };
  }

  // For project-only symlink policy, target must also be in project
  if (isSymlink && symlinkPolicy === 'project-only') {
    const targetRelative = relative(projectRoot, resolvedPath);
    if (targetRelative.startsWith('..') || isAbsolute(targetRelative)) {
      const reason = 'Symlink target is outside project root';

      auditLog.log({
        path: absolutePath,
        reason,
        action: 'blocked',
        isSymlink: true,
        resolvedPath,
      });

      return {
        valid: false,
        resolvedPath,
        reason,
        isSymlink: true,
      };
    }
  }

  // Path is valid
  auditLog.log({
    path: absolutePath,
    reason: 'Access allowed',
    action: 'allowed',
    isSymlink,
    resolvedPath: isSymlink ? resolvedPath : undefined,
  });

  return {
    valid: true,
    resolvedPath,
    isSymlink,
  };
}

/**
 * Create a security-aware file operation wrapper.
 * Validates paths before executing operations.
 *
 * @param config - Security configuration
 * @returns Wrapped file operations
 */
export function createSecureFs(config: SecurityConfig) {
  return {
    async validatePath(requestedPath: string): Promise<ValidationResult> {
      return validatePath(requestedPath, config);
    },

    async assertPath(requestedPath: string): Promise<string> {
      const result = await validatePath(requestedPath, config);
      if (!result.valid) {
        const error = new Error(result.reason);
        (error as Error & { code: string }).code = 'EACCES';
        throw error;
      }
      return result.resolvedPath;
    },
  };
}
