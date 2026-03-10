# Phase 2: Content Conversion Engine - Research

**Researched:** 2026-03-03
**Domain:** Markdown file transformation — frontmatter + body text conversion for multi-runtime CLI installer
**Confidence:** HIGH

## Summary

Phase 2 implements the content conversion engine that transforms GSD's Claude-native source files into GitHub Copilot format during installation. Three source directories (`commands/gsd/`, `agents/`, `get-shit-done/`) produce output in `.github/` with frontmatter transformation, tool name mapping, path reference replacement, and command name conversion.

The existing installer (`bin/install.js`, 2410 lines) already has mature conversion patterns for 4 runtimes (Claude, OpenCode, Gemini, Codex). Phase 2 follows these established patterns — creating Copilot-specific conversion functions and wiring them into the existing `install()` function's copy branches. The Codex conversion is the closest analog: it also uses a skills-in-folders structure (`skills/gsd-*/SKILL.md`) and has runtime-specific frontmatter transformation.

The codebase has hand-created reference files in `.github/skills/` and `.github/agents/` that serve as approximate validation targets, though they have known differences from what the automated conversion should produce (non-deduplicated tool arrays, some manual edits). The CONTEXT.md decisions override any discrepancies in the existing hand-created output.

**Primary recommendation:** Follow the Codex conversion pattern — create `convertCopilotToolName()`, `convertClaudeCommandToCopilotSkill()`, `convertClaudeAgentToCopilotAgent()` functions, add `isCopilot` branches to the install() copy logic, and expand the test module exports.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Source Directories and Conversion Targets:**
  - `./commands/gsd/*.md` → `.github/skills/gsd-*/SKILL.md` — skill conversion with frontmatter transformation
  - `./agents/gsd-*.md` → `.github/agents/gsd-*.agent.md` — agent conversion with tools mapping and file rename
  - `./get-shit-done/` → `.github/get-shit-done/` — full directory copy with path and command name transformations
  - These are the ONLY 3 source directories for content conversion

