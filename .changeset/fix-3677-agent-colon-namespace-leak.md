---
type: Fixed
pr: 3680
---
**Installed agent bodies no longer leak retired `/gsd:<cmd>` colon refs on Claude / Qwen / Hermes (#3677)** — `bin/install.js` now applies the same hyphen-namespace normalizer that #3629 wired into SKILL.md bodies to agent bodies as well. A new pure predicate `shouldNormalizeHyphenNamespaceInAgentBody(runtime)` and helper `normalizeAgentBodyForRuntime(content, runtime, cmdNames)` are exported from `bin/install.js` and called from the agent install loop after all runtime-specific conversions. Explicit allow-list (`claude`, `qwen`, `hermes`) — unknown / future runtimes default to no rewrite. Gemini (intentionally colon-namespaced) and self-converting runtimes (Copilot/Codex/Cursor/Antigravity/Windsurf/Augment/Trae/Codebuddy/Cline/Opencode/Kilo) are unaffected. Sibling fixes #3583/#3629 (SKILL.md bodies) and #3584/#3606 (runtime emissions) complete the three-surface coverage.
