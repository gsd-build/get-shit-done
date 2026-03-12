/**
 * Security audit log with metrics collection.
 * Logs to stderr as structured JSON per CONTEXT.md.
 */
export class SecurityAuditLog {
    metrics = {
        blockedCount: 0,
        allowedCount: 0,
        symlinkCount: 0,
        deniedPatterns: {},
    };
    /**
     * Log a security event.
     */
    log(entry) {
        const logEntry = {
            ...entry,
            timestamp: new Date().toISOString(),
        };
        // Update metrics
        if (entry.action === 'blocked') {
            this.metrics.blockedCount++;
            // Track which patterns are being hit
            const pattern = entry.reason.match(/pattern: (.+)$/)?.[1];
            if (pattern) {
                this.metrics.deniedPatterns[pattern] =
                    (this.metrics.deniedPatterns[pattern] ?? 0) + 1;
            }
        }
        else {
            this.metrics.allowedCount++;
        }
        if (entry.isSymlink) {
            this.metrics.symlinkCount++;
        }
        // Structured JSON to stderr
        console.error(JSON.stringify({ type: 'security_audit', ...logEntry }));
    }
    /**
     * Get current metrics snapshot.
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Reset metrics (useful for testing).
     */
    resetMetrics() {
        this.metrics = {
            blockedCount: 0,
            allowedCount: 0,
            symlinkCount: 0,
            deniedPatterns: {},
        };
    }
}
// Singleton instance for shared use
export const auditLog = new SecurityAuditLog();
//# sourceMappingURL=audit.js.map