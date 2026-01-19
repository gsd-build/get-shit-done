# Phase 2: Document Validation - Research

**Researched:** 2026-01-19
**Domain:** Claim extraction and validation against actual codebase
**Confidence:** HIGH

## Summary

This phase creates a document validation system that cross-checks user-provided documentation (stored in USER-CONTEXT.md by Phase 1) against the actual codebase. The validator extracts verifiable technical claims from user docs, attempts to verify each claim against real code, and presents findings to the user for decision.

The GSD codebase has extensive verification infrastructure that this phase should mirror. The gsd-verifier agent provides the closest template - it uses goal-backward verification with three-level checks (exists, substantive, wired). The new gsd-doc-validator agent should follow similar patterns but operate on documentation claims rather than phase goals.

Key insight: The existing verification-patterns.md reference document provides ready-to-use bash patterns for file existence, content verification, and wiring checks. These should be reused directly rather than reinventing.

**Primary recommendation:** Create gsd-doc-validator agent following gsd-verifier structure. Extract claims from USER-CONTEXT.md, verify each with existing verification patterns, assign confidence levels, present issues to user via AskUserQuestion, and update USER-CONTEXT.md with validation status.

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Task tool | Claude Code native | Spawn validation subagent | Consistent with gsd-doc-ingestor pattern |
| Read tool | Claude Code native | Read USER-CONTEXT.md and source files | Verify content of referenced files |
| Bash tool | Claude Code native | File existence checks, grep patterns | Existing verification patterns rely on bash |
| Grep tool | Claude Code native | Content pattern matching | Verify exports, functions, API signatures |
| AskUserQuestion | Claude Code native | Present issues to user | Structured choices for Include/Exclude/Mark stale |
| Write tool | Claude Code native | Update USER-CONTEXT.md with validation results | Annotate claims with confidence levels |

### Supporting

| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| Glob tool | Claude Code native | Find files in codebase | When verifying directory structure claims |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated agent | Inline validation in workflow | Agent provides fresh context for potentially large USER-CONTEXT.md + codebase scanning |
| Update USER-CONTEXT.md | Separate VALIDATION-RESULTS.md | Single file is simpler for downstream consumers; validated docs stay with their content |

**No installation required** - all tools are Claude Code native.

## Architecture Patterns

### Recommended Agent Structure

```
gsd-doc-validator.md
├── role: Validate user docs against codebase
├── process:
│   ├── load_documents: Read USER-CONTEXT.md
│   ├── extract_claims: Parse verifiable technical claims
│   ├── verify_claims: Check each claim against codebase
│   ├── score_claims: Assign confidence levels
│   ├── present_issues: Show LOW confidence claims to user
│   ├── collect_decisions: Get user choices (Include/Exclude/Stale)
│   └── update_documents: Annotate USER-CONTEXT.md
└── return: Structured confirmation with counts
```

### Pattern 1: Claim Extraction

**What:** Parse USER-CONTEXT.md to identify verifiable technical claims
**When to use:** First step of validation process
**Categories of claims to extract:**

```markdown
## Claim Types

### File Path Claims
- "The config is in `src/config/index.ts`"
- "Database schema at `prisma/schema.prisma`"
- Pattern: backticked paths, explicit file references

### Directory Structure Claims
- "Components are in `src/components/`"
- "API routes under `app/api/`"
- Pattern: directory paths, "under", "in the X folder"

### Function/Class Claims
- "The `authenticate` function handles..."
- "The `UserService` class..."
- Pattern: backticked identifiers, "function", "class", "method"

### Export Claims
- "Exports `formatDate` utility"
- "Default exports the `App` component"
- Pattern: "exports", "default export", backticked identifiers

### API Signature Claims
- "Takes `userId` parameter"
- "Returns a `Promise<User>`"
- Pattern: parameter names, return types

### Config Value Claims
- "Uses port 3000"
- "Database connection string in DATABASE_URL"
- Pattern: env var names, specific config values

### Version Claims
- "Uses React 18"
- "Requires Node 20+"
- Pattern: technology names with version numbers
```

Source: CONTEXT.md decisions on claim extraction

### Pattern 2: Verification by Claim Type

**What:** Different verification strategies for different claim types
**When to use:** verify_claims step

```markdown
## Verification Strategies

### File Path Claims
Check: File exists at specified path
Command: `test -f "$path" && echo "EXISTS" || echo "MISSING"`
Confidence:
- HIGH: File exists
- LOW: File missing

### Directory Structure Claims
Check: Directory exists and contains expected file types
Command: `test -d "$path" && ls "$path" | head -5`
Confidence:
- HIGH: Directory exists with expected content
- MEDIUM: Directory exists but empty or different content
- LOW: Directory missing

### Function/Class Claims
Check: Identifier exists in specified file (or any file if no location given)
Command: `grep -E "function $name|class $name|const $name" "$path"`
Extra: Must be in the specific file if location mentioned
Confidence:
- HIGH: Found in correct location with expected signature
- MEDIUM: Found but in different location
- LOW: Not found anywhere

### Export Claims
Check: Export statement exists
Command: `grep -E "export (default |)(function|const|class) $name" "$path"`
Confidence:
- HIGH: Export statement found
- LOW: No matching export

### API Signature Claims
Check: Function signature matches
Command: `grep -A5 "function $name\|const $name" "$path" | grep "$param"`
Confidence:
- HIGH: Signature matches exactly
- MEDIUM: Function exists but signature differs
- LOW: Function not found

### Version Claims
Check: Note as "version claim - not verified"
Command: N/A (per CONTEXT.md decision)
Confidence:
- MEDIUM: Always mark as unverified version claim
```

