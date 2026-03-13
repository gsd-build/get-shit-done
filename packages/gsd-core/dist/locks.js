import lockfile from 'proper-lockfile';
import { dirname } from 'path';
import { mkdir } from 'fs/promises';
const DEFAULT_OPTIONS = {
    stale: 30000,
    update: 15000,
    retries: 3,
    realpath: true,
};
/**
 * Acquire advisory lock on a file.
 * Exposed for advanced use cases per CONTEXT.md.
 *
 * @param filePath - Path to lock
 * @param options - Lock configuration
 * @returns Lock result with release function or error
 */
export async function acquireLock(filePath, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    try {
        // Ensure parent directory exists (for new files)
        await mkdir(dirname(filePath), { recursive: true });
        const release = await lockfile.lock(filePath, {
            stale: opts.stale,
            update: opts.update,
            retries: {
                retries: opts.retries,
                minTimeout: 100,
                maxTimeout: 1000,
            },
            realpath: opts.realpath,
            onCompromised: (err) => {
                console.error('[lock] Lock compromised:', filePath, err.message);
            },
        });
        return { success: true, release };
    }
    catch (err) {
        const error = err;
        if (error.code === 'ELOCKED') {
            // Try to get lock info for structured error
            let holder;
            let age;
            try {
                // proper-lockfile doesn't expose holder info directly
                // but we can check lock file existence for diagnostics
                await lockfile.check(filePath);
            }
            catch {
                // Ignore check errors
            }
            return {
                success: false,
                error: {
                    code: 'ELOCKED',
                    file: filePath,
                    holder,
                    age,
                    message: `File is locked: ${filePath}`,
                },
            };
        }
        return {
            success: false,
            error: {
                code: error.code === 'ENOENT' ? 'ENOENT' : 'ECOMPROMISED',
                file: filePath,
                message: error.message,
            },
        };
    }
}
/**
 * Release a lock manually.
 * For use with acquireLock() when not using withFileLock().
 */
export async function releaseLock(filePath) {
    try {
        await lockfile.unlock(filePath);
    }
    catch (err) {
        // Ignore unlock errors (lock may have expired)
        console.warn('[lock] Release warning:', err.message);
    }
}
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
export async function withFileLock(filePath, operation, options = {}) {
    const result = await acquireLock(filePath, options);
    if (!result.success) {
        const error = new Error(result.error.message);
        error.lockError = result.error;
        throw error;
    }
    try {
        return await operation();
    }
    finally {
        await result.release();
    }
}
/**
 * Check if a file is currently locked.
 * Useful for diagnostic purposes.
 */
export async function isLocked(filePath) {
    try {
        return await lockfile.check(filePath);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=locks.js.map