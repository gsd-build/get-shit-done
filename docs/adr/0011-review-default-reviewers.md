# `review.default_reviewers` config key scopes the no-flag `/gsd-review` fan-out

- **Status:** Proposed
- **Date:** 2026-05-13

We propose adding a `review.default_reviewers` key to `.planning/config.json` that scopes the no-flag default of `/gsd-review` to a user-chosen subset of detected CLI reviewers. Today the no-flag branch of `workflows/review.md` (line 52) invokes **all available** CLIs, which for multi-CLI users plus local model servers (ollama, lm-studio, llama.cpp) means probing up to ~10 backends per review, paying timeout costs on servers that aren't running and burning tokens on reviewers the user doesn't want for routine work (`#3079`). The only workaround today is patching `workflows/review.md` in place; that patch is wiped on every `/gsd-update` and requires `/gsd-update --reapply` to restore, with no machine-readable record of intent. The proposed key sits inside the existing `review.*` namespace (alongside `review.models.<cli>` and `review.*_host`), follows GSD's **absent = enabled** config philosophy, and is implementable as a one-line config read plus an intersection on the detected reviewer set.

## Decision

- Add **`review.default_reviewers`** to the `config.json` schema as `string[]`, validated against the existing CLI slug pattern `^[a-zA-Z0-9_-]+$` (the same pattern used for `review.models.<cli>` slugs).
- When the key is **present**, the no-flag branch of `/gsd-review` invokes only the reviewers listed in the key, intersected with the host's `detect_clis` result.
- When the key is **absent**, today's behavior is preserved: every detected reviewer runs. This matches the **absent = enabled** pattern documented in `docs/CONFIGURATION.md`.
- **`--all`** continues to mean "every detected reviewer" and ignores the config key.
- **Individual reviewer flags** (`--gemini`, `--codex`, `--cursor`, `--claude`, `--opencode`, …) continue to win over both config and `--all`.
- Resolution lives in the `detect_clis` step of `workflows/review.md`: detect first, then filter by `review.default_reviewers` only on the no-flag branch.
- Unknown slugs in the key emit a warning and are dropped; valid-but-undetected slugs emit an info-level note and are dropped; an all-undetected post-filter set emits an actionable error (see "Open questions" Q-1 for empty-array semantics).
- Slug comparison is lowercase-normalized on read. The schema pattern already accepts mixed case, so normalization is forgiving without making the pattern itself stricter.
- No new top-level config namespace, no new command, no new flag in v1.

**Precedence (highest first):**

1. Individual reviewer flags
2. `--all`
3. `review.default_reviewers`
4. No config, no flags → today's behavior (all detected)

## Initial Scope

First slice should land the config plumbing and the no-flag branch behavior without expanding into adjacent reviewer-selection design:

1. Schema addition for `review.default_reviewers` in the config loader; validation as `string[]` with slug pattern; lowercase normalization; clear schema errors for non-array / non-string-element values.
2. Filter step inside `workflows/review.md` `detect_clis` no-flag branch:
   - intersect `detected ∩ default_reviewers`
   - emit a single-line "selection source" log identifying which path was taken (default config / `--all` / explicit flags / no config)
   - warn on unknown slugs; info on valid-but-undetected slugs; error if the post-filter selection is empty
3. Docs update: extend `docs/CONFIGURATION.md` with a `review.*` subsection documenting the key, allowed values, defaults, and override precedence; add the key to the schema block at the top of that file; update `workflows/review.md` to reference the key in the no-flag branch.
4. Tests: config parsing (valid / empty / malformed); `detect_clis` intersection; integration coverage of no-flag honors config, `--all` overrides, individual flags override, unknown slug warns, only-undetected slugs errors.
5. Release notes entry calling out the new key with the two-line config example.

It should **not** in the first pass:

- Add `--no-default` or any new CLI flag (track in "Open questions" Q-2 — likely equivalent to `--all`).
- Add per-phase or per-file-type reviewer profiles (`review.profiles.*`). The namespace is left open for this as a future ADR (see "Open questions" Q-3).
- Add reviewer "groups" or aliases (`review.groups.cheap = [...]`). Same — namespace deliberately left open.
- Auto-suggest defaults from usage history. Different design philosophy (silent behavior drift); explicitly out of scope.
- Extend `/gsd-config --integrations` to set the key interactively. Track as a fast follow (see "Open questions" Q-4).
- Change `--all` semantics or the individual flag set.

## Migration Inventory

### `workflows/review.md`

- `detect_clis` step, no-flag branch (current line 52: "No flags → include all available") — replace with: "No flags → if `review.default_reviewers` is set, intersect detected with the listed slugs; otherwise include all detected."
- Verbose / debug output path — emit one line identifying the selection source.

### Config loader

- Add `review.default_reviewers: string[]` to the JSON schema for `.planning/config.json`. Pattern per element: `^[a-zA-Z0-9_-]+$`. Slug list de-dup on read; lowercase-normalize on read.
- Surface schema errors at config load (file path + line number where the parser supports it), matching the existing handling for other malformed `review.*` keys.

