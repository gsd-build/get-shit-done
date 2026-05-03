import { describe, it, expect } from 'vitest';
import { fallbackBridgeNotices } from './query-dispatch-observability.js';

describe('query-dispatch-observability', () => {
  it('builds fallback notices', () => {
    const notes = fallbackBridgeNotices('unknown-cmd');
    expect(notes[0]).toContain('unknown-cmd');
    expect(notes.length).toBe(2);
  });
});
