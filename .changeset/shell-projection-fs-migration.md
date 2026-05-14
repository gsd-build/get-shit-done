---
type: Changed
pr: 3467
---
Migrate all file I/O call sites to the shell-command-projection seam (`platformWriteSync`, `platformReadSync`, `platformEnsureDir`). Consolidates write atomicity, line-ending normalization, directory creation, and read null-safety. The seam owns `.md` normalization automatically — `normalizeMd` is dropped at every write site that used it as a pre-call. See #3467.
