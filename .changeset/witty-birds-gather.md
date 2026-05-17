---
type: Fixed
pr: 3662
---
**`readSurface()` no longer silently degrades partial `.gsd-surface.json` to the `full` profile** — missing optional array fields (`disabledClusters`, `explicitAdds`, `explicitRemoves`) now default to `[]` so a hand-edited surface state with only some fields keeps working. Hard validation failures (malformed JSON, non-object root, missing/non-string/blank `baseProfile`, including whitespace-only) still return `null` but now emit a `console.warn` diagnostic naming the file and reason instead of failing silently. Unknown profile names in `baseProfile` (e.g. a typo like `"standrad"`) also warn — they were previously swallowed by `resolveProfile()`'s fallback-to-`full`. `writeSurface()` normalizes its input symmetrically — partial inputs are completed before being written, blank/non-string `baseProfile` throws `TypeError`, and unknown profile names warn — so the writer/reader asymmetry that produced the original bug cannot recur. (#3662)
