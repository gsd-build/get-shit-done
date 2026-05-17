# Verification Overrides

Mechanism for intentionally accepting must-have failures when the deviation is known and acceptable. Prevents verification loops on items that will never pass as originally specified.

<override_format>

## Override Format

Overrides are declared in the VERIFICATION.md frontmatter under an `overrides:` key:

```yaml
---
phase: 03-authentication
verified: 2026-04-05T12:00:00Z
status: passed
score: 5/5
overrides_applied: 2
overrides:
  - must_have: "OAuth2 PKCE flow implemented"
    reason: "Using session-based auth instead — PKCE unnecessary for server-rendered app"
    accepted_by: "dave"
    accepted_at: "2026-04-04T15:30:00Z"
  - must_have: "Rate limiting on login endpoint"
    reason: "Deferred to Phase 5 (infrastructure) — tracked in ROADMAP.md"
    accepted_by: "dave"
    accepted_at: "2026-04-04T15:30:00Z"
---
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `must_have` | string | The must-have truth, artifact description, or key link being overridden. Does not need to be an exact match — fuzzy matching applies. |
| `reason` | string | Why this deviation is acceptable. Must be specific — not just "not needed". |
| `accepted_by` | string | Who accepted the override (username or role). Required. |
| `accepted_at` | string | ISO timestamp of when the override was accepted. Required. |

</override_format>

## When to Use

Overrides apply when a phase intentionally deviated from the original plan during execution — for example, a requirement was descoped, an alternative approach was chosen, or a dependency changed.

Without overrides, the verifier reports these as FAIL even though the deviation was intentional. Overrides let the developer mark specific items as `PASSED (override)` with a documented reason.

Overrides are appropriate when:
- A requirement changed after planning but ROADMAP.md hasn't been updated yet
- An alternative implementation satisfies the intent but not the literal wording
- A must-have is deferred to a later phase with explicit tracking
- External constraints make the original must-have impossible or unnecessary

## When NOT to Use

Overrides are NOT appropriate when:
- The implementation is simply incomplete — fix it instead
- The must-have is unclear — clarify it instead
- The developer wants to skip verification — that undermines the process
- Multiple must-haves are failing for the same phase — if more than 2-3 items need overrides, revisit the plan instead of overriding in bulk

<matching_rules>

## Matching Rules

Override matching uses **fuzzy matching**, not exact string comparison. This accommodates minor wording differences between how must-haves are phrased in ROADMAP.md, PLAN.md frontmatter, and the override entry.

### Matching Algorithm

1. **Normalize both strings:** case-insensitive comparison — lowercase both strings, strip punctuation, collapse whitespace
2. **Token overlap:** split into words, compute intersection
3. **Match threshold:** 80% token overlap in EITHER direction (override tokens found in must-have, OR must-have tokens found in override)
4. **Key noun priority:** nouns and technical terms (file paths, component names, API endpoints) are weighted higher than common words

### Examples

| Must-Have | Override `must_have` | Match? | Reason |
|-----------|---------------------|--------|--------|
| "User can authenticate via OAuth2 PKCE" | "OAuth2 PKCE flow implemented" | Yes | Key terms `OAuth2` and `PKCE` overlap, 80% threshold met |
| "Rate limiting on /api/auth/login" | "Rate limiting on login endpoint" | Yes | `rate limiting` + `login` overlap |
| "Chat component renders messages" | "OAuth2 PKCE flow implemented" | No | No meaningful token overlap |
| "src/components/Chat.tsx provides message list" | "Chat.tsx message list rendering" | Yes | `Chat.tsx` + `message` + `list` overlap |

### Ambiguity Resolution

If an override matches multiple must-haves, apply it to the **most specific match** (highest token overlap percentage). If still ambiguous, apply to the first match and log a warning.

</matching_rules>

<verifier_behavior>

## Verifier Behavior with Overrides

### Check Order

The override check happens **before marking a must-have as FAIL**. The flow is:

1. Evaluate must-have against codebase (Steps 3-5 of verification process)
2. If evaluation result is FAIL or UNCERTAIN:
   a. Check `overrides:` array in VERIFICATION.md frontmatter for a fuzzy match
   b. If override found: mark as `PASSED (override)` instead of FAIL
   c. If no override found: mark as FAIL as normal
3. If evaluation result is PASS: mark as VERIFIED (overrides are irrelevant)

### Output Format

Overridden items appear with distinct status in all verification tables:

```markdown
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can authenticate | VERIFIED | OAuth session flow working |
| 2 | OAuth2 PKCE flow | PASSED (override) | Override: Using session-based auth — accepted by dave on 2026-04-04 |
| 3 | Chat renders messages | FAILED | Component returns placeholder |
```

The `PASSED (override)` status must be visually distinct from both `VERIFIED` and `FAILED`. In the evidence column, include the override reason and who accepted it.

### Impact on Overall Status

- `PASSED (override)` items count toward the passing score, not the failing score
- A phase with all items either VERIFIED or PASSED (override) can have status `passed`
- Overrides do NOT suppress `human_needed` items — those still require human testing

### Frontmatter Score

The score and override count in frontmatter reflect applied overrides:

```yaml
score: 5/5  # includes 2 overrides
overrides_applied: 2
```

</verifier_behavior>

<creating_overrides>

## Creating Overrides

### Interactive Override Suggestion

When the verifier marks a must-have as FAIL and the failure looks intentional (e.g., alternative implementation exists, or the code explicitly handles the case differently), the verifier should suggest creating an override:

```markdown
### F-002: OAuth2 PKCE flow

