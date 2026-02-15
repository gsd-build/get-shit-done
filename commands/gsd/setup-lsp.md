---
name: gsd:setup-lsp
description: Configure LSP support for enhanced code navigation
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<objective>
Configure Language Server Protocol (LSP) support for GSD agents, enabling faster and more accurate code navigation through `findReferences`, `goToDefinition`, and call hierarchy operations.

LSP is opt-in and falls back to grep when unavailable.
</objective>

<process>

## 1. Detect Project Languages

Check for language indicators:

```bash
# TypeScript/JavaScript
ls tsconfig.json package.json 2>/dev/null

# Python
ls pyproject.toml requirements.txt setup.py 2>/dev/null

# Rust
ls Cargo.toml 2>/dev/null

# Go
ls go.mod 2>/dev/null

# C/C++
ls CMakeLists.txt Makefile *.c *.cpp *.h 2>/dev/null | head -1

# Java
ls pom.xml build.gradle *.java 2>/dev/null | head -1
```

Build detected languages list.

## 2. Ask User Which Languages to Enable

Use AskUserQuestion with multiSelect:

```
AskUserQuestion([
  {
    question: "Which languages should have LSP enabled?",
    header: "Languages",
    multiSelect: true,
    options: [
      // Only show detected languages
      { label: "TypeScript/JavaScript", description: "typescript-lsp for .ts/.tsx/.js files" },
      { label: "Python", description: "pyright-lsp for .py files" },
      { label: "Rust", description: "rust-analyzer-lsp for .rs files" },
      { label: "Go", description: "gopls-lsp for .go files" },
      { label: "C/C++", description: "clangd-lsp for .c/.cpp/.h files" },
      { label: "Java", description: "jdtls-lsp for .java files" }
    ]
  }
])
```

**If no languages detected:** Show all options with note that none were auto-detected.

## 3. Update Config

