/**
 * Secrets handling — TypeScript mirror of `get-shit-done/bin/lib/secrets.cjs`.
 *
 * Keys considered sensitive (`SECRET_CONFIG_KEYS`) are masked in any
 * machine-readable response from `config-set` / `config-get` so plaintext
 * credentials don't end up in workflow output, session transcripts, or
 * shell histories. The on-disk value is unchanged; only the response is masked.
 *
 * Behavior must match `secrets.cjs` exactly. A parity test asserts the
 * two modules expose the same set of secret keys and produce identical
 * masked output for representative inputs.
 *
 * Tracked in #2997 (security: SDK port lost masking behavior).
 */

export const SECRET_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'brave_search',
  'firecrawl',
  'exa_search',
]);

export function isSecretKey(keyPath: string): boolean {
  return SECRET_CONFIG_KEYS.has(keyPath);
}

/**
 * Convention: ≥8 chars → `****<last-4>`; <8 chars → `****`; null/empty/undefined → `(unset)`.
 * Identical to `secrets.cjs` `maskSecret`.
 */
export function maskSecret(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(unset)';
  const s = String(value);
  if (s.length < 8) return '****';
  return '****' + s.slice(-4);
}

/**
 * Helper: returns the value masked if `keyPath` is a secret, else the value
 * unchanged. Use at response-construction boundaries in query handlers.
 */
export function maskIfSecret<T>(keyPath: string, value: T): T | string {
  return isSecretKey(keyPath) ? maskSecret(value) : value;
}
