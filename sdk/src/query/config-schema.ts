import { readFileSync } from 'node:fs';

/**
 * Thin SDK Adapter over the Config Schema Module shared data.
 *
 * The shared data is shipped with both the root package and standalone SDK.
 * This file preserves the existing SDK exports while keeping schema ownership
 * behind one Interface.
 */

/**
 * Dynamic-pattern validators — keys matching these regexes are also accepted.
 */
export interface DynamicKeyPattern {
  readonly test: (k: string) => boolean;
  readonly topLevel: string;
  readonly description: string;
  readonly source: string;
}

interface ConfigSchemaData {
  readonly validConfigKeys: readonly string[];
  readonly runtimeStateKeys: readonly string[];
  readonly dynamicKeyPatterns: ReadonlyArray<{
    readonly topLevel: string;
    readonly source: string;
    readonly description: string;
  }>;
}

const schemaUrl = new URL('../../shared/config-schema.json', import.meta.url);

export const CONFIG_SCHEMA_DATA = JSON.parse(
  readFileSync(schemaUrl, 'utf-8'),
) as ConfigSchemaData;

/** Exact-match config key paths accepted by config-set. */
export const VALID_CONFIG_KEYS: ReadonlySet<string> = new Set(CONFIG_SCHEMA_DATA.validConfigKeys);

/**
 * Internal runtime-state keys accepted by config-set workflows but not exposed
 * as user-facing config options.
 */
export const RUNTIME_STATE_KEYS: ReadonlySet<string> = new Set(CONFIG_SCHEMA_DATA.runtimeStateKeys);

export const DYNAMIC_KEY_PATTERNS: readonly DynamicKeyPattern[] = CONFIG_SCHEMA_DATA.dynamicKeyPatterns.map((pattern) => {
  const regex = new RegExp(pattern.source);
  return {
    topLevel: pattern.topLevel,
    source: pattern.source,
    description: pattern.description,
    test: (k: string) => regex.test(k),
  };
});

/** Returns true if keyPath is a valid config key (exact, runtime-state, or dynamic pattern). */
export function isValidConfigKeyPath(keyPath: string): boolean {
  if (VALID_CONFIG_KEYS.has(keyPath)) return true;
  if (RUNTIME_STATE_KEYS.has(keyPath)) return true;
  return DYNAMIC_KEY_PATTERNS.some((p) => p.test(keyPath));
}
