---
process_name: [PROCESS_NAME]
last_analyzed_commit: [COMMIT_HASH]
block_mode: soft
created_date: [DATE]
finding_counts:
  blocker: 0
  warning: 0
  watch: 0
related_smes: []
---

# [PROCESS_NAME] SME Document

## Process Overview

[Prose description of this process: what it does, who uses it, key invariants,
and the main code paths involved. Written by the creator agent after analysis.]

## Identified Risks

<!-- [BLOCKER] **Race condition in lock acquisition** — Concurrent requests can acquire the same
  lock ID when a shared resource reaches a boundary condition.
  *Evidence:* `src/path/to/service.ts:142` — lock check is not atomic; read and write happen in separate queries
  *Mitigation:* Wrap lock check and acquire in a database transaction using `SELECT FOR UPDATE` to prevent concurrent access -->

## Test Gaps

<!-- [WARNING] **No test for concurrent submission** — The concurrent-request path through the
  submission handler has no test coverage.
  *Evidence:* `tests/path/to/submission.test.ts:1` — only sequential single-request scenarios are tested
  *Mitigation:* Add an integration test that fires two simultaneous requests and asserts only one succeeds -->

## Outdated Logic

<!-- [WATCH] **Hardcoded legacy threshold value** — A business rule threshold is hardcoded as a
  magic number from a prior policy that may no longer apply.
  *Evidence:* `src/path/to/rules.ts:87` — value `2500` set during 2020 policy change, no comment explaining origin
  *Mitigation:* Extract to a named constant with a comment referencing the governing policy document; confirm value is still correct -->

## Edge Cases

<!-- [WARNING] **Empty input bypasses validation** — When the input collection is empty the
  validation loop exits immediately without checking required fields, allowing malformed records through.
  *Evidence:* `src/path/to/validator.ts:34` — `for...of` over empty array skips all checks
  *Mitigation:* Add an explicit guard before the loop: reject or return early with an error when the collection is empty -->

## Known Blockers

<!-- [BLOCKER] **Dependency on deprecated external API** — This process calls an endpoint marked
  deprecated in the upstream provider's changelog; the endpoint is scheduled for removal.
  *Evidence:* `src/path/to/client.ts:201` — calls `POST /v1/legacy/submit`; provider deprecation notice at https://example.com/changelog
  *Mitigation:* Migrate to `POST /v2/submit` before the deprecation deadline; update integration tests to target the new endpoint -->
