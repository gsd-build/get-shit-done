# LSP Patterns Reference

Single source of truth for LSP usage in GSD agents. All LSP operations gracefully fall back to grep when unavailable.

## Config Check Pattern

Before using LSP, check if enabled:
```
Read .planning/config.json → check lsp.enabled === true
If disabled or missing → use grep directly
```

## Decision Pattern: LSP vs Grep

| Task | Prefer LSP | Prefer Grep |
|------|-----------|-------------|
| Find all usages of symbol | ✅ `findReferences` | Pattern/text search |
| Find where symbol is defined | ✅ `goToDefinition` | File path known |
| List functions calling X | ✅ `incomingCalls` | Approximate matches OK |
| List functions X calls | ✅ `outgoingCalls` | Approximate matches OK |
| Get type info/docs | ✅ `hover` | N/A |
| List symbols in file | ✅ `documentSymbol` | Quick scan |
| Search text patterns | grep | ✅ |
| Find files by name | glob | ✅ |
| Search across many files | grep | ✅ |

**Rule:** Use LSP for semantic queries ("is this used?", "where defined?"). Use grep for text/pattern queries.

## Operation Patterns

### findReferences (Most Common)

**Use for:** "Is this symbol used?", "What imports this?", "Find all callers"

**LSP:**
```
LSP(operation="findReferences", filePath="src/utils.ts", line=15, character=20)
```

**Fallback:**
```bash
grep -r "symbolName" src/ --include="*.ts" --include="*.tsx"
```

**Notes:**
- Most valuable LSP operation for verification
- Returns exact references, not pattern matches
- Includes re-exports and indirect usage

---

### goToDefinition

**Use for:** "Where is this defined?", "Find implementation"

**LSP:**
```
LSP(operation="goToDefinition", filePath="src/index.ts", line=5, character=10)
```

**Fallback:**
```bash
grep -rE "^(export )?(function|const|class|interface|type) symbolName" src/
```

**Notes:**
- Follows imports to actual definition
- Works across module boundaries
- Handles re-exports correctly

---

### incomingCalls

**Use for:** "What functions call this?", "Trace callers"

**LSP:**
```
LSP(operation="prepareCallHierarchy", filePath="src/api.ts", line=42, character=10)
# Then:
LSP(operation="incomingCalls", filePath="src/api.ts", line=42, character=10)
```

**Fallback:**
```bash
grep -r "functionName(" src/ --include="*.ts"
```

**Notes:**
- Requires `prepareCallHierarchy` first to get call hierarchy item
- More accurate than grep for method calls on objects
- Shows full call chain

---

### outgoingCalls

**Use for:** "What does this function call?", "Trace dependencies"

**LSP:**
```
LSP(operation="prepareCallHierarchy", filePath="src/api.ts", line=42, character=10)
# Then:
LSP(operation="outgoingCalls", filePath="src/api.ts", line=42, character=10)
```

**Fallback:**
```bash
# Read function body and grep for function calls
grep -E "\w+\(" src/api.ts
```

**Notes:**
- Shows what a function depends on
- Useful for impact analysis

---

### documentSymbol

**Use for:** "List all exports", "What's in this file?"

**LSP:**
```
LSP(operation="documentSymbol", filePath="src/types.ts", line=1, character=1)
```

**Fallback:**
```bash
grep -E "^export (function|const|class|interface|type)" src/types.ts
```

**Notes:**
- Quick overview of file contents
- Includes nested symbols (methods in classes)

---

### hover

**Use for:** "What type is this?", "Get documentation"

**LSP:**
```
LSP(operation="hover", filePath="src/utils.ts", line=10, character=15)
```

**Fallback:**
```
# Read the definition file directly
```

**Notes:**
- Returns type info and JSDoc/docstrings
- Useful for understanding APIs quickly

---

### goToImplementation

**Use for:** "Find implementations of interface", "Find concrete classes"

**LSP:**
```
LSP(operation="goToImplementation", filePath="src/interfaces.ts", line=5, character=15)
```

**Fallback:**
```bash
grep -rE "implements InterfaceName|extends ClassName" src/
```

**Notes:**
- Finds concrete implementations
- Works with interfaces, abstract classes, type definitions

## Error Handling

**Principle:** LSP failure never blocks GSD operation.

```
1. Check if lsp.enabled in .planning/config.json
2. If enabled, try LSP operation
3. If LSP fails or returns empty → use grep fallback (silent)
4. If LSP disabled → use grep directly
```

**Common LSP Errors (handle silently):**
- Server not running → grep fallback
- File not in project → grep fallback
- Symbol not found → grep fallback
- Timeout → grep fallback

**Never show LSP errors to user** - just use fallback and continue.

## Verification Patterns

### "Is this export used?"
```
1. LSP findReferences on the export
2. If references found outside defining file → used
3. Fallback: grep for import statements containing symbol name
```

### "Is this function wired up?"
```
1. LSP findReferences on the function
2. Check if any reference is a call site
3. Fallback: grep for "functionName(" patterns
```

### "Does this import exist?"
```
1. LSP goToDefinition on the import
2. If resolves → exists
3. Fallback: Check file exists at import path
```

## Official LSP Plugins

When setting up LSP, use only official plugins from `@claude-plugins-official`:

| Language | Plugin |
|----------|--------|
| TypeScript/JavaScript | `typescript-lsp@claude-plugins-official` |
| Python | `pyright-lsp@claude-plugins-official` |
| Rust | `rust-analyzer-lsp@claude-plugins-official` |
| Go | `gopls-lsp@claude-plugins-official` |
| C/C++ | `clangd-lsp@claude-plugins-official` |
| Java | `jdtls-lsp@claude-plugins-official` |

## Environment Requirements

LSP tools require:
1. `ENABLE_LSP_TOOL=1` environment variable
2. Language server binary installed (e.g., `typescript-language-server`)
3. Plugin enabled in Claude Code settings
