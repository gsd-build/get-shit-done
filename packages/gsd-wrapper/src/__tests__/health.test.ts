import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock execGsdTools before importing health module
vi.mock('../exec.js', () => ({
  execGsdTools: vi.fn(),
}));

import { getHealth } from '../health.js';
import { execGsdTools } from '../exec.js';
import type { HealthReport } from '../types.js';

const mockExecGsdTools = vi.mocked(execGsdTools);

describe('health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHealth', () => {
    it('returns health report on success', async () => {
      // Arrange
      const healthData: HealthReport = {
        status: 'healthy',
        issues: [],
        exit_code: 0,
        summary: {
          orphan_count: 0,
          stale_lock_count: 0,
          incomplete_count: 0,
          sync_issue_count: 0,
        },
      };

      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: healthData,
      });

      // Act
      const result = await getHealth('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('healthy');
        expect(result.data.issues).toHaveLength(0);
        expect(result.data.exit_code).toBe(0);
      }
    });

    it('returns degraded status with issues', async () => {
      // Arrange
      const healthData: HealthReport = {
        status: 'degraded',
        issues: [
          {
            type: 'stale_lock',
            phase: '14',
            path: '.planning/phases/14-backend/STATE.lock',
            branch: null,
            age_days: 3,
            suggested_action: 'Remove stale lock file',
            repairable: true,
          },
        ],
        exit_code: 1,
        summary: {
          orphan_count: 0,
          stale_lock_count: 1,
          incomplete_count: 0,
          sync_issue_count: 0,
        },
      };

      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: healthData,
      });

      // Act
      const result = await getHealth('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('degraded');
        expect(result.data.issues).toHaveLength(1);
        expect(result.data.issues[0]?.type).toBe('stale_lock');
        expect(result.data.summary.stale_lock_count).toBe(1);
      }
    });

    it('propagates error from execGsdTools', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: false,
        error: {
          code: 'GSD_COMMAND_FAILED',
          message: 'health check failed',
          command: 'gsd-tools health check --json',
        },
      });

      // Act
      const result = await getHealth('/project');

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GSD_COMMAND_FAILED');
        expect(result.error.message).toBe('health check failed');
      }
    });

    it('passes correct arguments to execGsdTools', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          status: 'healthy',
          issues: [],
          exit_code: 0,
          summary: {
            orphan_count: 0,
            stale_lock_count: 0,
            incomplete_count: 0,
            sync_issue_count: 0,
          },
        },
      });

      // Act
      await getHealth('/my/project/path');

      // Assert
      expect(mockExecGsdTools).toHaveBeenCalledWith(
        ['health', 'check', '--json'],
        '/my/project/path'
      );
    });
  });
});
