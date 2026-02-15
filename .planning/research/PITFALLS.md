# Domain Pitfalls: Adding a New Runtime

**Domain:** Cursor integration runtime conversion
**Researched:** 2026-02-05
**Context:** OpenCode and Gemini were added after Claude Code, each with different conversion needs

## Critical Pitfalls

Mistakes that cause runtime failures or broken installations.

### Pitfall 1: Incomplete Tool Name Mapping

**What goes wrong:** Tool names in frontmatter and prose aren't converted, causing runtime errors when agents try to use tools that don't exist.

**Why it happens:** Conversion functions only handle frontmatter parsing, but tool names appear in:
- Agent body text (documentation, examples)
- Command descriptions
- Workflow instructions
- Reference documentation

**Consequences:**
- Agents fail with "tool not found" errors
- Commands reference non-existent tools
- User confusion when documentation doesn't match runtime behavior

**Prevention:**
1. **Convert tool names in ALL content**, not just frontmatter:
   ```javascript
   // In convertClaudeToOpencodeFrontmatter and convertClaudeToGeminiAgent
   // Apply tool name replacements to body content too
   convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'question');
   convertedContent = convertedContent.replace(/\bRead\b/g, 'read_file'); // Gemini
   ```

2. **Create comprehensive tool mapping table** covering:
   - Frontmatter `allowed-tools:` arrays
   - Frontmatter `tools:` fields (both comma-separated and YAML arrays)
   - Inline tool references in markdown prose
   - Code examples in documentation

3. **Test with grep** after conversion:
   ```bash
   # Verify no PascalCase tool names remain
   grep -r "AskUserQuestion\|TodoWrite\|SlashCommand" ~/.config/opencode/agents/
   ```

**Detection:**
- Runtime errors: "Tool 'AskUserQuestion' not found"
- User reports: "Documentation says X but runtime expects Y"
- Manual inspection: Search for PascalCase tool names in converted files

**Current state:** OpenCode conversion handles some body replacements (lines 442-445), but Gemini conversion (`convertClaudeToGeminiAgent`) only processes frontmatter, not body content.

---

### Pitfall 2: MCP Tool Handling Inconsistencies

**What goes wrong:** MCP tools (`mcp__*`) are handled differently across runtimes, causing silent failures or missing functionality.

**Why it happens:**
- OpenCode: MCP tools keep their format (`mcp__context7__query-docs`)
- Gemini: MCP tools are excluded entirely (auto-discovered at runtime)
- Claude Code: MCP tools used as-is

**Consequences:**
- Gemini agents missing MCP tools in frontmatter (expected, but must be documented)
- OpenCode agents may fail if MCP tool names are incorrectly converted
- Confusion about whether to include or exclude MCP tools

**Prevention:**
1. **Document MCP tool behavior per runtime** in conversion functions:
   ```javascript
   /**
    * MCP tools (mcp__*):
    * - OpenCode: Keep format as-is (mcp__context7__query-docs)
    * - Gemini: Exclude (auto-discovered from mcpServers config)
    * - Claude Code: Use as-is
    */
   ```

2. **Add runtime-specific MCP handling**:
   ```javascript
   function convertToolName(claudeTool, runtime) {
     // MCP tools: runtime-specific handling
     if (claudeTool.startsWith('mcp__')) {
       if (runtime === 'gemini') return null; // Exclude for Gemini
       return claudeTool; // Keep for OpenCode/Claude
     }
     // ... rest of conversion
   }
   ```

3. **Test MCP tool scenarios**:
   - Agent with MCP tools → verify exclusion for Gemini
   - Agent with MCP tools → verify preservation for OpenCode

**Detection:**
- Missing functionality: MCP tools don't appear in Gemini agent tool lists
- Runtime errors: MCP tool names incorrectly converted for OpenCode

**Current state:** `convertGeminiToolName` correctly excludes MCP tools (line 337), but this behavior isn't tested or documented in user-facing docs.

---

### Pitfall 3: Path Replacement Edge Cases

**What goes wrong:** Path references aren't replaced correctly, causing broken file links and incorrect config directory references.

**Why it happens:**
- Multiple path formats exist: `~/.claude/`, `.claude/`, `@~/.claude/get-shit-done/`
- Windows vs Unix path separators
- Environment variable overrides (`CLAUDE_CONFIG_DIR`, `OPENCODE_CONFIG_DIR`)
- Local vs global install path prefixes differ

