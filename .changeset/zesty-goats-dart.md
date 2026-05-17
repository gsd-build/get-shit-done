---
type: Changed
pr: 3487
---
**ADR and PRD files now use issue#-prefix slug naming** (`docs/adr/<issue#>-<slug>.md`, `docs/prd/<issue#>-<slug>.md`). The legacy local-compute sequential scheme (`NNNN-*`) is retained for the existing `docs/adr/0001-*` through `0011-*` files as immutable historical record but cannot be used for new ADRs/PRDs — collisions where two parallel PRs picked the same number prompted the change. See CONTRIBUTING.md "Proposing an ADR or PRD" for the full process.