- **Tool Name Mapping (Agents ONLY):**
  - Read→read, Write→edit, Edit→edit, Bash→execute, Grep→search, Glob→search, Task→agent, WebSearch→web, WebFetch→web, TodoWrite→todo, AskUserQuestion→ask_user, SlashCommand→skill, mcp__context7__*→io.github.upstash/context7/*
  - When multiple Claude tools map to same Copilot tool, deduplicate output
  - Agent tools format: JSON array — `tools: ['read', 'edit', 'execute', 'search']`

- **Skill Conversion Strategy:**
  - Copy body completely — body content after frontmatter is identical
  - Transform frontmatter only: `name:` colon→hyphen, `allowed-tools:` YAML list→comma string
  - Skills keep original tool names — no mapping applied to `allowed-tools`
  - Directory structure: `.github/skills/gsd-{name}/SKILL.md`

- **Agent Conversion Strategy:**
  - Copy body completely — body content is identical
  - Transform frontmatter: `tools:` apply mapping+JSON array+deduplicate, `name:` already correct
  - File rename: `gsd-*.md` → `gsd-*.agent.md`

- **Path Reference Conversion (CONV-06) — Global, applied to ALL content:**
  - `~/.claude/` → `~/.copilot/` (global path)
  - `./.claude/` → `./.github/` (local path with explicit prefix)
  - `.claude/` → `.github/` (local path without prefix)

- **Command Name Conversion (CONV-07) — Global, applied to ALL content:**
  - `gsd:name` → `gsd-name` (colon to hyphen in all command references)

- **Engine Directory:** Full copy of `./get-shit-done/` → `.github/get-shit-done/` with CONV-06 and CONV-07

- **Router Skill (CONV-09) — DISCARDED:** `.github/skills/get-shit-done/SKILL.md` is legacy, NOT generated

- **CHANGELOG.md and VERSION (CONV-10):** Written to `.github/get-shit-done/` (same as existing runtimes)

### Claude's Discretion
- Order of conversion operations (skills first vs agents first)
- Error handling for malformed frontmatter
- Whether to use streaming or batch file processing
- Internal function naming for conversion utilities

### Deferred Ideas (OUT OF SCOPE)
- **CONV-09 Router skill** — Discarded entirely, not deferred
- **Hook conversion** — Copilot hooks deferred to future milestone
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | Commands converted to Copilot skills (`.github/skills/gsd-*/SKILL.md`) | Codex skill conversion pattern exists (`copyCommandsAsCodexSkills`). 31 source skills identified. Folder-per-skill structure verified in existing output. |
| CONV-02 | `allowed-tools` YAML list → comma-separated string | Frontmatter extraction utilities exist (`extractFrontmatterAndBody`, `extractFrontmatterField`). 3 skills lack `allowed-tools` — need graceful handling. |
| CONV-03 | Agents copied to `.github/agents/gsd-*.agent.md` with extension rename | Agent copy branch exists in `install()`. 11 source agents identified. File rename is simple suffix addition. |
| CONV-04 | Agent `tools:` converted to JSON array format | Codex agent conversion pattern exists (`convertClaudeAgentToCodexAgent`). JSON array format: `['read', 'edit', 'execute']`. |
| CONV-05 | Tool name mapping applied to agent tools | Complete mapping table from CONTEXT.md. Existing `convertToolName()` and `convertGeminiToolName()` are patterns. `mcp__context7__*` wildcard needs prefix matching. |
| CONV-06 | Path references replaced: `~/.claude/`→`~/.copilot/`, `./.claude/`→`./.github/`, `.claude/`→`.github/` | 323 path references across all sources. Also `$HOME/.claude/` pattern (168 occurrences). Existing `copyWithPathReplacement()` handles 2 of 4 patterns. |
| CONV-07 | Command names: `gsd:name` → `gsd-name` in ALL content | ~390 total `gsd:` references across skills, agents, and engine. Applies to frontmatter AND body. Also in `.cjs` files (verify.cjs has 8). |
| CONV-08 | `get-shit-done/` directory copied to `.github/get-shit-done/` | Existing `copyWithPathReplacement()` handles this. 93 files total. Need to extend for CONV-07 (not currently done for any runtime). |
| CONV-09 | ~~Router skill~~ — **DISCARDED** | Router at `.github/skills/get-shit-done/SKILL.md` is legacy. Should NOT be generated. Existing hand-created version to be removed by Phase 3 uninstall. |
| CONV-10 | CHANGELOG.md and VERSION written to `.github/get-shit-done/` | Already implemented in `install()` for all runtimes — copies CHANGELOG.md and writes VERSION with `pkg.version`. No new code needed. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `path`) | ≥16.7 | File I/O, path manipulation | Existing codebase pattern — zero dependencies |
| `bin/install.js` | Current | Single-file installer with all conversion logic | All 4 existing runtimes are in this file |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` + `node:assert` | Built-in | Test framework | All tests use this — no external test libs |
| `c8` | ^11.0.0 | Code coverage | `npm run test:coverage` |

### No New Dependencies
This phase adds NO new packages. All conversion logic is pure Node.js string manipulation within the existing `bin/install.js` file, following the established pattern of the 4 existing runtimes.

## Architecture Patterns

### Where New Code Goes (Single-File Architecture)

All conversion functions live in `bin/install.js`. The file structure follows this organization:

```
bin/install.js (2410 lines)
├── Constants (lines 1-35)          — tool mappings, markers
├── Arg parsing (lines 37-62)       — flag detection
├── Path helpers (lines 64-230)     — getDirName, getGlobalDir, etc.
├── Content utilities (lines 320-455) — attribution, tool conversion, frontmatter extraction
├── Codex converters (lines 455-685) — convertClaudeCommandToCodexSkill, etc.
├── Gemini converters (lines 732-920) — convertClaudeToGeminiAgent, etc.
├── Copy functions (lines 969-1220)  — copyFlattenedCommands, copyCommandsAsCodexSkills, copyWithPathReplacement
├── Lifecycle (lines 1220-1840)      — manifest, patches, uninstall, verify
├── install() (lines 1840-2050)      — main install logic with runtime branches
├── finishInstall() (lines 2139-2250) — statusline, settings, completion
├── Prompts (lines 2250-2355)        — interactive runtime/location selection
└── Exports / main (lines 2355-2410) — GSD_TEST_MODE exports
```

### Pattern 1: Tool Mapping Constant + Converter Function

