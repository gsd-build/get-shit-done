---
name: add-todo
description: Capture idea or task as todo from current conversation context
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# add-todo Skill

## Objective

Capture an idea, task, or issue that surfaces during a GSD session as a structured todo for later work.
Enables "thought → capture → continue" flow without losing context or derailing current work.
@.planning/STATE.md

## When to Use



## Process

```bash
mkdir -p .planning/todos/pending .planning/todos/done
```
```bash
ls .planning/todos/pending/*.md 2>/dev/null | xargs -I {} grep "^area:" {} 2>/dev/null | cut -d' ' -f2 | sort -u
```
Note existing areas for consistency in infer_area step.
**With arguments:** Use as the title/focus.
- `/gsd:add-todo Add auth token refresh` → title = "Add auth token refresh"
**Without arguments:** Analyze recent conversation to extract:
- The specific problem, idea, or task discussed
- Relevant file paths mentioned
- Technical details (error messages, line numbers, constraints)
Formulate:
- `title`: 3-10 word descriptive title (action verb preferred)
- `problem`: What's wrong or why this is needed
- `solution`: Approach hints or "TBD" if just an idea
- `files`: Relevant paths with line numbers from conversation
Infer area from file paths:
| Path pattern | Area |
|--------------|------|
| `src/api/*`, `api/*` | `api` |
| `src/components/*`, `src/ui/*` | `ui` |
| `src/auth/*`, `auth/*` | `auth` |
| `src/db/*`, `database/*` | `database` |
| `tests/*`, `__tests__/*` | `testing` |
| `docs/*` | `docs` |
| `.planning/*` | `planning` |
| `scripts/*`, `bin/*` | `tooling` |
| No files or unclear | `general` |
Use existing area from step 2 if similar match exists.

## Success Criteria

- [ ] Directory structure exists
- [ ] Todo file created with valid frontmatter
- [ ] Problem section has enough context for future Claude
- [ ] No duplicates (checked and resolved)
- [ ] Area consistent with existing todos
- [ ] STATE.md updated if exists
- [ ] Todo and state committed to git

## Anti-Patterns

- Don't create todos for work in current plan (that's deviation rule territory)
- Don't create elaborate solution sections — captures ideas, not plans
- Don't block on missing information — "TBD" is fine
- [ ] Directory structure exists
- [ ] Todo file created with valid frontmatter
- [ ] Problem section has enough context for future Claude
- [ ] No duplicates (checked and resolved)
- [ ] Area consistent with existing todos
- [ ] STATE.md updated if exists
- [ ] Todo and state committed to git

## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
