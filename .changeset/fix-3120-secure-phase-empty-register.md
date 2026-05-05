---
type: Fixed
pr: 3142
---
**`secure-phase` no longer rubber-stamps SECURITY.md for legacy phases with no `<threat_model>` blocks** — Step 3's short-circuit previously exited to Step 6 (write clean SECURITY.md) whenever `threats_open: 0`, regardless of whether zero threats meant "all mitigated" or "none were ever written". Legacy phases authored before `<threat_model>` blocks became canonical now trigger **retroactive-STRIDE mode** in Step 5: the auditor builds a register from implementation files before verifying mitigations. Step 2c now tracks `register_authored_at_plan_time` and Step 3 gates the skip on both `threats_open: 0 AND register_authored_at_plan_time: true`. Closes #3120.
