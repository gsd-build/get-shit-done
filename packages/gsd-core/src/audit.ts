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
  deniedPatterns: Record<string, number>; // Pattern -> count
}

/**
 * Security audit log with metrics collection.
 * Logs to stderr as structured JSON per CONTEXT.md.
 */
export class SecurityAuditLog {
  private metrics: SecurityMetrics = {
    blockedCount: 0,
    allowedCount: 0,
    symlinkCount: 0,
    deniedPatterns: {},
  };

  /**
   * Log a security event.
   */
  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const logEntry: AuditLogEntry = {
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
    } else {
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
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for testing).
   */
  resetMetrics(): void {
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
