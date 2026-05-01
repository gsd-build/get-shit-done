---
type: Added
pr: 2982
---
Extended no-source-grep lint to catch var-binding readFileSync.includes() pattern. Tests now fail when source-grep is hidden behind a parser wrapper. See #2982.
