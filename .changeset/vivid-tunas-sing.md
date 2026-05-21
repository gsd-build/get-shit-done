---
type: Fixed
pr: 3800
---
Workflow routing-block strings now emit /gsd-<cmd> hyphen form — regression tests for #3646 confirm that routing lines in installed workflow files use the routable hyphen form, catching any future regression in the install-time normalizer.
