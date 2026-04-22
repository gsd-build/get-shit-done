/**
 * Unit tests for utility query handlers.
 *
 * Covers: generateSlug and currentTimestamp functions with output parity
 * to gsd-tools.cjs cmdGenerateSlug and cmdCurrentTimestamp.
 */

import { describe, it, expect } from 'vitest';
import { generateSlug, currentTimestamp } from './utils.js';
import { GSDError, ErrorClassification } from '../errors.js';

const PROJECT_DIR = '/tmp/test-project';

describe('generateSlug', () => {
  it('converts simple text to kebab-case slug', async () => {
    const result = await generateSlug(['My Phase Name'], PROJECT_DIR);
    expect(result).toEqual({ data: { slug: 'my-phase-name' } });
  });

  it('strips non-alphanumeric characters and collapses runs', async () => {
    const result = await generateSlug(['  Hello   World!!!  '], PROJECT_DIR);
    expect(result).toEqual({ data: { slug: 'hello-world' } });
  });

  it('strips leading and trailing hyphens', async () => {
    const result = await generateSlug(['---test---'], PROJECT_DIR);
    expect(result).toEqual({ data: { slug: 'test' } });
  });

  it('truncates slug to 60 characters', async () => {
    const longText = 'a'.repeat(100);
    const result = await generateSlug([longText], PROJECT_DIR);
    expect((result.data as { slug: string }).slug).toHaveLength(60);
  });

  it('throws GSDError with Validation classification for empty text', async () => {
    await expect(generateSlug([''], PROJECT_DIR)).rejects.toThrow(GSDError);
    try {
      await generateSlug([''], PROJECT_DIR);
    } catch (err) {
      expect(err).toBeInstanceOf(GSDError);
      expect((err as GSDError).classification).toBe(ErrorClassification.Validation);
    }
  });

  it('throws GSDError with Validation classification for missing text', async () => {
    await expect(generateSlug([], PROJECT_DIR)).rejects.toThrow(GSDError);
    try {
      await generateSlug([], PROJECT_DIR);
    } catch (err) {
      expect(err).toBeInstanceOf(GSDError);
      expect((err as GSDError).classification).toBe(ErrorClassification.Validation);
    }
  });
});

describe('currentTimestamp', () => {
  it('returns full ISO timestamp by default', async () => {
    const result = await currentTimestamp([], PROJECT_DIR);
    const ts = (result.data as { timestamp: string }).timestamp;
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('returns full ISO timestamp for "full" format', async () => {
    const result = await currentTimestamp(['full'], PROJECT_DIR);
    const ts = (result.data as { timestamp: string }).timestamp;
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns date-only string for "date" format', async () => {
    const result = await currentTimestamp(['date'], PROJECT_DIR);
    const ts = (result.data as { timestamp: string }).timestamp;
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns filename-safe string for "filename" format', async () => {
    const result = await currentTimestamp(['filename'], PROJECT_DIR);
    const ts = (result.data as { timestamp: string }).timestamp;
    expect(ts).not.toContain(':');
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
  });
});
