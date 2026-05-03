---
type: Added
pr: TBD
---
**Post-push pipeline polling for `/gsd-ship` and `/gsd-complete-milestone`** — `/gsd-ship` now captures the new pipeline ID after `git push`, polls via `ScheduleWakeup` (30s × 30 max, 15-min cap), and refuses to mark the phase shipped if the pipeline ends in `failed`/`canceled`. Failed-job names + last ~50 lines of trace are surfaced inline. Override available via `/gsd-ship --ignore-pipeline` (auditable in SUMMARY.md). `/gsd-complete-milestone` adds a strict tag-push gate: refuses to push a `vX.Y.0` tag while the most recent `main` pipeline is non-success — no override (tags trigger prod deploys in many setups). Backwards-compatible — old phases without pipeline state still ship; commits with `[ci skip]` skip polling.
