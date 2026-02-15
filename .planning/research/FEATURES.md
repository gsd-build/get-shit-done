# Feature Landscape: Cursor IDE Runtime Support

**Domain:** Cursor IDE runtime adaptation for GSD
**Researched:** February 5, 2026
**Confidence:** HIGH (based on existing migration scripts and adaptation documentation)

## Executive Summary

Cursor IDE requires specific conversions from Claude Code format to function correctly. These conversions are similar to OpenCode in some ways (tool names, frontmatter format) but differ in command structure (nested vs flat) and hook support (Cursor supports hooks, OpenCode does not). The conversion logic exists in `cursor-gsd/scripts/migrate.sh` and needs to be integrated into the main installer (`bin/install.js`).

## Table Stakes

Features required for Cursor IDE runtime support. Missing any = installation fails or commands don't work.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Path reference conversion (`~/.claude/` → `~/.cursor/`) | Cursor uses different config directory | Low | Must apply to all files (commands, agents, workflows, templates, references, hooks) |
| Command name format (`/gsd:cmd` → `/gsd-cmd`) | Cursor uses hyphen separator, not colon | Low | Affects frontmatter `name:` field and all command references in content |
| Tool name conversion (PascalCase → snake_case) | Cursor uses lowercase snake_case tool names | Low | Same pattern as OpenCode: `Read` → `read`, `AskUserQuestion` → `ask_question` |
| Frontmatter format conversion (`allowed-tools` → `tools` object) | Cursor uses object format with boolean values | Medium | Commands: array → object. Agents: comma-separated string → object |
| Color format conversion (names → hex) | Cursor requires hex color values in frontmatter | Low | `color: yellow` → `color: "#FFFF00"` |
| Hook path updates in JavaScript files | Hook scripts reference `.claude` directories | Low | Update `gsd-check-update.js` and `gsd-statusline.js` path references |
| Settings.json hook configuration | Cursor uses same hook system as Claude Code | Low | Same structure, different paths (`~/.cursor/hooks/...`) |
| Command directory structure (nested) | Cursor uses `commands/gsd/` not flat `command/` | Low | Different from OpenCode which uses flat structure |

## Differentiators

Features that improve Cursor integration beyond basic functionality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Command display format (`/gsd/cmd` shown, `/gsd-cmd` stored) | Better UX with nested command display | Low | Cursor displays nested commands as `/gsd/cmd` but files must be stored as `/gsd-cmd` |
| Hook system support | Enables statusline and update checks | Low | Cursor supports hooks unlike OpenCode, reuse Claude Code hook pattern |
| Global-only installation | Simplifies initial implementation | Low | Can add local install later if needed |
| Runtime detection | Automatic Cursor detection during install | Medium | Check for `~/.cursor/` directory or CURSOR_CONFIG_DIR env var |

## Anti-Features

Features to explicitly NOT build. Common mistakes in runtime adaptation.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Flat command structure (`command/gsd-*.md`) | Cursor uses nested structure like Claude Code | Use `commands/gsd/*.md` structure |
| TOML format conversion | Cursor uses markdown, not TOML | Keep `.md` files, only convert frontmatter |
| Removing hooks | Cursor supports hooks, unlike OpenCode | Keep hook system, just update paths |
| OpenCode permissions.json | Cursor doesn't need permission configuration | Skip permissions setup (OpenCode-specific) |
| Stripping `<sub>` tags | Cursor renders HTML tags fine | Don't strip tags (Gemini-specific conversion) |

## Complete Conversion List

### 1. Path References (All Files)

| Find | Replace | Files Affected |
|------|---------|----------------|
| `~/.claude/` | `~/.cursor/` | All markdown files, JavaScript hooks |
| `.claude/` | `.cursor/` | All markdown files, JavaScript hooks |
| `@~/.claude/get-shit-done/` | `@~/.cursor/get-shit-done/` | Commands, workflows, templates |
| `$CLAUDE_PROJECT_DIR` | `${workspaceFolder}` or equivalent | Workflows, templates |

**Source:** `cursor-gsd/scripts/migrate.sh` lines 202-205

### 2. Command Format Conversions

#### Frontmatter Name Field
```yaml
# Before (Claude Code)
name: gsd:new-project

# After (Cursor)
name: gsd-new-project
```

#### Content Command References
```markdown
# Before
Next: `/gsd:plan-phase 1`

# After  
Next: `/gsd-plan-phase 1`
```

**Source:** `cursor-gsd/scripts/migrate.sh` lines 208-209

### 3. Tool Name Mappings

Complete mapping from Claude Code PascalCase to Cursor snake_case:

