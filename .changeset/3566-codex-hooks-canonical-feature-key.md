---
type: Fixed
pr: 3573
---

**Codex installer now emits canonical `[features].hooks` on fresh inserts (no longer writes deprecated `codex_hooks`)** — Codex's own source marks `codex_hooks` as a `legacy_key` ([codex-rs/features/src/legacy.rs](https://github.com/openai/codex/blob/main/codex-rs/features/src/legacy.rs)). The GSD installer was writing the deprecated key on every install / reinstall on Codex CLI ≥ 0.130.0. The installer now writes the canonical `[features].hooks = true` (section, root-dotted, and block-fallback forms) and the runtime check recognizes both `hooks` and legacy `codex_hooks` as enabling the feature. Pre-existing legacy lines (user-authored or from older GSD installs) are preserved untouched — Codex's own `legacy_key` alias handles them at the runtime layer, so there's no breaking change for existing configs. Closes #3566.
