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
