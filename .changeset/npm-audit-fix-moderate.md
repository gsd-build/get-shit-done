---
type: Fixed
pr: 0
---
**`qs` bumped from 6.15.1 to 6.15.2 to resolve moderate advisory GHSA-q8mj-m7cp-5q26 (#3858)** — `qs@6.15.1` (transitive via `@anthropic-ai/claude-agent-sdk` → `@modelcontextprotocol/sdk` → `express` → `body-parser`) contained a remotely triggerable DoS where `qs.stringify` crashes on null/undefined entries in comma-format arrays with `encodeValuesOnly` set; bumping to 6.15.2 (non-breaking patch) clears the advisory and restores `tests/bug-3588-npm-audit-clean.test.cjs` to green.
