---
type: Fixed
pr: 3275
---
state-snapshot no longer returns wrong status and other fields when STATE.md body contains a Markdown table cell with bold field syntax (e.g. **Status:** in a task history row) — YAML frontmatter values now take precedence over body extraction for all canonical scalar fields.
