---
type: Changed
pr: 3074
---

**query CLI path extracted into a dedicated Query CLI Adapter Module** — `sdk/src/cli.ts` now delegates query-specific dispatch, error mapping, and output/exit handling to `sdk/src/query/query-cli-adapter.ts` for better locality and testability.
