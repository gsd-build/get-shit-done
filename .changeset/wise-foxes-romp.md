---
type: Fixed
pr: 3189
---
Task→Agent dispatcher rename complete across 24 command allowed-tools lists, 29 workflow files (~133 call sites), and 1 agent tools frontmatter. Orchestrators no longer fall back to inline execution on runtimes where Task is not available. Fixes #3168.
