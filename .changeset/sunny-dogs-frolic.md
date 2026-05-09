---
type: Changed
pr: 3311
---
**`gsd-tools --json-errors` covers every error path** — every "Unknown <subsystem> subcommand" and missing-required-arg error now emits a typed `ERROR_REASON` code (`sdk_unknown_command` or `usage`) instead of the fallback `unknown`. Tests can now lock these paths via `JSON.parse(stderr).reason` without grepping the human message (#3310, builds on #3255).
