# Technology Stack: Adding Cursor Runtime Support

**Project:** GSD Installer Enhancement  
**Researched:** 2026-02-05  
**Confidence:** HIGH (codebase analysis)

## Executive Summary

The GSD installer (`bin/install.js`) currently supports three runtimes: Claude Code, OpenCode, and Gemini. Adding Cursor support follows a well-established pattern with runtime-specific functions for directory resolution, tool name conversion, and frontmatter transformation.

**Key Finding:** Cursor uses the same directory structure as Claude Code (`commands/` plural, not `command/` singular like OpenCode), but requires different tool name formats (snake_case) and frontmatter structure (object with booleans, not array).

## Current Runtime Pattern

### Pattern Components

Each runtime requires:

1. **Flag parsing** (lines 22-39)
2. **Directory name resolution** (`getDirName()`, lines 42-46)
3. **Global directory resolution** (`getGlobalDir()`, lines 78-106)
4. **Tool name conversion** (mapping objects + conversion functions)
5. **Frontmatter conversion** (runtime-specific conversion functions)
6. **Install logic** (`install()` function, lines 1069-1279)
7. **Uninstall logic** (`uninstall()` function, lines 774-966)
8. **Interactive prompts** (`promptRuntime()`, lines 1369-1405)
9. **Help text** (lines 151-154)

## Cursor-Specific Requirements

### Directory Structure

| Aspect | Cursor | Claude Code | OpenCode | Gemini |
|--------|--------|-------------|----------|--------|
| Global dir | `~/.cursor/` | `~/.claude/` | `~/.config/opencode/` | `~/.gemini/` |
| Local dir | `.cursor/` | `.claude/` | `.opencode/` | `.gemini/` |
| Commands dir | `commands/gsd/` | `commands/gsd/` | `command/` (flat) | `commands/gsd/` |
| Command format | `/gsd-*` | `/gsd:*` | `/gsd-*` | `/gsd:*` |

**Key:** Cursor uses **nested structure** (`commands/gsd/`) like Claude/Gemini, NOT flat structure like OpenCode.

### Tool Name Mapping

Cursor uses snake_case tool names, similar to Gemini but with some differences:

| Claude Code Tool | Cursor Tool | Gemini Tool |
|------------------|-------------|-------------|
| `Read` | `read` | `read_file` |
| `Write` | `write` | `write_file` |
| `Edit` | `edit` | `replace` |
| `Bash` | `bash` | `run_shell_command` |
| `Glob` | `glob` | `glob` |
| `Grep` | `grep` | `search_file_content` |
| `AskUserQuestion` | `ask_question` | `ask_user` |
| `TodoWrite` | `todo_write` | `write_todos` |
| `WebFetch` | `web_fetch` | `web_fetch` |
| `WebSearch` | `web_search` | `google_web_search` |
| `MultiEdit` | `multi_edit` | (not in Gemini) |
| `Task` | (subagent) | (excluded) |
| `mcp__*` | `mcp__*` (same) | (excluded) |

**Key Difference:** Cursor tool names are simpler than Gemini (no `_file` suffix, no `google_` prefix).

### Frontmatter Format

**Claude Code (source format):**
```yaml
---
allowed-tools:
  - Read
  - Write
  - Bash
color: yellow
---
```

**Cursor (target format):**
```yaml
---
tools:
  read: true
  write: true
  bash: true
color: "#FFFF00"
---
```

**Key Changes:**
- `allowed-tools:` array → `tools:` object with boolean values
- PascalCase tool names → snake_case
- Color names → hex values
- Path references: `~/.claude/` → `~/.cursor/`
- Command references: `/gsd:` → `/gsd-`

### Color Conversion

Cursor requires hex color values (same as OpenCode):

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

## Implementation Checklist

### Step 1: Add Flag Parsing

**Location:** Lines 22-39

**Add:**
```javascript
const hasCursor = args.includes('--cursor');
```

**Modify:** Lines 31-39
```javascript
if (hasAll) {
  selectedRuntimes = ['claude', 'opencode', 'gemini', 'cursor'];
} else if (hasBoth) {
  selectedRuntimes = ['claude', 'opencode'];
} else {
  if (hasOpencode) selectedRuntimes.push('opencode');
  if (hasClaude) selectedRuntimes.push('claude');
  if (hasGemini) selectedRuntimes.push('gemini');
  if (hasCursor) selectedRuntimes.push('cursor');
}
```

