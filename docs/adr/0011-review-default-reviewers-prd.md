# PRD — `review.default_reviewers` config key for `/gsd-review` reviewer selection

- **Status:** Draft
- **Date:** 2026-05-13
- **Issue:** `#3079`
- **Related ADR:** `0011-review-default-reviewers.md`

> This PRD is filed alongside its ADR under `docs/adr/` for co-location. The repo does not yet have a `docs/prd/` directory; if maintainers prefer one, this file can move there with the `0011-` prefix preserved.

## TL;DR

`/gsd-review` with no flags fans out to **every** detected CLI reviewer (Claude, Codex, Cursor, Gemini, OpenCode, plus local model servers such as ollama, lm-studio, llama.cpp). For users with many backends installed, this wastes wall-clock on timeouts and burns tokens on reviewers they don't want for routine work. Add a `review.default_reviewers` key under the existing `review.*` namespace in `.planning/config.json` that scopes the no-flag default to a user-chosen subset. Absent key preserves today's behavior. `--all` and individual flags continue to work unchanged. Follows GSD's **absent = enabled** convention.

## Problem Statement

GSD's `/gsd-review` workflow treats "no flags" as "invoke every CLI we can detect" (`workflows/review.md` line 52). That default is fine at install time — it makes the feature discoverable — but it's the wrong default for any user who has accumulated multiple reviewer CLIs plus local model servers. Each review probes up to ~10 backends, including ones that are slow, expensive, redundant for the change at hand, or not actually running (timeout waits on ollama, lm-studio, llama.cpp when the daemon is off).

The only existing workaround is editing `workflows/review.md` in place. That patch gets clobbered on every `/gsd-update`, requiring `/gsd-update --reapply` to restore. There is no machine-readable record of the user's intent — every machine the user works on needs the same patch reapplied. The issue reporter (`#3079`) and presumably others are paying a "tax" on every review that is purely a default-selection problem.

This is a small change with broad reach: it lands in a hot-path workflow that power users run many times per day.

## Goals

- Eliminate the recurring local-patch tax for multi-CLI users. A user who consistently wants only Gemini + Codex for routine reviews should be able to set that once and forget it.
- Cut median wall-clock time of a no-flag `/gsd-review` on multi-CLI machines (target: ≥40% reduction for users with ≥4 detected CLIs).
- Keep the change non-breaking. Absent config = today's behavior; nothing changes for the install-day experience.
- Match GSD's established config conventions (`review.models.*`, `review.*_host`, **absent = enabled**, namespacing under `review.*`) so users don't have to learn a new pattern.
- Stay one-line-shaped. The implementation should be a config read plus an intersection with the detected set — no new commands, no schema overhaul, no migration.

## Non-Goals

- **Per-phase or per-task reviewer routing** (e.g., "use Codex on Rust phases, Gemini on docs"). Useful, but a separate, larger design — track as a future ADR.
- **Reviewer scoring, weighting, or ensemble logic.** This is about *which* reviewers run, not *how* their output is aggregated.
- **Auto-detecting the "best" default reviewers based on usage history.** Out of scope; we want explicit user intent, not silent behavior drift.
- **Changing the `--all` semantics or the individual flag set** (`--gemini`, `--codex`, `--cursor`, …). They keep their current meaning.
- **A new top-level config namespace.** Reviewers belong under the existing `review.*` namespace.
- **GUI / TUI editing of the key in v1.** Editing the JSON file directly (or via `/gsd-settings` / `/gsd-config --integrations` if maintainers choose to support it later) is sufficient.

## Users & Use Cases

### Primary persona: "Multi-CLI power user"

A developer who has installed multiple coding CLIs (e.g., Claude Code, Codex, Gemini CLI, Cursor, OpenCode, Kilo) plus one or more local inference servers. They run `/gsd-review` frequently — sometimes dozens of times per day during a sprint — and have a stable mental model of which 1–3 reviewers actually add signal for their day-to-day work.

### Secondary persona: "Single-CLI user with a sometimes-on local server"

