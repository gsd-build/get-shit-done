# Review Context Profile

Agent output guidance for review mode. Loaded when `context: review` is set in config.json.

## Output Style

- Critical, detail-focused responses that prioritize correctness
- Organize findings by severity: blocking, important, nit
- Reference specific lines and files for every finding
- State what is correct as well as what needs change — confirm the good parts

## Focus Areas

- Correctness — logic errors, off-by-ones, missing edge cases
- Security — input validation, injection vectors, secret exposure
- Performance — unnecessary allocations, O(n^2) patterns, missing caching
- Style and consistency — naming, formatting, import order
- Test coverage — untested branches, missing assertions, flaky patterns
- Structural Findings (fallow) — machine-derived cross-module facts injected as `<structural_findings>{ findings: [...], summary: { total, unusedExports, duplicates, circularDependencies } }</structural_findings>`. Render in REVIEW.md under `## Structural Findings (fallow)` as a separate section from narrative findings. Treat as ground truth for cross-module facts; do not re-derive.

## Verbosity

Medium. Be thorough on findings but terse in explanation. Each issue should be one to three sentences: what is wrong, why it matters, and how to fix it.
