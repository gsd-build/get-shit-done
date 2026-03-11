import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverProjects } from '../project.js';
import * as fsPromises from 'fs/promises';

vi.mock('fs/promises');

const mockReaddir = vi.mocked(fsPromises.readdir);
const mockAccess = vi.mocked(fsPromises.access);

describe('project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('discoverProjects', () => {
    it('discovers projects with .planning directories', async () => {
      // Arrange
      mockReaddir.mockResolvedValue([
        { name: 'project-a', isDirectory: () => true },
        { name: 'project-b', isDirectory: () => true },
        { name: 'not-a-project', isDirectory: () => true },
      ] as unknown as fsPromises.Dirent[]);

      mockAccess
        .mockResolvedValueOnce(undefined) // project-a has .planning
        .mockResolvedValueOnce(undefined) // project-b has .planning
        .mockRejectedValueOnce(new Error('ENOENT')); // not-a-project doesn't

      // Act
      const result = await discoverProjects(['/search/path']);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toEqual({
          id: 'project-a',
          name: 'Project A',
          path: '/search/path/project-a',
          hasPlanning: true,
        });
        expect(result.data[1]).toEqual({
          id: 'project-b',
          name: 'Project B',
          path: '/search/path/project-b',
          hasPlanning: true,
        });
      }
    });

    it('skips hidden directories', async () => {
      // Arrange
      mockReaddir.mockResolvedValue([
        { name: '.git', isDirectory: () => true },
        { name: '.vscode', isDirectory: () => true },
        { name: 'project', isDirectory: () => true },
      ] as unknown as fsPromises.Dirent[]);

      mockAccess.mockResolvedValue(undefined);

      // Act
      const result = await discoverProjects(['/search/path']);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.id).toBe('project');
      }
    });

    it('skips node_modules', async () => {
      // Arrange
      mockReaddir.mockResolvedValue([
        { name: 'node_modules', isDirectory: () => true },
        { name: 'my-project', isDirectory: () => true },
      ] as unknown as fsPromises.Dirent[]);

      mockAccess.mockResolvedValue(undefined);

      // Act
      const result = await discoverProjects(['/search/path']);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.id).toBe('my-project');
      }
    });

    it('skips non-directory entries', async () => {
      // Arrange
      mockReaddir.mockResolvedValue([
        { name: 'file.txt', isDirectory: () => false },
        { name: 'project', isDirectory: () => true },
      ] as unknown as fsPromises.Dirent[]);

      mockAccess.mockResolvedValue(undefined);

      // Act
      const result = await discoverProjects(['/search/path']);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
      }
    });

    it('searches multiple paths', async () => {
      // Arrange
      mockReaddir
        .mockResolvedValueOnce([
          { name: 'project-1', isDirectory: () => true },
        ] as unknown as fsPromises.Dirent[])
        .mockResolvedValueOnce([
          { name: 'project-2', isDirectory: () => true },
        ] as unknown as fsPromises.Dirent[]);

      mockAccess.mockResolvedValue(undefined);

      // Act
      const result = await discoverProjects(['/path1', '/path2']);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]?.path).toBe('/path1/project-1');
        expect(result.data[1]?.path).toBe('/path2/project-2');
      }
    });

    it('handles inaccessible search paths gracefully', async () => {
      // Arrange
      mockReaddir
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce([
          { name: 'project', isDirectory: () => true },
        ] as unknown as fsPromises.Dirent[]);

      mockAccess.mockResolvedValue(undefined);

      // Act
      const result = await discoverProjects(['/bad/path', '/good/path']);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.path).toBe('/good/path/project');
      }
    });

    it('returns empty array when no projects found', async () => {
      // Arrange
      mockReaddir.mockResolvedValue([
        { name: 'no-planning', isDirectory: () => true },
      ] as unknown as fsPromises.Dirent[]);

      mockAccess.mockRejectedValue(new Error('ENOENT'));

      // Act
      const result = await discoverProjects(['/search']);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('formats project names correctly', async () => {
      // Arrange
      mockReaddir.mockResolvedValue([
        { name: 'my-cool-project', isDirectory: () => true },
        { name: 'another_project', isDirectory: () => true },
        { name: 'simple', isDirectory: () => true },
      ] as unknown as fsPromises.Dirent[]);

      mockAccess.mockResolvedValue(undefined);

      // Act
      const result = await discoverProjects(['/search']);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0]?.name).toBe('My Cool Project');
        expect(result.data[1]?.name).toBe('Another Project');
        expect(result.data[2]?.name).toBe('Simple');
      }
    });

    it('returns empty array for empty search paths', async () => {
      // Act
      const result = await discoverProjects([]);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });
});