Read existing `.planning/config.json` (create if doesn't exist):

```bash
cat .planning/config.json 2>/dev/null || echo '{}'
```

Update with LSP settings:

```json
{
  ...existing_config,
  "lsp": {
    "enabled": true,
    "languages": ["typescript", "python", ...]  // based on selection
  }
}
```

Write to `.planning/config.json`.

## 4. Check Existing Plugins

Read user's Claude Code settings to see which plugins are already installed:

```bash
cat ~/.claude/settings.json 2>/dev/null
```

Parse `enabledPlugins` object. Build list of:
- **Already installed:** plugins with `true` value
- **Need to install:** plugins for selected languages not in settings

Plugin mapping:
| Language | Plugin ID |
|----------|-----------|
| TypeScript/JavaScript | `typescript-lsp@claude-plugins-official` |
| Python | `pyright-lsp@claude-plugins-official` |
| Rust | `rust-analyzer-lsp@claude-plugins-official` |
| Go | `gopls-lsp@claude-plugins-official` |
| C/C++ | `clangd-lsp@claude-plugins-official` |
| Java | `jdtls-lsp@claude-plugins-official` |

## 5. Install Missing Plugins

**If all needed plugins already installed:**

```
✅ All required LSP plugins are already installed:
   - typescript-lsp@claude-plugins-official
   - pyright-lsp@claude-plugins-official
```

Skip to Step 6.

**If plugins need to be installed:**

Show status and ask:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LSP PLUGINS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Already installed:
  ✅ typescript-lsp@claude-plugins-official
  ✅ pyright-lsp@claude-plugins-official

Need to install:
  ⬜ rust-analyzer-lsp@claude-plugins-official
  ⬜ gopls-lsp@claude-plugins-official
```

```
AskUserQuestion([
  {
    question: "Install the missing LSP plugins now?",
    header: "Plugins",
    multiSelect: false,
    options: [
      { label: "Yes - Update settings.json (Recommended)", description: "I'll add them to ~/.claude/settings.json" },
      { label: "Yes - Use /plugin commands", description: "I'll run /plugin install for each" },
      { label: "No - Show me how", description: "Show manual instructions" }
    ]
  }
])
```

**If "Yes - Update settings.json" (Recommended):**

Read current settings.json, add missing plugins to `enabledPlugins`, write back:

```bash
# Read existing settings
cat ~/.claude/settings.json
```

Use the Edit tool to add missing plugins to `enabledPlugins` object:

```json
{
  "enabledPlugins": {
    ...existing_plugins,
    "rust-analyzer-lsp@claude-plugins-official": true,
    "gopls-lsp@claude-plugins-official": true
  }
}
```

Confirm:
```
✅ Updated ~/.claude/settings.json
   Added: rust-analyzer-lsp@claude-plugins-official
   Added: gopls-lsp@claude-plugins-official

   Restart Claude Code for changes to take effect.
```

**If "Yes - Use /plugin commands":**

Run `/plugin install {plugin-id}` for each missing plugin:

```
Installing rust-analyzer-lsp@claude-plugins-official...
/plugin install rust-analyzer-lsp@claude-plugins-official

Installing gopls-lsp@claude-plugins-official...
/plugin install gopls-lsp@claude-plugins-official
```

**If "No - Show me how" (manual):**

Show both options:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MANUAL PLUGIN INSTALLATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option 1: Run these commands in Claude Code:

/plugin install rust-analyzer-lsp@claude-plugins-official
/plugin install gopls-lsp@claude-plugins-official

Option 2: Add to ~/.claude/settings.json in "enabledPlugins":

{
  "enabledPlugins": {
    "rust-analyzer-lsp@claude-plugins-official": true,
    "gopls-lsp@claude-plugins-official": true
  }
}
```

## 6. Display Binary Install Instructions

For each selected language, show binary install commands:

### TypeScript/JavaScript
```
npm install -g typescript-language-server typescript
```

### Python
```
pip install pyright
```

### Rust
```
rustup component add rust-analyzer
```

### Go
```
go install golang.org/x/tools/gopls@latest
```

### C/C++
```
Mac:     brew install llvm
Linux:   apt install clangd (Ubuntu/Debian) or dnf install clang-tools-extra (Fedora)
Windows: winget install LLVM.LLVM or download from https://releases.llvm.org/
```

### Java
```
All platforms: Download from https://download.eclipse.org/jdtls/
Or via VS Code Java extension (includes JDTLS)
```

First, check which binaries are already installed:

```bash
which typescript-language-server 2>/dev/null && echo "✅ TypeScript LSP installed" || echo "⬜ TypeScript LSP not found"
which pyright 2>/dev/null && echo "✅ Pyright installed" || echo "⬜ Pyright not found"
which rust-analyzer 2>/dev/null && echo "✅ rust-analyzer installed" || echo "⬜ rust-analyzer not found"
which gopls 2>/dev/null && echo "✅ gopls installed" || echo "⬜ gopls not found"
which clangd 2>/dev/null && echo "✅ clangd installed" || echo "⬜ clangd not found"
```

Show status and ask:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LANGUAGE SERVER BINARIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Already installed:
  ✅ typescript-language-server
  ✅ pyright

Need to install:
  ⬜ rust-analyzer
  ⬜ gopls
```

**If all needed binaries already installed:**

```
✅ All required language server binaries are already installed!
```

Skip to Step 7.

**If binaries need to be installed:**

```
AskUserQuestion([
  {
    question: "Install the missing language server binaries now?",
    header: "Binaries",
    multiSelect: false,
    options: [
      { label: "Yes - Install for me (Recommended)", description: "Run install commands automatically" },
      { label: "No - Show me the commands", description: "I'll install them myself" }
    ]
  }
])
```

**If "Yes - Install for me":**

Run the appropriate install commands for each missing binary. Show progress:

```
Installing TypeScript language server...
```
```bash
npm install -g typescript-language-server typescript
```
```
✅ typescript-language-server installed
```

```
Installing Pyright...
```
```bash
# Prefer uv if available
which uv && uv pip install pyright || pip install pyright
```
```
✅ pyright installed
```

```
Installing rust-analyzer...
```
```bash
rustup component add rust-analyzer
```
```
✅ rust-analyzer installed
```

```
Installing gopls...
```
```bash
go install golang.org/x/tools/gopls@latest
```
```
✅ gopls installed
```

For C/C++ (clangd), detect platform:
```bash
# macOS
brew install llvm

# Linux (Ubuntu/Debian)
sudo apt install clangd

# Linux (Fedora)
sudo dnf install clang-tools-extra
```

For Java: Show manual instructions (no simple one-liner):
```
Java JDTLS requires manual installation:
  Download from: https://download.eclipse.org/jdtls/
  Or install VS Code Java extension (includes JDTLS)
```

**Handle failures gracefully:** If a command fails, show the error and manual command, then continue with other languages:
```
⚠️ Failed to install rust-analyzer automatically.
   Manual command: rustup component add rust-analyzer
   Error: rustup not found - install from https://rustup.rs
```

**If "No - Show me the commands":**

Show all commands for manual installation:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MANUAL BINARY INSTALLATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{commands for each missing binary based on selected languages}
```

## 7. Check Environment Variable

```bash
echo $ENABLE_LSP_TOOL
```

**If not set or not "1":**

Detect shell:
```bash
echo $SHELL
```

Ask user:

```
AskUserQuestion([
  {
    question: "Add ENABLE_LSP_TOOL=1 to your shell profile?",
    header: "Env Var",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Add to {detected_profile}" },
      { label: "No", description: "I'll add it manually" }
    ]
  }
])
```

**If Yes:**

Append to appropriate profile:
- bash: `~/.bashrc`
- zsh: `~/.zshrc`
- fish: `~/.config/fish/config.fish` (use `set -gx ENABLE_LSP_TOOL 1`)

```bash
# For bash/zsh:
echo 'export ENABLE_LSP_TOOL=1' >> ~/.zshrc

# For fish:
echo 'set -gx ENABLE_LSP_TOOL 1' >> ~/.config/fish/config.fish
```

**Note:** Tell user to run `source ~/.zshrc` (or equivalent) or restart terminal.

## 8. Add CLAUDE.md Instructions

LSP tools work best when Claude knows to prioritize them. Offer to add instructions to the user's CLAUDE.md.

```
AskUserQuestion([
  {
    question: "Add LSP priority instructions to your CLAUDE.md?",
    header: "CLAUDE.md",
    multiSelect: false,
    options: [
      { label: "Yes - Add to project CLAUDE.md (Recommended)", description: "Add to ./CLAUDE.md in this project" },
      { label: "Yes - Add to global CLAUDE.md", description: "Add to ~/.claude/CLAUDE.md for all projects" },
      { label: "No - Show me the snippet", description: "I'll add it manually" }
    ]
  }
])
```

**The snippet to add:**

```
## LSP Priority

Prefer LSP tools over grep for semantic code navigation:
- findReferences > grep for "find usages"
- goToDefinition > grep for "where defined"
- documentSymbol > grep for "list symbols"
- incomingCalls/outgoingCalls for call chains
- hover for type info/docs
- FALLBACK to Glob/Grep if LSP errors or for pattern/text search
```

**If "Yes - Add to project CLAUDE.md":**

Check if ./CLAUDE.md exists:
- If exists: Append the snippet with a blank line separator
- If not exists: Create it with the snippet

Confirm:
```
✅ Added LSP priority instructions to ./CLAUDE.md
```

**If "Yes - Add to global CLAUDE.md":**

Check if ~/.claude/CLAUDE.md exists:
- If exists: Check if it already contains "LSP Priority" section
  - If already has it: Tell user "LSP instructions already present in ~/.claude/CLAUDE.md"
  - If not: Append the snippet with a blank line separator
- If not exists: Create it with the snippet

Confirm:
```
✅ Added LSP priority instructions to ~/.claude/CLAUDE.md
   This will apply to all your projects.
```

**If "No - Show me the snippet":**

Display clearly formatted for terminal copy-paste:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CLAUDE.MD SNIPPET (copy everything below the line)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## LSP Priority

Prefer LSP tools over grep for semantic code navigation:
- findReferences > grep for "find usages"
- goToDefinition > grep for "where defined"
- documentSymbol > grep for "list symbols"
- incomingCalls/outgoingCalls for call chains
- hover for type info/docs
- FALLBACK to Glob/Grep if LSP errors or for pattern/text search

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add this to:
  • ./CLAUDE.md (project-specific)
  • ~/.claude/CLAUDE.md (all projects)
```

## 9. Verify Readiness

Show status summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LSP STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Component          | Status |
|--------------------|--------|
| Config Updated     | ✅ .planning/config.json |
| Languages          | {list} |
| ENABLE_LSP_TOOL    | {✅ Set / ⚠️ Not set} |
| CLAUDE.md          | {✅ Added / ℹ️ Snippet shown / ⏭️ Skipped} |

## Next Steps

1. Install language server binaries (commands above)
2. Restart terminal (if env var was added)
3. Run /gsd:progress to continue your work

LSP will enhance:
- findReferences: Check if symbols are used/imported
- goToDefinition: Find where symbols are defined
- incomingCalls/outgoingCalls: Trace call hierarchies

Agents will automatically fall back to grep if LSP is unavailable.
```

</process>

<success_criteria>
- [ ] Languages detected or user selected
- [ ] config.json updated with lsp.enabled=true and lsp.languages
- [ ] Existing plugins checked in ~/.claude/settings.json
- [ ] Missing plugins installed (settings.json edit, /plugin command, or manual shown)
- [ ] Binary install instructions displayed for each language
- [ ] ENABLE_LSP_TOOL checked (and optionally added to profile)
- [ ] CLAUDE.md instructions offered (added automatically or snippet shown)
- [ ] Status summary shown with next steps
</success_criteria>

<official_plugins>
Only recommend official plugins from `@claude-plugins-official` marketplace:

| Language | Plugin ID |
|----------|-----------|
| TypeScript/JavaScript | `typescript-lsp@claude-plugins-official` |
| Python | `pyright-lsp@claude-plugins-official` |
| Rust | `rust-analyzer-lsp@claude-plugins-official` |
| Go | `gopls-lsp@claude-plugins-official` |
| C/C++ | `clangd-lsp@claude-plugins-official` |
| Java | `jdtls-lsp@claude-plugins-official` |
</official_plugins>
