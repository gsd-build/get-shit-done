---
type: Fixed
pr: 3773
---
acquireStateLock no longer silently grants false-success lock acquisition on non-EEXIST openSync errors (EMFILE/EINTR/ENOSPC under load) — the error is now propagated to the caller, preventing two concurrent processes from simultaneously holding the same lock and producing lost-update STATE.md overwrites. (#3773)
