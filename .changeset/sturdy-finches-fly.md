---
type: Fixed
pr: 3261
---
**`buildStateFrontmatter` now counts nested `plans/<N>-PLAN-<NN>-<slug>.md` files** — repos using the nested layout (post-#3139) no longer get `progress.*` counters silently overwritten downward on every state mutation. Sibling fix to #3115/#3139/#3191.
