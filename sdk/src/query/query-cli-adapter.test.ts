import { describe, it, expect } from 'vitest';
import { runQueryCliCommand } from './query-cli-adapter.js';

describe('query-cli-adapter', () => {
  it('returns validation failure for missing query command', async () => {
    const out = await runQueryCliCommand({
      projectDir: process.cwd(),
      queryArgv: [],
    });
    expect(out.exitCode).toBe(10);
    expect(out.stderrLines.join('\n')).toContain('requires a command');
  });
});