Has Claude + ollama installed. Wants reviews from Claude every time, and from ollama only when explicitly asked. Today, every `/gsd-review` pays the ollama timeout cost when ollama isn't running.

### Secondary persona: "Cost-sensitive team lead"

Routine reviews should hit cheap/local reviewers; pre-merge reviews should hit the expensive ones via `--all` or explicit flags. Wants a config-level expression of "the cheap subset is my default."

### Use cases this enables

- "I only want Gemini + Codex for routine reviews." → set `review.default_reviewers: ["gemini", "codex"]`.
- "I want Claude only by default, and I'll opt into the others with flags." → set `["claude"]`.
- "I want today's behavior." → leave the key absent.
- "I want today's behavior just this once" on a configured project → `/gsd-review --all`.

## User Stories

Grouped by persona, ordered roughly by frequency.

**Multi-CLI power user**

- As a multi-CLI user, I want to declare which reviewers run by default so that `/gsd-review` doesn't probe backends I don't use.
- As a multi-CLI user, I want my preference to survive `/gsd-update` so I don't have to keep re-patching `workflows/review.md`.
- As a multi-CLI user, I want `--all` to still work so I can opt into a full review pre-merge without un-setting my config.
- As a multi-CLI user, I want individual flags (`--gemini`, `--cursor`, …) to keep working regardless of my default so ad-hoc runs aren't constrained by the default.

**Single-CLI user with sometimes-on local server**

- As a user with intermittent local servers, I want my default to exclude them so a stopped daemon doesn't cost me a 30-second timeout on every review.

**Cost-sensitive team lead**

- As a team lead, I want to commit `.planning/config.json` to the repo so everyone on the team gets the same review defaults.

**New user**

- As a new user, I want today's behavior preserved so the feature still "just works" out of the box without config.

**Edge cases**

- As a user with a typo in my default list, I want a clear warning that names an unknown reviewer rather than a silent skip.
- As a user whose configured reviewer is no longer installed, I want a clear note that it was dropped from this run.
- As a user who lists only reviewers that aren't installed, I want a clear error or a documented fallback (see Open Questions).

## Requirements

### Must-Have (P0)

- **P0-1. New config key.** `review.default_reviewers` is `string[]`. Each element validates against the existing slug pattern `^[a-zA-Z0-9_-]+$`. Schema parser accepts the key; rejects non-array or non-string-element values with a clear error. Empty array `[]` behavior is decided per Q-1.
- **P0-2. No-flag honors the key.** Given the key is `["gemini", "codex"]` and both are detected, running `/gsd-review` invokes only Gemini and Codex.
- **P0-3. Absent key preserves current behavior.** Given the key is unset, running `/gsd-review` runs every detected reviewer, identical to today.
- **P0-4. `--all` overrides the config.** Given the key is `["gemini"]`, running `/gsd-review --all` invokes every detected reviewer. Verbose mode shows which reviewers came from `--all` vs. the default.
- **P0-5. Individual flags override the config.** Given the key is `["gemini"]`, running `/gsd-review --cursor` invokes only Cursor. Running `/gsd-review --gemini --codex` invokes exactly those two regardless of the default.
- **P0-6. Graceful slug handling.** Unknown slug → start-of-run warning naming the offending slug; run continues with valid entries. Known slug but undetected → info-level note; run continues. Zero post-filter selections → error per Q-1.
- **P0-7. Docs updated.** `docs/CONFIGURATION.md` gets a `review.*` subsection (or an extension of an existing one) covering the new key. `workflows/review.md` references the key in the no-flag branch. Schema example at the top of `docs/CONFIGURATION.md` includes the key.
- **P0-8. Tests.** Unit and integration coverage per the test list in the ADR's **Tests expected to move with the seam** section.

### Nice-to-Have (P1)

