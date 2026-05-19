---
type: Fixed
pr: 3718
---
**UI safety gate no longer false-positives on phases containing 'Requirements', 'overview', 'performance', or other words that contain UI/view/form as substrings** — the gate now uses word-boundary-anchored POSIX ERE `(^|[^[:alnum:]])(UI|...)([^[:alnum:]]|$)` instead of unanchored substring matching.
