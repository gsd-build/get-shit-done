---
type: Added
pr: 3304
---
gsd-tools --json-errors mode: all error paths now emit structured JSON ({ok, reason, message}) when invoked with --json-errors or GSD_JSON_ERRORS=1 — tests can assert on typed reason codes instead of grepping stderr text
