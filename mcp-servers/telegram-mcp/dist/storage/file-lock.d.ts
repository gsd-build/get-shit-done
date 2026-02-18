/**
 * Executes an operation with exclusive file lock protection.
 * Uses exponential backoff retry strategy for lock acquisition.
 *
 * @param filePath Path to the file to lock
 * @param operation Async operation to execute while holding the lock
 * @returns Result of the operation
 * @throws Error if lock cannot be acquired after all retries
 */
export declare function withLock<T>(filePath: string, operation: () => Promise<T>): Promise<T>;
