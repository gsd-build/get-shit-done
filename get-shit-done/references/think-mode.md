# Think Mode Reference

Apply mental frameworks to GSD commands with `--think <framework>`.

## Usage

```
/gsd:plan-phase 1 --think pareto
/gsd:debug "login broken" --think 5-whys
/gsd:define-requirements --think inversion
```

**Rule:** `--think <framework>` must be the final arguments.

## Parsing

When processing `$ARGUMENTS`:

1. Check if arguments end with `--think <name>`
2. If found:
   - `THINK_MODE` = `<name>` (lowercase)
   - `CLEAN_ARGS` = everything before `--think`
3. If not found:
   - `THINK_MODE` = empty
   - `CLEAN_ARGS` = `$ARGUMENTS`

Example: `/gsd:plan-phase 1 --gaps --think pareto`
- `THINK_MODE` = `pareto`
- `CLEAN_ARGS` = `1 --gaps`

## Loading Framework

If `THINK_MODE` is set:

1. Load: `@~/.claude/get-shit-done/frameworks/${THINK_MODE}.md`
2. If framework file doesn't exist, error with valid framework list

## Applying Framework

When framework loaded:

- Follow framework's `<process>` as guiding lens for the command
- Add framework's `<success_criteria>` to command's verification
- Include framework-specific output section in results

The framework shapes HOW you approach the task, not WHAT the task is.

## Available Frameworks

| Framework | Best For |
|-----------|----------|
| pareto | Prioritization (80/20) |
| first-principles | Architecture |
| inversion | Risk analysis |
| 5-whys | Root cause |
| second-order | Consequences |
| via-negativa | Scope reduction |
| opportunity-cost | Trade-offs |
| swot | Assessment |
| eisenhower-matrix | Task priority |
| one-thing | Focus |
| occams-razor | Simplicity |
| 10-10-10 | Time perspective |

## Supported Commands

- `/gsd:plan-phase`
- `/gsd:debug`
- `/gsd:define-requirements`
- `/gsd:discuss-phase`
- `/gsd:new-project`
