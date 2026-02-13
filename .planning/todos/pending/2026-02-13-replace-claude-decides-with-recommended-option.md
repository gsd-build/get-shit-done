---
created: 2026-02-13T15:24
title: Replace "Claude decides" with recommended option in discuss phase
area: commands
files:
  - commands/gsd/discuss-phase.md
  - agents/gsd-discuss-researcher.md
---

## Problem

During the discuss phase, when presenting gray area options to the user via `AskUserQuestion`, there's a pattern where "Claude decides" (or equivalent delegation) appears as an option. This undermines user agency — the user should always understand what they're choosing.

Instead, Claude should analyze the options, form a recommendation, and present that recommendation as the first option with a "(Recommended)" suffix. The user still sees all choices and understands the reasoning, but gets a clear signal of which option Claude thinks is best for their context. This keeps the user in control while reducing decision fatigue.

## Solution

TBD — likely involves:
- Updating `commands/gsd/discuss-phase.md` to instruct the agent to always form a recommendation before presenting options
- Removing any "Claude decides" / "Let Claude choose" option patterns
- Adding the first option as Claude's recommended choice with "(Recommended)" label
- Optionally adding a brief rationale for why it's recommended in the option description
- Updating `agents/gsd-discuss-researcher.md` if the researcher generates option sets that include delegation patterns