| Claude Code | Cursor | Notes |
|-------------|--------|-------|
| `Read` | `read` | Lowercase |
| `Write` | `write` | Lowercase |
| `Edit` | `edit` | Lowercase |
| `Bash` | `bash` | Lowercase |
| `Glob` | `glob` | Lowercase |
| `Grep` | `grep` | Lowercase |
| `Task` | (removed) | Cursor uses subagent mechanism, not Task tool |
| `AskUserQuestion` | `ask_question` | Snake_case |
| `TodoWrite` | `todo_write` | Snake_case |
| `WebFetch` | `web_fetch` | Snake_case |
| `WebSearch` | `web_search` | Snake_case |
| `MultiEdit` | `multi_edit` | Snake_case |
| `mcp__context7__*` | `mcp__context7__*` | Unchanged (MCP tools) |

**Source:** `cursor-gsd/scripts/migrate.sh` lines 103-120, `bin/install.js` lines 286-308

### 4. Frontmatter Format Conversions

#### Commands: Array → Object
```yaml
# Before (Claude Code)
allowed-tools:
  - Read
  - Write
  - AskUserQuestion

# After (Cursor)
tools:
  read: true
  write: true
  ask_question: true
```

**Source:** `cursor-gsd/scripts/migrate.sh` lines 122-157

#### Agents: Comma-Separated String → Object
```yaml
# Before (Claude Code)
tools: Read, Write, Edit, Bash, Grep, Glob

# After (Cursor)
tools:
  read: true
  write: true
  edit: true
  bash: true
  grep: true
  glob: true
```

**Source:** `cursor-gsd/scripts/migrate.sh` lines 159-189

### 5. Color Format Conversions

| Color Name | Hex Value |
|------------|-----------|
| `cyan` | `#00FFFF` |
| `red` | `#FF0000` |
| `green` | `#00FF00` |
| `blue` | `#0000FF` |
| `yellow` | `#FFFF00` |
| `magenta` | `#FF00FF` |
| `orange` | `#FFA500` |
| `purple` | `#800080` |
| `pink` | `#FFC0CB` |
| `white` | `#FFFFFF` |
| `gray` / `grey` | `#808080` |

**Source:** `cursor-gsd/scripts/migrate.sh` lines 212-223

### 6. Hook Script Path Updates

#### gsd-check-update.js
```javascript
// Before
const cacheDir = path.join(homeDir, '.claude', 'cache');
const projectVersionFile = path.join(cwd, '.claude', 'get-shit-done', 'VERSION');
const globalVersionFile = path.join(homeDir, '.claude', 'get-shit-done', 'VERSION');

// After
const cacheDir = path.join(homeDir, '.cursor', 'cache');
const projectVersionFile = path.join(cwd, '.cursor', 'get-shit-done', 'VERSION');
const globalVersionFile = path.join(homeDir, '.cursor', 'get-shit-done', 'VERSION');
```

#### gsd-statusline.js
```javascript
// Before
const todosDir = path.join(homeDir, '.claude', 'todos');
const cacheFile = path.join(homeDir, '.claude', 'cache', 'gsd-update-check.json');

// After
const todosDir = path.join(homeDir, '.cursor', 'todos');
const cacheFile = path.join(homeDir, '.cursor', 'cache', 'gsd-update-check.json');
```

**Source:** `hooks/gsd-check-update.js`, `hooks/gsd-statusline.js` (need conversion)

### 7. Settings.json Configuration

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.cursor/hooks/gsd-check-update.js"
          }
        ]
      }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "node ~/.cursor/hooks/gsd-statusline.js"
  }
}
```

**Source:** `cursor-gsd/scripts/install.ps1` lines 157-174

## Comparison with Other Runtimes

### Cursor vs Claude Code

| Aspect | Claude Code | Cursor | Notes |
|--------|-------------|--------|-------|
| Config directory | `~/.claude/` | `~/.cursor/` | Different root |
| Command format | `/gsd:cmd` | `/gsd-cmd` | Hyphen vs colon |
| Command structure | `commands/gsd/` | `commands/gsd/` | Same nested structure |
| Tool names | PascalCase | snake_case | Different naming |
| Frontmatter tools | `allowed-tools:` array | `tools:` object | Different format |
| Hooks | Supported | Supported | Same system |
| Color format | Names (`yellow`) | Hex (`#FFFF00`) | Different format |

### Cursor vs OpenCode

| Aspect | OpenCode | Cursor | Notes |
|--------|----------|--------|-------|
| Config directory | `~/.config/opencode/` | `~/.cursor/` | Different locations |
| Command format | `/gsd-cmd` | `/gsd-cmd` | Same hyphen format |
| Command structure | `command/gsd-*.md` (flat) | `commands/gsd/*.md` (nested) | **Different structure** |
| Tool names | snake_case | snake_case | Same naming |
| Frontmatter tools | `tools:` object | `tools:` object | Same format |
| Hooks | Not supported | Supported | **Different** |
| Permissions | Required (`opencode.json`) | Not needed | **Different** |
| Color format | Hex (`#FFFF00`) | Hex (`#FFFF00`) | Same format |

