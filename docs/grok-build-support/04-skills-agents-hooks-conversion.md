# Grok Build: Skills, Agents, Hooks & Content Conversion

This is the most complex and Grok-specific part of the work.

## 1. Frontmatter Differences

### Claude / GSD Source Style (commands/gsd/*.md and agents/*.md)
```yaml
---
name: gsd:plan-phase
description: ...
allowed-tools:
  - Read
  - Write
  - Bash
  - ...
tools: Read, Write, Bash, Glob, Grep, ...
color: green
---
<role>...</role>
<objective>...</objective>
...
```

### Grok Build SKILL.md Style (observed in ~/.grok/skills/* and bundled)
```yaml
---
name: gsd-plan-phase
description: >
  Multi-line description here.
metadata:
  short-description: "Short one-liner for autocomplete"
---
# Actual markdown body (can still contain GSD XML tags)
...
```

### Grok Build Agent Style (bundled/agents/*.md)
```yaml
---
name: gsd-planner
description: >
  ...
prompt_mode: full
model: inherit
permission_mode: workspace-write   # or "plan" or "read-only"
agents_md: true
---
You are ...
```

## 2. Required Conversion Functions (new in bin/install.js)

We will add, modeled on the existing Windsurf/Trae pair:

```js
function convertClaudeCommandToGrokSkill(content, skillName) {
  // 1. Rewrite frontmatter to Grok keys (name without "gsd:" prefix? or keep; decide after spike)
  // 2. Change description to folded > style if multi-line
  // 3. Add minimal metadata block
  // 4. Rewrite all @~/.claude/get-shit-done/...  → @~/.grok/get-shit-done/...
  // 5. Rewrite ~/.claude/ paths in prose
  // 6. Optional: replace "Claude Code" → "Grok Build" in help text (or keep neutral)
  // 7. Preserve the <objective>, <execution_context>, <role> XML tags (Grok understands them via the skill body)
  return transformed;
}

function convertClaudeAgentToGrokAgent(content, agentName) {
  // Map:
  //   tools / allowed-tools → (Grok uses permission_mode + implicit allowlist)
  //   color → (drop or map to theme color)
  //   Add: prompt_mode: "full", model: "inherit", agents_md: true
  //   permission_mode: lookup in a GROK_AGENT_SANDBOX map (similar to CODEX_AGENT_SANDBOX)
  // Rewrite internal @ paths and get-shit-done references
  return transformed;
}

function convertClaudeToGrokMarkdown(generalText) {
  // Brand + path substitution for any prose that ships in templates or workflows
  // "Claude Code" → "Grok Build" (configurable?)
  // "CLAUDE.md" → "AGENTS.md"
  // ".claude/" → ".grok/"
  return text;
}
```

**Decision point:** Should GSD skill names in Grok be `gsd:help` (with colon, matching current slash command UX) or `gsd-help`? Grok's slash commands from skills appear to use the `name` field directly. We should preserve `gsd:xxx` if Grok allows `:` in command names, otherwise map to `gsd-xxx`.

## 3. Path Rewrites (critical for self-references)

Every workflow and agent contains lines such as:

```
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/references/...
```

These must become `~/.grok/get-shit-done/...` when installed for the `grok` runtime.

The existing conversion helpers already do this for Windsurf (`~/.windsurf/rules`, `.windsurf/skills/`) and Trae. We extend the same string-replace machinery (or make it table-driven: runtime → {claudeDir, configDir, rulesFile, skillDir}).

## 4. Hook Adaptation for Grok

### Current GSD Hook Scripts (language/runtime agnostic)
- `gsd-statusline.js`
- `gsd-prompt-guard.js`
- `gsd-read-guard.js`
- `gsd-read-injection-scanner.js`
- `gsd-workflow-guard.js`
- `gsd-context-monitor.js`
- `gsd-check-update.js`
- `gsd-update-banner.js`
- `gsd-session-state.sh`
- `gsd-validate-commit.sh`
- `gsd-phase-boundary.sh`
- `gsd-graphify-update.sh`

These are plain Node/shell and can be executed by `node` or `bash` from any tool that supports "run command on event".

### Grok Hook Mechanism

Grok expects JSON files in `~/.grok/hooks/` (or `.grok/hooks/`) with structure:

```json
{
  "hooks": {
    "SessionStart": [ { "matcher": "*", "hooks": [ { "type": "command", "command": "..." } ] } ],
    "PreToolUse":   [ ... ],
    "PostToolUse":  [ ... ],
    "UserPromptSubmit": [ ... ]
    // possibly more events
  }
}
```

**Implementation approach:**