**What:** Define a mapping constant, then a function that uses it with fallback logic.
**When to use:** Copilot tool name conversion (CONV-05).
**Example (from existing Gemini pattern):**

```javascript
// Constant — placed near line 35
const claudeToCopilotTools = {
  Read: 'read',
  Write: 'edit',
  Edit: 'edit',
  Bash: 'execute',
  Grep: 'search',
  Glob: 'search',
  Task: 'agent',
  WebSearch: 'web',
  WebFetch: 'web',
  TodoWrite: 'todo',
  AskUserQuestion: 'ask_user',
  SlashCommand: 'skill',
};

// Function — placed near line 420
function convertCopilotToolName(claudeTool) {
  // mcp__context7__* → io.github.upstash/context7/*
  if (claudeTool.startsWith('mcp__context7__')) {
    return 'io.github.upstash/context7/' + claudeTool.slice('mcp__context7__'.length);
  }
  // Check explicit mapping
  if (claudeToCopilotTools[claudeTool]) {
    return claudeToCopilotTools[claudeTool];
  }
  // Default: lowercase
  return claudeTool.toLowerCase();
}
```

### Pattern 2: Skill Conversion — Frontmatter Transform + Body Pass-Through

**What:** Parse frontmatter, transform fields, reconstruct with converted body.
**When to use:** CONV-01, CONV-02.
**Key differences from Codex pattern:**
- Copilot skills use original tool names (no mapping)
- Copilot uses `allowed-tools: Read, Bash, Write` (comma-separated, single line)
- Copilot uses unquoted name: `name: gsd-health` (not JSON-quoted)

```javascript
function convertClaudeCommandToCopilotSkill(content, skillName) {
  // Apply CONV-06 and CONV-07 first (path + command name conversion)
  let converted = convertClaudeToCopilotContent(content);
  
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;
  
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const argumentHint = extractFrontmatterField(frontmatter, 'argument-hint') || '';
  const agent = extractFrontmatterField(frontmatter, 'agent') || '';
  
  // Extract allowed-tools (YAML multiline list → comma string)
  const toolsMatch = frontmatter.match(/^allowed-tools:\s*\n((?:\s+-\s+.+\n?)*)/m);
  let toolsLine = '';
  if (toolsMatch) {
    const tools = toolsMatch[1].match(/^\s+-\s+(.+)/gm);
    if (tools) {
      toolsLine = tools.map(t => t.replace(/^\s+-\s+/, '').trim()).join(', ');
    }
  }
  
  // Reconstruct frontmatter
  let fm = `---\nname: ${skillName}\ndescription: ${description}\n`;
  if (argumentHint) fm += `argument-hint: '${argumentHint}'\n`;
  if (agent) fm += `agent: ${agent}\n`;
  if (toolsLine) fm += `allowed-tools: ${toolsLine}\n`;
  fm += '---';
  
  return `${fm}\n${body}`;
}
```

### Pattern 3: Agent Conversion — Tool Mapping + JSON Array + Deduplication

**What:** Parse tools field, apply mapping, format as JSON array, deduplicate.
**When to use:** CONV-03, CONV-04, CONV-05.

```javascript
function convertClaudeAgentToCopilotAgent(content) {
  // Apply CONV-06 and CONV-07 first
  let converted = convertClaudeToCopilotContent(content);
  
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;
  
  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const color = extractFrontmatterField(frontmatter, 'color') || '';
  const toolsRaw = extractFrontmatterField(frontmatter, 'tools') || '';
  
  // Map and deduplicate tools
  const claudeTools = toolsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const mappedTools = claudeTools.map(t => convertCopilotToolName(t));
  const uniqueTools = [...new Set(mappedTools)];
  const toolsArray = `['${uniqueTools.join("', '")}']`;
  
  // Reconstruct frontmatter
  let fm = `---\nname: ${name}\ndescription: ${description}\ntools: ${toolsArray}\n`;
  if (color) fm += `color: ${color}\n`;
  fm += '---';
  
  return `${fm}\n${body}`;
}
```

### Pattern 4: Content Conversion — Path + Command Name Replacement

**What:** Apply CONV-06 and CONV-07 to any content string.
**When to use:** Called by BOTH skill and agent converters, and by the engine directory copy.

