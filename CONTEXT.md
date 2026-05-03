# Context

## Domain terms

### Dispatch Policy Module
Module owning dispatch error mapping, fallback policy, timeout classification, and CLI exit mapping contract.

Canonical error kind set:
- `unknown_command`
- `native_failure`
- `native_timeout`
- `fallback_failure`
- `validation_error`
- `internal_error`

### Command Definition Module
Canonical command metadata Interface powering alias, catalog, and semantics generation.

### Query Runtime Context Module
Module owning query-time context resolution for `projectDir` and `ws`, including precedence and validation policy used by query adapters.

### Native Dispatch Adapter Module
Adapter Module that satisfies native query dispatch at the Dispatch Policy seam, so policy modules consume a focused dispatch Interface instead of closure-wired call sites.

### Query CLI Output Module
Module owning projection from dispatch results/errors to CLI `{ exitCode, stdoutChunks, stderrLines }` output contract.

### Query Command Resolution Module
Canonical command normalization and resolution Interface (`query-command-resolution-strategy`) used by internal query/transport paths after dead-wrapper convergence.
