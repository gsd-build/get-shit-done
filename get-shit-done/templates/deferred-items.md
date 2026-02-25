# Deferred Items

Items discovered during execution that are outside current task scope. Captured for future planning.

## Format

Each entry records what was found, where it was found, and why it was deferred.

## Items

| # | Discovered During | Description | Category | Priority Estimate |
|---|-------------------|-------------|----------|-------------------|
| 1 | {phase}-{plan} Task N | [What was discovered] | [bug / enhancement / refactor / feature / optimization] | [low / medium / high] |

## Notes

- Items here were logged by executor Rule 5 (defer out-of-scope discoveries)
- Review during next planning cycle to decide whether to incorporate into future plans
- High-priority items may warrant their own plan; low-priority items may be batched