```javascript
function convertClaudeToCopilotContent(content, pathPrefix) {
  let c = content;
  // CONV-06: Path replacement (order matters — most specific first)
  c = c.replace(/\$HOME\/\.claude\//g, pathPrefix);  // $HOME/.claude/ → pathPrefix
  c = c.replace(/~\/\.claude\//g, pathPrefix);         // ~/.claude/ → pathPrefix  
  c = c.replace(/\.\/\.claude\//g, './.github/');       // ./.claude/ → ./.github/
  c = c.replace(/\.claude\//g, '.github/');             // .claude/ → .github/ (no prefix)
  // CONV-07: Command name conversion
  c = c.replace(/gsd:/g, 'gsd-');                       // gsd:name → gsd-name
  return c;
}
```

### Pattern 5: install() Branch Integration

**What:** Add `isCopilot` branches to existing install() copy logic.
**When to use:** Wiring converters into the install flow.

The install() function at line 1840 already has:
- Skill copy branch (lines 1888-1925): `if (isOpencode)...else if (isCodex)...else...`
- Engine copy (lines 1928-1935): calls `copyWithPathReplacement()`
- Agent copy (lines 1938-1978): runtime-specific conversion inside loop

Add Copilot branches:
1. **Skills:** Add `else if (isCopilot)` to skill branch — create `skills/gsd-*/SKILL.md` folders
2. **Engine:** Extend `copyWithPathReplacement()` with Copilot content conversion
3. **Agents:** Add `else if (isCopilot)` to agent loop — apply conversion + file rename

### Anti-Patterns to Avoid

- **Modifying source files:** Conversion is read-only on source — all transformations happen in memory before writing to target
- **Separate conversion script:** All conversion lives in `bin/install.js` — do NOT create a separate conversion module (breaks the single-file architecture)
- **Regex on binary/non-text files:** Only `.md`, `.cjs`, `.js` files get content transformation. `config.json` template and any other non-text files are copied as-is
- **Hardcoding file lists:** Use `fs.readdirSync()` to discover source files, not hardcoded arrays of filenames

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Full YAML parser | `extractFrontmatterAndBody()` + regex | Existing pattern works for all 4 runtimes, frontmatter is simple key-value |
| Tool name mapping | Dynamic config/rules engine | Static constant object + function | 13 mappings total, unlikely to change frequently |
| Directory structure creation | Custom tree builder | `fs.mkdirSync(dir, { recursive: true })` | Node.js handles nested creation |
| File discovery | Glob library | `fs.readdirSync()` with filter | Existing pattern, no wildcards needed |

**Key insight:** The existing codebase deliberately avoids external dependencies (zero runtime deps). All string transformation is pure regex/string operations. Don't introduce parsing libraries.

## Common Pitfalls

### Pitfall 1: `$HOME/.claude/` Path Pattern Not in CONTEXT.md Spec
**What goes wrong:** CONTEXT.md specifies 3 path patterns (`~/.claude/`, `./.claude/`, `.claude/`) but the codebase has a 4th: `$HOME/.claude/` (168 occurrences, mostly in bash code blocks).
**Why it happens:** Shell scripts use `$HOME` instead of `~` for variable expansion safety.
**How to avoid:** Add `$HOME/.claude/` → `$HOME/.copilot/` (global) replacement as a 4th pattern. Apply it BEFORE `~/.claude/` to avoid partial matches.
**Warning signs:** Shell snippets in converted output still reference `.claude/` after conversion.

### Pitfall 2: Regex Order Sensitivity for Path Replacement
**What goes wrong:** `.claude/` regex matches inside `~/.claude/` and `./.claude/`, causing double-replacement.
**Why it happens:** Unanchored `.claude/` matches as a substring.
**How to avoid:** Apply replacements most-specific-first: `$HOME/.claude/` → `~/.claude/` → `./.claude/` → `.claude/`. The first two have unique prefixes; the last catches remaining bare `.claude/` references.
**Warning signs:** Output has `.github/.github/` or `~/.copilot/.github/` doubled paths.

