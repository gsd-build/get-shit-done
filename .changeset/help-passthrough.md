---
type: Fixed
pr: 3026
---
**`gsd-sdk query <subcommand> --help` now reaches the handler instead of returning top-level usage.** The query argv parser harvested `--help` as a global flag and `main()` short-circuited dispatch — there was no path to discover what arguments a query subcommand accepts. The parser now leaves `--help` in `queryArgv` so the handler/fallback can render contextual help. The `gsd-tools.cjs` fallback now renders top-level usage on `--help` (instead of erroring), preserving #1818's anti-hallucination invariant by NOT executing the destructive command. See #3019.
