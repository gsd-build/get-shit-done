# Skill surface budget — research memo

**Date:** 2026-05-12
**Author:** triage analysis for issue [#3408](https://github.com/gsd-build/get-shit-done/issues/3408)
**Status:** Research input for ADR-0010
**Reading time:** ~15 min

---

## 1. Problem statement

Claude Code and other runtimes that surface skills enumerate every installed skill's `name + description` into the system prompt on every turn, inside an `<available_skills>` block. This block is capped by `skillListingBudgetFraction` — default **1%** of the model's context window, ~**2,000 tokens** at 200k. When the combined descriptions exceed the cap, the harness silently truncates the tail. The reporter of #3408 has 135 installed skills across multiple plugins and observed dropped skills.

GSD's audited footprint:

| Metric | Value |
|---|---|
| Installed skills | 66 |
| Installed sub-agents | 33 (not listed in `<available_skills>` — invoked via `Task`) |
| Total skill description chars | 4,787 |
| Estimated description tokens (÷4) | ~1,196 |
| Mean description length | 72.5 chars |
| Description ceiling (enforced by `scripts/lint-descriptions.cjs`) | 100 chars |
| GSD share of a 200k 1% budget | ~60% |

GSD on its own consumes roughly 60% of the default skill-listing budget. When the user stacks any other plugin of comparable size (the reporter's `/doctor` shows several), the budget is breached and skills get dropped. This is not a GSD-only problem, but **GSD is the single biggest contributor in the typical install**, so we are the natural place for ecosystem-wide remediation to start.

## 2. What's already in place

GSD has done one consolidation pass and shipped one install-time lever:

- **`--minimal` / `--core-only` install flag** (`bin/install.js:123`, `get-shit-done/bin/lib/install-profiles.cjs`). Stages a filtered copy of `commands/gsd/` into a temp dir before each runtime-specific copy step. Reduces ~12k tokens of cold-start overhead to ~700.
- **`MINIMAL_SKILL_ALLOWLIST`** — 6 skills: `new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, `help`, `update`. Zero sub-agents in minimal.
- **Hard 100-char description budget**, enforced in CI by `scripts/lint-descriptions.cjs` and `npm run lint:descriptions`.
- **`gsd update` (without `--minimal`)** as the documented upgrade path from minimal → full.

The 100-char cap means **shrinking descriptions further is not a viable lever** — average is already 72.5 chars and the rare 99-char outliers exist because they earn their length (e.g. `gsd:progress`, `gsd:inbox`). Any future budget relief has to come from **emitting fewer skills**, not shorter ones.

## 3. Audit findings

### 3.1 Dependency topology (66 skills)

Hot nodes (counted by other-skill body references):

| Rank | Skill | Callers | Role |
|---|---|---|---|
| 1 | `phase` | 38 | Dispatcher to all phase-typed workflows |
| 2 | `review` | 11 | Review-output convergence |
| 3 | `config` | 7 | Project config display/edit |
| 4 | `progress` | 5 | Active-phase progress tracker |
| 5 | `update` | 5 | Upgrade path |
| 6 | `discuss-phase` | 2 | Main-loop step 1 |
| 6 | `execute-phase` | 2 | Main-loop step 3 |
| 6 | `new-project` | 2 | Bootstrap |
| 6 | `plan-phase` | 2 | Main-loop step 2 |

`phase` and `review` are the two skills whose absence would silently break dozens of others. **`phase` is referenced by 38 other skills but is not in the current minimal allowlist** — a latent gap worth raising. Confirm with a `--minimal` install + a `/gsd:audit-fix` invocation whether it still works.

### 3.2 Functional clusters

Greedy clustering by name + prose intent:

| Cluster | Skills | Desc chars | Desc tokens |
|---|---|---|---|
| `core_loop` | 6 | 346 | ~87 |
| `phase_variants` (includes `core_loop`) | 10 | 734 | ~184 |
| `audit_review` | 11 | 772 | ~193 |
| `milestone` | 4 | 292 | ~73 |
| `research_ideate` (`sketch`, `spike`, `forensics`, `explore`, `graphify`, `ns-ideate`) | 6 | 482 | ~121 |
| `workspace_state` (`pause`, `resume`, `workspace`, `workstreams`, `thread`, `capture`, `inbox`) | 7 | 496 | ~124 |
| `docs` | 2 | 160 | ~40 |
| `ui` | 2 | 122 | ~31 |
| `ai_eval` | 2 | 179 | ~45 |
| `ns_meta` | 6 | 315 | ~79 |
| `utility` (incl. `health`, `stats`, `settings`, `cleanup`, `pr-branch`, `ship`, `undo`, `fast`, `quick`, …) | 23 | 1,714 | ~429 |

The **utility** bucket is the heaviest single cluster (36% of description tokens) and is also the most heterogeneous — half of these likely run only once per project, not once per session. They're the prime candidates for an "advanced" or "opt-in" tier.

### 3.3 Consolidation ceiling

A second consolidation pass (collapsing all 10 `*-phase` skills into a single dispatcher) would save ~150 tokens at most, at the cost of making the user-facing slash commands less discoverable in the UI and complicating argument parsing. **Pure consolidation has diminishing returns** below the current 66-skill count; the next big saves come from changing *what gets surfaced* rather than *how it's written*.

## 4. Options

Each option is graded against five dimensions:

- **User UX**: how surprising / how much new mental model
- **Implementation cost**: relative dev effort
- **Dependency safety**: risk of breaking cross-skill calls
- **Token savings**: vs. current ~1,196 desc tokens
- **Anthropic dependency**: whether platform changes are required

### Option A — Expand install-time profiles (named feature flags)

Layer named profiles on top of the existing minimal/full binary:

```
gsd install --profile=core            # current --minimal (6 skills, 0 agents)
gsd install --profile=standard        # +phase, +review, +config, +progress (~14 skills)
gsd install --profile=full            # current default (66 skills, 33 agents)
gsd install --profile=core,audit,ui   # composable feature tags
```

| Dimension | Assessment |
|---|---|
| User UX | Familiar pattern (Cargo features, Helm `--set`, Ansible tags). Picker prompt on interactive install. |
| Implementation cost | **Low.** `install-profiles.cjs` already does the staging. Extend `MINIMAL_SKILL_ALLOWLIST` into a map of profile → set, add a `--profile` arg parser, add interactive `AskUserQuestion`. |
| Dependency safety | Need a manifest declaring each skill's required-skills set, so a profile can't ship an orphan caller. Add as CI lint. |
| Token savings | High — `standard` cuts ~70% of descriptions; named clusters give users granular control. |
| Anthropic dependency | None. |

**Pros:** ships unilaterally, leverages existing seam, low blast radius.
**Cons:** install-time only — users on a "full" install can't shrink without reinstall.

### Option B — Runtime enable/disable command

A `/gsd:surface` (or `gsd surface` CLI) command that toggles which skills are visible to the runtime without touching installed files:

```
/gsd:surface list                # show enabled/disabled
/gsd:surface disable ui audit    # hide a cluster
/gsd:surface profile standard    # apply a named profile
```

Implementation: write enable/disable state to `~/.claude/skills/<name>/SKILL.md.disabled` (rename) or maintain a `gsd-surface.json` manifest the installer reads on every `update`.

| Dimension | Assessment |
|---|---|
| User UX | Discoverable through `/gsd:help`. Lower commit than reinstall. Mirrors VS Code's enable/disable extension UX. |
| Implementation cost | **Medium.** Need persistent state separate from install files, plus a re-apply loop on `gsd update`. |
| Dependency safety | Same manifest requirement as Option A — disabling `phase` should warn that 38 skills depend on it. |
| Token savings | High — user-driven; can match Option A's savings. |
| Anthropic dependency | None for the rename approach. Cleaner if Anthropic supports a `SKILL.disabled` convention natively. |

**Pros:** in-session adjustable, no reinstall friction.
**Cons:** state lives outside the installer's idempotent model, so `gsd update` migrations get more complex.

### Option C — Further skill consolidation

Collapse semantically related skills into a single dispatcher with sub-modes:

```text
gsd-phase           → keeps existing
gsd-milestone {new|complete|summary|audit}        # was 4 skills (hypothetical)
gsd-research  {sketch|spike|forensics|explore}    # was 4 skills (hypothetical)
gsd-workspace {pause|resume|capture|inbox|thread} # was 5 skills (hypothetical)
```

(The hypothetical dispatchers above are written without the slash prefix to signal they are not shipped commands — Option C is a sketch, not a recommendation.)

| Dimension | Assessment |
|---|---|
| User UX | Breaking change for muscle-memorized slash commands; needs aliases for ≥1 release cycle. |
| Implementation cost | **Medium-high.** Argument-parsing inside each dispatcher; migration of cross-references in 30+ skill bodies; aliases; CHANGELOG entries. |
| Dependency safety | High — every cross-reference in existing skill bodies needs rewriting. The audit graph (3.1) is the migration spec. |
| Token savings | Moderate — ~200-300 tokens by collapsing the 13-15 named skills above into 3 dispatchers. |
| Anthropic dependency | None. |

**Pros:** also improves IA — the slash-command surface becomes more discoverable.
**Cons:** breaks user habits, doesn't compose with A/B (you still want profiles after consolidating).

### Option D — Lazy / on-demand descriptions (Anthropic ask)

Skills ship a 1-line *teaser* in the system prompt and the full description loads only when the model expresses interest (analogous to `ToolSearch` for deferred tools). Cuts per-skill listing cost to ~10 chars.

| Dimension | Assessment |
|---|---|
| User UX | Invisible to users. |
| Implementation cost | **Low for GSD** — add a `teaser:` frontmatter field. **High for Anthropic** — harness changes. |
| Dependency safety | N/A (purely about listing). |
| Token savings | ~85% of all skill-listing budget across the ecosystem. |
| Anthropic dependency | **Yes — platform feature.** |

This is the architecturally correct long-term answer. GSD can't ship it alone.

### Option E — Per-plugin budget allocation (Anthropic ask)

Instead of one shared `skillListingBudgetFraction`, give each plugin a dedicated quota (e.g. proportional to declared `skills.count` × ceiling). Eliminates one greedy plugin starving others.

| Dimension | Assessment |
|---|---|
| User UX | Invisible. |
| Implementation cost | **Low for GSD** — declare quota in `package.json` / plugin manifest. **Medium for Anthropic** — quota arithmetic and tie-breaking in the harness. |
| Token savings | Doesn't reduce total, but eliminates the silent-drop failure mode. |
| Anthropic dependency | **Yes.** |

### Option F — Sub-plugins / split distribution

Publish GSD as multiple npm packages: `get-shit-done-cc-core`, `get-shit-done-cc-milestones`, `get-shit-done-cc-research`, etc. Users install only what they need.

| Dimension | Assessment |
|---|---|
| User UX | Reasonable for advanced users; confusing for first-time installers. Needs a meta-package (`get-shit-done-cc`) that depends on the slim ones — analogous to VS Code extension packs. |
| Implementation cost | **High.** Multi-package build pipeline, version sync across packages, changelog routing, install-script forking. |
| Dependency safety | npm semver carries the contract; cross-package refs become real `require()` calls. |
| Token savings | Same as Option A in practice — token savings come from choosing not to install, not from the package boundary. |
| Anthropic dependency | None. |

**Pros:** clean separation, follows npm-ecosystem norms.
**Cons:** very high lift for the same token savings Option A delivers.

## 5. Recommendation

**Adopt Option A (named install profiles) as ADR-0010, with Option B (runtime surface toggle) as a Phase-2 amendment**. File Options D and E to Anthropic as platform asks.

Why this ordering:

1. **A reuses an existing seam.** `install-profiles.cjs` is already the staging point; this is the lowest-risk way to ship meaningful relief in the next release.
2. **A is composable.** Naming clusters as profiles is a forcing function for the dependency manifest, which we want anyway for the lint described in 3.1.
3. **B follows A naturally.** Once profiles exist, the `/gsd:surface` command is "apply a profile to a live install plus persist deltas." Without A, B has no profiles to apply.
4. **C is independent and orthogonal.** It can happen in parallel as IA cleanup; it should not block A.
5. **D and E are platform-level.** GSD ships A regardless; D/E are documented as cooperative asks so Anthropic sees them in context.

## 6. Anthropic platform asks

Drafted for filing at <https://docs.claude.com/feedback> or similar channel; copy unchanged into the issue or feedback form.

### Ask 1 — Native lazy skill descriptions

> Skills currently emit `name + description` into every system prompt. For large plugin ecosystems (135+ skills on power-user installs) this overruns `skillListingBudgetFraction` and silently drops skills. Proposal: add a frontmatter `teaser:` field (≤40 chars) that ships in the listing, with the full `description:` loaded only when the model requests it (analogous to ToolSearch for deferred tools). Backwards-compatible: skills without `teaser:` keep current behavior.

### Ask 2 — Per-plugin budget allocation

> A single `skillListingBudgetFraction` shared across all installed plugins causes silent truncation when one plugin's skill set is large. Proposal: each plugin declares a soft quota in its manifest; the harness arbitrates fairness when total demand exceeds budget (e.g. proportional shrink, with a documented order — most-recently-installed last to be cut). Surface drops in `/doctor` output today; do not drop silently.

### Ask 3 — Dependency-aware skill listing

> Skills can call other skills (in GSD, the `phase` skill is referenced by 38 others). When the harness drops a skill from the listing, it has no way to know whether anything else relies on it. Proposal: optional frontmatter `requires: [other-skill]` so the harness keeps the closure of dependencies in the listing, or warns the user at install time that a dropped skill is reachable from a kept one.

### Ask 4 — Disable/enable without uninstall

> Today the only way to remove a skill from the listing is to delete its `SKILL.md`. Proposal: a `.disabled` suffix (e.g. `SKILL.md.disabled`) or a per-skill `enabled: false` frontmatter is treated as "not surfaced" by the harness. This lets plugins ship surface-toggle UIs (like our proposed `/gsd:surface disable`) without touching install state.

## 7. Implementation sketch (for the ADR)

Phase 1 — profiles (ships with ADR-0010):

1. In `get-shit-done/bin/lib/install-profiles.cjs`, replace the single `MINIMAL_SKILL_ALLOWLIST` constant with a `PROFILES` map. Each profile is the *transitive closure* over a base set, so `standard` includes `core` automatically.
2. Add a `requires:` frontmatter field to every skill that calls another skill in its body. Add a lint check in `scripts/lint-descriptions.cjs` (or a sibling `lint-skill-deps.cjs`) that fails CI if a skill body references another skill that isn't in its `requires` list, and that fails if any profile would ship a skill whose `requires` aren't satisfied.
3. Extend the `bin/install.js` argument parser: `--profile=<name>` (mutually exclusive with `--minimal`), `--profile=core,audit` for composition. Keep `--minimal` as an alias for `--profile=core`.
4. Interactive install: if no `--profile` is given and no runtime/location is forced, present an `AskUserQuestion`-style picker. (Cowork analog already in the install flow.)
5. `gsd update` re-applies the recorded profile from a small marker file (`~/.claude/skills/.gsd-profile`).

Phase 2 — runtime surface command (follow-up ADR or amendment):

1. `/gsd:surface` command writes to the profile marker and re-runs the staging step for the active runtime.
2. Once Anthropic ships Ask 4, switch from file-deletion to `.disabled`-suffix toggling.

## 8. Follow-ups outside this scope

- **Stale comment in `install-profiles.cjs`.** The module-level header cites "86 skills + 33 agents" producing ~12k tokens. The audited count is 66 + 33 — a previous consolidation pass already happened. Update the comment in a parallel cleanup commit when ADR-0010 lands.
- **Audit JSON refresh.** `docs/research/data/2026-05-12-skill-audit.json` is a one-shot snapshot. If we want it to stay current, wire the extraction script into `scripts/` and run it on `lint:skill-deps`. Not a blocker.

## 9. Risks and unknowns

- **The `phase` dispatcher gap in the existing minimal allowlist.** Confirm whether a fresh `--minimal` install + the documented main loop actually works end-to-end. If `discuss-phase`/`plan-phase`/`execute-phase` silently fall back to `/gsd:phase`, the minimal allowlist is currently broken. Track as a separate bug if confirmed.
- **Profile naming bikeshed.** `core` / `standard` / `full` vs. `minimal` / `recommended` / `everything` vs. functional names (`planning`, `audit`, `research`). Settle in the ADR's Open Questions.
- **Discoverability of disabled skills.** If `gsd:audit-fix` isn't surfaced, a user asking "audit my project" won't get it suggested. `/gsd:help` should list installed-but-not-surfaced skills with a one-line upgrade hint.
- **Telemetry blind spot.** GSD doesn't currently know which skills users invoke, so "drop the long tail" is theoretical. Survey or self-reporting may be needed before drawing the `standard` profile line.

## 10. References

- Issue: [#3408](https://github.com/gsd-build/get-shit-done/issues/3408)
- Existing seam: `get-shit-done/bin/lib/install-profiles.cjs`
- Description lint: `scripts/lint-descriptions.cjs`
- Install dispatcher: `bin/install.js:123` (mode parsing), `bin/install.js:8167-8207` (minimal staging)
- Audit data: [`docs/research/data/2026-05-12-skill-audit.json`](data/2026-05-12-skill-audit.json) (per-skill dep graph, description sizes, and cluster mapping — reproducible from `commands/gsd/` and `agents/`)
- Prior ADRs: 0008 (Installer Migration Module) and 0009 (Shell Command Projection Module) — both touch the same install pipeline this proposal extends.
- Ecosystem precedents: Cargo `[features]`, npm `optionalDependencies`, VS Code extension packs, Homebrew taps, Helm chart values, Ansible role tags, Linux kernel `make menuconfig` tristate, systemd target activation.