### Step 2: Add Directory Name Resolution

**Location:** Lines 42-46 (`getDirName()`)

**Add:**
```javascript
function getDirName(runtime) {
  if (runtime === 'opencode') return '.opencode';
  if (runtime === 'gemini') return '.gemini';
  if (runtime === 'cursor') return '.cursor';
  return '.claude';
}
```

### Step 3: Add Global Directory Resolution

**Location:** Lines 78-106 (`getGlobalDir()`)

**Add Cursor case:**
```javascript
function getGlobalDir(runtime, explicitDir = null) {
  if (runtime === 'opencode') {
    // ... existing code ...
  }
  
  if (runtime === 'gemini') {
    // ... existing code ...
  }
  
  if (runtime === 'cursor') {
    // Cursor: --config-dir > CURSOR_CONFIG_DIR > ~/.cursor
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.CURSOR_CONFIG_DIR) {
      return expandTilde(process.env.CURSOR_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.cursor');
  }
  
  // Claude Code: --config-dir > CLAUDE_CONFIG_DIR > ~/.claude
  // ... existing code ...
}
```

### Step 4: Add Tool Name Mapping

**Location:** After line 308 (after `claudeToGeminiTools`)

**Add:**
```javascript
// Tool name mapping from Claude Code to Cursor
// Cursor uses snake_case tool names
const claudeToCursorTools = {
  Read: 'read',
  Write: 'write',
  Edit: 'edit',
  Bash: 'bash',
  Glob: 'glob',
  Grep: 'grep',
  AskUserQuestion: 'ask_question',
  TodoWrite: 'todo_write',
  WebFetch: 'web_fetch',
  WebSearch: 'web_search',
  MultiEdit: 'multi_edit',
};
```

### Step 5: Add Tool Name Conversion Function

**Location:** After line 350 (after `convertGeminiToolName()`)

**Add:**
```javascript
/**
 * Convert a Claude Code tool name to Cursor format
 * - Applies Claude→Cursor mapping (Read→read, AskUserQuestion→ask_question, etc.)
 * - Filters out MCP tools (mcp__*) — they keep their format
 * - Filters out Task — handled via subagent mechanism
 * @returns {string|null} Cursor tool name, or null if tool should be excluded
 */
function convertCursorToolName(claudeTool) {
  // MCP tools: keep format (mcp__*)
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  // Task: exclude — handled via subagent mechanism
  if (claudeTool === 'Task') {
    return null;
  }
  // Check for explicit mapping
  if (claudeToCursorTools[claudeTool]) {
    return claudeToCursorTools[claudeTool];
  }
  // Default: lowercase
  return claudeTool.toLowerCase();
}
```

### Step 6: Add Frontmatter Conversion Function

**Location:** After line 542 (after `convertClaudeToOpencodeFrontmatter()`)

