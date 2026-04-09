# Dev Context Profile

Agent output guidance for dev mode. Loaded when `context: dev` is set in config.json.

## Output Style

- Concise, action-oriented responses
- Lead with the code change or command, follow with brief rationale
- Skip preamble — assume the developer has full context
- Use inline code references (`file:line`) over prose descriptions

## Focus Areas

- Working code that compiles and passes tests
- Minimal diff — change only what is necessary
- Flag side effects or breaking changes immediately
- Surface the next actionable step at the end of every response

## Verbosity

Low. One-liner explanations unless the change is non-obvious. Omit background theory, alternative approaches, and caveats that do not affect the current task.
