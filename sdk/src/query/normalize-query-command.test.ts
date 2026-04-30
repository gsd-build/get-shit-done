import { describe, it, expect } from 'vitest';
import { normalizeQueryCommand } from './normalize-query-command.js';

describe('normalizeQueryCommand', () => {
  it('merges nested gsd-tools-style state + subcommand', () => {
    expect(normalizeQueryCommand('state', ['json'])).toEqual(['state.json', []]);
    expect(normalizeQueryCommand('state', ['validate'])).toEqual(['state.validate', []]);
  });

  it('merges verify known subcommands only', () => {
    expect(normalizeQueryCommand('verify', ['plan-structure', 'x.md'])).toEqual(['verify.plan-structure', ['x.md']]);
    expect(normalizeQueryCommand('verify', ['unknown-op'])).toEqual(['verify', ['unknown-op']]);
  });

  it('maps bare state to state.load', () => {
    expect(normalizeQueryCommand('state', [])).toEqual(['state.load', []]);
  });

  it('does not merge unknown state subcommands', () => {
    expect(normalizeQueryCommand('state', ['not-a-subcommand'])).toEqual(['state', ['not-a-subcommand']]);
  });

  it('merges init workflows', () => {
    expect(normalizeQueryCommand('init', ['execute-phase', '9'])).toEqual(['init.execute-phase', ['9']]);
    expect(normalizeQueryCommand('init', ['new-project'])).toEqual(['init.new-project', []]);
  });

  it('does not merge unknown init subcommands', () => {
    expect(normalizeQueryCommand('init', ['made-up-init-op', 'x'])).toEqual(['init', ['made-up-init-op', 'x']]);
  });

  it('maps scaffold to phase.scaffold', () => {
    expect(normalizeQueryCommand('scaffold', ['phase-dir', '--phase', '1'])).toEqual([
      'phase.scaffold',
      ['phase-dir', '--phase', '1'],
    ]);
  });

  it('merges progress and stats subcommands', () => {
    expect(normalizeQueryCommand('progress', ['bar'])).toEqual(['progress.bar', []]);
    expect(normalizeQueryCommand('stats', ['json'])).toEqual(['stats.json', []]);
  });

  it('passes through single-token commands', () => {
    expect(normalizeQueryCommand('config-get', ['model_profile'])).toEqual(['config-get', ['model_profile']]);
    expect(normalizeQueryCommand('generate-slug', ['Hello'])).toEqual(['generate-slug', ['Hello']]);
  });

  it('merges check/route helper commands', () => {
    expect(normalizeQueryCommand('check', ['config-gates', 'plan-phase'])).toEqual([
      'check.config-gates',
      ['plan-phase'],
    ]);
    expect(normalizeQueryCommand('check', ['phase-ready', '3'])).toEqual(['check.phase-ready', ['3']]);
    expect(normalizeQueryCommand('check', ['auto-mode'])).toEqual(['check.auto-mode', []]);
    expect(normalizeQueryCommand('route', ['next-action'])).toEqual(['route.next-action', []]);
  });

  it('merges known phase subcommands and preserves unknown ones', () => {
    expect(normalizeQueryCommand('phase', ['add-batch', '--descriptions', '[]'])).toEqual([
      'phase.add-batch',
      ['--descriptions', '[]'],
    ]);
    expect(normalizeQueryCommand('phase', ['made-up-phase-op', 'x'])).toEqual([
      'phase',
      ['made-up-phase-op', 'x'],
    ]);
  });

  it('merges known phases subcommands and preserves unknown ones', () => {
    expect(normalizeQueryCommand('phases', ['clear', 'v1.0'])).toEqual([
      'phases.clear',
      ['v1.0'],
    ]);
    expect(normalizeQueryCommand('phases', ['made-up-phases-op', 'x'])).toEqual([
      'phases',
      ['made-up-phases-op', 'x'],
    ]);
  });

  it('merges known validate subcommands and preserves unknown ones', () => {
    expect(normalizeQueryCommand('validate', ['consistency'])).toEqual([
      'validate.consistency',
      [],
    ]);
    expect(normalizeQueryCommand('validate', ['made-up-validate-op', 'x'])).toEqual([
      'validate',
      ['made-up-validate-op', 'x'],
    ]);
  });

  it('merges known roadmap subcommands and preserves unknown ones', () => {
    expect(normalizeQueryCommand('roadmap', ['analyze'])).toEqual([
      'roadmap.analyze',
      [],
    ]);
    expect(normalizeQueryCommand('roadmap', ['made-up-roadmap-op', 'x'])).toEqual([
      'roadmap',
      ['made-up-roadmap-op', 'x'],
    ]);
  });
});
