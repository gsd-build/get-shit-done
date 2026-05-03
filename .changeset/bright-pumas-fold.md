---
type: Changed
pr: 3075
---

**query architecture deepening pass** — extracted Query Runtime Context, Native Dispatch Adapter, and Query CLI Output Modules so dispatch policy, runtime context policy, and CLI projection logic each live behind focused seams with higher locality and leverage.