- **P1-1.** `/gsd-config --integrations` extends to set `review.default_reviewers` interactively, aligning with the existing interactive config flow for reviewers.
- **P1-2.** `--no-default` flag that runs the full detected set without `--all` semantics — slightly different intent expression. Drop if equivalent to `--all` (Q-2).
- **P1-3.** Verbose-mode "selection source" line in `/gsd-review` output: `Running reviewers (default): gemini, codex (set in .planning/config.json)`.
- **P1-4.** Per-command override env var (`GSD_REVIEW_DEFAULT=...`) for CI scenarios where mutating `config.json` is undesirable.

### Future Considerations (P2)

- **P2-1.** Per-phase or per-file-type reviewer profiles (`review.profiles.frontend: ["claude", "cursor"]`). The shape of `default_reviewers` is deliberately chosen not to foreclose this — a future `review.profiles.*` map can coexist.
- **P2-2.** Reviewer "groups" or aliases (`review.groups.cheap = ["ollama", "gemini-flash"]`). Same — leave room under `review.*`.
- **P2-3.** Auto-suggestion that detects repeated flag patterns and offers to persist them. Natural follow-up but explicitly out of scope here.

## Behavior Specification

### Precedence (highest first)

1. Individual reviewer flags (`--gemini`, `--codex`, `--cursor`, …) — always win.
2. `--all` — full detected set, ignores config.
3. `review.default_reviewers` in config — subset, intersected with detected set.
4. No config, no flags — full detected set (today's behavior).

This matches the principle of least surprise: explicit user input (flags) always wins over persisted preference (config), and persisted preference only fills the gap when the user hasn't said anything else.

### Resolution pseudocode

```text
detected = detect_clis()                  # unchanged
if any individual flag passed:
    selected = flags_to_set(flags) ∩ detected
elif --all:
    selected = detected
elif config.review.default_reviewers is set:
    valid    = filter(config.review.default_reviewers, is_known_slug)
    # warn on each invalid slug
    selected = valid ∩ detected
    # info on each valid-but-undetected slug
    if selected is empty:
        error with actionable message      # see Q-1
else:
    selected = detected                    # today's behavior
```

### Validation

- Slug pattern: `^[a-zA-Z0-9_-]+$` (already in use for `review.models.<cli>`).
- Type: JSON array of strings; anything else → schema error at config load.
- Empty array: see Q-1 (proposed: schema error).
- Slug case normalization: lowercase-on-read.
- Duplicates: de-dup silently.

### Logging

- One line per `/gsd-review` start identifying the source of selection (default config / `--all` / explicit flags / no config). Surfaced under `--verbose` per Q-5.
- Slug warnings/infos as described in P0-6.

## Success Metrics

### Leading indicators (1–4 weeks post-release)

- **Adoption proxy.** Count of `.planning/config.json` files containing `review.default_reviewers` (only countable if/when GSD ever ships opt-in telemetry; otherwise qualitative via Discussions).
- **Issue echo.** Closure of `#3079` and zero new issues reporting the same wipe-on-update problem within 60 days.
- **Patch-removal proxy.** Maintainer observes no further PRs or Discussion threads about patching `workflows/review.md` defaults within 60 days.

### Lagging indicators (1–3 months post-release)

- **Median wall-clock per `/gsd-review`** on machines with ≥4 detected CLIs (self-reported or telemetry). Target: ≥40% reduction for users who opt in.
- **User-perceived signal-to-noise** on review output (qualitative; gather via GitHub Discussions or a single follow-up question on the issue).

### Measurement notes

GSD doesn't ship usage telemetry today. Most of these metrics rely on qualitative signal: issue activity, Discussion threads, and a follow-up on `#3079`. That's appropriate for a config addition of this size — we don't need a metrics pipeline to validate it.

## Edge Cases & Error Handling

- **Config key missing** → today's behavior (all detected).
- **Config key is `[]`** → schema error per proposed Q-1 resolution. Message: `review.default_reviewers is empty; remove the key to use the default-all behavior or list at least one reviewer.`
- **Config key contains an unknown slug** → warn, drop the unknown entry, continue with the rest.
- **Config key contains a known slug not detected on this host** → info, drop, continue.
- **Config key contains only undetected slugs** → error with actionable message: `All configured default reviewers are missing on this host: [...]. Install at least one, or pass --all / specific flags.`
- **Config key is malformed (e.g., string instead of array)** → schema error at config load, with file path and line number where the parser supports it.
- **Slug case sensitivity** → lowercase-normalize on read; document this.
- **Duplicates in the array** → de-dup silently.
- **User passes `--all` and individual flags together** → existing behavior preserved; this change does not alter that interaction. Confirm in tests.

## Open Questions

- **Q-1. Empty-array semantics.** Should `review.default_reviewers: []` be a schema error, or should it fall back to "all detected"? *Proposal: schema error.* **Blocking.** Affects schema validation and tests.
- **Q-2. `--no-default` flag.** Is this meaningfully different from `--all`? *Proposal: drop unless implementation surfaces a concrete difference.*
- **Q-3. `/gsd-config --integrations` integration.** Land in this pass or as a fast follow? *Proposal: fast follow; depends on contributor bandwidth.*
- **Q-4. Slug case handling.** Lowercase-on-read (proposed) or exact-match enforcement at the schema layer?
- **Q-5. Verbose-mode "selection source" line.** Always-on or only under `--verbose`? *Proposal: `--verbose` only.*
- **Q-6. Cross-runtime sanity.** Any cross-runtime concerns for Codex, OpenCode, Gemini CLI, or Kilo given the existing `resolve_model_ids: "omit"` pattern? *Proposal: none expected — the change operates on detection, not runtime; add at least one non-Claude integration test to confirm.*

## Rollout Plan

This is a small, additive, non-breaking change. No migration is required.

1. **Implementation** (one PR) — schema addition, resolution logic, unit + integration tests per P0-8, docs update per P0-7.
2. **Pre-release sanity** — dogfood on a multi-CLI setup; confirm `--all` and individual flags still behave.
3. **Release** in the next minor version (no semver-major bump needed — additive).
4. **Changelog & announcement** — call out in release notes; link to `#3079`; show the two-line config example.
5. **Monitor** `#3079` and any new issues mentioning "default reviewers" or "review.md patch" for 60 days.
6. **Optional fast follow** — P1-1 (`/gsd-config --integrations` integration) if there's contributor bandwidth.

## Timeline Considerations

- No hard deadlines. Quality-of-life fix, not contractual or compliance-driven.
- No dependencies on other in-flight work.
- Size: estimated ≤1 day of engineering for implementation + tests + docs.

## Out-of-Scope (Restated)

- No new commands.
- No new top-level config namespaces.
- No changes to `--all` or individual flag semantics.
- No reviewer-output aggregation changes.
- No per-phase reviewer profiles in v1 — the namespace is left open.
- No GUI/TUI editing of the key in v1.

## Appendix A: Example config

```json
{
  "review": {
    "default_reviewers": ["gemini", "codex"]
  }
}
```

With this config, `/gsd-review` invokes only Gemini and Codex. `/gsd-review --all` invokes every detected reviewer. `/gsd-review --cursor` invokes only Cursor.

## Appendix B: Glossary

- **Reviewer / CLI / backend.** Any code-review-capable CLI or model server GSD can invoke (Claude, Codex, Cursor, Gemini, OpenCode, Kilo, ollama, lm-studio, llama.cpp, …).
- **Detected set.** The list of reviewers `detect_clis` finds on the current host at review time.
- **Slug.** The lowercase short name of a reviewer used in flags and config (e.g., `gemini`, `codex`).
- **"Absent = enabled" pattern.** GSD's convention that missing config keys default to a sensible enabled state. Here, missing `review.default_reviewers` means "all detected."

## References

- Feature issue: `#3079`
- Configuration reference: `docs/CONFIGURATION.md` — `review.models.<cli>`, `review.*_host`, and the **absent = enabled** pattern
- Workflow file owning the no-flag branch: `workflows/review.md` (line 52)
- Companion ADR: `0011-review-default-reviewers.md`
