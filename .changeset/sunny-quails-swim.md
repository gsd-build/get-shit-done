---
type: Fixed
pr: 3801
---
**`gsd-pristine/` no longer overwrites old-release bytes with new-release content on upgrade** — the installer now preserves existing correct pristine entries (sha256 matches old-release hash) instead of wiping and re-populating from the new release source, eliminating the `OK_PRISTINE_DRIFT_DETECTED` fallback on every upgrade where an upstream file changed.