### `docs/CONFIGURATION.md`

- Add `review.default_reviewers` to the **Full Schema** code block at the top of the file as an optional array key under a `"review": { ... }` object.
- Add a new **Reviewer Selection** subsection (or extend the existing `review.*` section if one exists) covering: purpose, type, default, precedence vs. `--all` and individual flags, edge-case behavior (unknown slugs, undetected slugs, empty result).
- Cross-reference `workflows/review.md` for how the key is consumed at review time.

### Tests expected to move with the seam

- New `tests/review-default-reviewers-config.test.cjs`:
  - valid `["gemini", "codex"]` parses; lowercase normalization works
  - `[]` schema decision per Q-1 (proposed: parse-time error)
  - non-array → schema error
  - non-string element → schema error
  - element failing slug pattern → schema error
- New `tests/review-default-reviewers-resolution.test.cjs`:
  - no flags + key set, both slugs detected → exactly those reviewers invoked
  - no flags + key set, one slug undetected → info logged, remaining slug invoked
  - no flags + key set, all slugs undetected → actionable error, nothing invoked
  - no flags + key set, unknown slug present → warning logged, unknowns dropped, rest invoked
  - `--all` + key set → every detected reviewer invoked, key ignored
  - `--gemini` + key set to `["codex"]` → only Gemini invoked
  - no flags + key absent → every detected reviewer invoked (back-compat)
- Extend existing `/gsd-review` integration tests to cover the new selection-source log line.

### Schema doc cross-reference

- Update the schema example at the top of `docs/CONFIGURATION.md` to include `"review": { "default_reviewers": ["gemini", "codex"] }` so the key is discoverable from the canonical schema view.

## Example config

```json
{
  "review": {
    "default_reviewers": ["gemini", "codex"]
  }
}
```

With this set, `/gsd-review` (no flags) invokes only Gemini and Codex. `/gsd-review --all` invokes every detected reviewer. `/gsd-review --cursor` invokes only Cursor. Today's behavior is preserved by simply omitting the key.

## Resolution pseudocode

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
log_selection_source(selected, source)
```

## Consequences

- Multi-CLI users can stop patching `workflows/review.md`; the patch class that `/gsd-update` wipes goes away for this case.
- Teams can commit `.planning/config.json` and share a default reviewer set across machines and contributors, without forking the workflow file.
- `/gsd-review` wall-clock time drops on machines where detection probes idle local model servers — the timeout cost on stopped daemons is no longer paid on every routine review.
- Schema surface grows by one optional key; doc maintenance and the test matrix grow by a small fixed amount.
- The `review.*` namespace stays internally consistent. Future `review.profiles.*` or `review.groups.*` can coexist with `review.default_reviewers` without renaming.
- Cross-runtime impact is minimal: the change operates on the detection layer in `detect_clis`, not on any per-runtime adapter. The existing `resolve_model_ids: "omit"` path used by non-Claude runtimes (Codex, OpenCode, Gemini CLI, Kilo) is unaffected.
- One additional surface area for bug reports — primarily edge interactions between the key and `--all` / individual flags, which the test plan covers.
- If telemetry is ever opt-in for `.planning/config.json` shape, adoption of this key becomes a useful signal for whether to invest in the richer profiles design (see Q-3).

## Open questions

- **Q-1.** Should `review.default_reviewers: []` be a schema error, or should it fall back to "all detected"? *Proposal: schema error.* Rationale: users who want "all detected" can simply omit the key (more readable); `[]` looks like a typo or programmatic mistake; surfacing the ambiguity is more helpful than silently swallowing it. **Blocking** — affects schema validation and tests.
- **Q-2.** Is a new `--no-default` flag warranted, or is it equivalent to `--all` for this use case? *Proposal: drop unless a concrete difference surfaces during implementation.* Non-blocking.
- **Q-3.** Do we want to commit now to leaving `review.profiles.*` open as a future namespace, or is that premature? *Proposal: leave open; document the intent in `docs/CONFIGURATION.md` so the next contributor doesn't pick a conflicting key.* Non-blocking.
- **Q-4.** Should `/gsd-config --integrations` learn the new key in this pass, or as a fast follow once the schema + resolution land? *Proposal: fast follow.* Non-blocking; depends on contributor bandwidth.
- **Q-5.** Should the verbose-mode "selection source" line ship in the first pass, or only behind `--verbose`? *Proposal: behind `--verbose`.* Non-blocking.
- **Q-6.** Slug normalization: lowercase-on-read (proposed) vs. exact-match enforcement at the schema layer. *Proposal: normalize.* Non-blocking; document either way.

## References

- Feature issue: `#3079`
- Configuration reference: `docs/CONFIGURATION.md` — `review.models.<cli>`, `review.*_host`, and the **absent = enabled** pattern
- Workflow file owning the no-flag branch: `workflows/review.md` (line 52)
- Existing slug validation pattern: `^[a-zA-Z0-9_-]+$` (used for `review.models.<cli>` keys)
- Related PRD: `0011-review-default-reviewers-prd.md`
