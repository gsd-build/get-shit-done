---
type: Changed
pr: 3042
---
**`/gsd-research-phase` consolidated into `/gsd-plan-phase --research-phase <N>`** — the standalone research command's slash-command stub was never registered (#3042). Rather than restore the orphan, the research-only capability now lives as a flag on `/gsd-plan-phase`. New modifiers: `--view` prints existing `RESEARCH.md` to stdout without spawning, `--research` forces refresh, otherwise prompts `update / view / skip` when `RESEARCH.md` already exists. Also scrubs four other stale slash-command references (`/gsd-check-todos`, `/gsd-new-workspace`, `/gsd-status`, residual `/gsd-plan-milestone-gaps`) across English + 4 localized doc sets (#3044). Closes #3042 and #3044.