### Pitfall 3: `gsd:` Replacement Overbreadth
**What goes wrong:** `gsd:` regex replaces inside strings where colon is valid (e.g., YAML `name: gsd:health` frontmatter line converts the whole thing, or URLs, or timestamps).
**Why it happens:** Naive global regex without boundary checking.
**How to avoid:** The `gsd:` pattern is actually safe as a global replace because there are no false positives in the codebase (verified: all 390+ occurrences are legitimate command name references). However, test with full content to confirm no edge cases in new content.
**Warning signs:** Corrupted YAML, broken URLs, or malformed timestamps.

### Pitfall 4: Skills Without `allowed-tools` Field
**What goes wrong:** Conversion code assumes `allowed-tools` exists and crashes or produces malformed frontmatter.
**Why it happens:** 3 skills (cleanup, help, join-discord) have no `allowed-tools` field.
**How to avoid:** Check for `allowed-tools` match before processing. Omit the field from output if not present in source.
**Warning signs:** `allowed-tools: undefined` or `allowed-tools: ` (empty) in output.

### Pitfall 5: `mcp__context7__*` Wildcard Tool Mapping
**What goes wrong:** Treating `mcp__context7__*` as a literal string instead of a prefix match.
**Why it happens:** The `*` in the source frontmatter is a wildcard indicator, not literal.
**How to avoid:** In the tool mapping function, check `claudeTool.startsWith('mcp__context7__')` and replace the prefix. Note: in the source, the frontmatter literally contains `mcp__context7__*` — it's a wildcard pattern declaration, so map it as `io.github.upstash/context7/*` preserving the wildcard.
**Warning signs:** `mcp__context7__*` passed through unmapped, or the `*` suffix gets lost.

### Pitfall 6: Agent File Rename Creates Orphaned Source-Named Files
**What goes wrong:** Agent loop writes `gsd-executor.md` (source name) instead of `gsd-executor.agent.md` (target name), or the old-file cleanup deletes the new `.agent.md` files.
**Why it happens:** Existing agent copy uses `entry.name` for dest filename. The cleanup loop removes `gsd-*.md` files.
**How to avoid:** For Copilot: change dest filename from `entry.name` to `entry.name.replace('.md', '.agent.md')`. The existing cleanup regex `file.startsWith('gsd-') && file.endsWith('.md')` would match `.agent.md` files too — need to adjust for Copilot.
**Warning signs:** Agents missing from install, or both `.md` and `.agent.md` versions present.

### Pitfall 7: `argument-hint` YAML Quoting
**What goes wrong:** Values like `[--repair]` break YAML parsing because `[` starts a YAML flow sequence.
**Why it happens:** YAML interprets unquoted `[...]` as arrays.
**How to avoid:** Quote `argument-hint` values that contain special YAML characters. The existing Copilot output uses single quotes: `argument-hint: '[--repair]'`.
**Warning signs:** YAML parse errors in Copilot skills, or missing argument hints.

### Pitfall 8: Non-.md Files in Engine Directory Need CONV-07
**What goes wrong:** `.cjs` files in `get-shit-done/bin/lib/` contain `gsd:` references that don't get converted.
**Why it happens:** `copyWithPathReplacement()` only processes `.md` files for content transformation.
**How to avoid:** Extend the engine copy to also apply CONV-07 (`gsd:` → `gsd-`) to `.cjs` and `.js` files for Copilot. Specifically: `verify.cjs` (8 references), `phase.cjs` (2), `commands.cjs` (1).
**Warning signs:** Runtime errors in GSD tools where `gsd:` references appear in user-facing messages instead of `gsd-`.

### Pitfall 9: Test Module Exports
**What goes wrong:** New conversion functions aren't testable because they aren't in the `GSD_TEST_MODE` export block.
**Why it happens:** Forgetting to add new functions to the exports object at line 2355.
**How to avoid:** Add ALL new Copilot conversion functions to the `module.exports` block alongside existing Codex exports.
**Warning signs:** `TypeError: X is not a function` in tests.

### Pitfall 10: CONV-10 (CHANGELOG + VERSION) Already Works
**What goes wrong:** Implementing CHANGELOG/VERSION copy when it's already done.
**Why it happens:** The install() function already copies CHANGELOG.md and writes VERSION for ALL runtimes (lines 1980-2000). This runs regardless of runtime.
**How to avoid:** Verify existing code handles this — no new code needed for CONV-10.
**Warning signs:** Duplicate file writes, or CHANGELOG appearing in wrong location.

## Code Examples

