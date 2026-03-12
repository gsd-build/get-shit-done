/**
 * Audit log entry per CONTEXT.md:
 * { path, reason, timestamp }
 */
export interface AuditLogEntry {
    timestamp: string;
    path: string;
    reason: string;
    action: 'blocked' | 'allowed';
    isSymlink: boolean;
    resolvedPath?: string | undefined;
}
/**
 * Security metrics for blocked access counter.
 */
export interface SecurityMetrics {
    blockedCount: number;
    allowedCount: number;
    symlinkCount: number;
    deniedPatterns: Record<string, number>;
}
/**
 * Security audit log with metrics collection.
 * Logs to stderr as structured JSON per CONTEXT.md.
 */
export declare class SecurityAuditLog {
    private metrics;
    /**
     * Log a security event.
     */
    log(entry: Omit<AuditLogEntry, 'timestamp'>): void;
    /**
     * Get current metrics snapshot.
     */
    getMetrics(): SecurityMetrics;
    /**
     * Reset metrics (useful for testing).
     */
    resetMetrics(): void;
}
export declare const auditLog: SecurityAuditLog;
//# sourceMappingURL=audit.d.ts.map