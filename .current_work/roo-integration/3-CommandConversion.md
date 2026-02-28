# Phase 3: Command Frontmatter & Path Conversion

## Objective
Implement the `convertCommandForRoo()` function in `bin/install.js` that transforms each GSD command `.md` file from Claude Code format to Roo format. This is the core content transformation step.

## Files to Modify
- [`bin/install.js`](c:/Users/sge20/go/src/github.com/harmony-ai-solutions/get-shit-done/bin/install.js) — add `convertCommandForRoo()` function

## What the Conversion Must Do

### 1. Strip / Replace Frontmatter

**Claude Code format:**
```yaml
---
name: gsd:map-codebase
description: Analyze codebase with parallel mapper agents
argument-hint: "[optional: specific area]"
allowed-tools:
  - Read
  - Bash
  - Task
---
```

**Roo format:**
```yaml
---
description: "Analyze codebase with parallel mapper agents"
---
```

Rules:
- Remove `name:` field entirely
- Remove `argument-hint:` field entirely
- Remove `allowed-tools:` block entirely (including its list items)
- Keep `description:` value, ensure it's quoted
- Remove `agent:` field (used by Claude Code for model routing; Roo handles this via mode)

### 2. Replace All Path References

Replace every occurrence of `~/.claude/get-shit-done/` and `$HOME/.claude/get-shit-done/`:

```js
content = content
  .replace(/~\/\.claude\/get-shit-done\//g, '~/.roo/get-shit-done/')
  .replace(/\$HOME\/\.claude\/get-shit-done\//g, '$HOME/.roo/get-shit-done/')
  .replace(/"@~\/\.claude\/get-shit-done\//g, '"@~/.roo/get-shit-done/')
  .replace(/@~\/\.claude\/get-shit-done\//g, '@~/.roo/get-shit-done/');
```

### 3. Replace Tool Names in Command Body

In the command body text (not frontmatter), tool name references in `<allowed-tools>` XML blocks or prose descriptions should also be replaced:

```js
const toolNameMap = {
  'AskUserQuestion': 'ask_followup_question',
  'TodoWrite': 'update_todo_list',
  'SlashCommand': 'slash_command',
};
// Note: Do NOT do a global replace of Read/Write/Bash/Task in the body text
// as these are common English words; only replace in structured tool lists.
```

### 4. Add Roo-Specific Header Block

Prepend a small Roo runtime note after the frontmatter, before the main content:

```markdown
> **Roo Runtime Note:** This command runs in the context of your active Roo mode. 
> Subagents are spawned using `new_task` with the appropriate GSD mode slug.
> Shell commands use `execute_command`. File operations use `read_file` / `write_to_file`.
```

Actually, this is optional — only include if it helps AI interpretation. Keep it minimal.

### 5. Replace `$ARGUMENTS` references

`$ARGUMENTS` works the same way in Roo slash commands — no change needed.

### 6. Handle `@` file references in `<execution_context>` blocks

The `@~/.claude/get-shit-done/workflows/xyz.md` syntax is respected by Roo as an instruction to read that file. After path replacement, `@~/.roo/get-shit-done/workflows/xyz.md` will work correctly as long as the support files are installed.

### 7. Handle `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs"` bash snippets

These appear in several command bodies (e.g., `debug.md`, `execute-phase.md`). The path replacement in step 2 handles this:
- `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs"` → `node "$HOME/.roo/get-shit-done/bin/gsd-tools.cjs"`

## `convertCommandForRoo()` Implementation Sketch

```js
function convertCommandForRoo(content, rooConfigDir) {
  // 1. Extract and rewrite frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    const newFmLines = [];
    let skipNextLines = false;
    
    for (const line of fmLines) {
      // Skip name:, argument-hint:, agent: fields
      if (/^(name|argument-hint|agent):\s/.test(line)) continue;
      
      // Skip allowed-tools block (field + indented list items)
      if (/^allowed-tools:\s*$/.test(line)) { skipNextLines = true; continue; }
      if (skipNextLines && /^\s+-/.test(line)) continue;
      if (skipNextLines && !/^\s+-/.test(line)) skipNextLines = false;
      
      newFmLines.push(line);
    }
    
    const newFm = '---\n' + newFmLines.join('\n') + '\n---';
    content = content.replace(fmMatch[0], newFm);
  }
  
  // 2. Replace all path references
  content = content
    .replace(/~\/\.claude\/get-shit-done\//g, '~/.roo/get-shit-done/')
    .replace(/\$HOME\/\.claude\/get-shit-done\//g, '$HOME/.roo/get-shit-done/')
    .replace(/@~\/\.claude\/get-shit-done\//g, '@~/.roo/get-shit-done/');
  
  // 3. Replace .claude/skills/ with .roo/skills/
  content = content.replace(/\.claude\/skills\//g, '.roo/skills/');
  
  return content;
}
```

## Progress Checklist
- [ ] `convertCommandForRoo()` function implemented in `install.js`
- [ ] Frontmatter stripping: `name:`, `argument-hint:`, `agent:`, `allowed-tools:` block
- [ ] Path replacement: `~/.claude/` → `~/.roo/`
- [ ] `@` reference path replacement
- [ ] `node "$HOME/.claude/..."` → `node "$HOME/.roo/..."` in bash snippets
- [ ] `.claude/skills/` → `.roo/skills/` references
- [ ] `$ARGUMENTS` confirmed to work unchanged
- [ ] All 25 command files tested through conversion