Verified patterns from the existing codebase:

### Frontmatter Extraction (Existing)
```javascript
// Source: bin/install.js:432
function extractFrontmatterAndBody(content) {
  if (!content.startsWith('---')) {
    return { frontmatter: null, body: content };
  }
  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return { frontmatter: null, body: content };
  }
  return {
    frontmatter: content.substring(3, endIndex).trim(),
    body: content.substring(endIndex + 3),
  };
}
```

### Codex Skill Folder Creation (Existing Pattern to Follow)
```javascript
// Source: bin/install.js:1025-1082
// This is the Codex version — Copilot follows same folder structure
function copyCommandsAsCodexSkills(srcDir, skillsDir, prefix, pathPrefix, runtime) {
  fs.mkdirSync(skillsDir, { recursive: true });
  // Remove previous GSD skills
  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }
  // Recurse into source, create skill dirs
  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        recurse(path.join(currentSrcDir, entry.name), `${currentPrefix}-${entry.name}`);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });
      let content = fs.readFileSync(path.join(currentSrcDir, entry.name), 'utf8');
      // ... apply conversions ...
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }
  recurse(srcDir, prefix);
}
```

### Existing Path Replacement Pattern (Existing)
```javascript
// Source: bin/install.js:1084-1140
// Current pattern — only handles ~/.claude/ and ./.claude/
const globalClaudeRegex = /~\/\.claude\//g;
const localClaudeRegex = /\.\/\.claude\//g;
content = content.replace(globalClaudeRegex, pathPrefix);
content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
```

### Copilot Path Replacement (Needs Extension)
```javascript
// For Copilot, need 4 patterns applied in specificity order:
function applyCopilotPathConversion(content, pathPrefix) {
  let c = content;
  c = c.replace(/"\$HOME\/\.claude\//g, '"' + pathPrefix);  // $HOME/.claude/ in shell
  c = c.replace(/~\/\.claude\//g, pathPrefix);               // ~/.claude/ global refs
  c = c.replace(/\.\/\.claude\//g, './.github/');             // ./.claude/ local refs
  c = c.replace(/(?<![~\/])\.claude\//g, '.github/');         // bare .claude/ (negative lookbehind)
  return c;
}
```

### Tool Array Construction with Deduplication
```javascript
// Format agent tools as JSON array with deduplication
const claudeTools = toolsRaw.split(',').map(t => t.trim()).filter(Boolean);
const mappedTools = claudeTools.map(t => convertCopilotToolName(t));
const uniqueTools = [...new Set(mappedTools)];
const toolsArray = "['" + uniqueTools.join("', '") + "']";
// Result: "['read', 'edit', 'execute', 'search', 'web', 'io.github.upstash/context7/*']"
```

