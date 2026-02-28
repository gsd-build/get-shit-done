# Phase 14: PR Restructure - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Split PR #762 into 2 focused PRs (PR B: resolve-model fix, PR C: autopilot feature), remove committed `.planning/` artifacts, coordinate with closed PR #761, and close #762 with a comment linking the replacements. PR A (tests+CI) is no longer needed since PR #763 already merged that content.

</domain>

<decisions>
## Implementation Decisions

### PR #762 Handling
- Close #762 and open 2 new PRs (not 3 — PR A absorbed by merged #763)
- Add closing comment to #762 with links to new PRs: "Split into #X, #Y per review feedback from @glittercowboy"
- Each new PR references #762 in its body: "Split from #762 per review feedback"

### PR #761 Coordination
- PR #761 was closed without merging — the resolve-model fix only exists in our branch
- No conflict risk since #761 never landed on main
- Credit @ChuckMayo in PR B body: "Also identified by @ChuckMayo in #761"

### Branch Strategy
- Rebase feat/autopilot onto main first (main now includes #763's test content)
- Fork both new branches from rebased feat/autopilot
- PR B: branch from feat/autopilot, remove all non-resolve-model files
- PR C: branch from feat/autopilot, remove `.planning/` artifacts, keep autopilot feature code
- PR B stays separate from PR C (reviewer explicitly asked for separation)

### PR Descriptions
- Follow repo's PR template: What / Why / Testing / Checklist / Breaking Changes
- Add extra section mapping which @glittercowboy review findings each PR addresses (point-by-point)
- Both PRs include test plan details

### Claude's Discretion
- Exact branch names for PR B and PR C
- Commit message wording for the rebase and cleanup
- How to structure the "review findings addressed" section in PR body
- Whether template.test.cjs goes into PR B or PR C

</decisions>

<specifics>
## Specific Ideas

- PR #763 (merged Feb 27) already landed tests+CI, so PR A is eliminated
- Repo has CODEOWNERS and a PR template at `.github/pull_request_template.md`
- The PR template requires: OS testing checkboxes, CHANGELOG updates for user-facing changes, GSD style compliance, Windows path testing

</specifics>

<deferred>
## Deferred Ideas

- Adding tests for the autopilot feature itself (reviewer noted as [MISSING]) — candidate for v1.4
- CHANGELOG.md updates for the autopilot feature — include in PR C if user-facing

</deferred>

---

*Phase: 14-pr-restructure*
*Context gathered: 2026-02-28*
