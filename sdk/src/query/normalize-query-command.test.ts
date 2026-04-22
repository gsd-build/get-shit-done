import { describe, it, expect } from 'vitest';
import { normalizeQueryCommand } from './normalize-query-command.js';

describe('normalizeQueryCommand', () => {
  it('merges nested gsd-tools-style state + subcommand', () => {
    expect(normalizeQueryCommand('state', ['json'])).toEqual(['state.json', []]);
    expect(normalizeQueryCommand('state', ['validate'])).toEqual(['state.validate', []]);
  });

  it('maps bare state to state.load', () => {
    expect(normalizeQueryCommand('state', [])).toEqual(['state.load', []]);
  });

  it('merges init workflows', () => {
    expect(normalizeQueryCommand('init', ['execute-phase', '9'])).toEqual(['init.execute-phase', ['9']]);
    expect(normalizeQueryCommand('init', ['new-project'])).toEqual(['init.new-project', []]);
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

  it('merges phase add-batch for future handler', () => {
    expect(normalizeQueryCommand('check', ['config-gates', 'plan-phase'])).toEqual([
      'check.config-gates',
      ['plan-phase'],
    ]);
    expect(normalizeQueryCommand('check', ['phase-ready', '3'])).toEqual(['check.phase-ready', ['3']]);
    expect(normalizeQueryCommand('check', ['auto-mode'])).toEqual(['check.auto-mode', []]);
    expect(normalizeQueryCommand('route', ['next-action'])).toEqual(['route.next-action', []]);

    expect(normalizeQueryCommand('phase', ['add-batch', '--descriptions', '[]'])).toEqual([
      'phase.add-batch',
      ['--descriptions', '[]'],
    ]);
  });
});
