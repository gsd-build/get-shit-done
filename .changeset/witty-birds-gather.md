---
type: Fixed
pr: 3662
---
**`readSurface()` no longer silently degrades partial `.gsd-surface.json` to the `full` profile** — missing optional array fields (`disabledClusters`, `explicitAdds`, `explicitRemoves`) now default to `[]` so a hand-edited surface state with only some fields keeps working. Hard validation failures (malformed JSON, non-object root, missing/non-string `baseProfile`) still return `null` but now emit a `console.warn` diagnostic naming the file and reason instead of failing silently. `writeSurface()` normalizes its input symmetrically — partial inputs are completed before being written, and an empty/missing `baseProfile` throws — so the writer/reader asymmetry that produced the original bug cannot recur. (#3662)
