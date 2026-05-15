/**
 * Unit tests for STATE.md Document Module — stateExtractField.
 */

import { describe, it, expect } from 'vitest';
import {
  stateExtractField,
  stateReplaceField,
  stateReplaceFieldWithFallback,
  normalizeStateStatus,
  computeProgressPercent,
  shouldPreserveExistingProgress,
  normalizeProgressNumbers,
} from './state-document.js';

describe('stateExtractField', () => {
  it('extracts value from bold pattern', () => {
    const content = 'Some content\n**FieldName:** the value\nMore content';
    expect(stateExtractField(content, 'FieldName')).toBe('the value');
  });

  it('extracts value from plain pattern', () => {
    const content = 'Some content\nFieldName: the value\nMore content';
    expect(stateExtractField(content, 'FieldName')).toBe('the value');
  });

  it('returns null when field is missing', () => {
    const content = 'Some content\nOtherField: something\nMore content';
    expect(stateExtractField(content, 'FieldName')).toBeNull();
  });
});

describe('stateReplaceField', () => {
  it('replaces value in bold pattern', () => {
    const content = 'Some content\n**Status:** old value\nMore content';
    const result = stateReplaceField(content, 'Status', 'new value');
    expect(result).toBe('Some content\n**Status:** new value\nMore content');
  });

  it('replaces value in plain pattern', () => {
    const content = 'Some content\nStatus: old value\nMore content';
    const result = stateReplaceField(content, 'Status', 'new value');
    expect(result).toBe('Some content\nStatus: new value\nMore content');
  });

  it('returns null when field is missing', () => {
    const content = 'Some content\nOtherField: something\nMore content';
    const result = stateReplaceField(content, 'Status', 'new value');
    expect(result).toBeNull();
  });
});

describe('stateReplaceFieldWithFallback', () => {
  it('replaces primary field when it exists', () => {
    const content = 'Status: old\nState: backup';
    const result = stateReplaceFieldWithFallback(content, 'Status', 'State', 'new');
    expect(result).toBe('Status: new\nState: backup');
  });

  it('replaces fallback field when primary is missing', () => {
    const content = 'Other: something\nState: backup';
    const result = stateReplaceFieldWithFallback(content, 'Status', 'State', 'new');
    expect(result).toBe('Other: something\nState: new');
  });

  it('returns content unchanged when neither field exists', () => {
    const content = 'Other: something\nAnother: value';
    const result = stateReplaceFieldWithFallback(content, 'Status', 'State', 'new');
    expect(result).toBe(content);
  });
});

describe('normalizeStateStatus', () => {
  it('returns paused for status containing "paused"', () => {
    expect(normalizeStateStatus('paused')).toBe('paused');
  });

  it('returns paused for status containing "stopped"', () => {
    expect(normalizeStateStatus('stopped')).toBe('paused');
  });

  it('returns paused when non-null pausedAt is provided', () => {
    expect(normalizeStateStatus('active', '2024-01-01')).toBe('paused');
  });

  it('returns executing for status containing "executing"', () => {
    expect(normalizeStateStatus('executing')).toBe('executing');
  });

  it('returns executing for status "in progress"', () => {
    expect(normalizeStateStatus('in progress')).toBe('executing');
  });

  it('returns executing for status "ready to execute"', () => {
    expect(normalizeStateStatus('ready to execute')).toBe('executing');
  });

  it('returns planning for status containing "planning"', () => {
    expect(normalizeStateStatus('planning')).toBe('planning');
  });

  it('returns discussing for status containing "discussing"', () => {
    expect(normalizeStateStatus('discussing')).toBe('discussing');
  });

  it('returns verifying for status containing "verif"', () => {
    expect(normalizeStateStatus('verifying')).toBe('verifying');
  });

  it('returns completed for status containing "complete"', () => {
    expect(normalizeStateStatus('completed')).toBe('completed');
  });

  it('returns completed for status containing "done"', () => {
    expect(normalizeStateStatus('done')).toBe('completed');
  });

  it('returns unknown for unrecognized status', () => {
    expect(normalizeStateStatus('something-else')).toBe('something-else');
  });

  it('returns unknown for null status', () => {
    expect(normalizeStateStatus(null)).toBe('unknown');
  });
});

describe('computeProgressPercent', () => {
  it('uses only plans data when phases data is absent', () => {
    expect(computeProgressPercent(3, 10, null, null)).toBe(30);
  });

  it('uses only phases data when plans data is absent', () => {
    expect(computeProgressPercent(null, null, 2, 4)).toBe(50);
  });

  it('uses minimum fraction when both plans and phases data are present', () => {
    // plans: 8/10 = 80%, phases: 3/10 = 30% → min = 30%
    expect(computeProgressPercent(8, 10, 3, 10)).toBe(30);
  });

  it('returns null when neither plans nor phases data is present', () => {
    expect(computeProgressPercent(null, null, null, null)).toBeNull();
  });

  it('returns null when total is 0 (treated as no data)', () => {
    expect(computeProgressPercent(0, 0, null, null)).toBeNull();
  });
});

describe('shouldPreserveExistingProgress', () => {
  it('returns true when existing total_phases exceeds derived', () => {
    expect(shouldPreserveExistingProgress({ total_phases: 10 }, { total_phases: 5 })).toBe(true);
  });

  it('returns false when derived exceeds existing', () => {
    expect(shouldPreserveExistingProgress({ total_phases: 5 }, { total_phases: 10 })).toBe(false);
  });

  it('returns false when existingProgress is not an object', () => {
    expect(shouldPreserveExistingProgress(null, { total_phases: 5 })).toBe(false);
  });

  it('returns false when both are null', () => {
    expect(shouldPreserveExistingProgress(null, null)).toBe(false);
  });
});

describe('normalizeProgressNumbers', () => {
  it('coerces all five tracked keys to numbers', () => {
    const input = {
      total_phases: '10',
      completed_phases: '3',
      total_plans: '5',
      completed_plans: '2',
      percent: '60',
    };
    expect(normalizeProgressNumbers(input)).toEqual({
      total_phases: 10,
      completed_phases: 3,
      total_plans: 5,
      completed_plans: 2,
      percent: 60,
    });
  });

  it('returns non-object input unchanged', () => {
    expect(normalizeProgressNumbers(null)).toBeNull();
    expect(normalizeProgressNumbers('string')).toBe('string');
  });

  it('preserves extra keys untouched', () => {
    const input = { total_phases: '4', extra_key: 'hello' };
    const result = normalizeProgressNumbers(input) as Record<string, unknown>;
    expect(result.total_phases).toBe(4);
    expect(result.extra_key).toBe('hello');
  });
});