1. Copy the JS/Shell hook files into the Grok hooks directory (or a `get-shit-done/hooks/` subdir to avoid polluting the top-level hooks/ namespace).
2. For each hook that GSD wants to register, emit a small JSON manifest file (e.g. `gsd-session-start.json`, `gsd-pre-tool-use.json`).
3. Use the existing `shell-command-projection` helpers to produce correct absolute or portable `node "/path/to/hook.js"` strings, quoting for the user's shell.
4. On uninstall / re-install, clean up both the JS files and the JSON manifests that GSD owns (via the manifest system).

**Event mapping (tentative — validate against Grok source or docs):**

| GSD Hook Purpose          | Grok Event       | Notes |
|---------------------------|------------------|-------|
| Session state / banner    | SessionStart     | Also good place for context monitor |
| Prompt guard / injection  | UserPromptSubmit | Critical for GSD's safety |
| Read guard / scanner      | PreToolUse       | Gate on Read tool |
| Workflow guard            | PreToolUse       | Gate on Write/Edit/Bash |
| Statusline                | ? (or PostToolUse + output) | May need Grok-specific statusline hook or rely on TUI native |
| Phase boundary / commit   | PostToolUse      | After Write/Edit |
| Update check              | SessionStart     | Periodic |

If Grok does not yet expose `UserPromptSubmit` or `PreToolUse` at the same granularity as Claude Code, the plan allows a **graceful degradation**: install the hooks that *do* map, and document which GSD safety features are active under Grok.

## 5. Project Rules File (AGENTS.md / Claude.md)

Grok's priority order (highest first):
1. Agents.md
2. Claude.md
3. AGENT.md
4. AGENTS.md

GSD currently ships and maintains a `CLAUDE.md` (from `templates/claude-md.md`) in the project root. It contains the GSD system instructions, state loading, and "always read" directives.

**Options (choose one in the impl spike):**

A. **Compat-only**: Keep installing `CLAUDE.md`. Grok will pick it up (explicitly supported). Zero conversion work. Users who also run Claude Code get the same file.

B. **Native**: Install `AGENTS.md` (or `GROK.md` if that becomes a thing) containing the GSD content + a small "managed by GSD" marker. On install for `grok`, if `CLAUDE.md` exists, either leave it or migrate content into `AGENTS.md`.

C. **Hybrid**: Always install both `CLAUDE.md` (for Claude users) and `AGENTS.md` (for Grok-first users), with the GSD section guarded by the same ownership markers used elsewhere.

**Recommended:** Option C for maximum compatibility, or simply rely on the fact that `CLAUDE.md` is already in Grok's search list and only add a lightweight `AGENTS.md` wrapper when the primary runtime is `grok`.

The `/gsd-new-project` workflow and `templates/project.md` etc. will need small prose updates or runtime-conditional rendering (see 05).

## 6. Brand & Prose Substitution

Many workflows, agents, and the `CLAUDE.md` template contain the literal string "Claude Code". For a polished Grok experience we should:

- Provide a general `replaceRuntimeBranding(text, targetRuntime)` utility.
- For `grok`: "Claude Code" → "Grok Build", "Claude" (when meaning the tool) → "Grok".
- Keep technical terms (`CLAUDE.md` file name when it is literally that file) accurate.

The Windsurf conversion already does a limited version of this (`convertClaudeToWindsurfMarkdown`).

## 7. Grok-Specific Agent Sandbox Map

Analogous to `CODEX_AGENT_SANDBOX` in `bin/install.js`:

```js
const GROK_AGENT_SANDBOX = {
  'gsd-executor': 'workspace-write',
  'gsd-planner': 'workspace-write',
  ...
  'gsd-plan-checker': 'read-only',
  ...
};
```

Used when writing the `permission_mode` field during agent conversion.

## 8. Testing the Conversion Layer

New test file (or extension of existing):
- `tests/grok-conversion.test.cjs` — unit tests for the three convert* functions, path rewriting, frontmatter shape, permission_mode injection.
- Must cover the 6 core skills and at least the planner/executor agents.

## 9. Files That Will Receive Conversion Treatment

- All 60+ files under `commands/gsd/`
- All 30+ files under `agents/`
- Selected templates (`claude-md.md`, `project.md`, `CONTEXT.md` snippets)
- Any workflow that hard-codes `~/.claude/get-shit-done` (should be none after the @-ref abstraction, but verify)

The conversion runs at *install time* only (not at runtime), so performance is irrelevant. The staged files live under the target runtime's tree and are what the LLM actually reads.

## 10. Future-Proofing

If Grok later changes its SKILL.md schema or adds a `gsd` category like Hermes (`skills/gsd/<name>/`), we can add a migration in `installer-migrations/` and a new profile in `install-profiles.cjs` (Hermes already has special nested handling).

This conversion module will live alongside the Windsurf and Trae converters in `bin/install.js`.
