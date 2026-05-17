---
type: Added
pr: 3558
---
**`executeForCjs` synchronous primitive on the SDK runtime bridge** — new sync entry point at `@gsd-build/sdk/dist/runtime-bridge-sync` that lets CJS callers (the `gsd-tools.cjs` dispatcher and per-family `*-command-router.cjs` files) invoke SDK query handlers in-process without spawning a subprocess and without breaking the synchronous CJS contract that ~21 CJS test files and 100+ consumers depend on. Implemented with `synckit` (Atomics.wait on a SharedArrayBuffer in a pooled Worker thread). First-call cost ~80ms (Worker startup + native bridge construction); steady-state ~0.1ms per call after the Worker warms. Returns a typed sync result `{ ok, data | errorKind, exitCode, errorDetails?, stderrLines }` aligned with the ADR-0001 Dispatch Policy Module error taxonomy. Foundation for the Phase 5 per-family CJS router migrations (state.*, verify.*, init.*, phase.*, phases.*, validate.*, roadmap.*, frontmatter.*, config.*) that follow as separate enhancements.
