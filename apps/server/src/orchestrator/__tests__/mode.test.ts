import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('orchestrator mode configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env['MOCK_EXECUTION'];
    delete process.env['ANTHROPIC_API_KEY'];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('fails fast when MOCK_EXECUTION is not true and API key is missing', async () => {
    await expect(import('../index.js')).rejects.toThrow(
      'ANTHROPIC_API_KEY is required when MOCK_EXECUTION is not true'
    );
  });

  it('allows startup when MOCK_EXECUTION=true without API key', async () => {
    process.env['MOCK_EXECUTION'] = 'true';

    await expect(import('../index.js')).resolves.toHaveProperty('createOrchestrator');
  });

  it('allows startup when a valid API key is present and mock mode is disabled', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';

    await expect(import('../index.js')).resolves.toHaveProperty('createOrchestrator');
  });

  it('allows startup when a non-empty non-sk key is present (e.g., Azure key)', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'azure-foundry-token-value';

    await expect(import('../index.js')).resolves.toHaveProperty('createOrchestrator');
  });
});
