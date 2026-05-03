import { describe, it, expect } from 'vitest';
import { formatPick, formatSuccess } from './query-dispatch-formatting.js';

describe('query-dispatch-formatting', () => {
  it('formats text with trailing newline', () => {
    expect(formatSuccess('USAGE', 'text')).toBe('USAGE\n');
  });

  it('formats json with pretty printing', () => {
    expect(formatSuccess({ nested: { value: 3 } }, 'json')).toBe([
      '{',
      '  "nested": {',
      '    "value": 3',
      '  }',
      '}',
      '',
    ].join('\n'));
  });

  it('formats json and applies pick', () => {
    expect(formatSuccess({ nested: { value: 3 } }, 'json', 'nested.value')).toBe('3\n');
  });

  it('formatPick returns input when no pickField', () => {
    const input = { ok: true };
    expect(formatPick(input)).toBe(input);
  });
});
