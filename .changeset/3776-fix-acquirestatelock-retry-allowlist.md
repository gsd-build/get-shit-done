---
type: Fixed
pr: 3777
---
acquireStateLock and withPlanningLock now retry on transient Docker overlay-fs (ENOENT/EINVAL/EIO) and NFS (ESTALE) errno codes in addition to the existing EPERM/EBUSY; truly fatal codes (EMFILE/ENOSPC/EROFS/EACCES) still throw immediately. Closes #3776.
