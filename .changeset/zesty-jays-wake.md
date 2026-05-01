---
type: Fixed
pr: 2979
---
Managed JS hooks now resolve under GUI/minimal-PATH runtimes — installer emits process.execPath (absolute, quoted, forward-slash-normalized) as the runner for every .js hook command instead of bare node. See #2979.