### YAML Multiline List to Comma String
```javascript
// Extract allowed-tools: YAML list and convert to comma-separated
function extractAllowedTools(frontmatter) {
  // Match the field name followed by indented list items
  const match = frontmatter.match(/^allowed-tools:\s*\n((?:\s+-\s+.+\n?)*)/m);
  if (!match) return null;
  const items = match[1].match(/^\s+-\s+(.+)/gm);
  if (!items) return null;
  return items.map(t => t.replace(/^\s+-\s+/, '').trim()).join(', ');
  // "Read, Bash, Write, AskUserQuestion"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-created `.github/` files | Automated conversion in installer | Phase 2 (now) | Reproducible, maintainable, consistent |
| Single pathPrefix for all patterns | Context-dependent path mapping | Phase 2 (now) | Correctly distinguishes global vs local refs |
| Non-deduplicated tool arrays | Deduplicated tool arrays | Phase 2 (now) | Cleaner agent configuration |
| `mcp__context7__*` unmapped | Maps to `io.github.upstash/context7/*` | Phase 2 (now) | Correct Copilot MCP tool format |

**Current hand-created output vs automated conversion differences:**
- Existing output has non-deduplicated tools: `['read', 'edit', 'edit', 'execute', 'search', 'search']`
- Existing output keeps `mcp__context7__*` unmapped and `WebSearch`→`websearch` (lowercase only)
- Existing output has some manual content edits (removed `<analysis_paralysis_guard>` section, changed `.claude/skills/`→`.agents/skills/`)
- **Automated conversion follows CONTEXT.md decisions**, not the hand-created output

## Key Metrics

| Category | Count | Details |
|----------|-------|---------|
| Source skills | 31 | `commands/gsd/*.md` (excluding .bak file) |
| Source agents | 11 | `agents/gsd-*.md` |
| Engine files | 93 | `get-shit-done/` (md + cjs + js + json) |
| `gsd:` references | ~390 | Skills ~40, agents ~30, engine ~310 |
| Path references | ~323 | `~/.claude/` 140 + `$HOME/.claude/` 168 + `./.claude/` 5 + `.claude/` ~10 |
| Skills without `allowed-tools` | 3 | cleanup, help, join-discord |
| Skills with `agent:` field | 1 | plan-phase (agent: gsd-planner) |
| Agents with `mcp__context7__*` | 3 | phase-researcher, project-researcher, planner |

## Open Questions

1. **`$HOME/.claude/` Handling**
   - What we know: 168 occurrences exist in source, mostly in bash code blocks. Not in CONTEXT.md's 3 patterns. Existing hand-created output converts them to `.github/` (local).
   - What's unclear: Should `$HOME/.claude/` follow the `~/.claude/` mapping (→`~/.copilot/` for global) or always become local `.github/`? For local install, both approaches yield the same result. For global install, they differ.
   - Recommendation: Use same pathPrefix as `~/.claude/` — they're semantically equivalent. The pathPrefix is set based on global/local install context. This matches the existing behavior for other runtimes.

2. **`.claude/skills/` → `.github/skills/` vs `.agents/skills/`**
   - What we know: The hand-created output uses `.agents/skills/` (not `.github/skills/`). But automated CONV-06 would produce `.github/skills/` since `.claude/` → `.github/`.
   - What's unclear: Whether the hand-created `.agents/skills/` was intentional or a manual error.
   - Recommendation: Follow CONV-06 rules. `.claude/skills/` → `.github/skills/`. The `.agents/skills/` in hand-created output appears to be a manual decision outside the conversion scope. If deliberate, it should be a post-conversion fixup, not a core conversion rule.

3. **pathPrefix approach for global Copilot install**
   - What we know: The existing installer uses a single `pathPrefix` that replaces ALL `~/.claude/` references uniformly. For local: `./.github/`. For global: `~/.copilot/`.
   - What's unclear: CONTEXT.md says `~/.claude/` → `~/.copilot/` (global) and `./.claude/` → `./.github/` (local) as FIXED mappings regardless of install type. This implies even in a global install, `./.claude/` should become `./.github/` (local project reference).
   - Recommendation: Keep the existing pathPrefix approach — it's correct. For local install: both `~/.claude/` and `./.claude/` → local paths. For global install: `~/.claude/` → `~/.copilot/` (global prefix), `./.claude/` → `./.github/` (always local). The existing code already handles the `./.claude/` pattern separately with `getDirName()`.

## Sources

### Primary (HIGH confidence)
- **`bin/install.js`** — Full source code analyzed (2410 lines). All existing conversion patterns, functions, and install flow examined directly.
- **`commands/gsd/*.md`** — All 31 source skill files frontmatter examined directly.
- **`agents/gsd-*.md`** — All 11 source agent files frontmatter examined directly.
- **`.github/skills/`, `.github/agents/`** — Existing hand-created Copilot output used as validation reference.
- **`tests/copilot-install.test.cjs`** — Phase 1 test patterns examined.
- **`02-CONTEXT.md`** — Locked decisions from discuss phase.

### Secondary (MEDIUM confidence)
- **Side-by-side diffs** of source→target for 4 files (health skill, progress skill, executor agent, phase-researcher agent) — confirmed exact transformation patterns.
- **Grep counts** across entire codebase for path references and command name patterns — exact numbers verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — single-file architecture fully understood, no ambiguity
- Architecture: HIGH — existing patterns for 4 runtimes provide clear templates
- Pitfalls: HIGH — identified through actual codebase analysis and diff comparison
- CONV-06 path handling: MEDIUM — `$HOME/.claude/` pattern needs verification against CONTEXT.md intent
- CONV-05 tool mapping: HIGH — complete table provided in CONTEXT.md decisions

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable — internal project tooling, not fast-moving ecosystem)