**Status:** FAILED
**Evidence:** No PKCE implementation found. Session-based auth used instead.

**This looks intentional.** The codebase uses session-based authentication which achieves the same goal differently. To accept this deviation, add an override to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "OAuth2 PKCE flow implemented"
    reason: "Using session-based auth instead — PKCE unnecessary for server-rendered app"
    accepted_by: "{your name}"
    accepted_at: "{current ISO timestamp}"
```

Then re-run verification to apply.
```

### Override via gsd-tools

Overrides can also be managed through the verification workflow:

1. Run `/gsd:verify-work` — verification finds gaps
2. Review gaps — determine which are intentional deviations
3. Add override entries to VERIFICATION.md frontmatter
4. Re-run `/gsd:verify-work` — overrides are applied, remaining gaps shown

</creating_overrides>

<override_lifecycle>

## Override Lifecycle

### During Re-verification

When a phase is re-verified (e.g., after gap closure):
- Existing overrides carry forward automatically
- If the underlying code now satisfies the must-have, the override becomes unnecessary — mark as VERIFIED instead
- Overrides are never removed automatically; they persist as documentation

### At Milestone Completion

During `/gsd:audit-milestone`, overrides are surfaced in the audit report:

```
### Verification Overrides ({count} across {phase_count} phases)

| Phase | Must-Have | Reason | Accepted By |
|-------|----------|--------|-------------|
| 03 | OAuth2 PKCE | Session-based auth used instead | dave |
```

This gives the team visibility into all accepted deviations before closing the milestone.

### Cleanup

Stale overrides (where the must-have was later implemented or removed from ROADMAP.md) can be cleaned up during milestone completion. They are informational — leaving them causes no harm.

</override_lifecycle>

## Example VERIFICATION.md

```markdown
---
phase: 03-api-layer
verified: 2026-04-05T12:00:00Z
status: passed
score: 3/3
overrides_applied: 1
overrides:
  - must_have: "paginated API responses"
    reason: "Descoped — dataset under 100 items, pagination adds complexity without value"
    accepted_by: "dave"
    accepted_at: "2026-04-04T15:30:00Z"
---

## Phase 3: API Layer — Verification

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | REST endpoints return JSON | VERIFIED | curl tests confirm |
| 2 | Paginated API responses | PASSED (override) | Descoped — see override: dataset under 100 items |
| 3 | Authentication middleware | VERIFIED | JWT validation working |
```
