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
 * Validate a file path per CONTEXT.md security decisions:
 * - Check against denylist BEFORE resolving symlinks
 * - Resolve symlinks and verify target is within project root
 * - Apply symlink policy (allow/deny/project-only)
 *
 * @param requestedPath - Path to validate (absolute or relative to projectRoot)
 * @param config - Security configuration
 * @returns Validation result
 */
export declare function validatePath(requestedPath: string, config: SecurityConfig): Promise<ValidationResult>;
/**
 * Create a security-aware file operation wrapper.
 * Validates paths before executing operations.
 *
 * @param config - Security configuration
 * @returns Wrapped file operations
 */
export declare function createSecureFs(config: SecurityConfig): {
    validatePath(requestedPath: string): Promise<ValidationResult>;
    assertPath(requestedPath: string): Promise<string>;
};
//# sourceMappingURL=security.d.ts.map