import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

import { createRegistry } from './index.js';
import { STATE_COMMAND_MANIFEST } from './command-manifest.state.js';
import { VERIFY_COMMAND_MANIFEST } from './command-manifest.verify.js';
import { INIT_COMMAND_MANIFEST } from './command-manifest.init.js';
import { PHASE_COMMAND_MANIFEST } from './command-manifest.phase.js';
import { PHASES_COMMAND_MANIFEST } from './command-manifest.phases.js';
import { VALIDATE_COMMAND_MANIFEST } from './command-manifest.validate.js';
import { ROADMAP_COMMAND_MANIFEST } from './command-manifest.roadmap.js';
import {
  STATE_COMMAND_ALIASES,
  VERIFY_COMMAND_ALIASES,
  INIT_COMMAND_ALIASES,
  PHASE_COMMAND_ALIASES,
  PHASES_COMMAND_ALIASES,
  VALIDATE_COMMAND_ALIASES,
  ROADMAP_COMMAND_ALIASES,
} from './command-aliases.generated.js';

function subcommandFor(canonical: string, family: 'state' | 'verify' | 'init' | 'phase' | 'phases' | 'validate' | 'roadmap'): string {
  return canonical.slice(`${family}.`.length);
}

describe('command seam coverage (manifest -> generated -> adapters)', () => {
  it('state/verify/init/phase/phases/validate/roadmap manifest canonicals are present in generated alias artifacts', () => {
    const generated = new Map<string, { aliases: string[]; subcommand: string; mutation: boolean }>();
    for (const entry of [...STATE_COMMAND_ALIASES, ...VERIFY_COMMAND_ALIASES, ...INIT_COMMAND_ALIASES, ...PHASE_COMMAND_ALIASES, ...PHASES_COMMAND_ALIASES, ...VALIDATE_COMMAND_ALIASES, ...ROADMAP_COMMAND_ALIASES]) {
      generated.set(entry.canonical, { aliases: [...entry.aliases], subcommand: entry.subcommand, mutation: !!entry.mutation });
    }

    for (const entry of STATE_COMMAND_MANIFEST) {
      const g = generated.get(entry.canonical);
      expect(g, `missing generated canonical ${entry.canonical}`).toBeTruthy();
      expect(g?.subcommand).toBe(subcommandFor(entry.canonical, 'state'));
      expect(g?.aliases ?? []).toEqual(entry.aliases);
      expect(g?.mutation).toBe(entry.mutation);
    }

    for (const entry of VERIFY_COMMAND_MANIFEST) {
      const g = generated.get(entry.canonical);
      expect(g, `missing generated canonical ${entry.canonical}`).toBeTruthy();
      expect(g?.subcommand).toBe(subcommandFor(entry.canonical, 'verify'));
      expect(g?.aliases ?? []).toEqual(entry.aliases);
      expect(g?.mutation).toBe(entry.mutation);
    }

    for (const entry of INIT_COMMAND_MANIFEST) {
      const g = generated.get(entry.canonical);
      expect(g, `missing generated canonical ${entry.canonical}`).toBeTruthy();
      expect(g?.subcommand).toBe(subcommandFor(entry.canonical, 'init'));
      expect(g?.aliases ?? []).toEqual(entry.aliases);
      expect(g?.mutation).toBe(entry.mutation);
    }

    for (const entry of PHASE_COMMAND_MANIFEST) {
      const g = generated.get(entry.canonical);
      expect(g, `missing generated canonical ${entry.canonical}`).toBeTruthy();
      expect(g?.subcommand).toBe(subcommandFor(entry.canonical, 'phase'));
      expect(g?.aliases ?? []).toEqual(entry.aliases);
      expect(g?.mutation).toBe(entry.mutation);
    }

    for (const entry of PHASES_COMMAND_MANIFEST) {
      const g = generated.get(entry.canonical);
      expect(g, `missing generated canonical ${entry.canonical}`).toBeTruthy();
      expect(g?.subcommand).toBe(subcommandFor(entry.canonical, 'phases'));
      expect(g?.aliases ?? []).toEqual(entry.aliases);
      expect(g?.mutation).toBe(entry.mutation);
    }

    for (const entry of VALIDATE_COMMAND_MANIFEST) {
      const g = generated.get(entry.canonical);
      expect(g, `missing generated canonical ${entry.canonical}`).toBeTruthy();
      expect(g?.subcommand).toBe(subcommandFor(entry.canonical, 'validate'));
      expect(g?.aliases ?? []).toEqual(entry.aliases);
      expect(g?.mutation).toBe(entry.mutation);
    }

    for (const entry of ROADMAP_COMMAND_MANIFEST) {
      const g = generated.get(entry.canonical);
      expect(g, `missing generated canonical ${entry.canonical}`).toBeTruthy();
      expect(g?.subcommand).toBe(subcommandFor(entry.canonical, 'roadmap'));
      expect(g?.aliases ?? []).toEqual(entry.aliases);
      expect(g?.mutation).toBe(entry.mutation);
    }
  });

  it('registry has every canonical + alias for migrated families', () => {
    const registry = createRegistry();
    for (const entry of [...STATE_COMMAND_ALIASES, ...VERIFY_COMMAND_ALIASES, ...INIT_COMMAND_ALIASES, ...PHASE_COMMAND_ALIASES, ...PHASES_COMMAND_ALIASES, ...VALIDATE_COMMAND_ALIASES, ...ROADMAP_COMMAND_ALIASES]) {
      expect(registry.has(entry.canonical), `missing registry canonical ${entry.canonical}`).toBe(true);
      for (const alias of entry.aliases) {
        expect(registry.has(alias), `missing registry alias ${alias}`).toBe(true);
      }
    }
  });

  it('CJS seam adapters export expected router functions', () => {
    const require = createRequire(import.meta.url);
    const stateRouter = require('../../../get-shit-done/bin/lib/state-command-router.cjs');
    const verifyRouter = require('../../../get-shit-done/bin/lib/verify-command-router.cjs');
    const initRouter = require('../../../get-shit-done/bin/lib/init-command-router.cjs');
    const phaseRouter = require('../../../get-shit-done/bin/lib/phase-command-router.cjs');
    const phasesRouter = require('../../../get-shit-done/bin/lib/phases-command-router.cjs');
    const validateRouter = require('../../../get-shit-done/bin/lib/validate-command-router.cjs');
    const roadmapRouter = require('../../../get-shit-done/bin/lib/roadmap-command-router.cjs');

    expect(typeof stateRouter.routeStateCommand).toBe('function');
    expect(typeof verifyRouter.routeVerifyCommand).toBe('function');
    expect(typeof initRouter.routeInitCommand).toBe('function');
    expect(typeof phaseRouter.routePhaseCommand).toBe('function');
    expect(typeof phasesRouter.routePhasesCommand).toBe('function');
    expect(typeof validateRouter.routeValidateCommand).toBe('function');
    expect(typeof roadmapRouter.routeRoadmapCommand).toBe('function');
  });
});
