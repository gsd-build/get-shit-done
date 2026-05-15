---
type: Fixed
pr: 3577
---
**SDK validation errors no longer surface as native_failure** — the runtime-bridge-sync worker now unwraps GSDError causes wrapped in GSDToolsError. Empty/invalid command arguments produce errorKind: 'validation_error' (exit 10) as the SyncErrorKind taxonomy promises, instead of the misleading errorKind: 'native_failure'. Detected by new Phase 6 behavioral contract tests.
