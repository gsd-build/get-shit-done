# Bug Report - Get Shit Done Codebase Review

**Date:** 2026-01-31
**Reviewer:** Claude Code Agent
**Scope:** Full codebase review for bugs, logic errors, and edge cases

---

## Critical Bugs (High Priority)

### 1. Missing error handling in statusline.js for file system operations

**File:** `hooks/gsd-statusline.js:51-54`
**Severity:** High
**Type:** Runtime error / crash

**Issue:**
The statusline reads the todos directory without error handling. If there's a permission issue or a race condition where a file gets deleted between `readdirSync` and `statSync`, the statusline will crash.

**Current code:**
```javascript
if (session && fs.existsSync(todosDir)) {
  const files = fs.readdirSync(todosDir)  // Can throw on permission errors
    .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))  // Can throw if file deleted
    .sort((a, b) => b.mtime - a.mtime);
```

The try-catch at line 57 only wraps the JSON.parse, not the directory operations.

**Fix:**
Wrap the entire directory reading block in try-catch:
```javascript
if (session && fs.existsSync(todosDir)) {
  try {
    const files = fs.readdirSync(todosDir)
      .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      try {
        const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
        const inProgress = todos.find(t => t.status === 'in_progress');
        if (inProgress) task = inProgress.activeForm || '';
      } catch (e) {}
    }
  } catch (e) {
    // Silently fail - don't break statusline on file system errors
  }
}
```

---

### 2. Fragile JSON parsing in bash workflows

**Files:**
- `get-shit-done/workflows/execute-phase.md:20`
- `commands/gsd/execute-phase.md:45`
- `get-shit-done/workflows/execute-phase.md:62`
- `agents/gsd-executor.md:47`

**Severity:** High
**Type:** Logic error / silent failure

**Issue:**
The workflows use fragile grep/sed patterns to extract JSON values instead of proper JSON parsing. These patterns will fail silently if JSON formatting varies.

**Examples:**
```bash
# Fragile - fails if JSON is minified or has different spacing
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")

COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")

BRANCHING_STRATEGY=$(cat .planning/config.json 2>/dev/null | grep -o '"branching_strategy"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:.*"\([^"]*\)"/\1/' || echo "none")
```

**Problems:**
- Fails if JSON is minified (no spaces)
- Fails if values aren't quoted (e.g., `true` vs `"true"`)
- Fails if there are escaped quotes in the value
- Fails if spacing is different than expected

**Fix:**
Use `jq` for robust JSON parsing:
```bash
# Robust JSON parsing
MODEL_PROFILE=$(jq -r '.model_profile // "balanced"' .planning/config.json 2>/dev/null || echo "balanced")

COMMIT_PLANNING_DOCS=$(jq -r '.commit_docs // true' .planning/config.json 2>/dev/null | grep -o 'true\|false' || echo "true")

BRANCHING_STRATEGY=$(jq -r '.branching_strategy // "none"' .planning/config.json 2>/dev/null || echo "none")

PHASE_BRANCH_TEMPLATE=$(jq -r '.phase_branch_template // "gsd/phase-{phase}-{slug}"' .planning/config.json 2>/dev/null || echo "gsd/phase-{phase}-{slug}")
```

**Impact:**
Without this fix, configuration settings may silently fall back to defaults even when explicitly configured, leading to unexpected behavior.

---

### 3. Violation of stated git commit rules

**File:** `commands/gsd/execute-phase.md:94`
**Severity:** Medium
**Type:** Inconsistency with documented rules

**Issue:**
The workflow uses `git add -u` which violates the explicitly stated rule "NEVER use git add . or git add -A or git add src/".

**Current code:**
```bash
git add -u && git commit -m "fix({phase}): orchestrator corrections"
```

**Fix:**
Either:
1. Remove this step if orchestrator corrections shouldn't happen
2. Explicitly enumerate the files to stage:
```bash
# List modified files and stage individually
git status --porcelain | grep '^ M' | cut -c4- | while read file; do
  git add "$file"
done
git commit -m "fix({phase}): orchestrator corrections"
```

