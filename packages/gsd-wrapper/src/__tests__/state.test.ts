import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock execGsdTools before importing state module
vi.mock('../exec.js', () => ({
  execGsdTools: vi.fn(),
}));

import { getState, getProgress } from '../state.js';
import { execGsdTools } from '../exec.js';

const mockExecGsdTools = vi.mocked(execGsdTools);

describe('state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getState', () => {
    it('parses state with all fields', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: `---
status: active
milestone: v1.0
total_plans: 10
completed_plans: 5
---

**Phase:** 14
**Plan:** 02
**Last activity:** 2024-03-10 10:00
`,
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      const result = await getState('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phase).toBe('14');
        expect(result.data.plan).toBe('02');
        expect(result.data.status).toBe('active');
        expect(result.data.milestone).toBe('v1.0');
        expect(result.data.progress.total).toBe(10);
        expect(result.data.progress.completed).toBe(5);
        expect(result.data.progress.percentage).toBe(50);
        expect(result.data.lastActivity).toBe('2024-03-10 10:00');
      }
    });

    it('handles completed status', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: `---
status: completed
---
`,
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      const result = await getState('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('complete');
      }
    });

    it('handles complete status variation', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: `---
status: complete
---
`,
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      const result = await getState('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('complete');
      }
    });

    it('handles in_progress status as active', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: `---
status: in_progress
---
`,
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      const result = await getState('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('active');
      }
    });

    it('defaults to pending for unknown status', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: `---
status: unknown_status
---
`,
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      const result = await getState('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending');
      }
    });

    it('handles missing frontmatter', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: `No frontmatter here
**Phase:** 14
`,
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      const result = await getState('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending');
        expect(result.data.progress.total).toBe(0);
        expect(result.data.progress.completed).toBe(0);
        expect(result.data.progress.percentage).toBe(0);
        expect(result.data.milestone).toBeUndefined();
      }
    });

    it('handles zero total plans without division error', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: `---
total_plans: 0
completed_plans: 0
---
`,
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      const result = await getState('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress.percentage).toBe(0);
        expect(Number.isNaN(result.data.progress.percentage)).toBe(false);
      }
    });

    it('rounds percentage to integer', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: `---
total_plans: 3
completed_plans: 1
---
`,
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      const result = await getState('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress.percentage).toBe(33); // 33.33... rounded
      }
    });

    it('propagates error from execGsdTools', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: false,
        error: {
          code: 'GSD_COMMAND_FAILED',
          message: 'Command failed',
          command: 'gsd-tools state --json',
        },
      });

      // Act
      const result = await getState('/project');

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GSD_COMMAND_FAILED');
      }
    });

    it('passes correct arguments to execGsdTools', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: '',
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      await getState('/my/project/path');

      // Assert
      expect(mockExecGsdTools).toHaveBeenCalledWith(
        ['state', '--json'],
        '/my/project/path'
      );
    });
  });

  describe('getProgress', () => {
    it('returns percentage on success', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          config: {},
          state_raw: `---
total_plans: 4
completed_plans: 3
---
`,
          state_exists: true,
          roadmap_exists: true,
          config_exists: true,
        },
      });

      // Act
      const result = await getProgress('/project');

      // Assert
      expect(result).toBe(75);
    });

    it('returns null on error', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: false,
        error: {
          code: 'GSD_COMMAND_FAILED',
          message: 'Failed',
          command: 'gsd-tools state --json',
        },
      });

      // Act
      const result = await getProgress('/project');

      // Assert
      expect(result).toBeNull();
    });
  });
});
