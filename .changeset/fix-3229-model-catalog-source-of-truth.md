---
type: Fixed
pr: 3230
---
**`resolve-model` no longer drifts between SDK and CLI/CJS** — model-selection data now comes from a shared Model Catalog Module (`sdk/shared/model-catalog.json`) that both the SDK and the main CLI package consume. This fixes the #3229 class of bug where the SDK knew only 18 agents while 33 shipped agents existed on disk, causing `resolve-model` to silently return `{ unknown_agent: true, model: "sonnet" }` for valid agents like `gsd-code-reviewer` and `gsd-security-auditor`.

The shared catalog now owns:
- the full 33-agent registry
- per-agent golden/quality alias plus balanced/budget aliases
- adaptive routing derivation from `routingTier`
- agent → phase-type map
- agent → dynamic-routing default tier map
- runtime tier defaults for all supported runtimes (`claude`, `codex`, `gemini`, `qwen`, `opencode`, `copilot`, `hermes`, plus Group B runtimes with no built-in defaults)

`resolve-model` unknown-agent fallback is also now profile-semantic instead of hardcoded `sonnet`: `quality → opus`, `budget → haiku`, `balanced/adaptive → sonnet`, `inherit → inherit`.
