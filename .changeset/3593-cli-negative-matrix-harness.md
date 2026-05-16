---
"get-shit-done-cc": patch
---

**Fixed: `config-set <key>` with no value now fails cleanly.** Previously, invoking `config-set model_profile` (key only, no value) returned `{ updated: true }` with exit 0 — but the value passed through as `undefined`, which `JSON.stringify` silently dropped during the write. Now both the CJS handler and the SDK `configSet` query throw a typed `Usage` error before any write, preventing silent config corruption. Surfaced by the new CLI adversarial-input matrix (#3593).
