# Common Bug Patterns

Checklist of frequent bug patterns to scan before forming hypotheses. Ordered by frequency. Check these FIRST — they cover ~80% of bugs across all technology stacks.

<patterns>

## Null / Undefined Access

- **Null property access** — accessing property on `null` or `undefined`, missing null check or optional chaining
- **Missing return value** — function returns `undefined` instead of expected value, missing `return` statement or wrong branch
- **Destructuring null** — array/object destructuring on `null`/`undefined`, API returned error shape instead of data
- **Undefaulted optional** — optional parameter used without default, caller omitted argument

## Off-by-One / Boundary

- **Wrong loop bound** — loop starts at 1 instead of 0, or ends at `length` instead of `length - 1`
- **Fence-post error** — "N items need N-1 separators" miscounted
- **Inclusive vs exclusive** — range boundary `<` vs `<=`, slice/substring end index
- **Empty collection** — `.length === 0` falls through to logic assuming items exist

## Async / Timing

- **Missing await** — async function called without `await`, gets Promise object instead of resolved value
- **Race condition** — two async operations read/write same state without coordination
- **Stale closure** — callback captures old variable value, not current one
- **Initialization order** — event handler fires before setup complete
- **Leaked timer** — timeout/interval not cleaned up, fires after component/context destroyed

## State Management

- **Shared mutation** — object/array modified in place affects other consumers
- **Stale render** — state updated but UI not re-rendered, missing reactive trigger or wrong reference
- **Stale handler state** — closure captures state at bind time, not current value
- **Dual source of truth** — same data stored in two places, one gets out of sync
- **Invalid transition** — state machine allows transition missing guard condition

## Import / Module

- **Circular dependency** — module A imports B, B imports A, one gets `undefined`
- **Export mismatch** — default vs named export, `import X` vs `import { X }`
- **Wrong extension** — `.js` vs `.cjs` vs `.mjs`, `.ts` vs `.tsx`
- **Path case sensitivity** — works on Windows/macOS, fails on Linux
- **Missing extension** — ESM requires explicit file extensions in imports

## Type / Coercion

- **String vs number compare** — `"5" > "10"` is `true` (lexicographic), `5 > 10` is `false`
- **Implicit coercion** — `==` instead of `===`, truthy/falsy surprises (`0`, `""`, `[]`)
- **Numeric precision** — `0.1 + 0.2 !== 0.3`, large integers lose precision
- **Falsy valid value** — value is `0` or `""` which is valid but falsy

## Environment / Config

- **Missing env var** — environment variable missing or wrong value in dev vs prod vs CI
- **Hardcoded path** — works on one machine, fails on another
- **Port conflict** — port already in use, previous process still running
- **Permission denied** — different user/group in deployment
- **Missing dependency** — not in package.json or not installed

## Data Shape / API Contract

- **Changed response shape** — backend updated, frontend expects old format
- **Wrong container type** — array where object expected or vice versa, `data` vs `data.results` vs `data[0]`
- **Missing required field** — required field omitted in payload, backend returns validation error
- **Date format mismatch** — ISO string vs timestamp vs locale string
- **Encoding mismatch** — UTF-8 vs Latin-1, URL encoding, HTML entities

## Regex / String

- **Sticky lastIndex** — regex `g` flag with `.test()` then `.exec()`, `lastIndex` not reset between calls
- **Missing escape** — `.` matches any char, `$` is special, backslash needs doubling
- **Greedy overmatch** — `.*` eats through delimiters, need `.*?`
- **Wrong quote type** — string interpolation needs backticks for template literals

## Error Handling

- **Swallowed error** — empty `catch {}` or logs but doesn't rethrow/handle
- **Wrong error type** — catches base `Error` when specific type needed
- **Error in handler** — cleanup code throws, masking original error
- **Unhandled rejection** — missing `.catch()` or try/catch around `await`

## Scope / Closure

- **Variable shadowing** — inner scope declares same name, hides outer variable
- **Loop variable capture** — all closures share same `var i`, use `let` or bind
- **Lost this binding** — callback loses context, need `.bind()` or arrow function
- **Scope confusion** — `var` hoisted to function, `let`/`const` block-scoped

</patterns>

<usage>

## How to Use This Checklist

1. **Before forming any hypothesis**, scan the relevant categories based on the symptom
2. **Match symptom to pattern** — if the bug involves "undefined is not an object", check Null/Undefined first
3. **Each checked pattern is a hypothesis candidate** — verify or eliminate with evidence
4. **If no pattern matches**, proceed to open-ended investigation

### Symptom-to-Category Quick Map

| Symptom | Check First |
|---------|------------|
| "Cannot read property of undefined/null" | Null/Undefined Access |
| "X is not a function" | Import/Module, Type/Coercion |
| Works sometimes, fails sometimes | Async/Timing, State Management |
| Works locally, fails in CI/prod | Environment/Config |
| Wrong data displayed | Data Shape, State Management |
| Off by one item / missing last item | Off-by-One/Boundary |
| "Unexpected token" / parse error | Data Shape, Type/Coercion |
| Memory leak / growing resource usage | Async/Timing (cleanup), Scope/Closure |
| Infinite loop / max call stack | State Management, Async/Timing |

</usage>
