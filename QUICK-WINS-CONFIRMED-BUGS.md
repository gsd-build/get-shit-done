# Quick Wins: Confirmed-Bug Fixes

**Status**: Active  
**Started**: 2026-05-16  
**Owner**: Current session (Grok + user)  
**Context**: Follow-up to `/gsd-inbox` triage on 2026-05-16

## Goal

Land 6 high-signal, confirmed-bug issues that currently have **zero open pull requests**. These are the cleanest quick-win opportunities available in the public GitHub inbox right now.

All six issues carry the `confirmed-bug` label, meaning the bug has been verified and a fix is explicitly welcome.

## The 6 Issues (Prioritized)

| # | Issue | Short Title | Type | Recommended Flow | Est. Effort | Status | Notes |
|---|-------|-------------|------|------------------|-------------|--------|-------|
| 1 | [#3583](https://github.com/gsd-build/get-shit-done/issues/3583) | Claude skill install leaves `/gsd:<cmd>` in `SKILL.md` body | Installer / Command namespace | PR 3629 (our branch) + competing 3586 | Small (1 file + test) | PR opened / Review | **Leading PR: 3629** (cristianuibar) — reviewed + hardened with CodeRabbit feedback (left-boundary regex + body-scoped guard). Competing PR 3586 has "needs changes" + "ci: failing". Issue still carries `confirmed-bug`. |
| 2 | [#3579](https://github.com/gsd-build/get-shit-done/issues/3579) | `build-hooks.js` + npm publish omit graphify auto-update hook | Packaging / Build | `/gsd-quick` | Small | Not started | Classic "new feature missed in release artifact". Easy local verification. |
| 3 | [#3496](https://github.com/gsd-build/get-shit-done/issues/3496) | `/gsd:update` changelog extraction skips intermediate versions | Workflow / Update logic | `/gsd-quick` or lightweight plan | Medium-small | Not started | Needs deterministic version-range helper. |
| 4 | [#3588](https://github.com/gsd-build/get-shit-done/issues/3588) | Production `npm audit` has 1 high + 5 moderate advisories | Security / Dependencies | Direct + careful review | Medium | Not started | Transitive via `@anthropic-ai/claude-agent-sdk`. May need overrides. |
| 5 | [#3584](https://github.com/gsd-build/get-shit-done/issues/3584) | Runtime `bin/lib/*.cjs` still emit `/gsd:<cmd>` (larger piece deferred from #3583) | Runtime output / Slash formatter | Short plan first, then execute | Medium-Large | Not started | 16+ files. Design a centralized runtime-aware formatter. Do after #3583. |
| 6 | [#3340](https://github.com/gsd-build/get-shit-done/issues/3340) | SDK publish lag — agent dir fix never shipped in `@gsd-build/sdk@0.1.0` | Release / SDK publishing | Plan + coordination | Medium (release-focused) | Not started | Oldest. Mostly a publishing/versioning task. |

## Execution Rules for This Batch

- **Branch naming**: `fix/NNNN-short-description` (enforced by CI)
- **PR template**: Must use `.github/PULL_REQUEST_TEMPLATE/fix.md`
- **Linking**: `Fixes #NNNN` (or `Closes`) in the PR body
- **Changeset**: Required for all user-facing or security fixes
- **Testing**: All existing tests must pass + new coverage where the issue describes a gap
- **Clean context windows**: Each fix should preferably be driven from a fresh session using the prepared prompts (see session notes or ask for them)
- **GSD self-use**: For the small ones (#3583, #3579, #3496), using `/gsd-quick` (or `/gsd-fast`) inside the fix session is encouraged and appropriate. For #3584, a short planning step is recommended.

## Status Legend

- **Not started** — Issue claimed for this batch, no work begun
- **In progress** — Active work in a clean window
- **PR opened** — Pull request created and linked
- **Review** — Awaiting review / CI / merge fixes
- **Merged** — Landed on main
- **Blocked** — Needs input from maintainers or upstream

## Current Status

- [x] #3583 — **PR opened** (3629 leading after CodeRabbit review + hardening push; competing 3586 needs changes + CI failing)
- [ ] #3579 — Not started (cleanest next target — 0 PRs)
- [ ] #3496 — PR 3497 open (changes requested)
- [ ] #3588 — Not started
- [ ] #3584 — Not started (larger; deferred runtime cjs colon emissions)
- [ ] #3340 — Not started

**Progress**: 0 / 6 merged (1 in active review)

## Process Notes

- These issues were identified during a `/gsd-inbox` run on 2026-05-16.
- At the time of creation of this file, zero of the six had open PRs.
- 2026-05-16 Grok session: Reviewed PR 3629 (our #3583 fix) for CodeRabbit comments. 1 critical was false-positive (scripts/ *is* published per package.json "files" + npm pack). Applied the 2 valid suggestions (bidirectional word-boundary lookbehind in `buildColonPattern` + body-only scope for the colon-ref regression guard in the test). Tests pass. Pushed hardening commit to the fork branch. Competing PR 3586 exists but is behind on CI/review status.
- Work is intended to be done in **parallel clean context windows** (one issue per fresh Claude/Codex/Gemini session) using dedicated prompts.
- After each fix is complete in its window, the resulting branch + PR description should be brought back here for final review and opening.
- This file serves as the single source of truth for the current batch while execution is in progress. It can be deleted or moved to `docs/archive/` once all six PRs are merged.

## Related Artifacts

- Inbox triage report: `/tmp/GSD-INBOX-TRIAGE-2026-05-16.md` (from the `/gsd-inbox` run)
- Full issue list with `confirmed-bug` label: `gh issue list --state open --label confirmed-bug`

---

**Next action**: #3583 now has active PR(s) under review. Next clean quick win (0 PRs, small packaging effort, high value for recently-landed graphify feature): **#3579**. Validated via GitHub search: no PRs mention 3579. Ready for `/gsd-quick` or direct fix (update `scripts/build-hooks.js` HOOKS_TO_COPY + ensure `hooks/lib/` copy in installer + fix any publish filter).

This document will be updated as status changes.