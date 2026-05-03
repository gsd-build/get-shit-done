---
type: Changed
pr: 3065
---

**Dispatch policy seam now returns a structured result contract** across native and fallback query execution paths (`ok`, typed error `kind`, `details`, and final `exit_code`), with CLI consuming the unified result instead of mixed throw/result handling.