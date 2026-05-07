---
type: Security
pr: 3215
---
**Package legitimacy gate added** — GSD now runs slopcheck against every researcher-recommended package before it enters RESEARCH.md; slopsquatted ([SLOP]) packages are removed at the source and suspicious ([SUS]) or assumed ([ASSUMED]) packages force a `checkpoint:human-verify` task before the executor installs them. The `npx --yes` auto-download pattern is replaced with a `command -v` guard across all three agent files, and executor RULE 3 explicitly excludes package-manager installs from auto-fix scope.
