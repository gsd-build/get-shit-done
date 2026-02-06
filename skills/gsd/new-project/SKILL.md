---
name: new-project
description: Initialize a new project with deep context gathering and PROJECT.md
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# new-project Skill

## Objective

Initialize a new project through comprehensive context gathering.
This is the most leveraged moment in any project. Deep questioning here means better plans, better execution, better outcomes.
Creates `.planning/` with PROJECT.md and config.json.

## When to Use



## Process

**MANDATORY FIRST STEP — Execute these checks before ANY user interaction:**
1. **Abort if project exists:**
   ```bash
   [ -f .planning/PROJECT.md ] && echo "ERROR: Project already initialized. Use /gsd:progress" && exit 1
   ```
2. **Initialize git repo in THIS directory** (required even if inside a parent repo):
   ```bash
   # Check if THIS directory is already a git repo root (handles .git file for worktrees too)
   if [ -d .git ] || [ -f .git ]; then
       echo "Git repo exists in current directory"
   else
       git init
       echo "Initialized new git repo"
   fi
   ```
3. **Detect existing code (brownfield detection):**
   ```bash
   # Check for existing code files
   CODE_FILES=$(find . -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.swift" -o -name "*.java" 2>/dev/null | grep -v node_modules | grep -v .git | head -20)
   HAS_PACKAGE=$([ -f package.json ] || [ -f requirements.txt ] || [ -f Cargo.toml ] || [ -f go.mod ] || [ -f Package.swift ] && echo "yes")
   HAS_CODEBASE_MAP=$([ -d .planning/codebase ] && echo "yes")
   ```
   **You MUST run all bash commands above using the Bash tool before proceeding.**
**If existing code detected and .planning/codebase/ doesn't exist:**
Check the results from setup step:
- If `CODE_FILES` is non-empty OR `HAS_PACKAGE` is "yes"
- AND `HAS_CODEBASE_MAP` is NOT "yes"
Use AskUserQuestion:
- header: "Existing Code"
- question: "I detected existing code in this directory. Would you like to map the codebase first?"
- options:
  - "Map codebase first" — Run /gsd:map-codebase to understand existing architecture (Recommended)
  - "Skip mapping" — Proceed with project initialization
**If "Map codebase first":**
```

## Success Criteria

- [ ] Deep questioning completed (not rushed)
- [ ] PROJECT.md captures full context with evolutionary structure
- [ ] Requirements initialized as hypotheses (greenfield) or with inferred Validated (brownfield)
- [ ] Key Decisions table initialized
- [ ] config.json has workflow mode, depth, and parallelization
- [ ] All committed to git

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