### Cursor vs Gemini

| Aspect | Gemini | Cursor | Notes |
|--------|--------|--------|-------|
| Config directory | `~/.gemini/` | `~/.cursor/` | Different root |
| Command format | `/gsd-cmd` | `/gsd-cmd` | Same hyphen format |
| Command structure | `commands/gsd/` | `commands/gsd/` | Same nested structure |
| File format | `.toml` | `.md` | **Different format** |
| Tool names | snake_case | snake_case | Same naming |
| Frontmatter tools | YAML array | Object | **Different format** |
| Color | Removed | Hex (`#FFFF00`) | **Different** |
| HTML tags | `<sub>` stripped | Kept | **Different** |
| Hooks | Supported | Supported | Same system |

## Feature Dependencies

```
Path Conversion → All other conversions depend on this
    ↓
Tool Name Mapping → Required for frontmatter conversion
    ↓
Frontmatter Format → Required for commands/agents to load
    ↓
Hook Path Updates → Required for hooks to function
    ↓
Settings.json Config → Required for hooks to register
```

## MVP Recommendation

For MVP Cursor support, prioritize:

1. **Path reference conversion** (`~/.claude/` → `~/.cursor/`)
   - **Why:** Without this, nothing works
   - **Complexity:** Low
   - **Files:** All markdown and JavaScript files

2. **Command format conversion** (`/gsd:` → `/gsd-cmd`)
   - **Why:** Commands won't be recognized without this
   - **Complexity:** Low
   - **Files:** Command frontmatter and all content references

3. **Tool name conversion** (PascalCase → snake_case)
   - **Why:** Tools won't be recognized with wrong names
   - **Complexity:** Low
   - **Files:** Command and agent frontmatter

4. **Frontmatter format conversion** (`allowed-tools` → `tools` object)
   - **Why:** Commands won't load with wrong format
   - **Complexity:** Medium
   - **Files:** Commands and agents

5. **Hook path updates**
   - **Why:** Statusline and update checks won't work
   - **Complexity:** Low
   - **Files:** `gsd-check-update.js`, `gsd-statusline.js`

Defer to post-MVP:
- **Local install support:** Global-only is sufficient initially
- **Runtime auto-detection:** Can require `--cursor` flag initially
- **Advanced hook features:** Basic hooks are enough

## Implementation Phases

### Phase 1: Core Conversions (MVP)
- [ ] Path reference conversion (`~/.claude/` → `~/.cursor/`)
- [ ] Command format conversion (`/gsd:` → `/gsd-cmd`)
- [ ] Tool name mapping (PascalCase → snake_case)
- [ ] Frontmatter format conversion (array/string → object)
- [ ] Color format conversion (names → hex)

### Phase 2: Hook Support
- [ ] Hook script path updates (`gsd-check-update.js`)
- [ ] Hook script path updates (`gsd-statusline.js`)
- [ ] Settings.json hook configuration
- [ ] Test hook execution

### Phase 3: Installer Integration
- [ ] Add `--cursor` flag to `bin/install.js`
- [ ] Add Cursor to runtime selection prompt
- [ ] Implement Cursor-specific conversion functions
- [ ] Test end-to-end installation

### Phase 4: Verification
- [ ] Test all 27 commands load correctly
- [ ] Test all 11 agents load correctly
- [ ] Test hooks trigger correctly
- [ ] Test file references (`@~/.cursor/...`) work
- [ ] Test complete workflow end-to-end

## Sources

- **HIGH confidence:** `cursor-gsd/scripts/migrate.sh` - Complete conversion logic
- **HIGH confidence:** `cursor-gsd/scripts/install.ps1` - Cursor installation patterns
- **HIGH confidence:** `bin/install.js` - Existing runtime conversion patterns (OpenCode, Gemini)
- **HIGH confidence:** `GSD-CURSOR-ADAPTATION.md` - Complete adaptation guide
- **HIGH confidence:** `cursor-gsd/src/` - Converted files showing target format

## Open Questions

1. **Command display format:** Cursor displays `/gsd/cmd` but files store as `/gsd-cmd`. Is this handled automatically by Cursor or do we need special handling?
   - **Answer needed from:** Cursor IDE documentation or testing

2. **Local install support:** Should Cursor support local installs (`.cursor/` in project) or global-only?
   - **Recommendation:** Start global-only, add local later if needed

3. **Runtime detection:** Can we auto-detect Cursor installation, or require `--cursor` flag?
   - **Recommendation:** Require flag initially, add auto-detection later

4. **Subagent mechanism:** How exactly does Cursor handle subagent spawning? Same as Claude Code `Task()` tool?
   - **Answer needed from:** Cursor IDE documentation or testing
