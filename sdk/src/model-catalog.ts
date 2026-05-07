import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface RuntimeTierEntry {
  model: string;
  reasoning_effort?: string;
}

type RuntimeTierTable = Record<string, Record<string, RuntimeTierEntry | null>>;

interface AgentCatalogEntry {
  golden: 'opus' | 'sonnet' | 'haiku';
  balanced: 'opus' | 'sonnet' | 'haiku';
  budget: 'opus' | 'sonnet' | 'haiku';
  phaseType: string;
  routingTier: 'light' | 'standard' | 'heavy';
}

interface ModelCatalog {
  profiles: string[];
  phaseTypes: string[];
  adaptiveTierMap: Record<'light' | 'standard' | 'heavy', 'opus' | 'sonnet' | 'haiku'>;
  runtimeTierDefaults: RuntimeTierTable;
  agents: Record<string, AgentCatalogEntry>;
}

const CATALOG_PATH = new URL('../shared/model-catalog.json', import.meta.url);
export const catalog: ModelCatalog = JSON.parse(readFileSync(fileURLToPath(CATALOG_PATH), 'utf-8'));

export const VALID_PROFILES: string[] = [...catalog.profiles];
export const SUPPORTED_RUNTIMES = Object.keys(catalog.runtimeTierDefaults);
export type Runtime = (typeof SUPPORTED_RUNTIMES)[number];

export const MODEL_PROFILES: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(catalog.agents).map(([agent, meta]) => [agent, {
    quality: meta.golden,
    balanced: meta.balanced,
    budget: meta.budget,
    adaptive: catalog.adaptiveTierMap[meta.routingTier],
  }])
);

export const AGENT_TO_PHASE_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(catalog.agents).map(([agent, meta]) => [agent, meta.phaseType])
);

export const AGENT_DEFAULT_TIERS: Record<string, string> = Object.fromEntries(
  Object.entries(catalog.agents).map(([agent, meta]) => [agent, meta.routingTier])
);

export function getAgentToModelMapForProfile(normalizedProfile: string): Record<string, string> {
  const profile = VALID_PROFILES.includes(normalizedProfile) ? normalizedProfile : 'balanced';
  const out: Record<string, string> = {};
  for (const [agent, profiles] of Object.entries(MODEL_PROFILES)) {
    out[agent] = profile === 'inherit' ? 'inherit' : profiles[profile] ?? profiles.balanced;
  }
  return out;
}

export function resolveRuntimeTierDefault(runtime: string, alias: 'opus' | 'sonnet' | 'haiku'): RuntimeTierEntry | null {
  return catalog.runtimeTierDefaults[runtime]?.[alias] ?? null;
}

export function runtimesWithReasoningEffort(): Set<string> {
  return new Set(
    Object.entries(catalog.runtimeTierDefaults)
      .filter(([, tiers]) => Object.values(tiers).some((entry) => entry && entry.reasoning_effort))
      .map(([runtime]) => runtime)
  );
}
