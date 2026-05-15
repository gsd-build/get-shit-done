---
'@gsd-build/get-shit-done': minor
---

Add Grok Build (`--grok`) as a first-class runtime: native `~/.grok/skills/gsd-*` (converted SKILL.md frontmatter), `~/.grok/agents/`, and `~/.grok/hooks/gsd-*.json` manifests wiring the core GSD guard hooks (prompt-guard, read-guard, workflow-guard, session-state, update-banner, context-monitor, etc.) to SessionStart/PreToolUse/PostToolUse. Path/brand conversion, AGENTS.md support, `GROK_CONFIG_DIR`, and install/uninstall parity. Core loop (new-project through verified execution) works with active guardrails inside Grok Build TUI.