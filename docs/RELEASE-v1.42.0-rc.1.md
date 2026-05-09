# v1.42.0-rc.1 Release Notes

First release candidate for the **1.42.0** train. Published to npm under the `next` dist-tag.

```bash
npx get-shit-done-cc@next
# or pin exact:
npm install -g get-shit-done-cc@1.42.0-rc1
```

> **Release-candidate stream caveat.** RCs come from `main` and are the staging stream for the next stable `latest`. They are stable enough for everyday use but may carry bake items resolved before the matching `vX.Y.0` is published. See [CANARY.md](CANARY.md) for the stream policy.

---

## What's in this release

1.42.0-rc.1 is the first cut of the 1.42 train. The headline addition is a **package legitimacy gate against slopsquatting** — a three-layer defense across the research → plan → execute pipeline that prevents AI-hallucinated package names from flowing undetected into `npm install`. Underneath that, two structural refactors deepen the **SDK package seam** and the **phase lifecycle seams** so future work has cleaner module boundaries.

This RC also rolls up every fix that shipped in [v1.41.1](https://github.com/gsd-build/get-shit-done/releases/tag/v1.41.1). Those fixes are listed in the v1.41.1 notes and on the GitHub release page; this document is scoped to the **new features** in 1.42.0.

---

## Added

### Security

#### Package legitimacy gate against slopsquatting ([#3215](https://github.com/gsd-build/get-shit-done/pull/3215))

A three-layer defense across the research → plan → execute pipeline. Before this release, a hallucinated package name that passed `npm view` could flow undetected into `gsd-executor` running `npm install <malicious-pkg>` with no human gate. The gate closes that path:

- **Layer 1 — Researcher (`agents/gsd-phase-researcher.md`).** A new `<package_legitimacy_protocol>` block runs `slopcheck install <pkgs> --json` over every recommended package, performs ecosystem-specific verification (`pip index versions` / `npm view` / `cargo search`), and emits a `## Package Legitimacy Audit` table to `RESEARCH.md` with Package, Registry, Age, Downloads, Source Repo, slopcheck, and Disposition columns. Packages discovered solely through WebSearch are tagged `[ASSUMED]` — never `[VERIFIED]`. `[SLOP]` packages are removed from RESEARCH.md and listed under "Packages removed due to slopcheck."
- **Layer 2 — Planner (`agents/gsd-planner.md`).** Reads the Audit table and inserts a `checkpoint:human-verify` task before any install whose package is tagged `[ASSUMED]` or `[SUS]`. Plans that introduce installs gain a `T-{phase}-SC` Tampering / supply-chain row in their `<threat_model>` template.
- **Layer 3 — Executor (`agents/gsd-executor.md`).** RULE 3 amended: package installs (`npm`/`pip`/`cargo`) are excluded from auto-fix scope. Failed installs become `checkpoint:human-verify` with a slopsquatting-risk rationale instead of being silently retried.

**Hardening.** Every `npx --yes <pkg>@latest` invocation across the three agent files is replaced with a `command -v <bin>` guard pattern — this closes the same fetch-and-execute hole `npx --yes` opens.

**Graceful degradation.** When `slopcheck` is unavailable at research time, every recommended package is tagged `[ASSUMED]` and gated with a checkpoint, so the protective behavior degrades safely instead of bypassing the gate.

**Documentation.** `docs/USER-GUIDE.md` has a new "Package Legitimacy Gate" subsection in the Security section; `docs/COMMANDS.md` notes the gate on `/gsd-plan-phase`; `docs/ARCHITECTURE.md` documents the gate before the Security Hooks section and updates the plan-phase pipeline diagram with the gate steps.

Closes [#2827](https://github.com/gsd-build/get-shit-done/issues/2827).

---

## Changed

### Architecture

#### SDK package seam deepened; runtime-global skills policy converged ([#3238](https://github.com/gsd-build/get-shit-done/pull/3238))

Concentrates two areas that were previously scattered across the codebase:

- **SDK Package Seam Module.** Legacy package and install-layout compatibility — previously leaked across `state-project-load`, `verify`, `roadmap`, prompt-loading paths, `agent-skills`, `skill-manifest`, and `generateDevPreferences` — is now centralized behind a single Module. Callers consume legacy-asset discovery and install-layout probing through a thin Adapter; transition-only error messaging lives in one place.
- **Runtime-Global Skills Policy Module.** A single runtime-aware global-skills directory policy is now shared by SDK and CJS callers. Resolves runtime-global skills bases and skill paths from the runtime + env precedence chain, renders display paths for warnings/manifests, and reports unsupported runtimes that lack a skills directory.

The CONTEXT.md domain glossary is updated with both Module entries so future work points at the canonical seams instead of re-deriving the boundaries.

Closes [#3237](https://github.com/gsd-build/get-shit-done/issues/3237). Refs [#3234](https://github.com/gsd-build/get-shit-done/issues/3234).

#### Phase lifecycle seams deepened ([#3267](https://github.com/gsd-build/get-shit-done/pull/3267))

`phase-lifecycle.ts` becomes a thin public orchestrator. Three new modules are extracted:

- **Phase Numbering Policy Module.** Phase-name and project-code validation, slug/ID generation, sequential and decimal phase progression, and roadmap-entry construction.
- **Phase Filesystem Adapter Module.** Directory listing, gitkeep creation, and archive operations for phase directories.
- **Phase Roadmap Mutation Module.** `replaceInCurrentMilestone` and atomic ROADMAP.md read-modify-write under planning lock.

Backward-compatible re-exports are preserved on `phase-lifecycle.ts` so existing callers continue to work; new callers should import from the dedicated modules.

Closes [#3270](https://github.com/gsd-build/get-shit-done/issues/3270).

---

## What was in 1.41.x

- **[v1.41.1](https://github.com/gsd-build/get-shit-done/releases/tag/v1.41.1)** — 14-fix hotfix: phase-plan-index DAG correctness, state-snapshot YAML frontmatter precedence, code-review SUMMARY parser hardening (`BL-` / `blocker:` accepted as Critical-tier), Codex install TOML floats + idempotent rollback, persistent SDK reachability probe, shared model-catalog source of truth (ADR-0003), and more.
- **[v1.41.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.41.0)** — six namespace meta-skills, `/gsd-health --context` utilization guard, `--minimal` install flag, `/gsd-edit-phase`, post-merge build & test gate, manual canary release workflow, and 25+ correctness fixes. See [`RELEASE-v1.41.0.md`](RELEASE-v1.41.0.md).

---

## Installing

```bash
# npm (global, RC channel)
npm install -g get-shit-done-cc@next

# npx (one-shot)
npx get-shit-done-cc@next

# Pin to this exact RC
npm install -g get-shit-done-cc@1.42.0-rc1
```

The installer is idempotent — re-running on an existing install updates in-place, preserving your `.planning/` directory and local patches.

To roll back to the latest stable, install with `@latest`:

```bash
npx get-shit-done-cc@latest
```
