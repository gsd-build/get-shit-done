---
type: Fixed
pr: 2998
---
gsd-pristine/ is now populated by the installer when local patches are detected — saveLocalPatches calls a new populatePristineDir helper that runs the install transform pipeline into a tmp staging dir and copies modified files into pristineDir. The reapply-patches Step 5 verifier no longer falls back to its over-broad heuristic. See #2998.
