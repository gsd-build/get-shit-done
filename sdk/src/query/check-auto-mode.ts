/**
 * Consolidated auto-advance flags (`check.auto-mode`).
 *
 * Replaces paired `config-get workflow.auto_advance` + `config-get workflow._auto_chain_active`
 * for checkpoint and auto-advance gates. See `.planning/research/decision-routing-audit.md` §3.5.
 *
 * Semantics match `execute-phase.md`: automation applies when **either** the ephemeral chain flag
 * or the persistent user preference is true (`active === true`).
 */

import { loadConfig } from '../config.js';
import type { QueryHandler } from './utils.js';

export type AutoModeSource = 'auto_chain' | 'auto_advance' | 'both' | 'none';

function resolveSource(
  autoChainActive: boolean,
  autoAdvance: boolean,
): { active: boolean; source: AutoModeSource } {
  if (autoChainActive && autoAdvance) {
    return { active: true, source: 'both' };
  }
  if (autoChainActive) {
    return { active: true, source: 'auto_chain' };
  }
  if (autoAdvance) {
    return { active: true, source: 'auto_advance' };
  }
  return { active: false, source: 'none' };
}

export const checkAutoMode: QueryHandler = async (_args, projectDir) => {
  const config = await loadConfig(projectDir);
  const wf: Record<string, unknown> = {
    ...(config.workflow as unknown as Record<string, unknown>),
  };
  const autoAdvance = Boolean(wf.auto_advance ?? false);
  const autoChainActive = Boolean(wf._auto_chain_active ?? false);
  const { active, source } = resolveSource(autoChainActive, autoAdvance);

  return {
    data: {
      active,
      source,
      auto_chain_active: autoChainActive,
      auto_advance: autoAdvance,
    },
  };
};
