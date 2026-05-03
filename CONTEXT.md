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

### Query Execution Policy Module
Module owning query transport routing policy projection (`preferNative`, fallback policy, workstream subprocess forcing) at execution seam.

### Query Subprocess Adapter Module
Adapter Module owning subprocess execution contract for query commands (JSON/raw invocation, `@file:` indirection parsing, timeout/exit error projection).

### Query Command Resolution Module
Canonical command normalization and resolution Interface (`query-command-resolution-strategy`) used by internal query/transport paths after dead-wrapper convergence.

### Command Topology Module
Module owning command resolution, policy projection (`mutation`, `output_mode`), unknown-command diagnosis, and handler Adapter binding at one seam for query dispatch.

### Query Pre-Project Config Policy Module
Module policy that defines query-time behavior when `.planning/config.json` is absent: use built-in defaults for parity-sensitive query Interfaces, and emit parity-aligned empty model ids for pre-project model resolution surfaces.
