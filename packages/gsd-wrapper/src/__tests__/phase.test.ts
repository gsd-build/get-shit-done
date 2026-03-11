import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock execGsdTools before importing phase module
vi.mock('../exec.js', () => ({
  execGsdTools: vi.fn(),
}));

import { listPhases } from '../phase.js';
import { execGsdTools } from '../exec.js';

const mockExecGsdTools = vi.mocked(execGsdTools);

describe('phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listPhases', () => {
    it('parses phase directories correctly', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          directories: [
            '.planning/phases/10-api-design',
            '.planning/phases/11-backend-core',
            '.planning/phases/12-frontend-ui',
          ],
          count: 3,
          milestone: 'v1.0',
        },
      });

      // Act
      const result = await listPhases('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(3);

        expect(result.data[0]?.number).toBe('10');
        expect(result.data[0]?.name).toBe('api design');
        expect(result.data[0]?.slug).toBe('api-design');
        expect(result.data[0]?.directory).toBe('.planning/phases/10-api-design');

        expect(result.data[1]?.number).toBe('11');
        expect(result.data[1]?.name).toBe('backend core');

        expect(result.data[2]?.number).toBe('12');
        expect(result.data[2]?.name).toBe('frontend ui');
      }
    });

    it('handles decimal phase numbers', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          directories: [
            '.planning/phases/10.1-hotfix',
            '.planning/phases/10.2-urgent-fix',
          ],
          count: 2,
        },
      });

      // Act
      const result = await listPhases('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0]?.number).toBe('10.1');
        expect(result.data[0]?.name).toBe('hotfix');
        expect(result.data[1]?.number).toBe('10.2');
      }
    });

    it('handles unmatched directory format gracefully', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          directories: [
            '.planning/phases/weird-directory-name',
          ],
          count: 1,
        },
      });

      // Act
      const result = await listPhases('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0]?.number).toBe('0');
        expect(result.data[0]?.name).toBe('weird-directory-name');
        expect(result.data[0]?.slug).toBe('weird-directory-name');
      }
    });

    it('extracts basename from full path', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          directories: [
            '/absolute/path/.planning/phases/14-backend',
          ],
          count: 1,
        },
      });

      // Act
      const result = await listPhases('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0]?.number).toBe('14');
        expect(result.data[0]?.name).toBe('backend');
      }
    });

    it('returns empty array for no phases', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          directories: [],
          count: 0,
        },
      });

      // Act
      const result = await listPhases('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('sets default status to pending', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: true,
        data: {
          directories: ['.planning/phases/10-test'],
          count: 1,
        },
      });

      // Act
      const result = await listPhases('/project');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0]?.status).toBe('pending');
        expect(result.data[0]?.plans).toBe(0);
        expect(result.data[0]?.completedPlans).toBe(0);
      }
    });

    it('propagates error from execGsdTools', async () => {
      // Arrange
      mockExecGsdTools.mockResolvedValue({
        success: false,
        error: {
          code: 'GSD_COMMAND_FAILED',
          message: 'phases list failed',
          command: 'gsd-tools phases list --json',
        },
      });

      // Act
      const result = await listPhases('/project');

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
        data: { directories: [], count: 0 },
      });

      // Act
      await listPhases('/my/project');

      // Assert
      expect(mockExecGsdTools).toHaveBeenCalledWith(
        ['phases', 'list', '--json'],
        '/my/project'
      );
    });
  });
});
