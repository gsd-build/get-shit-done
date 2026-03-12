/**
 * Lock configuration per CONTEXT.md decisions:
 * - TTL: 30 seconds
 * - Stale detection: automatic
 * - Auto-cleanup on next access
 */
export interface LockOptions {
    stale?: number;
    update?: number;
    retries?: number;
    realpath?: boolean;
}
/**
 * Structured lock error with context per CONTEXT.md.
 */
export interface LockError {
    code: 'ELOCKED' | 'ECOMPROMISED' | 'ENOENT';
    file: string;
    holder?: string | undefined;
    age?: number | undefined;
    message: string;
}
/**
 * Result of lock acquisition.
 */
export type LockResult = {
    success: true;
    release: () => Promise<void>;
} | {
    success: false;
    error: LockError;
};
/**
 * Acquire advisory lock on a file.
 * Exposed for advanced use cases per CONTEXT.md.
 *
 * @param filePath - Path to lock
 * @param options - Lock configuration
 * @returns Lock result with release function or error
 */
export declare function acquireLock(filePath: string, options?: LockOptions): Promise<LockResult>;
/**
 * Release a lock manually.
 * For use with acquireLock() when not using withFileLock().
 */
export declare function releaseLock(filePath: string): Promise<void>;
/**
 * Execute operation with automatic file locking.
 * Internal auto-locking for standard ops per CONTEXT.md.
 *
 * @param filePath - Path to lock
 * @param operation - Async operation to execute
 * @param options - Lock configuration
 * @returns Operation result
 * @throws On lock failure with structured error
 */
export declare function withFileLock<T>(filePath: string, operation: () => Promise<T>, options?: LockOptions): Promise<T>;
/**
 * Check if a file is currently locked.
 * Useful for diagnostic purposes.
 */
export declare function isLocked(filePath: string): Promise<boolean>;
//# sourceMappingURL=locks.d.ts.map