Source: CONTEXT.md validation depth decisions, verification-patterns.md

### Pattern 3: Issue Presentation

**What:** Show only problems, all at once, minimal detail
**When to use:** After verification, before user decisions

```markdown
## Issue Presentation Format

AskUserQuestion with multiSelect=true:

header: "Documentation Issues Found"
question: "These claims have validation issues. Choose how to handle each:"
options:
  - "[Claim text] (LOW - file not found)" - Include | Exclude | Mark stale
  - "[Another claim] (LOW - function not found)" - Include | Exclude | Mark stale
  ...

**If no issues:**
Skip AskUserQuestion entirely.
Display: "Validation complete: X claims verified across Y documents"
```

Source: CONTEXT.md issue presentation decisions

### Anti-Patterns to Avoid

- **One-at-a-time prompting:** User decided all issues at once. Don't prompt per-claim.

- **Showing passing claims:** Only show LOW confidence items needing decision. Don't list all verified claims.

- **Excessive detail:** Show claim text + confidence level only. Not full context or verbose explanations.

- **Auto-excluding on failure:** User decided to be asked about issues. Never auto-exclude documentation.

- **Verifying version claims:** Per CONTEXT.md, note as "version claim - not verified" rather than checking package.json.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File existence checks | Custom validation | `test -f "$path"` | Edge cases with symlinks, permissions |
| Export verification | Regex from scratch | verification-patterns.md patterns | Already tested and proven |
| Stub detection | New heuristics | gsd-verifier stub patterns | Comprehensive, battle-tested |
| Wiring verification | Custom tracing | verification-patterns.md wiring checks | Handles common patterns |

**Key insight:** The `get-shit-done/references/verification-patterns.md` file has ready-to-use bash commands for all verification types. Copy patterns directly.

## Common Pitfalls

### Pitfall 1: Over-extraction

**What goes wrong:** Treating every noun as a claim, flooding user with false positives
**Why it happens:** Too aggressive claim extraction regex
**How to avoid:** Focus on technical claims with verifiable identifiers (backticked paths, explicit file references, function names)
**Warning signs:** User sees dozens of "issues" for normal prose

### Pitfall 2: Location-blind verification

**What goes wrong:** Function found in wrong file marked as verified
**Why it happens:** Searching entire codebase instead of specified path
**How to avoid:** Per CONTEXT.md: "function must exist in the specific file mentioned"
**Warning signs:** Claim says "in utils.ts" but function found in helpers.ts

### Pitfall 3: Context window exhaustion

**What goes wrong:** Agent fails mid-validation on large USER-CONTEXT.md
**Why it happens:** Loading all docs + scanning all code in single context
**How to avoid:** Process claims in batches; verify one doc section at a time
**Warning signs:** Agent returns truncated results or fails silently

### Pitfall 4: Prose misinterpretation

**What goes wrong:** Treating architectural descriptions as literal claims
**Why it happens:** Claim extraction too literal for prose
**How to avoid:** Per CONTEXT.md: "Claude's discretion on prose/architectural descriptions" - mark as MEDIUM if can't verify literally
**Warning signs:** "The system uses a layered architecture" marked as LOW confidence

### Pitfall 5: Lost validation results

**What goes wrong:** Validation runs but results not persisted
**Why it happens:** Forgetting to update USER-CONTEXT.md
**How to avoid:** Write validation status directly to USER-CONTEXT.md
**Warning signs:** Running validation repeatedly with no memory of prior runs

## Code Examples

### Claim Extraction Pattern

