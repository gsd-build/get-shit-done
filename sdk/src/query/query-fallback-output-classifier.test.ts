import { describe, it, expect } from 'vitest';
import { classifyFallbackOutput } from './query-fallback-output-classifier.js';

describe('query-fallback-output-classifier', () => {
  it('classifies json output', async () => {
    const out = await classifyFallbackOutput('{"ok":true}', process.cwd());
    expect(out.mode).toBe('json');
  });

  it('classifies text output on invalid json', async () => {
    const out = await classifyFallbackOutput('USAGE', process.cwd());
    expect(out.mode).toBe('text');
  });
});
