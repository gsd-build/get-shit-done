---
name: check-todos
description: List pending todos and select one to work on
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# check-todos Skill

## Objective

List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action.
Enables reviewing captured ideas and deciding what to work on next.
@.planning/STATE.md
@.planning/ROADMAP.md

## When to Use



## Process

```bash
TODO_COUNT=$(ls .planning/todos/pending/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "Pending todos: $TODO_COUNT"
```
If count is 0:
```
No pending todos.
Todos are captured during work sessions with /gsd:add-todo.
---
Would you like to:
1. Continue with current phase (/gsd:progress)
2. Add a todo now (/gsd:add-todo)
```
Exit.
Check for area filter in arguments:
- `/gsd:check-todos` → show all
- `/gsd:check-todos api` → filter to area:api only
```bash
for file in .planning/todos/pending/*.md; do
  created=$(grep "^created:" "$file" | cut -d' ' -f2)
  title=$(grep "^title:" "$file" | cut -d':' -f2- | xargs)
  area=$(grep "^area:" "$file" | cut -d' ' -f2)
  echo "$created|$title|$area|$file"
done | sort
```
Apply area filter if specified. Display as numbered list:
```
Pending Todos:
1. Add auth token refresh (api, 2d ago)
2. Fix modal z-index issue (ui, 1d ago)
3. Refactor database connection pool (database, 5h ago)
---

## Success Criteria

- [ ] All pending todos listed with title, area, age
- [ ] Area filter applied if specified
- [ ] Selected todo's full context loaded
- [ ] Roadmap context checked for phase match
- [ ] Appropriate actions offered
- [ ] Selected action executed
- [ ] STATE.md updated if todo count changed
- [ ] Changes committed to git (if todo moved to done/)

## Anti-Patterns

- Don't delete todos — move to done/ when work begins
- Don't start work without moving to done/ first
- Don't create plans from this command — route to /gsd:plan-phase or /gsd:add-phase
- [ ] All pending todos listed with title, area, age
- [ ] Area filter applied if specified
- [ ] Selected todo's full context loaded
- [ ] Roadmap context checked for phase match
- [ ] Appropriate actions offered
- [ ] Selected action executed
- [ ] STATE.md updated if todo count changed
- [ ] Changes committed to git (if todo moved to done/)

## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
