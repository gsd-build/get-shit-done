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

## 4. Display Setup Instructions

For each selected language, show:

### TypeScript/JavaScript
```
Binary: npm install -g typescript-language-server typescript
Plugin: typescript-lsp@claude-plugins-official
```

### Python
```
Binary: pip install pyright
Plugin: pyright-lsp@claude-plugins-official
```

### Rust
```
Binary: rustup component add rust-analyzer
Plugin: rust-analyzer-lsp@claude-plugins-official
```

### Go
```
Binary: go install golang.org/x/tools/gopls@latest
Plugin: gopls-lsp@claude-plugins-official
```

### C/C++
```
Binary:
  - Mac: brew install llvm
  - Linux: apt install clangd (Ubuntu/Debian) or dnf install clang-tools-extra (Fedora)
  - Windows: winget install LLVM.LLVM or download from https://releases.llvm.org/
Plugin: clangd-lsp@claude-plugins-official
```

### Java
```
Binary:
  - All platforms: Download from https://download.eclipse.org/jdtls/
  - Or via VS Code Java extension (includes JDTLS)
Plugin: jdtls-lsp@claude-plugins-official
```

Show combined instructions:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LSP SETUP INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Step 1: Install Language Servers

{binary install commands for each selected language}

## Step 2: Enable Plugins in Claude Code

Add to your Claude Code settings.json:

{
  "plugins": {
    "{plugin-name}@claude-plugins-official": { "enabled": true }
  }
}

## Step 3: Set Environment Variable

Add to your shell profile:

export ENABLE_LSP_TOOL=1
```

## 5. Check Environment Variable

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

## 6. Verify Readiness

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

## Next Steps

1. Install language server binaries (commands above)
2. Enable plugins in Claude Code settings
3. Restart terminal (if env var was added)
4. Run /gsd:progress to continue your work

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
- [ ] Setup instructions displayed for each language
- [ ] ENABLE_LSP_TOOL checked (and optionally added to profile)
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