```bash
# Extract file path claims (backticked paths)
grep -oE '`[^`]+\.(ts|tsx|js|jsx|md|json|prisma|sql|yaml|yml)`' "$USER_CONTEXT"

# Extract function/class claims
grep -oE '`(function |class |const |let |var )?[A-Za-z_][A-Za-z0-9_]+`' "$USER_CONTEXT"

# Extract directory claims
grep -oE '`[^`]+/`|`[^`]+ folder`|`[^`]+ directory`' "$USER_CONTEXT"
```

Source: Derived from verification-patterns.md approach

### File Existence Verification

```bash
# From verification-patterns.md
check_file_claim() {
  local path="$1"
  if [ -f "$path" ]; then
    echo "HIGH:EXISTS"
  elif [ -d "$path" ]; then
    echo "HIGH:EXISTS_DIR"
  else
    echo "LOW:MISSING"
  fi
}
```

Source: verification-patterns.md existence check

### Function Location Verification

```bash
# Verify function exists in specific file (location match requirement)
verify_function_location() {
  local func_name="$1"
  local expected_file="$2"

  if [ -z "$expected_file" ]; then
    # No location specified - search entire codebase
    local found=$(grep -r -l "function $func_name\|const $func_name" src/ 2>/dev/null | head -1)
    if [ -n "$found" ]; then
      echo "MEDIUM:FOUND_ELSEWHERE:$found"
    else
      echo "LOW:NOT_FOUND"
    fi
  else
    # Location specified - must be in that file
    if grep -q "function $func_name\|const $func_name" "$expected_file" 2>/dev/null; then
      echo "HIGH:FOUND_IN_LOCATION"
    else
      echo "LOW:NOT_IN_SPECIFIED_FILE"
    fi
  fi
}
```

Source: CONTEXT.md location match requirement + verification-patterns.md

### Export Verification

```bash
# From verification-patterns.md
check_export() {
  local name="$1"
  local path="$2"

  if grep -qE "export (default )?(function|const|class) $name" "$path" 2>/dev/null; then
    echo "HIGH:EXPORTED"
  elif grep -qE "export \{[^}]*$name[^}]*\}" "$path" 2>/dev/null; then
    echo "HIGH:EXPORTED_NAMED"
  else
    echo "LOW:NOT_EXPORTED"
  fi
}
```

Source: verification-patterns.md export check

### User Decision Collection

```markdown
# AskUserQuestion for issues
AskUserQuestion:
  header: "Documentation Issues Found"
  question: "3 claims have validation issues. Choose how to handle:"
  multiSelect: true
  options:
    - "`src/utils/auth.ts` - file not found (LOW)"
    - "`formatDate` function - not in specified file (LOW)"
    - "`UserService` class - not exported (LOW)"

# Each option implicitly offers: Include / Exclude / Mark as stale
# Format response handling:
# - Selected items: User chose to include as "known stale"
# - Unselected items: User chose to exclude
```

Source: CONTEXT.md user choices decision

### Validation Summary Output

```markdown
## VALIDATION COMPLETE

**Documents validated:** 3
**Total claims:** 47
**Verified (HIGH):** 39
**Verified (MEDIUM):** 5
**Issues (LOW):** 3

**User decisions:**
- Included as stale: 2
- Excluded: 1

**Output:** `.planning/codebase/USER-CONTEXT.md` (annotated)

Ready for downstream integration.
```

Source: gsd-verifier return pattern + CONTEXT.md clean pass summary

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Trust user docs blindly | Validate against code | This phase | Downstream agents use verified context |
| Manual doc review | Automated claim extraction | This phase | Systematic verification coverage |

**Current state:**
- USER-CONTEXT.md created by Phase 1 (gsd-doc-ingestor)
- No validation occurs - docs are trusted as-is
- Downstream agents may use stale/incorrect information

**After this phase:**
- Claims extracted and verified automatically
- LOW confidence items flagged to user
- USER-CONTEXT.md annotated with validation status
- Downstream agents know which docs are verified

## Open Questions

1. **Exact claim extraction regex**
   - What we know: Extract backticked paths, function names, exports
   - What's unclear: Exact regex patterns to minimize false positives
   - Recommendation: Start conservative (only backticked items), expand if needed

2. **USER-CONTEXT.md annotation format**
   - What we know: Need to mark claims with confidence levels
   - What's unclear: Exact markdown format for annotations
   - Recommendation: Add YAML frontmatter per document section with validation_status: validated|issues|stale

3. **Batch size for large docs**
   - What we know: Large USER-CONTEXT.md may exhaust context
   - What's unclear: Optimal batch size for claim verification
   - Recommendation: Process one category section at a time (Architecture, API, etc.)

4. **Semantic check depth**
   - What we know: Per CONTEXT.md: "flag when doc implies something the code doesn't actually do"
   - What's unclear: How deep to analyze semantic meaning
   - Recommendation: Focus on verifiable technical claims; mark prose as MEDIUM unless clearly contradicted

## Sources

### Primary (HIGH confidence)
- `agents/gsd-verifier.md` - Verification agent structure, return format, goal-backward methodology
- `agents/gsd-doc-ingestor.md` - Input format (USER-CONTEXT.md), category structure
- `get-shit-done/references/verification-patterns.md` - Bash patterns for all verification types
- `.planning/phases/02-document-validation/02-CONTEXT.md` - User decisions on validation behavior

### Secondary (MEDIUM confidence)
- `agents/gsd-plan-checker.md` - Pre-execution validation patterns
- `.planning/research/VALIDATION-PATTERNS.md` - Research on existing validation infrastructure
- `.planning/phases/01-document-ingestion-core/01-VERIFICATION.md` - Example verification report format

### Tertiary (LOW confidence)
- None - all findings from codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are Claude Code native, existing in similar agents
- Architecture: HIGH - Follows established gsd-verifier pattern exactly
- Pitfalls: HIGH - Derived from CONTEXT.md decisions and existing verification patterns

**Research date:** 2026-01-19
**Valid until:** 60 days (stable patterns, internal codebase)
