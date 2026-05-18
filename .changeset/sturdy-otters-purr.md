---
type: Fixed
pr: 3685
---
**Installed command, workflow, and reference bodies no longer leak retired `/gsd:<cmd>` colon refs on Claude / Qwen / Hermes (#3683)** — extends #3677's agent-body normalizer to all body text staged through `copyWithPathReplacement` (commands, workflows, references). The redundant `if (isCommand)` guard was removed — `normalizeAgentBodyForRuntime` already self-gates on `shouldNormalizeHyphenNamespaceInAgentBody(runtime)`. Adds a cross-reference invariant test that asserts every `/gsd-X` / `/gsd:X` reference in a command body resolves to an existing `commands/gsd/X.md`. Gemini-canonical (colon) runtimes are unaffected.
