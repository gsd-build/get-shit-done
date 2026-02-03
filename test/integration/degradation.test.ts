/**
 * Integration tests for graceful degradation
 * Verifies the system continues working when optional features fail
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getConfig, clearConfigCache } from '../../src/config';
import { findServiceWithConfidence, clearMatcherCache } from '../../src/matching/matcher';

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  }
}));

describe('Graceful Degradation', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const configPath = join(homedir(), '.gsd', 'company.json');
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    clearConfigCache();
    clearMatcherCache();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Config loading degradation', () => {
    it('continues without config file', async () => {
      // Mock fs to simulate missing config
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      // Should return null without throwing
      const config = await getConfig();
      expect(config).toBeNull();

      // Should not log warning for missing file (expected condition)
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('handles invalid JSON gracefully', async () => {
      // Mock fs with malformed JSON
      mockFs.readFile.mockResolvedValue('{ invalid json }');

      // Should return null without throwing
      const config = await getConfig();
      expect(config).toBeNull();

      // Should log parse error
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('Invalid JSON');
    });

    it('handles invalid config schema gracefully', async () => {
      // Mock fs with valid JSON but invalid schema
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        version: 123, // Should be string
        services: 'not-an-array' // Should be array
      }));

      // Should return null without throwing
      const config = await getConfig();
      expect(config).toBeNull();

      // Should log validation errors
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('Invalid configuration structure');
    });

    it('handles read permission errors gracefully', async () => {
      // Mock fs with permission error
      mockFs.readFile.mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });

      // Should return null without throwing
      const config = await getConfig();
      expect(config).toBeNull();

      // Should log permission error
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const warning = consoleWarnSpy.mock.calls[0][0];
      expect(warning).toContain('Cannot read config');
    });

    it('uses cached config for subsequent calls', async () => {
      // Mock successful config load
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        services: [
          { name: 'test-service', repository: 'https://github.com/test/service.git' }
        ]
      }));

      // First call loads config
      const config1 = await getConfig();
      expect(config1).not.toBeNull();
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);

      // Second call uses cache
      const config2 = await getConfig();
      expect(config2).not.toBeNull();
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('reloads config after cache clear', async () => {
      // Mock successful config load
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        services: []
      }));

      // First call
      await getConfig();
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);

      // Clear cache
      clearConfigCache();

      // Next call reloads
      await getConfig();
      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Service matching degradation', () => {
    it('handles no config at all', async () => {
      // Mock missing config
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      // Should return null without config
      const result = await findServiceWithConfidence('test-service');
      expect(result).toBeNull();

      // No errors thrown
    });

    it('handles empty services array', async () => {
      // Mock config with no services
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        services: []
      }));

      // Should return null for any service
      const result = await findServiceWithConfidence('test-service');
      expect(result).toBeNull();
    });

    it('handles missing services field', async () => {
      // Mock config without services field
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        version: '1.0.0'
      }));

      // Should return null
      const result = await findServiceWithConfidence('test-service');
      expect(result).toBeNull();
    });
  });

  describe('Complete system degradation', () => {
    it('produces basic output with all features disabled', async () => {
      // Mock everything to fail
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      // System should still work at basic level

      // Try to load config (should fail gracefully)
      const config = await getConfig();
      expect(config).toBeNull();

      // Try to find service (should return null)
      const serviceMatch = await findServiceWithConfidence('test-service');
      expect(serviceMatch).toBeNull();

      // System didn't crash, all operations returned null gracefully
      expect(true).toBe(true);
    });
  });
});