**Consequences:**
- Broken file references in documentation
- Incorrect config directory paths
- Commands fail to find referenced files
- User confusion about where files are located

**Prevention:**
1. **Replace ALL path variants**, not just `~/.claude/`:
   ```javascript
   // Current: Only replaces ~/.claude/
   content = content.replace(/~\/\.claude\//g, pathPrefix);
   
   // Better: Replace all variants
   const pathPatterns = [
     /~\/\.claude\//g,           // ~/.claude/
     /\.claude\//g,               // .claude/ (relative)
     /@~\/\.claude\/get-shit-done\//g,  // @~/.claude/get-shit-done/
     /\$CLAUDE_PROJECT_DIR\//g,   // $CLAUDE_PROJECT_DIR/
   ];
   pathPatterns.forEach(pattern => {
     content = content.replace(pattern, pathPrefix);
   });
   ```

2. **Handle runtime-specific path differences**:
   - OpenCode: `~/.config/opencode/` (XDG compliant)
   - Gemini: `~/.gemini/`
   - Claude Code: `~/.claude/`

3. **Test path replacement** with:
   - Global installs (full paths)
   - Local installs (relative paths)
   - Custom config directories (`--config-dir`)
   - Environment variable overrides

**Detection:**
- Broken links: Files referenced but not found
- Incorrect paths: User reports wrong directory in docs
- Manual inspection: Search for `.claude` in converted files

**Current state:** `copyWithPathReplacement` only replaces `~/.claude/` (line 669). `copyFlattenedCommands` also replaces `~/.opencode/` (line 629), but other variants may be missed.

---

### Pitfall 4: Frontmatter Format Conversion Failures

**What goes wrong:** YAML frontmatter parsing fails silently, producing invalid frontmatter that breaks agent/command loading.

**Why it happens:**
- Hand-rolled YAML parsing (lines 379-437) doesn't handle all YAML edge cases
- Multiple frontmatter formats: `allowed-tools:` arrays, `tools:` comma-separated, `tools:` YAML arrays
- Color field handling differs: OpenCode needs hex, Gemini removes color entirely
- Missing fields cause validation errors (e.g., Gemini requires `tools:` as array)

**Consequences:**
- Agents fail to load: "Invalid frontmatter format"
- Commands don't appear in runtime
- Silent failures: Invalid frontmatter ignored without error

**Prevention:**
1. **Use proper YAML parser** instead of line-by-line parsing:
   ```javascript
   const yaml = require('js-yaml');
   const frontmatter = yaml.load(content.substring(3, endIndex));
   // Convert programmatically
   const converted = convertFrontmatter(frontmatter, runtime);
   ```

2. **Handle all frontmatter variants**:
   - `allowed-tools:` with YAML array
   - `tools:` with comma-separated string
   - `tools:` with YAML array
   - Mixed formats (some tools in array, some in string)

3. **Validate converted frontmatter** before writing:
   ```javascript
   // For Gemini: tools must be array
   if (runtime === 'gemini' && converted.tools && !Array.isArray(converted.tools)) {
     throw new Error('Gemini requires tools as YAML array');
   }
   ```

4. **Test edge cases**:
   - Empty `allowed-tools:` array
   - Tools with special characters
   - Missing required fields
   - Extra fields that should be removed

**Detection:**
- Runtime errors: "Invalid agent format" or "Command not found"
- Manual inspection: Check frontmatter syntax in converted files
- User reports: Agents/commands don't appear after install

**Current state:** Hand-rolled parsing in `convertClaudeToGeminiAgent` (lines 370-438) and `convertClaudeToOpencodeFrontmatter` (lines 440-542) is fragile and doesn't handle all YAML edge cases.

---

### Pitfall 5: Settings.json Merge Conflicts

**What goes wrong:** Installing GSD overwrites or conflicts with existing `settings.json` configuration, breaking user's custom settings.

**Why it happens:**
- `readSettings` returns empty object if file doesn't exist (line 187)
- `writeSettings` overwrites entire file (line 194)
- Hook registration appends to arrays without checking for duplicates
- Attribution settings read from different locations per runtime

