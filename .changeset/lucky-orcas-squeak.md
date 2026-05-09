---
type: Fixed
pr: 3307
---
`/gsd-capture --backlog` now applies the `project_code` prefix when creating the phase directory, matching `phase.add` and `phase.insert`. Projects with `project_code: "CK"` produce `CK-999.1-foo` instead of `999.1-foo`. No behavior change for projects without `project_code` set.
