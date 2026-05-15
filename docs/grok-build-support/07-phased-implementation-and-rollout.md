# Grok Build: Phased Implementation and Rollout

## Phase 0 — Planning & Alignment (this document)

- Create `docs/grok-build-support/` with the 7 files on the `grok-build` branch.
- Open a GitHub issue in `gsd-build/get-shit-done` titled "Add Grok Build (`--grok`) as a first-class runtime".
- Apply label `approved-enhancement` (per triage-labels.md).
- Request review from maintainers / xAI liaison if available.
- Obtain consensus on the key decisions marked "Decision point" in the other plan docs (frontmatter name format, whether to always install AGENTS.md, exact Grok model IDs, statusline support level).

**Exit criteria:** Plan approved, issue triaged, branch ready for implementation work.

## Phase 1 — Data & Minimal Viable Runtime (1 day)

**Goal:** Make `grok` a recognized runtime that does not crash the installer or SDK.

1. Edit `sdk/shared/model-catalog.json` — add the `grok` tier entry (use placeholder model names if exact IDs not yet public; they can be updated later).
2. Add the `grok` case to `get-shit-done/bin/lib/runtime-homes.cjs` (pure function, low risk).
3. Add the minimal `hasGrok`, `getGlobalDir('grok')`, `getDirName('grok')`, and `selectedRuntimes` wiring in `bin/install.js`.
4. Add a no-op or "not yet implemented" path in the main install switch so that `--grok` at least prints a friendly message and exits cleanly.
5. Run the full test suite locally; fix any immediate breakage.
6. Add the first two test files (`grok-install.test.cjs` skeleton + one happy-path assertion, `grok-conversion.test.cjs` skeleton).

**Deliverable:** `npx get-shit-done-cc --grok` no longer throws "unknown runtime". PR or stacked commit on `grok-build` branch with passing CI.

## Phase 2 — Full Installer + Basic Conversion (2 days)

1. Implement the three conversion functions in `bin/install.js`.
2. Wire the Grok branch in the skill/agent staging code path (use the same profile staging as Claude/Windsurf).
3. Implement hook JSON manifest generation (reuse `shell-command-projection` patterns).
4. Implement `installGrokConfig` / config.toml light touch (or skip if hooks JSON is sufficient for v1).
5. Handle AGENTS.md / CLAUDE.md placement decision from Phase 0.
6. Extend `uninstall`, `writeManifest`, and the ownership marker logic for `grok`.
7. Add `GROK_CONFIG_DIR` documentation and the corresponding env handling.
8. Expand the conversion tests to cover all core skills + 5 representative agents.
9. Manual smoke test with a real `grok` binary (or the latest from x.ai/cli/install.sh in a throwaway container/VM).

**Exit:** `npx ... --grok --global --profile=standard` produces a usable set of 14 skills + agents under `~/.grok/skills/gsd-*` and `~/.grok/agents/`, and `grok` can at least discover and list the `/gsd:help` command.

## Phase 3 — Hook Integration & Polish (1–2 days)

1. Map and implement the important GSD hooks (prompt guard, read guard, workflow guard, session-state, update banner, context monitor).
2. Verify that the hooks actually fire inside a Grok session (the hardest part — requires running the TUI and triggering tool use).
3. Add `review.models.grok` example and default in docs + any config schema examples.
4. Update all documentation per the checklist in `05-documentation-and-user-experience.md`.
5. Run `scripts/lint-*.cjs`, `scripts/audit-workflow-script-paths.cjs`, and the full `run-tests.cjs`.
6. Add a changeset fragment (`.changeset/`) describing the new runtime.

**Exit:** Core GSD loop (new-project → discuss → plan → execute with verification) works end-to-end inside Grok Build with guardrails active.

## Phase 4 — Test Hardening & Edge Cases (1 day)

1. Fill out the full test matrix from `06-testing-strategy.md`.
2. Coexistence test (Grok + Claude on same machine, multiple profiles).
3. Re-install / `gsd update` flow from within a Grok session.
4. Windows + WSL path handling (if Grok supports Windows Git Bash).
5. Large payload / init command output via the `@file:` mechanism still works.
6. `grok inspect` output looks clean (token counts for AGENTS.md + skills).
7. Update any generated files (`INVENTORY-MANIFEST.json`, command aliases, etc.) and run the generators.

## Phase 5 — Release & Announcement

1. Merge to `main` (or the current release branch) following the project's PR template and ship-pr-body-sections.
2. Cut a release (patch or minor depending on semver).
3. Post in Discord, X (@gsd_foundation), and the GSD GitHub discussions.
4. (Optional) Submit GSD as a featured skill/plugin to the Grok Build marketplace.
5. Monitor for 48–72h for install or hook regressions from early Grok + GSD users.

## Risk Register & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Grok hook event names differ from Claude's | Medium | High (safety features silent) | Phase 3 includes explicit verification; fall back to SessionStart + PostToolUse only for v1; document limitations |
| Grok model IDs change before release | Low | Low | Use `null` tiers + strong `model_overrides` docs; update catalog in a follow-up patch |
| Frontmatter schema drift in Grok 0.2+ | Medium | Medium | Make conversion defensive (ignore unknown keys, log warnings); add version guard in manifest |
| Duplicate `/gsd:*` commands when user has both Claude + Grok installs | High | Low (UX noise) | Document "install to your primary runtime only"; Grok's deduping may help |
| Monolithic installer becomes harder to maintain | Ongoing | Medium | This plan does not refactor it; future ADR can propose splitting per-runtime modules after Grok is proven |
| Translated docs lag | Medium | Low | Assign language maintainers in the issue; use the same PR for all 5 languages |

## Back-compat & Deprecation

- No existing user data is migrated or deleted.
- Users who have been manually symlinking or using the Claude compat path will continue to work; the new `--grok` path is additive.
- If in the future we decide to drop the Claude-compat skill discovery for Grok users, we will do so behind a feature flag and with a clear migration notice in `installer-migrations/`.

## Success Metrics (post-launch, 30 days)

- At least 500 `grok` installs counted via the anonymous version-check ping (or GitHub stars / Discord mentions).
- Zero P0 bugs filed against Grok + GSD integration.
- At least one community workflow or agent contributed that targets Grok specifically (or works great on it).
- `grok inspect` + `gsd:help` becomes a common way people discover the full GSD command set inside Grok Build.

## Owners & Review

- **Implementer:** (to be assigned on the tracking issue)
- **Reviewer(s):** At least one core maintainer + (ideally) someone from xAI Grok Build team for hook/event accuracy.
- Use the `/review` or `implement` skill on the final diff before merge.

---

This phased approach keeps risk low, delivers incremental value, and follows the project's existing patterns for adding the 15th (now 16th) runtime. The plan artifacts live in `docs/grok-build-support/` so future runtime additions (next one will be easier) have a template.
