---
type: Added
pr: 3415
---
**Perplexity Search & Agent integrations** — two new query commands (`perplexity-search`, `perplexity-agent`) available via both `gsd-tools` and `gsd-sdk query`. Resolves `PERPLEXITY_API_KEY` from env, `~/.gsd/perplexity_api_key`, or the `perplexity` field in `.planning/config.json` — in that order. Every outgoing call sends `Authorization: Bearer <key>` plus `X-Pplx-Integration: get-shit-done/<package-version>` from a single helper. The `perplexity` key is registered in `VALID_CONFIG_KEYS` and `SECRET_CONFIG_KEYS` so the existing `****<last-4>` masking applies to `config-set` / `config-get` output and the `gsd-config --integrations` confirmation table. When the key is unset, both commands return `{ available: false, reason: 'PERPLEXITY_API_KEY not set' }` for graceful fallback. Docs: https://docs.perplexity.ai. (#3415)
