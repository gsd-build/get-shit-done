---
type: Fixed
issue: 3591
---
**`createGSDToolsRuntime` now forwards the workstream to native registry dispatch** — the closure passed to `QueryNativeDirectAdapter.dispatch` previously called `registry.dispatch(command, args, projectDir)` and silently dropped `opts.workstream`. As a result, GSDTools-native query handlers ran against the root `.planning/` tree even when the GSDTools instance was created with a `workstream`. The closure now passes `opts.workstream` as the 4th argument, matching the `QuerySubprocessAdapter` path that already forwards it. Every native dispatch through the runtime bridge now routes planning-path queries to `.planning/workstreams/<name>/` when a workstream is set.
