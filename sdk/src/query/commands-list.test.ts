import { describe, it, expect } from 'vitest';
import { commandsList } from './commands-list.js';

// Regression test for bug #3121.
// The `commands` verb was missing from the SDK native registry.
// `gsd-sdk query commands` fell back to gsd-tools.cjs which threw
// "Unknown command: commands".
describe('commands-list handler (#3121)', () => {
  it('returns a non-empty sorted JSON array of command strings', async () => {
    const result = await commandsList([], '/tmp', undefined);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as string[]).length).toBeGreaterThan(10);
  });

  it('includes known canonical commands', async () => {
    const result = await commandsList([], '/tmp', undefined);
    const cmds = result.data as string[];
    expect(cmds).toContain('state.begin-phase');
    expect(cmds).toContain('check.decision-coverage-plan');
    expect(cmds).toContain('commands');
  });

  it('is sorted alphabetically', async () => {
    const result = await commandsList([], '/tmp', undefined);
    const cmds = result.data as string[];
    const sorted = [...cmds].sort((a, b) => a.localeCompare(b));
    expect(cmds).toEqual(sorted);
  });

  it('args and workstream are ignored (introspection verb)', async () => {
    const r1 = await commandsList([], '/tmp', undefined);
    const r2 = await commandsList(['ignored'], '/other', 'ws');
    expect(r1.data).toEqual(r2.data);
  });
});
