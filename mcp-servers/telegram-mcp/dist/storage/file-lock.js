import { lock, unlock } from 'proper-lockfile';
import * as fs from 'fs/promises';
/**
 * Executes an operation with exclusive file lock protection.
 * Uses exponential backoff retry strategy for lock acquisition.
 *
 * @param filePath Path to the file to lock
 * @param operation Async operation to execute while holding the lock
 * @returns Result of the operation
 * @throws Error if lock cannot be acquired after all retries
 */
export async function withLock(filePath, operation) {
    const retries = [100, 200, 400]; // Exponential backoff: 100ms, 200ms, 400ms
    const staleMs = 10000; // 10 seconds
    let lastError = null;
    for (let attempt = 0; attempt < retries.length; attempt++) {
        try {
            // Ensure parent directory exists
            const dir = filePath.substring(0, filePath.lastIndexOf('/'));
            await fs.mkdir(dir, { recursive: true });
            // Ensure file exists (proper-lockfile requires it)
            try {
                await fs.access(filePath);
            }
            catch {
                await fs.writeFile(filePath, '', { flag: 'wx' }).catch(() => {
                    // File created by another process - that's fine
                });
            }
            // Attempt to acquire lock
            const release = await lock(filePath, {
                stale: staleMs,
                retries: 0 // We handle retries manually for better control
            });
            try {
                // Execute operation while holding lock
                return await operation();
            }
            finally {
                // Always release lock
                await unlock(filePath);
            }
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Log lock acquisition failure
            console.error(`[file-lock] Failed to acquire lock for ${filePath} (attempt ${attempt + 1}/${retries.length}): ${lastError.message}`);
            // Wait before retry (exponential backoff)
            if (attempt < retries.length - 1) {
                await new Promise(resolve => setTimeout(resolve, retries[attempt]));
            }
        }
    }
    // All retries exhausted
    throw new Error(`Failed to acquire lock for ${filePath} after ${retries.length} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
}
