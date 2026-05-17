/**
 * Thin re-export adapter — sources schema data from the Configuration Module
 * (sdk/src/configuration/index.ts), which reads from the manifest at
 * sdk/shared/config-schema.manifest.json.
 *
 * All inline literals have been removed. The manifest is the single source
 * of truth for both the SDK and CJS sides (Phase 2 Cycle 5, #3536).
 *
 * Consumers of this module see an identical public API to the previous version:
 *   VALID_CONFIG_KEYS    — ReadonlySet<string>
 *   RUNTIME_STATE_KEYS   — ReadonlySet<string>
 *   DYNAMIC_KEY_PATTERNS — readonly DynamicKeyPattern[]
 *   DynamicKeyPattern    — interface (re-exported type)
 *   isValidConfigKeyPath — (keyPath: string) => boolean
 */

import {
  VALID_CONFIG_KEYS,
  RUNTIME_STATE_KEYS,
  DYNAMIC_KEY_PATTERNS,
} from '../configuration/index.js';

export {
  VALID_CONFIG_KEYS,
  RUNTIME_STATE_KEYS,
  DYNAMIC_KEY_PATTERNS,
  type DynamicKeyPattern,
} from '../configuration/index.js';

/** Returns true if keyPath is a valid config key (exact, runtime-state, or dynamic pattern). */
export function isValidConfigKeyPath(keyPath: string): boolean {
  if (VALID_CONFIG_KEYS.has(keyPath)) return true;
  if (RUNTIME_STATE_KEYS.has(keyPath)) return true;
  return DYNAMIC_KEY_PATTERNS.some((p) => p.test(keyPath));
}
