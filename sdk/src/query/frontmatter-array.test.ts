import { describe, it, expect } from 'vitest';
import { extractFrontmatter } from './frontmatter.js';

describe('extractFrontmatter array-of-objects', () => {
  it('parses array of objects', () => {
    const content = `---\nitems:\n  - id: 1\n    name: test\n  - id: 2\n    name: test2\n---\n`;
    expect(extractFrontmatter(content)).toEqual({
      items: [
        { id: '1', name: 'test' },
        { id: '2', name: 'test2' }
      ]
    });
  });
});