**Consequences:**
- User's custom hooks lost
- Statusline configuration overwritten
- Attribution settings reset
- Experimental flags (like Gemini's `enableAgents`) not preserved

**Prevention:**
1. **Deep merge settings** instead of overwriting:
   ```javascript
   function mergeSettings(existing, updates) {
     return {
       ...existing,
       ...updates,
       hooks: mergeHooks(existing.hooks, updates.hooks),
       // ... other nested objects
     };
   }
   ```

2. **Check for existing hook registrations** before adding:
   ```javascript
   const hasGsdUpdateHook = settings.hooks.SessionStart?.some(entry =>
     entry.hooks?.some(h => h.command?.includes('gsd-check-update'))
   );
   if (!hasGsdUpdateHook) {
     // Add hook
   }
   ```

3. **Preserve user's attribution settings**:
   ```javascript
   // Don't overwrite attribution, read existing value
   const existingAttribution = settings.attribution?.commit;
   if (existingAttribution !== undefined) {
     // Preserve user's setting
   }
   ```

4. **Test merge scenarios**:
   - Install with existing hooks
   - Install with existing statusline
   - Install with custom attribution
   - Reinstall (shouldn't duplicate hooks)

**Detection:**
- User reports: "My hooks disappeared after installing GSD"
- Duplicate hooks: Same hook registered multiple times
- Missing functionality: User's custom settings lost

**Current state:** `install` function checks for existing hooks (line 1261), but doesn't deep merge other settings. Attribution is read but not preserved if user has custom value.

---

### Pitfall 6: File Extension Conversion Missed

**What goes wrong:** Gemini requires `.toml` files for commands, but conversion only handles `.md` files, missing edge cases.

**Why it happens:**
- `copyWithPathReplacement` converts `.md` → `.toml` for Gemini (line 682)
- But `copyFlattenedCommands` (OpenCode) doesn't handle extension changes
- Non-markdown files copied as-is without conversion
- Recursive directory copying may miss nested files

**Consequences:**
- Gemini commands fail to load: "Command file not found" (expects `.toml`, gets `.md`)
- Inconsistent file extensions across runtimes
- Broken command structure

**Prevention:**
1. **Explicitly handle file extensions** per runtime:
   ```javascript
   function getTargetExtension(runtime, originalExt) {
     if (runtime === 'gemini' && originalExt === '.md') {
       return '.toml'; // Commands become TOML
     }
     return originalExt; // Agents stay .md, other files unchanged
   }
   ```

2. **Convert file extensions during copy**:
   ```javascript
   const targetExt = getTargetExtension(runtime, path.extname(entry.name));
   const destName = entry.name.replace(/\.[^.]+$/, targetExt);
   ```

3. **Test file extension conversion**:
   - Commands: `.md` → `.toml` for Gemini
   - Agents: `.md` → `.md` for all runtimes
   - Other files: No change

**Detection:**
- Runtime errors: "Command file not found"
- Manual inspection: Check file extensions in installed directories
- Missing commands: Commands don't appear in Gemini

**Current state:** `copyWithPathReplacement` handles `.md` → `.toml` conversion for Gemini (line 682), but only for files in `get-shit-done/` directory. Commands use different function (`copyFlattenedCommands` for OpenCode, nested structure for Gemini).

---

## Moderate Pitfalls

Mistakes that cause delays or require manual fixes.

### Pitfall 7: Attribution Processing Edge Cases

**What goes wrong:** Co-Authored-By lines aren't processed correctly, causing git attribution issues or broken commit messages.

**Why it happens:**
- Attribution settings differ per runtime:
  - OpenCode: `opencode.json` → `disable_ai_attribution` boolean
  - Gemini/Claude: `settings.json` → `attribution.commit` string
- Empty string vs `null` vs `undefined` semantics unclear
- Regex replacement may match multiple lines or miss edge cases

**Consequences:**
- Incorrect git attribution
- Broken commit messages (malformed Co-Authored-By)
- User's attribution preferences ignored

**Prevention:**
1. **Document attribution semantics** clearly:
   ```javascript
   /**
    * Attribution handling:
    * - null: Remove Co-Authored-By lines
    * - undefined: Keep existing (don't modify)
    * - string: Replace with custom attribution
    * - '' (empty string): Same as null (remove)
    */
   ```

2. **Test attribution scenarios**:
   - User has `disable_ai_attribution: true` → remove lines
   - User has `attribution.commit: ''` → remove lines
   - User has `attribution.commit: 'Custom'` → replace with custom
   - User has no attribution setting → keep existing

3. **Handle multiple Co-Authored-By lines**:
   ```javascript
   // Current regex may only match last line
   // Should handle multiple lines or first line only
   ```

**Detection:**
- Git commits: Check Co-Authored-By lines in commit history
- User reports: Attribution not working as expected

**Current state:** `processAttribution` (lines 249-260) handles basic cases, but regex may miss edge cases with multiple lines or malformed Co-Authored-By blocks.

---

### Pitfall 8: Command Structure Differences Not Handled

**What goes wrong:** OpenCode's flat command structure (`command/gsd-help.md`) vs nested structure (`commands/gsd/help.md`) causes missing commands or broken invocations.

**Why it happens:**
- OpenCode: Flat structure, commands invoked as `/gsd-help`
- Claude/Gemini: Nested structure, commands invoked as `/gsd:help`
- Conversion must flatten directory structure AND update command references in docs

**Consequences:**
- Commands don't appear in OpenCode
- Command invocations in docs are wrong (`/gsd:help` vs `/gsd-help`)
- Nested command directories not flattened correctly

**Prevention:**
1. **Flatten directory structure** for OpenCode:
   ```javascript
   // commands/gsd/debug/start.md → command/gsd-debug-start.md
   function flattenCommandPath(srcPath, prefix) {
     const relative = path.relative(commandsDir, srcPath);
     const parts = relative.split(path.sep);
     return `${prefix}-${parts.join('-')}`;
   }
   ```

2. **Update command references** in all content:
   ```javascript
   // Replace /gsd:command with /gsd-command for OpenCode
   content = content.replace(/\/gsd:/g, '/gsd-');
   ```

3. **Test command structure**:
   - Verify all commands appear in `command/` directory
   - Verify command invocations work (`/gsd-help` executes)
   - Verify nested commands flattened correctly

**Detection:**
- Missing commands: Commands don't appear in OpenCode
- Broken invocations: `/gsd:help` doesn't work (should be `/gsd-help`)
- Manual inspection: Check `command/` directory structure

**Current state:** `copyFlattenedCommands` (lines 596-638) handles flattening, and `convertClaudeToOpencodeFrontmatter` replaces `/gsd:` with `/gsd-` (line 447). But nested subdirectories may not be handled correctly (line 620 recurses but may not preserve correct prefix).

---

### Pitfall 9: Color Conversion Failures

**What goes wrong:** Color values aren't converted correctly, causing validation errors or incorrect display.

**Why it happens:**
- OpenCode requires hex colors (`#00FFFF`), not color names (`cyan`)
- Gemini removes `color:` field entirely (causes validation error)
- Color name mapping incomplete (only common colors mapped)
- Invalid hex colors not caught (fixed in line 504, but edge cases remain)

**Consequences:**
- OpenCode agents fail validation: "Invalid color format"
- Gemini agents fail validation: "Unknown field: color"
- Incorrect colors displayed

**Prevention:**
1. **Complete color name mapping**:
   ```javascript
   const colorNameToHex = {
     // Add all possible color names, not just common ones
     cyan: '#00FFFF',
     // ... include all CSS color names
   };
   ```

2. **Remove color field for Gemini**:
   ```javascript
   if (runtime === 'gemini' && trimmed.startsWith('color:')) {
     continue; // Skip color field
   }
   ```

3. **Validate hex colors** (already done, but ensure comprehensive):
   ```javascript
   if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {
     // Valid hex color
   }
   ```

4. **Test color conversion**:
   - Color names → hex for OpenCode
   - Color field removed for Gemini
   - Invalid hex colors skipped

**Detection:**
- Validation errors: "Invalid color format" or "Unknown field: color"
- Manual inspection: Check color values in converted frontmatter

**Current state:** Color conversion exists (lines 269-283, 496-511), but color name mapping may be incomplete. Gemini color removal implemented (line 410).

---

### Pitfall 10: TOML Conversion Incomplete

**What goes wrong:** Gemini command conversion to TOML format misses fields or produces invalid TOML.

**Why it happens:**
- `convertClaudeToGeminiToml` (lines 549-583) only extracts `description` and `prompt`
- Other frontmatter fields may be needed
- TOML syntax errors (unescaped quotes, invalid characters)
- Body content not properly escaped for TOML string

**Consequences:**
- Gemini commands fail to load: "Invalid TOML syntax"
- Missing command metadata
- Broken command functionality

**Prevention:**
1. **Extract all relevant frontmatter fields**:
   ```javascript
   // Not just description, but also:
   // - name (if needed)
   // - aliases (if supported)
   // - other Gemini-specific fields
   ```

2. **Properly escape TOML strings**:
   ```javascript
   // Use TOML library or proper escaping
   const toml = require('@iarna/toml');
   const tomlContent = toml.stringify({
     description: description,
     prompt: body
   });
   ```

3. **Test TOML conversion**:
   - Valid TOML syntax
   - All fields preserved
   - Special characters escaped correctly

**Detection:**
- TOML syntax errors: "Invalid TOML" at runtime
- Missing fields: Commands don't have expected metadata
- Manual inspection: Check `.toml` file syntax

**Current state:** `convertClaudeToGeminiToml` (lines 549-583) uses manual string building, which may produce invalid TOML if body contains special characters or unescaped quotes.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 11: Orphaned File Cleanup Incomplete

**What goes wrong:** Old GSD files from previous versions aren't removed, causing conflicts or confusion.

**Why it happens:**
- `cleanupOrphanedFiles` (lines 696-709) only handles specific files
- New orphaned files added in future versions not caught
- Directory structure changes leave orphaned directories

**Prevention:**
1. **Clean install approach**: Remove entire destination directory before install (already done for `get-shit-done/`, line 653)
2. **Track orphaned files** in version-specific list
3. **Remove orphaned hook registrations** (already done, lines 714-766)

**Current state:** Clean install removes destination directories (line 653), but specific orphaned files still tracked manually (lines 697-700).

---

### Pitfall 12: Windows Path Handling

**What goes wrong:** Path handling fails on Windows due to backslash vs forward slash differences.

**Why it happens:**
- `buildHookCommand` (lines 170-174) converts backslashes to forward slashes
- But other path operations may not handle Windows paths correctly
- `expandTilde` (lines 159-164) may not work on Windows

**Prevention:**
1. **Use `path.join()` consistently** instead of string concatenation
2. **Normalize paths** before comparison:
   ```javascript
   const normalized = path.normalize(filePath).replace(/\\/g, '/');
   ```

**Current state:** `buildHookCommand` handles Windows paths (line 172), but other path operations may need review.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Tool name mapping | Missing tool conversions in body text | Search for PascalCase tool names after conversion |
| Frontmatter parsing | Invalid YAML/TOML syntax | Use proper parsers, validate output |
| Path replacement | Missed path variants | Test with all path formats, env vars, local/global installs |
| Settings merge | Overwritten user settings | Deep merge, preserve existing values |
| File extensions | Wrong extension for runtime | Explicit extension mapping per runtime |
| Attribution | Incorrect Co-Authored-By handling | Test all attribution scenarios per runtime |

---

## Testing Gaps

**Critical missing tests:**

1. **Tool name conversion tests**:
   - Frontmatter arrays → verify all tools converted
   - Body text → verify tool names replaced
   - Edge cases: MCP tools, Task tool, unknown tools

2. **Path replacement tests**:
   - All path variants (`~/.claude/`, `.claude/`, etc.)
   - Windows vs Unix paths
   - Environment variable overrides
   - Local vs global installs

3. **Frontmatter conversion tests**:
   - YAML parsing edge cases (empty arrays, special characters)
   - TOML syntax validation
   - Color conversion (names → hex, removal for Gemini)
   - Tool format conversion (array → object, comma-separated → array)

4. **Settings.json merge tests**:
   - Existing hooks preserved
   - Duplicate hooks prevented
   - Attribution settings preserved
   - Experimental flags preserved

5. **File extension tests**:
   - `.md` → `.toml` for Gemini commands
   - `.md` → `.md` for agents
   - Other files unchanged

6. **Command structure tests**:
   - Flattening for OpenCode (nested → flat)
   - Command reference updates (`/gsd:` → `/gsd-`)

**Recommended test structure:**
```javascript
describe('Runtime conversion', () => {
  describe('Tool name conversion', () => {
    test('converts PascalCase to runtime format');
    test('preserves MCP tools for OpenCode');
    test('excludes MCP tools for Gemini');
    test('converts tool names in body text');
  });
  
  describe('Path replacement', () => {
    test('replaces all path variants');
    test('handles Windows paths');
    test('respects environment variables');
  });
  
  // ... more test suites
});
```

---

## Sources

- **bin/install.js** - Core conversion logic (lines 262-691)
- **cursor-gsd/scripts/migrate.sh** - Migration script patterns
- **BUG_REPORT.md** - Documented bugs and edge cases
- **FIXES_APPLIED.md** - Fixed issues and remaining problems
- **.planning/codebase/CONCERNS.md** - Codebase concerns and fragile areas

**Confidence:** HIGH - Based on direct code analysis of conversion functions and documented issues.
