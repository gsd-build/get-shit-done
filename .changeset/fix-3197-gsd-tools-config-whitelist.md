---
type: Fixed
pr: 3197
---
**`gsd-tools config-set workflow._auto_chain_active` no longer rejected** — `workflow._auto_chain_active` is an internal runtime-state key written by plan-phase, execute-phase, discuss-phase, and transition workflows. PR #3162 added it to `RUNTIME_STATE_KEYS` in the SDK's `config-schema.ts` but did not mirror the change to the CJS `config-schema.cjs` used by `gsd-tools.cjs`. Users routed through `gsd-tools.cjs` continued to see "Unknown config key" (#3033). The fix adds `RUNTIME_STATE_KEYS` to `config-schema.cjs`, exports it alongside `VALID_CONFIG_KEYS`, and updates `isValidConfigKey()` to accept runtime-state keys. The SDK `config-mutation.ts` is updated to import and check the same set. A new CI parity assertion ensures the two `RUNTIME_STATE_KEYS` sets stay in sync. (#3197)
