---
type: Fixed
pr: 3429
---
**`/gsd:debug` frontmatter parses correctly** — `argument-hint` value is now double-quoted so YAML doesn't interpret the bracketed flag list as a malformed flow sequence. Previously the command's frontmatter loaded with empty metadata silently.
