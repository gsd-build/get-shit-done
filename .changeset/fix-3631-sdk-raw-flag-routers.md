---
type: Fixed
pr: 3631
---
**SDK dispatch path in family routers now honours `--raw`** — `phase next-decimal --raw`, `roadmap get-phase --raw`, and other family-router commands that route through the SDK bridge now emit the same scalar string the CJS path emitted before #3577. Routers request `mode: 'raw'` from the bridge under `--raw`; the sync-bridge worker wires `formatNativeRaw` to `formatQueryRawOutput` so the bridge returns the per-command projection. Routers then pass the formatted string through `output()`'s rawValue branch instead of JSON-stringifying it.
