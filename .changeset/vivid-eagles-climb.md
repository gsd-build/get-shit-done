---
type: Fixed
pr: 3767
---
**`verify-reapply-patches` no longer false-fails when `gsd-pristine/` has been refreshed to a newer version** — the verifier now reads `pristine_hashes` from `backup-meta.json` and validates each on-disk pristine file's SHA-256 before using it as a diff baseline; when a mismatch is detected (indicating the snapshot was overwritten by a later GSD update after the backup was captured), the file is reported as `ok` with reason `ok_pristine_drift_detected` rather than producing spurious `fail_user_lines_missing` failures for every line the upstream removed between the two versions.