Or better yet, avoid making corrections at the orchestrator level.

---

## Medium Priority Issues

### 4. Missing hex color validation in install.js

**File:** `bin/install.js:437-441`
**Severity:** Medium
**Type:** Data validation

**Issue:**
The code accepts hex color values without validation:

```javascript
} else if (colorValue.startsWith('#')) {
  // Already hex, keep as is
  newLines.push(line);
}
```

**Fix:**
Add validation for hex color format:
```javascript
} else if (colorValue.startsWith('#')) {
  // Validate hex color format (#RGB or #RRGGBB)
  if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
    newLines.push(line);
  }
  // Skip invalid hex colors
}
```

---

### 5. Potential issue with branch variable expansion

**File:** `get-shit-done/workflows/execute-phase.md:100-103`
**Severity:** Low
**Type:** Shell safety

**Issue:**
Phase name is used in shell variable without proper quoting in some places:

```bash
PHASE_NAME=$(basename "$PHASE_DIR" | sed 's/^[0-9]*-//')
```

The variable is properly quoted, but the subsequent sed operations should also be reviewed for edge cases with special characters in phase names.

**Fix:**
Ensure all variable expansions are properly quoted, especially in sed operations.

---

### 6. Missing CONTEXT.md reference documentation

**File:** `agents/gsd-executor.md:69`
**Severity:** Low
**Type:** Documentation gap

**Issue:**
The executor mentions that plans can reference CONTEXT.md but doesn't explain how it should be passed or read.

**Current text:**
```markdown
**If plan references CONTEXT.md:** The CONTEXT.md file provides the user's vision for this phase — how they imagine it working, what's essential, and what's out of scope. Honor this context throughout execution.
```

**Fix:**
Add clarity about how CONTEXT.md is accessed:
```markdown
**If plan references CONTEXT.md:** Read .planning/phases/{phase}/CONTEXT.md for the user's vision. Honor this context throughout execution. The file provides how they imagine it working, what's essential, and what's out of scope.
```

---

## Low Priority / Code Quality Issues

### 7. Inconsistent error handling patterns

**Files:** Multiple
**Severity:** Low
**Type:** Code quality

**Issue:**
Error handling is inconsistent across different files:
- Some functions have comprehensive try-catch blocks
- Others rely on optional chaining or existence checks
- Some fail silently, others propagate errors

**Recommendation:**
Establish consistent error handling patterns across the codebase, especially for:
- File system operations
- JSON parsing
- Git operations
- External command execution

---

### 8. Hardcoded paths in multiple locations

**Files:** Multiple
**Severity:** Low
**Type:** Maintainability

**Issue:**
Paths like `~/.claude/`, `.planning/`, etc. are hardcoded in many places. Changes to directory structure would require updates in multiple files.

**Examples:**
- `hooks/gsd-statusline.js:49` - hardcoded `~/.claude/todos`
- `hooks/gsd-check-update.js:12` - hardcoded `~/.claude/`
- Multiple workflow files reference `.planning/`

**Recommendation:**
Consider centralizing path constants in a shared configuration module.

---

## Summary

**Total bugs found:** 8

**By severity:**
- Critical: 3 (statusline error handling, JSON parsing, git rules violation)
- Medium: 3 (color validation, variable expansion, documentation)
- Low: 2 (error handling patterns, hardcoded paths)

**Recommended immediate actions:**
1. Fix statusline.js error handling (prevents crashes)
2. Replace grep/sed JSON parsing with jq (prevents silent configuration failures)
3. Fix or document the git add -u usage (consistency with stated rules)

**Next steps:**
- Prioritize fixes based on user impact
- Add unit tests for critical paths (especially JSON parsing and file operations)
- Consider adding integration tests for workflow orchestration
- Establish error handling and coding standards documentation
