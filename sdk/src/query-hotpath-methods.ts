import type { InitNewProjectInfo, PhaseOpInfo, PhasePlanIndex } from './types.js';

export interface QueryHotpathMethodsDeps {
  dispatchNativeHotpath: (
    legacyCommand: string,
    legacyArgs: string[],
    registryCommand: string,
    registryArgs: string[],
    mode: 'json' | 'raw',
  ) => Promise<unknown>;
}

/**
 * Module owning typed hot-path method projection for GSDTools facade.
 */
export class QueryHotpathMethods {
  constructor(private readonly deps: QueryHotpathMethodsDeps) {}

  phaseComplete(phase: string): Promise<string> {
    return this.deps.dispatchNativeHotpath('phase', ['complete', phase], 'phase.complete', [phase], 'raw') as Promise<string>;
  }

  commit(message: string, files?: string[]): Promise<string> {
    const args = [message];
    if (files?.length) args.push('--files', ...files);
    return this.deps.dispatchNativeHotpath('commit', args, 'commit', args, 'raw') as Promise<string>;
  }

  initPhaseOp(phaseNumber: string): Promise<PhaseOpInfo> {
    return this.deps.dispatchNativeHotpath('init', ['phase-op', phaseNumber], 'init.phase-op', [phaseNumber], 'json') as Promise<PhaseOpInfo>;
  }

  configGet(key: string): Promise<string | null> {
    return this.deps.dispatchNativeHotpath('config-get', [key], 'config-get', [key], 'json') as Promise<string | null>;
  }

  phasePlanIndex(phaseNumber: string): Promise<PhasePlanIndex> {
    return this.deps.dispatchNativeHotpath('phase-plan-index', [phaseNumber], 'phase-plan-index', [phaseNumber], 'json') as Promise<PhasePlanIndex>;
  }

  initNewProject(): Promise<InitNewProjectInfo> {
    return this.deps.dispatchNativeHotpath('init', ['new-project'], 'init.new-project', [], 'json') as Promise<InitNewProjectInfo>;
  }

  configSet(key: string, value: string): Promise<string> {
    return this.deps.dispatchNativeHotpath('config-set', [key, value], 'config-set', [key, value], 'raw') as Promise<string>;
  }
}