**Add:**
```javascript
/**
 * Convert Claude Code frontmatter to Cursor format
 * Cursor uses:
 * - tools: object with boolean values (not array)
 * - snake_case tool names
 * - hex color values
 * - /gsd- command format (not /gsd:)
 * - ~/.cursor/ path references (not ~/.claude/)
 */
function convertClaudeToCursorFrontmatter(content) {
  // Replace tool name references in content (applies to all files)
  let convertedContent = content;
  convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'ask_question');
  convertedContent = convertedContent.replace(/\bTodoWrite\b/g, 'todo_write');
  convertedContent = convertedContent.replace(/\bWebFetch\b/g, 'web_fetch');
  convertedContent = convertedContent.replace(/\bWebSearch\b/g, 'web_search');
  convertedContent = convertedContent.replace(/\bMultiEdit\b/g, 'multi_edit');
  // Replace /gsd: with /gsd- for Cursor command format
  convertedContent = convertedContent.replace(/\/gsd:/g, '/gsd-');
  // Replace ~/.claude with ~/.cursor (Cursor's config location)
  convertedContent = convertedContent.replace(/~\/\.claude\b/g, '~/.cursor');

  // Check if content has frontmatter
  if (!convertedContent.startsWith('---')) {
    return convertedContent;
  }

  // Find the end of frontmatter
  const endIndex = convertedContent.indexOf('---', 3);
  if (endIndex === -1) {
    return convertedContent;
  }

  const frontmatter = convertedContent.substring(3, endIndex).trim();
  const body = convertedContent.substring(endIndex + 3);

  // Parse frontmatter line by line (simple YAML parsing)
  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  const tools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect start of allowed-tools array
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Detect inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        // Parse comma-separated tools
        const parsed = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        for (const t of parsed) {
          const mapped = convertCursorToolName(t);
          if (mapped) tools.push(mapped);
        }
      } else {
        // tools: with no value means YAML array follows
        inAllowedTools = true;
      }
      continue;
    }

    // Remove name: field - Cursor uses filename for command name
    if (trimmed.startsWith('name:')) {
      continue;
    }

    // Convert color names to hex for Cursor
    if (trimmed.startsWith('color:')) {
      const colorValue = trimmed.substring(6).trim().toLowerCase();
      const hexColor = colorNameToHex[colorValue];
      if (hexColor) {
        newLines.push(`color: "${hexColor}"`);
      } else if (colorValue.startsWith('#')) {
        // Validate hex color format (#RGB or #RRGGBB)
        if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {
          // Already hex and valid, keep as is
          newLines.push(line);
        }
        // Skip invalid hex colors
      }
      // Skip unknown color names
      continue;
    }

    // Collect allowed-tools/tools array items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        const mapped = convertCursorToolName(trimmed.substring(2).trim());
        if (mapped) tools.push(mapped);
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        // End of array, new field started
        inAllowedTools = false;
      }
    }

    // Keep other fields
    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // Add tools as object with boolean values (Cursor requires object format)
  if (tools.length > 0) {
    newLines.push('tools:');
    for (const tool of tools) {
      newLines.push(`  ${tool}: true`);
    }
  }

  // Rebuild frontmatter (body already has tool names converted)
  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${body}`;
}
```

### Step 7: Update copyWithPathReplacement Function

**Location:** Lines 648-691 (`copyWithPathReplacement()`)

**Modify:** Add Cursor case in the conversion logic (around line 677):

```javascript
function copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime) {
  const isOpencode = runtime === 'opencode';
  const isCursor = runtime === 'cursor';
  const dirName = getDirName(runtime);

  // ... existing cleanup code ...

  for (const entry of entries) {
    // ... existing directory handling ...

    } else if (entry.name.endsWith('.md')) {
      // Always replace ~/.claude/ as it is the source of truth in the repo
      let content = fs.readFileSync(srcPath, 'utf8');
      const claudeDirRegex = /~\/\.claude\//g;
      content = content.replace(claudeDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));

      // Convert frontmatter for runtime compatibility
      if (isOpencode) {
        content = convertClaudeToOpencodeFrontmatter(content);
        fs.writeFileSync(destPath, content);
      } else if (runtime === 'gemini') {
        // ... existing Gemini conversion ...
      } else if (isCursor) {
        // Convert to Cursor format
        content = convertClaudeToCursorFrontmatter(content);
        fs.writeFileSync(destPath, content);
      } else {
        fs.writeFileSync(destPath, content);
      }
    }
  }
}
```

### Step 8: Update copyFlattenedCommands Function

**Location:** Lines 596-638 (`copyFlattenedCommands()`)

**Note:** Cursor uses nested structure (`commands/gsd/`), NOT flat structure. This function is only used for OpenCode. No changes needed for Cursor.

### Step 9: Update install Function

**Location:** Lines 1069-1279 (`install()`)

**Modify:** Add Cursor runtime label (around line 1091):

```javascript
function install(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isGemini = runtime === 'gemini';
  const isCursor = runtime === 'cursor';
  const dirName = getDirName(runtime);
  // ... existing code ...

  let runtimeLabel = 'Claude Code';
  if (isOpencode) runtimeLabel = 'OpenCode';
  if (isGemini) runtimeLabel = 'Gemini';
  if (isCursor) runtimeLabel = 'Cursor';
```

**Modify:** Command structure logic (around line 1105):

```javascript
  // OpenCode uses 'command/' (singular) with flat structure
  // Claude Code, Gemini, and Cursor use 'commands/' (plural) with nested structure
  if (isOpencode) {
    // ... OpenCode logic ...
  } else {
    // Claude Code, Gemini, and Cursor: nested structure in commands/ directory
    const commandsDir = path.join(targetDir, 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    
    const gsdSrc = path.join(src, 'commands', 'gsd');
    const gsdDest = path.join(commandsDir, 'gsd');
    copyWithPathReplacement(gsdSrc, gsdDest, pathPrefix, runtime);
    // ... rest of logic ...
  }
```

**Modify:** Agent conversion logic (around line 1169):

```javascript
        // Convert frontmatter for runtime compatibility
        if (isOpencode) {
          content = convertClaudeToOpencodeFrontmatter(content);
        } else if (isGemini) {
          content = convertClaudeToGeminiAgent(content);
        } else if (isCursor) {
          content = convertClaudeToCursorFrontmatter(content);
        }
```

### Step 10: Update getCommitAttribution Function

**Location:** Lines 205-241 (`getCommitAttribution()`)

**Modify:** Add Cursor case (assumes Cursor uses same settings.json structure as Claude):

```javascript
function getCommitAttribution(runtime) {
  // ... existing cache check ...

  let result;

  if (runtime === 'opencode') {
    // ... existing OpenCode logic ...
  } else if (runtime === 'gemini') {
    // ... existing Gemini logic ...
  } else if (runtime === 'cursor') {
    // Cursor: check settings.json for attribution config (same as Claude)
    const settings = readSettings(path.join(getGlobalDir('cursor', explicitConfigDir), 'settings.json'));
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  } else {
    // Claude Code
    // ... existing Claude logic ...
  }

  // Cache and return
  attributionCache.set(runtime, result);
  return result;
}
```

### Step 11: Update uninstall Function

**Location:** Lines 774-966 (`uninstall()`)

**Modify:** Add Cursor runtime label (around line 787):

```javascript
  let runtimeLabel = 'Claude Code';
  if (runtime === 'opencode') runtimeLabel = 'OpenCode';
  if (runtime === 'gemini') runtimeLabel = 'Gemini';
  if (runtime === 'cursor') runtimeLabel = 'Cursor';
```

**Modify:** Command removal logic (around line 803):

```javascript
  // 1. Remove GSD commands directory
  if (isOpencode) {
    // OpenCode: remove command/gsd-*.md files
    // ... existing OpenCode logic ...
  } else {
    // Claude Code, Gemini, and Cursor: remove commands/gsd/ directory
    const gsdCommandsDir = path.join(targetDir, 'commands', 'gsd');
    // ... rest of logic ...
  }
```

### Step 12: Update finishInstall Function

**Location:** Lines 1284-1313 (`finishInstall()`)

**Modify:** Add Cursor runtime label and command format (around line 1303):

```javascript
function finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isCursor = runtime === 'cursor';

  // ... existing statusline logic ...

  let program = 'Claude Code';
  if (runtime === 'opencode') program = 'OpenCode';
  if (runtime === 'gemini') program = 'Gemini';
  if (runtime === 'cursor') program = 'Cursor';

  const command = isOpencode || isCursor ? '/gsd-help' : '/gsd:help';
  // ... rest of function ...
}
```

### Step 13: Update installAllRuntimes Function

**Location:** Lines 1455-1492 (`installAllRuntimes()`)

**Modify:** Add Cursor to statusline handling (around line 1463):

```javascript
function installAllRuntimes(runtimes, isGlobal, isInteractive) {
  // ... existing results collection ...

  // Handle statusline for Claude, Gemini, and Cursor (OpenCode uses themes)
  const claudeResult = results.find(r => r.runtime === 'claude');
  const geminiResult = results.find(r => r.runtime === 'gemini');
  const cursorResult = results.find(r => r.runtime === 'cursor');

  if (claudeResult || geminiResult || cursorResult) {
    // Use whichever settings exist to check for existing statusline
    const primaryResult = claudeResult || geminiResult || cursorResult;
    
    handleStatusline(primaryResult.settings, isInteractive, (shouldInstallStatusline) => {
      if (claudeResult) {
        finishInstall(claudeResult.settingsPath, claudeResult.settings, claudeResult.statuslineCommand, shouldInstallStatusline, 'claude');
      }
      if (geminiResult) {
        finishInstall(geminiResult.settingsPath, geminiResult.settings, geminiResult.statuslineCommand, shouldInstallStatusline, 'gemini');
      }
      if (cursorResult) {
        finishInstall(cursorResult.settingsPath, cursorResult.settings, cursorResult.statuslineCommand, shouldInstallStatusline, 'cursor');
      }
      
      const opencodeResult = results.find(r => r.runtime === 'opencode');
      if (opencodeResult) {
        finishInstall(opencodeResult.settingsPath, opencodeResult.settings, opencodeResult.statuslineCommand, false, 'opencode');
      }
    });
  } else {
    // Only OpenCode
    // ... existing logic ...
  }
}
```

### Step 14: Update promptRuntime Function

**Location:** Lines 1369-1405 (`promptRuntime()`)

**Modify:** Add Cursor option (around line 1385):

```javascript
  console.log(`  ${yellow}Which runtime(s) would you like to install for?${reset}\n\n  ${cyan}1${reset}) Claude Code ${dim}(~/.claude)${reset}
  ${cyan}2${reset}) OpenCode    ${dim}(~/.config/opencode)${reset} - open source, free models
  ${cyan}3${reset}) Gemini      ${dim}(~/.gemini)${reset}
  ${cyan}4${reset}) Cursor      ${dim}(~/.cursor)${reset}
  ${cyan}5${reset}) All
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    if (choice === '5') {
      callback(['claude', 'opencode', 'gemini', 'cursor']);
    } else if (choice === '4') {
      callback(['cursor']);
    } else if (choice === '3') {
      callback(['gemini']);
    } else if (choice === '2') {
      callback(['opencode']);
    } else {
      callback(['claude']);
    }
  });
```

### Step 15: Update Help Text

**Location:** Lines 151-154

**Modify:** Add Cursor option:

```javascript
  console.log(`  ${yellow}Usage:${reset} npx get-shit-done-cc [options]\n\n  ${yellow}Options:${reset}\n    ${cyan}-g, --global${reset}              Install globally (to config directory)\n    ${cyan}-l, --local${reset}               Install locally (to current directory)\n    ${cyan}--claude${reset}                  Install for Claude Code only\n    ${cyan}--opencode${reset}                Install for OpenCode only\n    ${cyan}--gemini${reset}                   Install for Gemini only\n    ${cyan}--cursor${reset}                   Install for Cursor only\n    ${cyan}--all${reset}                     Install for all runtimes\n    ${cyan}-u, --uninstall${reset}           Uninstall GSD (remove all GSD files)\n    ${cyan}-c, --config-dir <path>${reset}   Specify custom config directory\n    ${cyan}-h, --help${reset}                Show this help message\n    ${cyan}--force-statusline${reset}        Replace existing statusline config\n\n  ${yellow}Examples:${reset}\n    ${dim}# Interactive install (prompts for runtime and location)${reset}\n    npx get-shit-done-cc\n\n    ${dim}# Install for Claude Code globally${reset}\n    npx get-shit-done-cc --claude --global\n\n    ${dim}# Install for Cursor globally${reset}\n    npx get-shit-done-cc --cursor --global\n\n    ${dim}# Install for all runtimes globally${reset}\n    npx get-shit-done-cc --all --global\n\n    ${dim}# Install to custom config directory${reset}\n    npx get-shit-done-cc --claude --global --config-dir ~/.claude-bc\n\n    ${dim}# Install to current project only${reset}\n    npx get-shit-done-cc --claude --local\n\n    ${dim}# Uninstall GSD from Claude Code globally${reset}\n    npx get-shit-done-cc --claude --global --uninstall\n\n  ${yellow}Notes:${reset}\n    The --config-dir option is useful when you have multiple configurations.\n    It takes priority over CLAUDE_CONFIG_DIR / GEMINI_CONFIG_DIR / CURSOR_CONFIG_DIR environment variables.\n`);
```

### Step 16: Update Banner Text

**Location:** Lines 108-118

**Modify:** Include Cursor in description:

```javascript
const banner = '\n' +
  cyan + '   ██████╗ ███████╗██████╗\n' +
  '  ██╔════╝ ██╔════╝██╔══██╗\n' +
  '  ██║  ███╗███████║██║  ██║\n' +
  '  ██║   ██║╚════██║██║  ██║\n' +
  '  ╚██████╔╝███████║██████╔╝\n' +
  '   ╚═════╝ ╚══════╝╚═════╝' + reset + '\n' +
  '\n' +
  '  Get Shit Done ' + dim + 'v' + pkg.version + reset + '\n' +
  '  A meta-prompting, context engineering and spec-driven\n' +
  '  development system for Claude Code, OpenCode, Gemini, and Cursor by TÂCHES.\n';
```

## Function Reference

### Functions to Modify

| Function | Lines | Purpose | Changes Needed |
|----------|-------|---------|----------------|
| `getDirName()` | 42-46 | Get local directory name | Add `cursor` case |
| `getGlobalDir()` | 78-106 | Resolve global config directory | Add Cursor case with env var support |
| `getCommitAttribution()` | 205-241 | Read attribution settings | Add Cursor case (same as Claude) |
| `convertClaudeToCursorFrontmatter()` | NEW | Convert frontmatter format | Create new function |
| `convertCursorToolName()` | NEW | Convert tool names | Create new function |
| `copyWithPathReplacement()` | 648-691 | Copy files with path conversion | Add Cursor conversion call |
| `install()` | 1069-1279 | Main install logic | Add Cursor runtime label, use nested structure |
| `finishInstall()` | 1284-1313 | Complete installation | Add Cursor label, command format |
| `uninstall()` | 774-966 | Remove GSD files | Add Cursor label, nested structure |
| `installAllRuntimes()` | 1455-1492 | Install multiple runtimes | Add Cursor to statusline handling |
| `promptRuntime()` | 1369-1405 | Interactive runtime selection | Add Cursor option |

### New Functions to Create

1. **`convertCursorToolName(claudeTool)`** - Maps Claude tool names to Cursor format
2. **`convertClaudeToCursorFrontmatter(content)`** - Converts YAML frontmatter and content

### Constants to Add

1. **`claudeToCursorTools`** - Object mapping Claude tool names to Cursor tool names

## Testing Checklist

After implementation:

- [ ] `--cursor --global` installs to `~/.cursor/`
- [ ] `--cursor --local` installs to `.cursor/`
- [ ] `--all` includes Cursor in installation
- [ ] Interactive prompt shows Cursor option
- [ ] Commands installed to `commands/gsd/` (nested, not flat)
- [ ] Tool names converted to snake_case in frontmatter
- [ ] Frontmatter uses `tools: { read: true }` format (not array)
- [ ] Colors converted to hex values
- [ ] Path references updated (`~/.claude/` → `~/.cursor/`)
- [ ] Command references updated (`/gsd:` → `/gsd-`)
- [ ] `--cursor --global --uninstall` removes files correctly
- [ ] Statusline configured for Cursor (if supported)
- [ ] Attribution settings read correctly

## Key Differences Summary

| Feature | Cursor | Most Similar To |
|---------|--------|----------------|
| Directory structure | `commands/gsd/` (nested) | Claude Code |
| Command format | `/gsd-*` (hyphen) | OpenCode |
| Tool names | snake_case | Gemini (but simpler) |
| Frontmatter format | `tools: { read: true }` | OpenCode |
| Color format | Hex values | OpenCode |
| Config location | `~/.cursor/` | Unique |

## Sources

- `bin/install.js` (lines 1-1530) - Current installer implementation
- `cursor-gsd/scripts/migrate.sh` (lines 1-406) - Existing Cursor conversion script
- `cursor-gsd/docs/GSD-CURSOR-ADAPTATION.md` - Cursor adaptation documentation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Directory structure | HIGH | Confirmed from migration script and docs |
| Tool name mapping | HIGH | Documented in adaptation guide |
| Frontmatter format | HIGH | Matches OpenCode pattern, verified in docs |
| Implementation pattern | HIGH | Follows existing runtime pattern exactly |
| Environment variables | MEDIUM | Assumed CURSOR_CONFIG_DIR follows same pattern as others |
