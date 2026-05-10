# Config Schema Module as shared schema data

- **Status:** Accepted
- **Date:** 2026-05-10

We decided to make config key registration a shared **Config Schema Module** backed by shipped schema data, with thin CJS and SDK Adapters projecting the existing runtime Interfaces.

## Context

Before this decision, the exact config key allowlist, runtime-state key allowlist, and dynamic key patterns lived in mirrored CJS and SDK files. Tests compared the mirrors to catch drift. That made the tests the primary safety net for duplicate implementations instead of making one Module own the schema.

The mirrored files fail the deletion test: deleting one mirror should not require maintainers to rediscover schema facts from tests or copy them from another Adapter. The real behavior is the shared schema contract, not the syntax of either runtime file.

## Decision

The Config Schema Module owns:

- exact-match user-facing config keys;
- runtime-state config keys that validation accepts but docs parity does not expose as user-settable options;
- dynamic config key pattern sources, descriptions, and top-level namespaces.

The canonical data lives in shipped shared schema data. CJS and SDK config-schema files are Adapters that:

- load the shared data;
- project `VALID_CONFIG_KEYS`, `RUNTIME_STATE_KEYS`, and `DYNAMIC_KEY_PATTERNS` for existing callers;
- build runtime `RegExp` validators from shared pattern sources;
- preserve existing `isValidConfigKey` / `isValidConfigKeyPath` behavior.

Config mutation handlers own argument parsing, value coercion, typo suggestions, command errors, and write behavior. They do not own config key registration. Docs tests consume the user-facing exact-key projection for documentation parity; they do not own schema membership.

## Consequences

Adding or removing a config key happens in one place, then both CJS and SDK Adapters project the result.

Tests should target the Config Schema Module Interface and representative validation behavior. CJS-vs-SDK parity tests may verify Adapter projection, but they should not parse mirrored source text or act as the primary mechanism that keeps two schema implementations synchronized.

This decision extends the SDK seam map from ADR 0005 without changing the Dispatch Policy Module or Planning Workspace Module.
