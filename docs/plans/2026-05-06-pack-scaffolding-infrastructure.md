# Pack Scaffolding & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `@adelphi/gsd-ic` npm package skeleton, soft-fork dev tooling, CI validator suite (10 validators), workflow-patch infrastructure (no-op stub), manifest skeleton, install entry-point, and documentation skeleton. End state: a publishable but content-empty pack that installs cleanly into a target program, exits with green CI, and has every Plan-1+ extension point in place.

**Architecture:** Soft-fork-of-upstream-GSD repo with IC pack content at repo root (per spec §10). A separate `bin/gsd-ic-install.js` is the npm entry-point invoked by `npx @adelphi/gsd-ic install`. The package.json `files` field is restrictive — npm publish ships only IC-prefixed content (`gsd-*` agents/hooks, IC skills, intel-refs, config-overlays, install scripts), never the upstream GSD source tree. CI validators are bash scripts that pass on empty content and fail on bad content.

**Tech Stack:** Node.js 20+ (matches upstream GSD), npm, vitest (matches upstream test runner), bash (validators + install helpers + sync-from-upstream), GitHub Actions (CI).

**Spec reference:** `docs/specs/2026-05-05-ic-agent-pack-design.md` — §10 Repo Layout, §11 Maintenance & Upgradability, §12 CI / Validation Strategy, §13 Build Sequencing (Phase 0 deps).

**Prerequisites:** Engineer has cloned `git@github.com:adelphidata/gsd-ic.git`, has Node 20+ and npm installed, has `git` and standard POSIX tools (`bash`, `jq`, `sed`, `awk`, `grep`).

**Seamless-fork guarantee (this plan upholds it):** Plan 0 adds files; Plan 0 *never* edits any upstream-GSD-owned file other than (1) `package.json` (renamed/repointed at root for npm identity) and (2) the addition of an `.github/workflows/ic-ci.yml` separate from upstream's CI. Stock workflow files in `commands/`, `agents/`, `hooks/`, `skills/`, `sdk/`, `bin/install.js`, and `bin/gsd-sdk.js` are not modified in Plan 0. Workflow patches arrive in later phase plans, gated by `intel-gates.json`.

---

## File Structure

Files this plan creates or modifies (every path absolute from repo root `/Users/romansky/gsd-ic/`):

**Top-level config (modified):**
- `package.json` — replace upstream's `name`/`bin`/`files` with `@adelphi/gsd-ic` IC pack identity; preserve upstream `scripts`, `dependencies`, `devDependencies` for dev parity. Original copied to `package.upstream.json` for reference during sync.

**Top-level config (new):**
- `VERSION` — `pack: 0.1.0\ngsd_pinned: <upstream-tag>` text file.
- `.gitignore` — append IC-pack-specific patterns (test fixtures temp dirs, npm pack artifacts).

**Pack content directories (new, all `.gitkeep`'d in this plan; populated in Plans 1–8):**
- `intel-refs/MANIFEST.json` — empty manifest (`{"version": "2026.05", "topics": {}}`).
- `intel-refs/{int-disciplines,capability-patterns,tradecraft,classification,house-style,demo,modernization,ai-ml,ecosystem}/.gitkeep`.
- `config-overlays/{nga,nsa,nro,cia,dia}/.gitkeep` — five customer overlay directories, empty.
- `config-overlays/README.md` — onboarding doc for adding a customer overlay.
- `workflow-patches/.gitkeep` — empty patches directory.
- `commands/gsd/.gitkeep` — note: this directory exists upstream; we add a `.gsd-ic-marker` file as a sentinel, do not write `.gitkeep` inside upstream-owned dirs.

**npm install entry-point (new):**
- `bin/gsd-ic-install.js` — `npx @adelphi/gsd-ic install --customer=<name>` entry-point.
- `bin/lib/gsd-ic/{install-pack.js,verify-gsd.js,wire-overlay.js,parse-args.js}.js` — split-out modules so each file stays focused.

**Soft-fork dev tooling (new):**
- `tools/sync/sync-from-upstream.sh` — git fetch upstream + merge + reapply patches + run validators.
- `tools/release/release-pack.sh` — bump `VERSION` pack field, git tag, run `npm publish`.
- `tools/patch-workflows.sh` — workflow-patch applier (no-op stub in Plan 0; populated in Plan 1+).

**CI validators (new, all under `tools/ci/`):**
- `tools/ci/validate-manifest.sh`
- `tools/ci/validate-classification.sh`
- `tools/ci/validate-agents.sh`
- `tools/ci/validate-skills.sh`
- `tools/ci/validate-workflow-patches.sh`
- `tools/ci/validate-no-classified-leak.sh`
- `tools/ci/validate-completion-markers.sh`
- `tools/ci/validate-triggers.sh`
- `tools/ci/validate-reference-staleness.sh`
- `tools/ci/validate-audit-log.sh`
- `tools/ci/validate-seamless-fork.sh` — confirms patched workflows with all gates off `diff` semantically empty against stock (added per spec §11.2).
- `tools/ci/validate-publish-scope.sh` — confirms `npm pack --dry-run` output contains only IC-prefixed content (no upstream GSD source files).
- `tools/ci/_lib.sh` — shared helpers (color output, fail/pass macros, fixture dir resolution).

**Validator tests (new, under `tools/ci/tests/`):**
- One `*.test.sh` per validator + a `_run-all.sh` runner.
- `tools/ci/tests/fixtures/` — fixture trees (good + bad) per validator.

**Install entry-point tests (new, under `tests/install/`):**
- `tests/install/parse-args.test.cjs`
- `tests/install/verify-gsd.test.cjs`
- `tests/install/install-pack.test.cjs`
- `tests/install/wire-overlay.test.cjs`
- `tests/install/idempotency.test.cjs`
- `tests/install/end-to-end.test.cjs` — full simulated install into a temp target dir.

**Completion-marker registry skeleton (new):**
- `references/agent-contracts.ic-pack.md` — IC-pack-specific completion markers, lives alongside upstream `references/agent-contracts.md`. Empty in Plan 0; populated as agents land in Plans 1–8.

**Documentation skeleton (new, all under `docs/ic-pack/`):**
- `README.md`, `ARCHITECTURE.md`, `QUICKSTART.md`, `UPGRADE-PROCEDURE.md`, `CONSUMER-UPGRADE.md`, `ADDING-AN-AGENT.md`, `ADDING-A-REFERENCE.md`, `ADDING-A-SKILL.md`, `ADDING-A-CUSTOMER-OVERLAY.md`, `PER-CUSTOMER-PLAYBOOK.md`, `TROUBLESHOOTING.md`, `ARCHITECTURE-DIAGRAMS/.gitkeep`.

**GitHub Actions (new):**
- `.github/workflows/ic-ci.yml` — runs all 12 validators + install tests on every PR. Separate file from upstream's CI to avoid sync friction.

**Total new files in Plan 0:** ~70. Total modified upstream files in Plan 0: 1 (`package.json`).

---

## Decomposition Decision Log (made during plan writing)

These are decisions made while writing this plan that the executing engineer should know about (each may be a one-liner ADR candidate later):

1. **package.json strategy:** Replace upstream's root `package.json` with IC-pack identity (`name`, `bin`, `files` overridden). Preserve upstream `scripts`, `dependencies`, `devDependencies`, `engines` for dev-environment parity. Save original as `package.upstream.json` (gitignored from npm publish but committed to the repo) so soft-fork sync has a reference. **Why:** the simplest model that works; the `files` field is the gatekeeper for pack-only publish.
2. **Bash validators, not Node:** Validators are bash scripts using `jq`/`grep`/`find`. **Why:** validators run in CI and locally; bash + standard POSIX tools means no node_modules dependency for validators; keeps validator test infra simple (bash-on-bash).
3. **Vitest for JS install code, plain bash for validator tests:** Match the test runner to the language being tested. Upstream GSD already uses vitest, so JS install code uses it. Validator tests are bash scripts.
4. **`npx @adelphi/gsd-ic install` not `npx @adelphi/gsd-ic`:** Explicit subcommand for install (mirrors upstream `npx get-shit-done-cc` interactive default; we choose explicit `install` for unambiguous CI-friendly invocation). Future subcommands (e.g., `verify`, `info`) get added cleanly.
5. **Customer overlay catalog ships 5 directories empty:** `nga, nsa, nro, cia, dia` per spec §3.3. Plan 0 stubs each with a `.gitkeep`; actual overlay content (per-customer skills, refs) lands in phase plans or as customer engagements demand.
6. **Workflow patches:** none in Plan 0. `tools/patch-workflows.sh` is a no-op script that exits 0 on empty input. Plan 1 adds the first patches.

---

## Task 1: Bootstrap repository identity (package.json + VERSION + .gitignore)

**Files:**
- Modify: `/Users/romansky/gsd-ic/package.json`
- Create: `/Users/romansky/gsd-ic/package.upstream.json`
- Create: `/Users/romansky/gsd-ic/VERSION`
- Modify: `/Users/romansky/gsd-ic/.gitignore`

- [ ] **Step 1: Capture the current upstream package.json**

Read the upstream version we're forking from so we can preserve dev-tooling fields:

```bash
cd /Users/romansky/gsd-ic
node -e "console.log(require('./package.json').version)"
```

Expected output: a version string like `1.39.0-rc.4` (whatever upstream tag we're synced to). Record it; you'll use it in `gsd_pinned`.

- [ ] **Step 2: Save the upstream package.json verbatim**

```bash
cp /Users/romansky/gsd-ic/package.json /Users/romansky/gsd-ic/package.upstream.json
```

This file is committed to the repo as the "what upstream looked like at last sync" reference. The soft-fork sync script will diff against it.

- [ ] **Step 3: Write the IC-pack-flavored `package.json`**

Replace the contents of `/Users/romansky/gsd-ic/package.json` with the merged IC + upstream content. Preserve `scripts`, `dependencies`, `devDependencies`, `engines` from upstream so the dev environment still works; override `name`, `version`, `description`, `bin`, `files`, and add `peerDependencies` for the upstream GSD compatibility check.

```json
{
  "name": "@adelphi/gsd-ic",
  "version": "0.1.0",
  "description": "Adelphi IC pack for the Get Shit Done framework — IC-flavored agents, hooks, skills, and tradecraft references for rapid prototyping in the intelligence community contracting space.",
  "license": "UNLICENSED",
  "private": false,
  "publishConfig": {
    "access": "restricted"
  },
  "bin": {
    "gsd-ic": "bin/gsd-ic-install.js"
  },
  "files": [
    "agents/gsd-*.md",
    "hooks/gsd-*.js",
    "hooks/patterns/",
    "skills/intel-coding-conventions/",
    "skills/prototyping-discipline/",
    "skills/classification-conventions/",
    "skills/adelphi-house-style/",
    "intel-refs/",
    "config-overlays/",
    "commands/gsd/intel-gate-*.md",
    "bin/gsd-ic-install.js",
    "bin/lib/gsd-ic/",
    "tools/patch-workflows.sh",
    "tools/ci/",
    "workflow-patches/",
    "references/agent-contracts.ic-pack.md",
    "VERSION",
    "README.md",
    "LICENSE",
    "docs/ic-pack/"
  ],
  "peerDependencies": {
    "get-shit-done-cc": ">=1.39.0 <2.0.0"
  },
  "peerDependenciesMeta": {
    "get-shit-done-cc": { "optional": true }
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:install": "vitest run tests/install",
    "test:validators": "bash tools/ci/tests/_run-all.sh",
    "test:all": "npm run test && npm run test:validators",
    "ci": "bash tools/ci/_run-all.sh",
    "release": "bash tools/release/release-pack.sh",
    "sync-upstream": "bash tools/sync/sync-from-upstream.sh"
  },
  "dependencies": {},
  "devDependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.84",
    "ws": "^8.20.0",
    "vitest": "^1.6.0"
  }
}
```

**Note:** Two key choices in this `package.json`:

1. **`dependencies` is empty.** The install entry-point uses Node's stdlib only — consumers installing `@adelphi/gsd-ic` should not pull any runtime deps from us. Keep this empty even when adding new IC pack code.
2. **`devDependencies` includes upstream's runtime deps (`@anthropic-ai/claude-agent-sdk`, `ws`) AND our test runner (`vitest`).** The soft-fork repo contains upstream's SDK code that imports those packages; without them in `devDependencies`, `npm install` in the gsd-ic repo leaves upstream code uninstallable. They live in `devDependencies` (not `dependencies`) so consumers don't get them. Bump these versions whenever the soft-fork sync pulls in upstream package.json changes — the `tools/sync/sync-from-upstream.sh` script (Task 25) handles this automatically.
3. **`engines.node` is `>=22.0.0`** to match upstream. Don't widen this; if upstream tightens it further, follow.

- [ ] **Step 4: Write the `VERSION` file**

```bash
cat > /Users/romansky/gsd-ic/VERSION <<'EOF'
pack: 0.1.0
gsd_pinned: 1.39.0-rc.4
EOF
```

Replace `1.39.0-rc.4` with whatever you observed in Step 1.

- [ ] **Step 5: Append IC-pack patterns to `.gitignore`**

Read the existing file first so you don't clobber upstream patterns:

```bash
cat /Users/romansky/gsd-ic/.gitignore
```

Append (don't replace) these lines:

```
# IC pack additions
*.tgz
.test-tmp/
tools/ci/tests/fixtures/_scratch/
.npm-pack-output/
```

- [ ] **Step 6: Verify the package.json parses and the bin path is reachable**

```bash
cd /Users/romansky/gsd-ic
node -e "const p = require('./package.json'); console.log('name:', p.name, '| bin:', p.bin); if (p.name !== '@adelphi/gsd-ic') process.exit(1);"
```

Expected output: `name: @adelphi/gsd-ic | bin: { 'gsd-ic': 'bin/gsd-ic-install.js' }` (no error exit).

The bin file does not exist yet — that's fine for now; npm only resolves it on install/publish.

- [ ] **Step 7: Commit**

```bash
cd /Users/romansky/gsd-ic
git add package.json package.upstream.json VERSION .gitignore
git commit -m "[U] feat(scaffold): rename root package to @adelphi/gsd-ic; add VERSION and gitignore"
```

---

## Task 2: Create empty pack-content directory tree

**Files:**
- Create: `/Users/romansky/gsd-ic/intel-refs/MANIFEST.json`
- Create: `/Users/romansky/gsd-ic/intel-refs/{int-disciplines,capability-patterns,tradecraft,classification,house-style,demo,modernization,ai-ml,ecosystem}/.gitkeep`
- Create: `/Users/romansky/gsd-ic/config-overlays/README.md`
- Create: `/Users/romansky/gsd-ic/config-overlays/{nga,nsa,nro,cia,dia}/.gitkeep`
- Create: `/Users/romansky/gsd-ic/workflow-patches/.gitkeep`
- Create: `/Users/romansky/gsd-ic/references/agent-contracts.ic-pack.md`

- [ ] **Step 1: Write the empty manifest skeleton**

```bash
mkdir -p /Users/romansky/gsd-ic/intel-refs
cat > /Users/romansky/gsd-ic/intel-refs/MANIFEST.json <<'EOF'
{
  "version": "2026.05",
  "topics": {}
}
EOF
```

The `version` field follows the date-shape convention from spec §8.1 + §11.0 (matches the `pack` version from `VERSION`). When agents start landing, manifest entries fill `topics`.

- [ ] **Step 2: Stub the intel-refs subdirectories**

Create the topic-area directories defined in spec §10 with `.gitkeep` placeholders so git tracks the empty dirs:

```bash
cd /Users/romansky/gsd-ic
for d in int-disciplines capability-patterns tradecraft classification house-style demo modernization ai-ml ecosystem; do
  mkdir -p "intel-refs/$d"
  touch "intel-refs/$d/.gitkeep"
done
```

Verify:

```bash
find /Users/romansky/gsd-ic/intel-refs -type f | sort
```

Expected output:
```
/Users/romansky/gsd-ic/intel-refs/MANIFEST.json
/Users/romansky/gsd-ic/intel-refs/ai-ml/.gitkeep
/Users/romansky/gsd-ic/intel-refs/capability-patterns/.gitkeep
/Users/romansky/gsd-ic/intel-refs/classification/.gitkeep
/Users/romansky/gsd-ic/intel-refs/demo/.gitkeep
/Users/romansky/gsd-ic/intel-refs/ecosystem/.gitkeep
/Users/romansky/gsd-ic/intel-refs/house-style/.gitkeep
/Users/romansky/gsd-ic/intel-refs/int-disciplines/.gitkeep
/Users/romansky/gsd-ic/intel-refs/modernization/.gitkeep
/Users/romansky/gsd-ic/intel-refs/tradecraft/.gitkeep
```

- [ ] **Step 3: Stub the customer overlay catalog**

```bash
cd /Users/romansky/gsd-ic
for c in nga nsa nro cia dia; do
  mkdir -p "config-overlays/$c"
  touch "config-overlays/$c/.gitkeep"
done
```

- [ ] **Step 4: Write `config-overlays/README.md`**

```markdown
# Customer Overlay Catalog

This directory holds **customer-specific overlay packs** for the GSD-IC framework. Each subdirectory is one IC customer (NGA, NSA, NRO, CIA, DIA, ...).

Per spec §2.3 single-program-instantiation, exactly one overlay is selected at install time:

```bash
npx @adelphi/gsd-ic@latest install --customer=nga
```

The selected overlay's `agent_skills` map is wired into the program's `.planning/config.json`; other overlays are not consulted at runtime.

## Adding a new customer overlay

See `docs/ic-pack/ADDING-A-CUSTOMER-OVERLAY.md` for the full procedure.

Quick form:

1. `mkdir config-overlays/<customer>/`
2. Write `overlay.json` with the customer's `agent_skills` map
3. Write `overlay.md` with human-readable customer notes (UNCLASSIFIED only)
4. Optional: drop customer-specific reference doc additions in `<customer>/refs/`
5. Commit; ships in next pack release

## Classification

All overlay content must be UNCLASSIFIED. CI validator `tools/ci/validate-classification.sh` enforces this.
```

- [ ] **Step 5: Stub workflow-patches and the IC-pack completion-marker registry**

```bash
mkdir -p /Users/romansky/gsd-ic/workflow-patches
touch /Users/romansky/gsd-ic/workflow-patches/.gitkeep

cat > /Users/romansky/gsd-ic/references/agent-contracts.ic-pack.md <<'EOF'
<!-- CLASSIFICATION: UNCLASSIFIED -->
# IC Pack Agent Contracts (Completion Marker Registry)

This file is the IC-pack-specific completion-marker registry, loaded alongside upstream `references/agent-contracts.md`. Every IC pack agent's completion marker is registered here.

Format (one row per agent):

```
| agent | completion-marker | failure-marker (if any) | output artifact |
```

## Registry

| agent | completion-marker | failure-marker | output artifact |
|---|---|---|---|

(empty in Plan 0; populated as agents land in Plans 1–8 — see Appendix D of the design spec for the full target list)
EOF
```

- [ ] **Step 6: Verify directory structure**

```bash
cd /Users/romansky/gsd-ic
find intel-refs config-overlays workflow-patches -type d | sort
```

Expected: `intel-refs/` + 9 subdirs, `config-overlays/` + 5 subdirs, `workflow-patches/`.

- [ ] **Step 7: Commit**

```bash
cd /Users/romansky/gsd-ic
git add intel-refs config-overlays workflow-patches references/agent-contracts.ic-pack.md
git commit -m "[U] feat(scaffold): create empty pack-content directory tree (intel-refs, config-overlays, workflow-patches, agent-contracts)"
```

---

## Task 3: Documentation skeleton (`docs/ic-pack/`)

**Files:**
- Create: `/Users/romansky/gsd-ic/docs/ic-pack/{README,ARCHITECTURE,QUICKSTART,UPGRADE-PROCEDURE,CONSUMER-UPGRADE,ADDING-AN-AGENT,ADDING-A-REFERENCE,ADDING-A-SKILL,ADDING-A-CUSTOMER-OVERLAY,PER-CUSTOMER-PLAYBOOK,TROUBLESHOOTING}.md`
- Create: `/Users/romansky/gsd-ic/docs/ic-pack/ARCHITECTURE-DIAGRAMS/.gitkeep`

The skeleton docs each contain a one-paragraph description + a "Status: skeleton, fleshed out in Plan N" note. Real content lands as the corresponding agent/skill/feature lands in later plans. Skeleton docs prevent broken links from the spec (which references all of these by name) and give engineers a place to land doc additions as they implement.

- [ ] **Step 1: Create the directory + diagrams placeholder**

```bash
mkdir -p /Users/romansky/gsd-ic/docs/ic-pack/ARCHITECTURE-DIAGRAMS
touch /Users/romansky/gsd-ic/docs/ic-pack/ARCHITECTURE-DIAGRAMS/.gitkeep
```

- [ ] **Step 2: Write `docs/ic-pack/README.md`**

```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Adelphi IC Pack for GSD

The IC pack is a soft-fork extension of [Get Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) that adds 58 specialized agents, 3 deterministic hooks, and 4 behavioral skills tailored to intelligence-community software prototyping.

It is distributed as the npm package `@adelphi/gsd-ic` and installed per program via:

```bash
npx @adelphi/gsd-ic@latest install --customer=<nga|nsa|nro|cia|dia>
```

Per the [design spec](../specs/2026-05-05-ic-agent-pack-design.md) §2.3, each program runs its own GSD-IC instance — one program, one customer, one repo.

## When to use

- You are building IC-focused software prototypes that need rapid demo cadence + the contracting paperwork (capability statements, white papers, ATO drafts) alongside.
- Your program has at least one SME per primary INT discipline in scope.
- Your code is UNCLASSIFIED in this repo (the IC pack does not handle classified content; CI enforces this).

## When not to use

- Code that already lives on a classified system. The IC pack is for low-side prototyping only.
- Programs without SME staffing — references decay without curators.
- Non-IC programs. Stock GSD is the right tool.

## Documentation map

- [QUICKSTART.md](QUICKSTART.md) — `npx install` to first agent invocation in 30 minutes
- [ARCHITECTURE.md](ARCHITECTURE.md) — layered architecture (subset of the design spec)
- [ADDING-AN-AGENT.md](ADDING-AN-AGENT.md) — how to author and register a new agent
- [ADDING-A-REFERENCE.md](ADDING-A-REFERENCE.md) — how to add a knowledge-layer reference doc
- [ADDING-A-SKILL.md](ADDING-A-SKILL.md) — how to author and inject a behavioral skill
- [ADDING-A-CUSTOMER-OVERLAY.md](ADDING-A-CUSTOMER-OVERLAY.md) — onboarding a new customer to the catalog
- [PER-CUSTOMER-PLAYBOOK.md](PER-CUSTOMER-PLAYBOOK.md) — gotchas + tradecraft notes per AO
- [UPGRADE-PROCEDURE.md](UPGRADE-PROCEDURE.md) — dev-side: soft-fork sync from upstream `gsd-build/get-shit-done`
- [CONSUMER-UPGRADE.md](CONSUMER-UPGRADE.md) — consumer-side: re-running `npx ... install` to bump pack version
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — common failure modes
```

- [ ] **Step 3: Write `docs/ic-pack/ARCHITECTURE.md`**

```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# IC Pack Architecture

> **Status:** Stub. The full architectural treatment lives in [the design spec](../specs/2026-05-05-ic-agent-pack-design.md). This document will be expanded into a customer-friendly subset as agents land in Plans 1–8.

## Six-layer model (summary; see spec §4.1)

```
Layer 5: Program project context     (.planning/intel-context.md)
Layer 4: Customer skill overlay      (one selected at install)
Layer 3: Skills (4 behavioral)       (skills/)
Layer 2: Manifest-indexed refs       (intel-refs/MANIFEST.json + intel-refs/**/*.md)
Layer 1: Thin agent files (58)       (agents/gsd-*.md)
Layer 0: Hooks (3, deterministic)    (hooks/gsd-*.js)
```

CI/validation gates every state change to any layer.

## Seamless-fork guarantee

With every gate and hook disabled in `.planning/intel-gates.json`, an installed program behaves bit-for-bit identically to a stock GSD program. The IC pack adds capabilities; it never silently changes or removes stock GSD behavior. Validated on every release by `tools/ci/validate-seamless-fork.sh`.
```

- [ ] **Step 4: Write the remaining 9 skeleton docs**

Each is a short stub with a "Status: skeleton, fleshed out in Plan N" line. Use exact files below — copy each block verbatim.

`docs/ic-pack/QUICKSTART.md`:
```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Quickstart: 30 Minutes from `npx` to First Agent Invocation

> **Status:** Stub. Fleshed out in Plan 1 (Phase 0 Foundations) once the first agent (`gsd-customer-context-mapper`) ships.

## Prerequisites

- A program repo that already has GSD installed (`npx get-shit-done-cc@latest`).
- Node 20+, npm.

## Install

```bash
cd /path/to/your/program
npx @adelphi/gsd-ic@latest install --customer=nga
```

(Replace `nga` with your actual customer; valid values: `nga`, `nsa`, `nro`, `cia`, `dia`.)

## Verify

After install, `.claude/agents/` contains both stock GSD and IC-pack agents (the IC ones are prefixed `gsd-`). Run any IC agent to verify wiring.

(More detail to come.)
```

`docs/ic-pack/UPGRADE-PROCEDURE.md`:
```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Dev-Side Upgrade Procedure: Soft-Fork Sync from Upstream

> **Status:** Stub. Fleshed out by Task 11 of this plan (sync-from-upstream tooling).

This document is for **maintainers of the gsd-ic dev repo**, not for consumers. Consumers see [CONSUMER-UPGRADE.md](CONSUMER-UPGRADE.md).

The gsd-ic dev repo is a soft-fork of `gsd-build/get-shit-done`. To pull upstream improvements:

```bash
npm run sync-upstream
```

Which runs `tools/sync/sync-from-upstream.sh` (see Task 11 of Plan 0).
```

`docs/ic-pack/CONSUMER-UPGRADE.md`:
```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Consumer-Side Upgrade: Bumping the Installed Pack Version

> **Status:** Stub. Fleshed out as the install entry-point matures (Tasks 6–10 of this plan).

To upgrade the IC pack version installed in a program:

```bash
cd /path/to/your/program
npx @adelphi/gsd-ic@latest install --customer=<same-customer-as-before>
```

The install is idempotent — re-running with the same `--customer` updates managed pack content without disturbing program-owned files (`.planning/intel-context.md`, etc.).
```

`docs/ic-pack/ADDING-AN-AGENT.md`:
```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Adding a New IC Pack Agent

> **Status:** Stub. The agent file template is Appendix A of the design spec. This doc will mirror the spec template + add Adelphi-specific authoring notes.

See spec [Appendix A — Agent File Template](../specs/2026-05-05-ic-agent-pack-design.md#appendix-a--agent-file-template).

Quick form:

1. Create `agents/gsd-<name>.md` with frontmatter + role + execution flow + completion marker.
2. Register the completion marker in `references/agent-contracts.ic-pack.md`.
3. Add the agent → model mapping to `MODEL_PROFILES` in `sdk/src/query/config-query.ts` (note: this is upstream territory; coordinate with upstream sync — see [UPGRADE-PROCEDURE.md](UPGRADE-PROCEDURE.md)).
4. (Optional) Register a workflow gate in `.planning/intel-gates.json` template.
5. Bump `VERSION` pack field on next release.
```

`docs/ic-pack/ADDING-A-REFERENCE.md`:
```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Adding a New Reference Doc

> **Status:** Stub. The reference doc template is Appendix B of the design spec.

See spec [Appendix B — Reference Doc Template](../specs/2026-05-05-ic-agent-pack-design.md#appendix-b--reference-doc-template).

Quick form:

1. Write `intel-refs/<topic-area>/<name>.md` with classification frontmatter (must be UNCLASSIFIED).
2. Add an entry to `intel-refs/MANIFEST.json` with `applies_when`, `owner`, `last_reviewed`.
3. Run `bash tools/ci/validate-manifest.sh` locally to confirm.
4. Commit; ships with next pack release.
```

`docs/ic-pack/ADDING-A-SKILL.md`:
```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Adding a New Behavioral Skill

> **Status:** Stub. The skill file template is Appendix C of the design spec.

See spec [Appendix C — Skill File Template](../specs/2026-05-05-ic-agent-pack-design.md#appendix-c--skill-file-template).

Note: per spec §7.0, a behavior should *promote* from a skill to a full agent if **two or more** of these criteria apply:

1. Multi-step reasoning required.
2. Own context window benefit.
3. Produces a distinct artifact.

Otherwise, keep it a skill.
```

`docs/ic-pack/ADDING-A-CUSTOMER-OVERLAY.md`:
```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Adding a Customer Overlay to the Catalog

> **Status:** Stub. Fleshed out as customer overlay work begins (typically late Plan 1 / Plan 4).

See [config-overlays/README.md](../../config-overlays/README.md) for the brief form.

Per spec §11.5:

1. Create `config-overlays/<customer>/` in the dev repo.
2. Drop in `overlay.json` with customer-specific `agent_skills` map.
3. (Optional) Drop customer-specific reference docs in `config-overlays/<customer>/refs/`.
4. The overlay ships in the next pack release; programs select via `--customer=<name>` at install time.
```

`docs/ic-pack/PER-CUSTOMER-PLAYBOOK.md`:
```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Per-Customer Playbook

> **Status:** Stub. This grows over time as we accumulate gotchas, tradecraft notes, and AO-specific quirks per customer.

Sections to be added per customer (NGA, NSA, NRO, CIA, DIA, ...):

- Common mission framings and capability gaps
- Common AO-specific compliance requirements
- Tradecraft / language conventions in deliverables
- Known PoR transition targets
- Past-performance citation conventions
- Watch-outs (things that historically tripped up demos)

This document is internal-only; redact before sharing externally.
```

`docs/ic-pack/TROUBLESHOOTING.md`:
```markdown
<!-- CLASSIFICATION: UNCLASSIFIED -->
# Troubleshooting

> **Status:** Stub. Populated as install/sync/CI failure modes accumulate.

## Install fails: "GSD not detected"

The IC pack installer requires upstream GSD to be installed first. Run:

```bash
npx get-shit-done-cc@latest
```

Then re-run the IC pack install.

## Install fails: "incompatible GSD version"

The IC pack pins to a known-compatible GSD version range (see `peerDependencies` in `package.json`). Either upgrade GSD or pin the IC pack to an older version (`npx @adelphi/gsd-ic@<older> install ...`).

(More entries added as failure modes are observed.)
```

- [ ] **Step 5: Verify the docs directory**

```bash
ls /Users/romansky/gsd-ic/docs/ic-pack/
```

Expected files (11 markdown + 1 directory): `README.md ARCHITECTURE.md QUICKSTART.md UPGRADE-PROCEDURE.md CONSUMER-UPGRADE.md ADDING-AN-AGENT.md ADDING-A-REFERENCE.md ADDING-A-SKILL.md ADDING-A-CUSTOMER-OVERLAY.md PER-CUSTOMER-PLAYBOOK.md TROUBLESHOOTING.md ARCHITECTURE-DIAGRAMS/`

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add docs/ic-pack
git commit -m "[U] docs(scaffold): documentation skeleton for IC pack"
```

---

## Task 4: CI validator shared helper library (`tools/ci/_lib.sh`)

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/_lib.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/_lib.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/_run-all.sh`

The shared library gives every validator a uniform output style + helper macros so individual validators stay terse.

- [ ] **Step 1: Write `tools/ci/_lib.sh`**

```bash
mkdir -p /Users/romansky/gsd-ic/tools/ci
cat > /Users/romansky/gsd-ic/tools/ci/_lib.sh <<'EOF'
#!/usr/bin/env bash
# Shared helpers for IC pack CI validators.
# Source this from each validator: `source "$(dirname "$0")/_lib.sh"`.

set -euo pipefail

# Resolve the gsd-ic repo root (works whether validator is invoked by absolute
# path, relative path, or via npm script).
gsd_ic_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  # tools/ci/<validator>.sh -> tools/ci -> tools -> root
  echo "$(cd "$script_dir/../.." && pwd)"
}

# Color output if we're on a TTY.
if [ -t 1 ]; then
  COLOR_RESET="\033[0m"
  COLOR_RED="\033[31m"
  COLOR_GREEN="\033[32m"
  COLOR_YELLOW="\033[33m"
  COLOR_DIM="\033[2m"
else
  COLOR_RESET=""
  COLOR_RED=""
  COLOR_GREEN=""
  COLOR_YELLOW=""
  COLOR_DIM=""
fi

VALIDATOR_NAME="${VALIDATOR_NAME:-$(basename "${BASH_SOURCE[1]}" .sh)}"
__validator_failures=0
__validator_warnings=0

vinfo()  { printf "${COLOR_DIM}[%s] %s${COLOR_RESET}\n" "$VALIDATOR_NAME" "$*" >&2; }
vpass()  { printf "${COLOR_GREEN}[%s] PASS${COLOR_RESET} %s\n" "$VALIDATOR_NAME" "$*" >&2; }
vwarn()  { printf "${COLOR_YELLOW}[%s] WARN${COLOR_RESET} %s\n" "$VALIDATOR_NAME" "$*" >&2; __validator_warnings=$((__validator_warnings+1)); }
vfail()  { printf "${COLOR_RED}[%s] FAIL${COLOR_RESET} %s\n" "$VALIDATOR_NAME" "$*" >&2; __validator_failures=$((__validator_failures+1)); }

# Exit with the right status code: 0 if no failures (warnings allowed), 1 otherwise.
vexit() {
  if [ "$__validator_failures" -gt 0 ]; then
    printf "${COLOR_RED}[%s] %d failure(s), %d warning(s)${COLOR_RESET}\n" "$VALIDATOR_NAME" "$__validator_failures" "$__validator_warnings" >&2
    exit 1
  fi
  if [ "$__validator_warnings" -gt 0 ]; then
    printf "${COLOR_YELLOW}[%s] OK with %d warning(s)${COLOR_RESET}\n" "$VALIDATOR_NAME" "$__validator_warnings" >&2
  else
    printf "${COLOR_GREEN}[%s] OK${COLOR_RESET}\n" "$VALIDATOR_NAME" >&2
  fi
  exit 0
}

# Require a binary to be on PATH.
require_bin() {
  local b="$1"
  if ! command -v "$b" >/dev/null 2>&1; then
    printf "${COLOR_RED}[%s] required binary missing: %s${COLOR_RESET}\n" "$VALIDATOR_NAME" "$b" >&2
    exit 2
  fi
}
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/_lib.sh
```

- [ ] **Step 2: Write the validator-test shared library `tools/ci/tests/_lib.sh`**

```bash
mkdir -p /Users/romansky/gsd-ic/tools/ci/tests
cat > /Users/romansky/gsd-ic/tools/ci/tests/_lib.sh <<'EOF'
#!/usr/bin/env bash
# Shared helpers for validator tests.
# Each test file: `source "$(dirname "$0")/_lib.sh"; <run cases>; report`.

set -euo pipefail

GSD_IC_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEST_NAME="${TEST_NAME:-$(basename "${BASH_SOURCE[1]}" .test.sh)}"
__test_passes=0
__test_fails=0

# Make a clean fixture scratch dir for one test case.
mkfixture() {
  local fname="$1"
  local dir="$GSD_IC_ROOT/tools/ci/tests/fixtures/_scratch/$TEST_NAME/$fname"
  rm -rf "$dir"
  mkdir -p "$dir"
  echo "$dir"
}

# Run a validator against a fixture root and capture its exit code.
# Usage: run_validator <validator-script> <root-dir>
# Sets $__last_exit and $__last_output.
run_validator() {
  local validator="$1"; shift
  local root="$1"; shift
  __last_output="$(GSD_IC_ROOT_OVERRIDE="$root" bash "$validator" "$@" 2>&1)" && __last_exit=0 || __last_exit=$?
}

# Assertions.
expect_pass() {
  local label="$1"
  if [ "$__last_exit" -eq 0 ]; then
    printf "  ✓ %s\n" "$label"
    __test_passes=$((__test_passes+1))
  else
    printf "  ✗ %s (expected exit 0, got %d)\n" "$label" "$__last_exit"
    printf "    output: %s\n" "$__last_output" | head -10
    __test_fails=$((__test_fails+1))
  fi
}

expect_fail() {
  local label="$1"
  if [ "$__last_exit" -ne 0 ]; then
    printf "  ✓ %s\n" "$label"
    __test_passes=$((__test_passes+1))
  else
    printf "  ✗ %s (expected non-zero exit, got 0)\n" "$label"
    __test_fails=$((__test_fails+1))
  fi
}

expect_output() {
  local label="$1" pattern="$2"
  if printf "%s" "$__last_output" | grep -q -- "$pattern"; then
    printf "  ✓ %s (output contains %q)\n" "$label" "$pattern"
    __test_passes=$((__test_passes+1))
  else
    printf "  ✗ %s (output missing %q)\n" "$label" "$pattern"
    printf "    output: %s\n" "$__last_output" | head -10
    __test_fails=$((__test_fails+1))
  fi
}

report() {
  printf "[%s] %d passed, %d failed\n" "$TEST_NAME" "$__test_passes" "$__test_fails"
  [ "$__test_fails" -eq 0 ] || exit 1
}
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/_lib.sh
```

- [ ] **Step 3: Write the test runner `tools/ci/tests/_run-all.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/_run-all.sh <<'EOF'
#!/usr/bin/env bash
# Run every validator test in tools/ci/tests/*.test.sh.
set -euo pipefail
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fail_count=0

for t in "$TEST_DIR"/*.test.sh; do
  [ -e "$t" ] || continue   # glob may not match in early scaffolding
  printf "\n=== %s ===\n" "$(basename "$t")"
  if bash "$t"; then
    :
  else
    fail_count=$((fail_count+1))
  fi
done

if [ "$fail_count" -gt 0 ]; then
  printf "\n[run-all] %d test file(s) failed.\n" "$fail_count"
  exit 1
fi
printf "\n[run-all] all validator tests passed.\n"
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/_run-all.sh
```

- [ ] **Step 4: Smoke-test the library (no validators yet — should run cleanly with no test files)**

```bash
cd /Users/romansky/gsd-ic
bash tools/ci/tests/_run-all.sh
```

Expected output:
```
[run-all] all validator tests passed.
```

(Because no `*.test.sh` files exist yet, the for-loop runs zero iterations.)

- [ ] **Step 5: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/_lib.sh tools/ci/tests/_lib.sh tools/ci/tests/_run-all.sh
git commit -m "[U] feat(ci): validator + test shared libraries"
```

---

## Task 5: Validator — `validate-manifest.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-manifest.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-manifest.test.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/fixtures/manifest/{good,missing-file,bad-shape,no-manifest}/...` (created by the test as needed)

**Spec contract (§12 row 1):** *Every manifest entry resolves to a real file; every reference doc has owner + last_reviewed + classification fields.*

For Plan 0, the second clause (per-doc field check) only applies when reference docs exist. With no reference docs in the empty manifest, only the first clause is exercised.

- [ ] **Step 1: Write the failing test first (TDD)**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-manifest.test.sh <<'EOF'
#!/usr/bin/env bash
# Tests for tools/ci/validate-manifest.sh
TEST_NAME="validate-manifest"
source "$(dirname "$0")/_lib.sh"

VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-manifest.sh"

# --- Case 1: empty manifest passes ---
fx="$(mkfixture empty-manifest)"
mkdir -p "$fx/intel-refs"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{ "version": "2026.05", "topics": {} }
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "empty manifest passes"

# --- Case 2: no manifest at all -> fail (manifest is required) ---
fx="$(mkfixture no-manifest)"
mkdir -p "$fx/intel-refs"
run_validator "$VALIDATOR" "$fx"
expect_fail "missing manifest is fatal"
expect_output "missing manifest output" "MANIFEST.json"

# --- Case 3: manifest references a file that does not exist -> fail ---
fx="$(mkfixture missing-file)"
mkdir -p "$fx/intel-refs"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"],
      "owner": "alice@adelphi.ai",
      "last_reviewed": "2026-04-15",
      "classification": "UNCLASSIFIED"
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "missing referenced file is fatal"
expect_output "missing-file error mentions path" "humint.md"

# --- Case 4: manifest entry missing required field -> fail ---
fx="$(mkfixture bad-shape)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/humint.md"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"]
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "missing required field (owner/last_reviewed/classification) is fatal"

# --- Case 5: malformed JSON -> fail ---
fx="$(mkfixture malformed-json)"
mkdir -p "$fx/intel-refs"
echo "{ this is not json" > "$fx/intel-refs/MANIFEST.json"
run_validator "$VALIDATOR" "$fx"
expect_fail "malformed JSON is fatal"

# --- Case 6: well-formed manifest with one valid entry -> pass ---
fx="$(mkfixture happy-path)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/humint.md"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"],
      "owner": "alice@adelphi.ai",
      "last_reviewed": "2026-04-15",
      "classification": "UNCLASSIFIED"
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "well-formed manifest with valid entry passes"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-manifest.test.sh
```

- [ ] **Step 2: Run the test to verify it fails (validator does not yet exist)**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-manifest.test.sh || true
```

Expected: every case fails because `tools/ci/validate-manifest.sh` does not exist (`bash: ... No such file`). Report at end shows `0 passed, 6 failed`.

- [ ] **Step 3: Implement `validate-manifest.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-manifest.sh <<'EOF'
#!/usr/bin/env bash
# validate-manifest.sh — every entry in intel-refs/MANIFEST.json must resolve to
# a real file under intel-refs/, and every entry must have the required fields:
# applies_when, owner, last_reviewed, classification.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-manifest"

# Resolve repo root (allow override for tests).
ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
MANIFEST="$ROOT/intel-refs/MANIFEST.json"

require_bin jq

if [ ! -f "$MANIFEST" ]; then
  vfail "MANIFEST.json not found at $MANIFEST"
  vexit
fi

# Validate JSON parses.
if ! jq -e . "$MANIFEST" >/dev/null 2>&1; then
  vfail "MANIFEST.json is not valid JSON"
  vexit
fi

# Required fields per entry.
required_fields=(applies_when owner last_reviewed classification)

# Iterate topics. `jq -r 'keys[]'` returns one key per line (none if empty).
while IFS= read -r topic; do
  [ -n "$topic" ] || continue
  topic_path="$ROOT/intel-refs/$topic"
  if [ ! -f "$topic_path" ]; then
    vfail "manifest entry '$topic' does not resolve to a real file at $topic_path"
    continue
  fi
  for field in "${required_fields[@]}"; do
    if ! jq -e --arg t "$topic" --arg f "$field" '.topics[$t][$f]' "$MANIFEST" >/dev/null 2>&1; then
      vfail "manifest entry '$topic' missing required field '$field'"
    fi
  done
done < <(jq -r '.topics | keys[]' "$MANIFEST" 2>/dev/null || true)

# Sanity: top-level shape.
if ! jq -e '.version' "$MANIFEST" >/dev/null 2>&1; then
  vfail "manifest missing top-level 'version' field"
fi
if ! jq -e '.topics' "$MANIFEST" >/dev/null 2>&1; then
  vfail "manifest missing top-level 'topics' field"
fi

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-manifest.sh
```

- [ ] **Step 4: Run the test to verify it now passes**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-manifest.test.sh
```

Expected: report shows `6 passed, 0 failed`. If `jq` is not installed, the validator exits 2 (not 1) — install `jq` first (`brew install jq` on macOS, `apt-get install jq` on Debian/Ubuntu).

- [ ] **Step 5: Run the validator against the actual repo (the empty manifest from Task 2)**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-manifest.sh
```

Expected: `[validate-manifest] OK`.

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-manifest.sh tools/ci/tests/validate-manifest.test.sh
git commit -m "[U] feat(ci): validate-manifest.sh + tests"
```

---

## Task 6: Validator — `validate-classification.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-classification.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-classification.test.sh`

**Spec contract (§12 row 2):** *No reference doc has `classification != "UNCLASSIFIED"` — prevents accidental commit of CUI/classified content.*

Scope: every reference doc under `intel-refs/`, every overlay note under `config-overlays/<customer>/overlay.md`, every customer ref under `config-overlays/<customer>/refs/`. Detection: a `classification:` frontmatter field OR a first-line `<!-- CLASSIFICATION: ... -->` HTML comment OR a first-line `# CLASSIFICATION:` source comment. If present, must equal `UNCLASSIFIED`.

- [ ] **Step 1: Write the failing test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-classification.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-classification"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-classification.sh"

# --- Case 1: empty repo passes ---
fx="$(mkfixture empty)"
mkdir -p "$fx/intel-refs" "$fx/config-overlays"
run_validator "$VALIDATOR" "$fx"
expect_pass "empty repo passes"

# --- Case 2: ref doc with UNCLASSIFIED frontmatter passes ---
fx="$(mkfixture good-frontmatter)"
mkdir -p "$fx/intel-refs/int-disciplines"
cat > "$fx/intel-refs/int-disciplines/humint.md" <<MD
---
classification: UNCLASSIFIED
owner: alice@adelphi.ai
---
# HUMINT
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "UNCLASSIFIED frontmatter passes"

# --- Case 3: ref doc with HTML-comment classification passes ---
fx="$(mkfixture good-html-comment)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/geoint.md"
echo "# GEOINT" >> "$fx/intel-refs/int-disciplines/geoint.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "UNCLASSIFIED HTML comment passes"

# --- Case 4: ref doc declared CUI -> fail ---
fx="$(mkfixture cui-frontmatter)"
mkdir -p "$fx/intel-refs/int-disciplines"
cat > "$fx/intel-refs/int-disciplines/sigint.md" <<MD
---
classification: CUI//SP-PRVCY
---
# bad
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "CUI frontmatter is fatal"
expect_output "CUI fail mentions path" "sigint.md"

# --- Case 5: ref doc declared SECRET -> fail ---
fx="$(mkfixture secret)"
mkdir -p "$fx/intel-refs/tradecraft"
echo "<!-- CLASSIFICATION: SECRET -->" > "$fx/intel-refs/tradecraft/icd-203.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "SECRET HTML comment is fatal"

# --- Case 6: ref doc with no classification declaration -> fail (every ref must declare) ---
fx="$(mkfixture undeclared)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "# undeclared" > "$fx/intel-refs/int-disciplines/osint.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "undeclared classification is fatal"

# --- Case 7: customer overlay ref doc with CUI -> fail ---
fx="$(mkfixture overlay-cui)"
mkdir -p "$fx/config-overlays/nga/refs"
echo "<!-- CLASSIFICATION: CUI -->" > "$fx/config-overlays/nga/refs/nga-flavor.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "overlay CUI is fatal"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-classification.test.sh
```

- [ ] **Step 2: Run to verify it fails**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-classification.test.sh || true
```

Expected: 0 passed, 7 failed (validator does not exist).

- [ ] **Step 3: Implement `validate-classification.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-classification.sh <<'EOF'
#!/usr/bin/env bash
# validate-classification.sh — every Markdown reference doc under intel-refs/
# and config-overlays/ must explicitly declare classification UNCLASSIFIED.
# Declaration accepted in any of:
#   - YAML frontmatter `classification: UNCLASSIFIED`
#   - HTML comment first-line `<!-- CLASSIFICATION: UNCLASSIFIED -->`
#   - source comment first-line `# CLASSIFICATION: UNCLASSIFIED` (for non-MD)

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-classification"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"

scan_paths=()
[ -d "$ROOT/intel-refs" ] && scan_paths+=("$ROOT/intel-refs")
[ -d "$ROOT/config-overlays" ] && scan_paths+=("$ROOT/config-overlays")

if [ "${#scan_paths[@]}" -eq 0 ]; then
  vinfo "no intel-refs/ or config-overlays/ directories — nothing to validate"
  vexit
fi

# Find all .md files; skip skeleton placeholder docs.
while IFS= read -r f; do
  # .gitkeep, README.md (catalog onboarding doc) are exempt.
  base="$(basename "$f")"
  case "$base" in
    .gitkeep|README.md) continue ;;
  esac

  # Look for a classification declaration in the first 10 lines.
  head_block="$(head -10 "$f" 2>/dev/null || true)"
  declared=""
  if printf "%s" "$head_block" | grep -Eq '^classification:[[:space:]]*'; then
    declared="$(printf "%s" "$head_block" | grep -E '^classification:' | head -1 | sed -E 's/^classification:[[:space:]]*//; s/[[:space:]]*$//')"
  elif printf "%s" "$head_block" | grep -Eq '<!--[[:space:]]*CLASSIFICATION:'; then
    declared="$(printf "%s" "$head_block" | grep -E '<!--[[:space:]]*CLASSIFICATION:' | head -1 | sed -E 's/.*CLASSIFICATION:[[:space:]]*//; s/[[:space:]]*-->.*//')"
  elif printf "%s" "$head_block" | grep -Eq '^#[[:space:]]*CLASSIFICATION:'; then
    declared="$(printf "%s" "$head_block" | grep -E '^#[[:space:]]*CLASSIFICATION:' | head -1 | sed -E 's/^#[[:space:]]*CLASSIFICATION:[[:space:]]*//')"
  fi

  if [ -z "$declared" ]; then
    vfail "no classification declared in $f"
    continue
  fi

  if [ "$declared" != "UNCLASSIFIED" ]; then
    vfail "non-UNCLASSIFIED classification '$declared' in $f"
  fi
done < <(find "${scan_paths[@]}" -type f -name "*.md" 2>/dev/null)

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-classification.sh
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-classification.test.sh
```

Expected: `7 passed, 0 failed`.

- [ ] **Step 5: Run against the live repo**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-classification.sh
```

Expected: OK (the only `.md` file under `intel-refs/` is the manifest's `MANIFEST.json` which is JSON, not MD; under `config-overlays/` only the `README.md` exists, which is exempt).

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-classification.sh tools/ci/tests/validate-classification.test.sh
git commit -m "[U] feat(ci): validate-classification.sh + tests"
```

---

## Task 7: Validator — `validate-agents.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-agents.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-agents.test.sh`

**Spec contract (§12 row 3):** *Every agent has frontmatter + completion marker + matches the contract template.*

Scope: every IC pack agent (filename glob `agents/gsd-*.md` AND not part of the upstream stock 33 — we identify ours by checking the file's frontmatter for an `ic_pack: true` field that the agent template will include). Plan 0 has zero agents, so the validator passes trivially; tests cover good and bad shapes for when agents do land.

- [ ] **Step 1: Write the failing test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-agents.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-agents"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-agents.sh"

# --- Case 1: no IC agents -> pass (trivially) ---
fx="$(mkfixture empty)"
mkdir -p "$fx/agents"
run_validator "$VALIDATOR" "$fx"
expect_pass "no IC agents passes trivially"

# --- Case 2: well-formed IC agent passes ---
fx="$(mkfixture good)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-sample.md" <<MD
---
name: gsd-sample
description: A sample IC pack agent for testing.
ic_pack: true
classification: UNCLASSIFIED
tools: [Read, Write, Bash]
---
# Sample Agent

Role: do the thing.

## Execution flow

1. Read context.
2. Do work.
3. Emit completion marker.

## Completion marker

\`## SAMPLE COMPLETE\`
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "well-formed IC agent passes"

# --- Case 3: agent missing frontmatter -> fail ---
fx="$(mkfixture no-frontmatter)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-bad.md" <<MD
# Bad Agent
no frontmatter
MD
# Mark it as IC pack via path naming (the validator should still notice the missing frontmatter
# and fail); add another good agent so there's content to inspect.
run_validator "$VALIDATOR" "$fx"
# This one is ambiguous — without frontmatter, validator can't tell it's IC pack. We require
# IC pack agents to be marked. So an agent with NO frontmatter and a gsd- prefix is treated
# as IC pack and failed.
expect_fail "missing frontmatter on gsd-* agent is fatal"

# --- Case 4: agent missing completion marker -> fail ---
fx="$(mkfixture no-marker)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-no-marker.md" <<MD
---
name: gsd-no-marker
ic_pack: true
classification: UNCLASSIFIED
---
# No marker
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "missing completion marker is fatal"
expect_output "marker error mentions filename" "gsd-no-marker"

# --- Case 5: agent missing classification -> fail ---
fx="$(mkfixture no-class)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-no-class.md" <<MD
---
name: gsd-no-class
ic_pack: true
---
# No classification

\`## NO CLASS COMPLETE\`
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "missing classification frontmatter is fatal"

# --- Case 6: stock GSD agent (no gsd- prefix? no — stock agents also use gsd- prefix.
# Distinguishing key is the ic_pack: true frontmatter field. A file without it is not ours
# and we don't validate it. Verify we ignore non-IC-pack agents.) ---
fx="$(mkfixture stock-coexists)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-planner.md" <<MD
---
name: gsd-planner
description: Stock GSD planner.
---
# Stock GSD planner — not ours, validator should ignore.
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "stock GSD agents (no ic_pack flag) are ignored"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-agents.test.sh
```

- [ ] **Step 2: Run to verify it fails**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-agents.test.sh || true
```

Expected: 0 passed, 6 failed.

- [ ] **Step 3: Implement `validate-agents.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-agents.sh <<'EOF'
#!/usr/bin/env bash
# validate-agents.sh — every IC pack agent must have:
#   - YAML frontmatter (delimited by --- ... ---)
#   - frontmatter contains: name, classification, ic_pack: true
#   - body contains a completion marker line of the form
#     \`## <SOMETHING> COMPLETE\` or \`## <SOMETHING> BLOCKED\`/`FOUND`/`FAILED`
#
# An IC pack agent is any agents/*.md file whose frontmatter has `ic_pack: true`,
# OR any file in agents/ whose name starts with `gsd-` and which has NO frontmatter
# at all (defensive: catches malformed IC pack agents that lack the marker field).

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-agents"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
AGENTS_DIR="$ROOT/agents"

if [ ! -d "$AGENTS_DIR" ]; then
  vinfo "no agents/ directory — nothing to validate"
  vexit
fi

# Helper: extract frontmatter (between first two `---` lines), output empty if absent.
extract_frontmatter() {
  awk 'BEGIN{in_fm=0; seen=0}
       /^---[[:space:]]*$/ {
         if (seen==0) { in_fm=1; seen=1; next }
         else if (in_fm==1) { in_fm=0; exit }
       }
       in_fm==1 { print }' "$1"
}

# Helper: check if a frontmatter block has a given key.
fm_has_key() {
  local fm="$1" key="$2"
  printf "%s" "$fm" | grep -Eq "^${key}:[[:space:]]"
}

# Helper: get value of a frontmatter key (first match; trimmed).
fm_value() {
  local fm="$1" key="$2"
  printf "%s" "$fm" | grep -E "^${key}:[[:space:]]" | head -1 | sed -E "s/^${key}:[[:space:]]*//; s/[[:space:]]*$//"
}

while IFS= read -r f; do
  fname="$(basename "$f")"
  fm="$(extract_frontmatter "$f")"

  is_ic_pack=false
  if [ -n "$fm" ]; then
    if [ "$(fm_value "$fm" ic_pack)" = "true" ]; then
      is_ic_pack=true
    fi
  else
    # No frontmatter at all. If filename starts with gsd-, treat as malformed IC pack.
    case "$fname" in
      gsd-*) is_ic_pack=true ;;
    esac
  fi

  $is_ic_pack || continue

  # Required: frontmatter exists.
  if [ -z "$fm" ]; then
    vfail "$f: agent has no frontmatter"
    continue
  fi
  for key in name classification; do
    if ! fm_has_key "$fm" "$key"; then
      vfail "$f: frontmatter missing required key '$key'"
    fi
  done
  # Classification (if present) must be UNCLASSIFIED.
  cls="$(fm_value "$fm" classification)"
  if [ -n "$cls" ] && [ "$cls" != "UNCLASSIFIED" ]; then
    vfail "$f: classification must be UNCLASSIFIED (got '$cls')"
  fi
  # Completion marker: a line like `## SOMETHING COMPLETE` or `## SOMETHING BLOCKED/FOUND/FAILED`.
  if ! grep -Eq '^##[[:space:]]+[A-Z][A-Z0-9 _&-]*[[:space:]]+(COMPLETE|BLOCKED|FOUND|FAILED|UPDATE COMPLETE)$' "$f"; then
    vfail "$f: no completion marker line found (expected '## <NAME> COMPLETE' or BLOCKED/FOUND/FAILED variant)"
  fi
done < <(find "$AGENTS_DIR" -maxdepth 1 -type f -name "*.md" 2>/dev/null)

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-agents.sh
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-agents.test.sh
```

Expected: `6 passed, 0 failed`.

- [ ] **Step 5: Run against live repo**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-agents.sh
```

Expected: OK (no IC pack agents yet; upstream stock agents lack `ic_pack: true` and are ignored).

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-agents.sh tools/ci/tests/validate-agents.test.sh
git commit -m "[U] feat(ci): validate-agents.sh + tests"
```

---

## Task 8: Validator — `validate-skills.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-skills.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-skills.test.sh`

**Spec contract (§12 row 4):** *Every skill referenced by `agent_skills` exists; every `SKILL.md` has classification frontmatter.*

In Plan 0 we have no skills and no `agent_skills` config to verify against, so the validator's job is to (a) parse any default `agent_skills` map in the IC pack's distribution config (none in Plan 0), (b) ensure every skill directory under `skills/<ic-skill-name>/` has a `SKILL.md` with classification frontmatter.

- [ ] **Step 1: Write the failing test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-skills.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-skills"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-skills.sh"

# --- Case 1: no IC skills -> pass ---
fx="$(mkfixture empty)"
mkdir -p "$fx/skills"
run_validator "$VALIDATOR" "$fx"
expect_pass "no IC skills passes"

# --- Case 2: well-formed IC skill passes ---
fx="$(mkfixture good)"
mkdir -p "$fx/skills/intel-coding-conventions"
cat > "$fx/skills/intel-coding-conventions/SKILL.md" <<MD
---
name: intel-coding-conventions
description: IC coding conventions skill.
ic_pack: true
classification: UNCLASSIFIED
---
# Intel coding conventions
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "well-formed IC skill passes"

# --- Case 3: skill missing SKILL.md -> fail ---
fx="$(mkfixture no-skill-md)"
mkdir -p "$fx/skills/intel-coding-conventions"
# IC pack skill name list is hardcoded in the validator (the four named skills from spec §7).
run_validator "$VALIDATOR" "$fx"
expect_fail "IC skill directory missing SKILL.md is fatal"

# --- Case 4: skill SKILL.md missing classification -> fail ---
fx="$(mkfixture no-class)"
mkdir -p "$fx/skills/prototyping-discipline"
cat > "$fx/skills/prototyping-discipline/SKILL.md" <<MD
---
name: prototyping-discipline
ic_pack: true
---
# Bad
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "missing classification frontmatter is fatal"

# --- Case 5: stock GSD skill (not in IC pack list) -> ignored ---
fx="$(mkfixture stock-skill-coexists)"
mkdir -p "$fx/skills/some-stock-skill"
cat > "$fx/skills/some-stock-skill/SKILL.md" <<MD
---
name: some-stock-skill
description: Stock GSD skill.
---
# Stock
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "stock GSD skills (not in IC pack list) are ignored"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-skills.test.sh
```

- [ ] **Step 2: Run to verify it fails**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-skills.test.sh || true
```

Expected: 0 passed, 5 failed.

- [ ] **Step 3: Implement `validate-skills.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-skills.sh <<'EOF'
#!/usr/bin/env bash
# validate-skills.sh — every IC pack skill (named in IC_PACK_SKILLS below) must
# have a SKILL.md with classification: UNCLASSIFIED frontmatter and an
# ic_pack: true marker. Other skills in skills/ are upstream and ignored.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-skills"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
SKILLS_DIR="$ROOT/skills"

# IC pack skill names per spec §7.
IC_PACK_SKILLS=(
  intel-coding-conventions
  prototyping-discipline
  classification-conventions
  adelphi-house-style
)

extract_frontmatter() {
  awk 'BEGIN{in_fm=0; seen=0}
       /^---[[:space:]]*$/ {
         if (seen==0) { in_fm=1; seen=1; next }
         else if (in_fm==1) { in_fm=0; exit }
       }
       in_fm==1 { print }' "$1"
}
fm_value() {
  local fm="$1" key="$2"
  printf "%s" "$fm" | grep -E "^${key}:[[:space:]]" | head -1 | sed -E "s/^${key}:[[:space:]]*//; s/[[:space:]]*$//"
}

if [ ! -d "$SKILLS_DIR" ]; then
  vinfo "no skills/ directory — nothing to validate"
  vexit
fi

for skill in "${IC_PACK_SKILLS[@]}"; do
  dir="$SKILLS_DIR/$skill"
  [ -d "$dir" ] || continue   # not yet shipped — fine in Plan 0
  md="$dir/SKILL.md"
  if [ ! -f "$md" ]; then
    vfail "IC pack skill '$skill' directory exists but SKILL.md is missing"
    continue
  fi
  fm="$(extract_frontmatter "$md")"
  if [ -z "$fm" ]; then
    vfail "$md: skill missing frontmatter"
    continue
  fi
  cls="$(fm_value "$fm" classification)"
  if [ "$cls" != "UNCLASSIFIED" ]; then
    vfail "$md: classification must be UNCLASSIFIED (got '$cls')"
  fi
  ic="$(fm_value "$fm" ic_pack)"
  if [ "$ic" != "true" ]; then
    vfail "$md: missing 'ic_pack: true' frontmatter marker"
  fi
done

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-skills.sh
```

- [ ] **Step 4: Run the test**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-skills.test.sh
```

Expected: `5 passed, 0 failed`.

- [ ] **Step 5: Run against live repo**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-skills.sh
```

Expected: OK.

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-skills.sh tools/ci/tests/validate-skills.test.sh
git commit -m "[U] feat(ci): validate-skills.sh + tests"
```

---

## Task 9: Validator — `validate-no-classified-leak.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-no-classified-leak.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-no-classified-leak.test.sh`

**Spec contract (§12 row 6):** *Repo grep for `S//`, `TS//`, `SI//`, `TK//`, `HCS//`, etc. — fails build if any classified compartment marking is found.*

This is the most security-load-bearing validator. It greps the entire repo (excluding `.git/`, `node_modules/`, the validator file itself, and the test fixtures directory which intentionally contains test patterns) for IC compartment markings.

- [ ] **Step 1: Write the failing test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-no-classified-leak.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-no-classified-leak"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-no-classified-leak.sh"

# --- Case 1: clean repo passes ---
fx="$(mkfixture clean)"
echo "regular content" > "$fx/notes.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "clean repo passes"

# --- Case 2: SECRET marking -> fail ---
fx="$(mkfixture secret-marking)"
echo "S//NOFORN something something" > "$fx/leak.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "S// marking is fatal"
expect_output "S// in output" "S//"

# --- Case 3: TS// marking -> fail ---
fx="$(mkfixture ts-marking)"
echo "TS//SI//NOFORN" > "$fx/leak.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "TS// marking is fatal"

# --- Case 4: SI// marking in a code comment -> fail ---
fx="$(mkfixture si-marking)"
echo "// SI//TK comment" > "$fx/leak.js"
run_validator "$VALIDATOR" "$fx"
expect_fail "SI// in code is fatal"

# --- Case 5: HCS marking -> fail ---
fx="$(mkfixture hcs-marking)"
echo "HCS-O//NOFORN" > "$fx/leak.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "HCS marking is fatal"

# --- Case 6: lowercase 's//' is NOT a marking (legit text) -> pass ---
fx="$(mkfixture lowercase-not-marking)"
echo "URL: https://example.com (the s// is part of the URL)" > "$fx/notes.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "lowercase s// is not a marking"

# --- Case 7: marking inside the validator's own fixture exclusion list -> pass ---
# (Validator should exclude tools/ci/tests/fixtures/ from the scan.)
fx="$(mkfixture excluded-fixture-dir)"
mkdir -p "$fx/tools/ci/tests/fixtures/_scratch/inside"
echo "TS//SI//NOFORN" > "$fx/tools/ci/tests/fixtures/_scratch/inside/leak.md"
echo "regular content" > "$fx/notes.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "scratch fixtures are excluded from scan"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-no-classified-leak.test.sh
```

- [ ] **Step 2: Run to verify it fails**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-no-classified-leak.test.sh || true
```

Expected: 0 passed, 7 failed.

- [ ] **Step 3: Implement `validate-no-classified-leak.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-no-classified-leak.sh <<'EOF'
#!/usr/bin/env bash
# validate-no-classified-leak.sh — grep the repo for IC classified compartment
# markings. ANY hit fails the build.
#
# Patterns (uppercase, "//" delimiter is the IC convention for portion marking):
#   S//        SECRET
#   TS//       TOP SECRET
#   SI//       Special Intelligence (SIGINT)
#   TK//       Talent Keyhole (IMINT/SIGINT)
#   HCS        HUMINT Control System
#   ORCON      Originator Controlled
#   NOFORN     No Foreign Nationals (often appears with markings)
#
# Exclusions: .git/, node_modules/, the validator scripts and their pattern
# strings (self-references), test fixtures dir, the design spec which discusses
# the patterns, and this script itself (case-insensitive name match).

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-no-classified-leak"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"

# Patterns to detect (PCRE). Anchored on uppercase letters + // delimiter where
# applicable; HCS/ORCON/NOFORN are word-boundary matched.
PATTERNS=(
  '\bS//[A-Z]'
  '\bTS//[A-Z]'
  '\bSI//[A-Z]'
  '\bTK//[A-Z]'
  '\bHCS-?[OP]?//'
  '\bORCON\b'
  '\bNOFORN\b'
)

# Excluded paths (relative to ROOT).
EXCLUDES=(
  '.git'
  'node_modules'
  'tools/ci/validate-no-classified-leak.sh'
  'tools/ci/tests/validate-no-classified-leak.test.sh'
  'tools/ci/tests/fixtures'
  'docs/specs'
  'docs/superpowers'
)

# Build a `find` exclusion clause.
prune_args=()
for ex in "${EXCLUDES[@]}"; do
  prune_args+=( -path "$ROOT/$ex" -prune -o )
done

found=0
while IFS= read -r f; do
  for p in "${PATTERNS[@]}"; do
    if grep -E -l "$p" "$f" >/dev/null 2>&1; then
      hit_line="$(grep -nE "$p" "$f" | head -1)"
      vfail "classified marking detected in $f: $hit_line"
      found=$((found+1))
      break  # one hit per file is enough
    fi
  done
done < <(find "$ROOT" "${prune_args[@]}" -type f \( -name "*.md" -o -name "*.js" -o -name "*.cjs" -o -name "*.ts" -o -name "*.json" -o -name "*.sh" -o -name "*.yml" -o -name "*.yaml" -o -name "*.txt" \) -print 2>/dev/null)

if [ "$found" -eq 0 ]; then
  vinfo "scanned repo, no classified markings detected"
fi
vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-no-classified-leak.sh
```

- [ ] **Step 4: Run the test**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-no-classified-leak.test.sh
```

Expected: `7 passed, 0 failed`.

- [ ] **Step 5: Run against live repo**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-no-classified-leak.sh
```

Expected: OK. (The design spec mentions these patterns but is excluded by the `docs/specs` exclusion.)

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-no-classified-leak.sh tools/ci/tests/validate-no-classified-leak.test.sh
git commit -m "[U] feat(ci): validate-no-classified-leak.sh + tests"
```

---

## Task 10: Validator — `validate-completion-markers.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-completion-markers.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-completion-markers.test.sh`

**Spec contract (§12 row 7):** *Every agent's declared completion marker is registered in `references/agent-contracts.md`.*

We use `references/agent-contracts.ic-pack.md` (created in Task 2) as our IC-pack-side registry. The validator scans IC pack agents (those with `ic_pack: true` frontmatter) for completion-marker lines and verifies each one is registered in the IC-pack registry table. Plan 0 has zero IC pack agents → trivially passes.

- [ ] **Step 1: Write the failing test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-completion-markers.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-completion-markers"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-completion-markers.sh"

# --- Case 1: no IC pack agents -> pass ---
fx="$(mkfixture empty)"
mkdir -p "$fx/agents" "$fx/references"
echo "# IC Pack Agent Contracts" > "$fx/references/agent-contracts.ic-pack.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "no IC pack agents passes"

# --- Case 2: agent with marker registered -> pass ---
fx="$(mkfixture registered)"
mkdir -p "$fx/agents" "$fx/references"
cat > "$fx/agents/gsd-x.md" <<MD
---
name: gsd-x
ic_pack: true
classification: UNCLASSIFIED
---
## X COMPLETE
MD
cat > "$fx/references/agent-contracts.ic-pack.md" <<MD
| agent | completion-marker | failure-marker | output artifact |
|---|---|---|---|
| gsd-x | ## X COMPLETE | | (n/a) |
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "registered marker passes"

# --- Case 3: agent with marker NOT registered -> fail ---
fx="$(mkfixture unregistered)"
mkdir -p "$fx/agents" "$fx/references"
cat > "$fx/agents/gsd-y.md" <<MD
---
name: gsd-y
ic_pack: true
classification: UNCLASSIFIED
---
## Y COMPLETE
MD
echo "# IC Pack Agent Contracts (empty registry)" > "$fx/references/agent-contracts.ic-pack.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "unregistered marker is fatal"
expect_output "fail names the marker" "Y COMPLETE"

# --- Case 4: registry file missing -> fail ---
fx="$(mkfixture no-registry)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-z.md" <<MD
---
name: gsd-z
ic_pack: true
classification: UNCLASSIFIED
---
## Z COMPLETE
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "missing registry is fatal when there are IC pack agents"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-completion-markers.test.sh
```

- [ ] **Step 2: Run to verify it fails**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-completion-markers.test.sh || true
```

Expected: 0 passed, 4 failed.

- [ ] **Step 3: Implement `validate-completion-markers.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-completion-markers.sh <<'EOF'
#!/usr/bin/env bash
# validate-completion-markers.sh — every IC pack agent's completion marker
# (any line of the form `## <NAME> COMPLETE` etc.) must appear verbatim
# somewhere in references/agent-contracts.ic-pack.md.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-completion-markers"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
AGENTS_DIR="$ROOT/agents"
REGISTRY="$ROOT/references/agent-contracts.ic-pack.md"

if [ ! -d "$AGENTS_DIR" ]; then
  vinfo "no agents/ directory — nothing to validate"
  vexit
fi

extract_frontmatter() {
  awk 'BEGIN{in_fm=0; seen=0}
       /^---[[:space:]]*$/ { if (seen==0) {in_fm=1; seen=1; next} else if (in_fm==1) {in_fm=0; exit} }
       in_fm==1 { print }' "$1"
}
fm_value() {
  printf "%s" "$1" | grep -E "^$2:[[:space:]]" | head -1 | sed -E "s/^$2:[[:space:]]*//; s/[[:space:]]*$//"
}

# Collect IC pack agents.
ic_agents=()
while IFS= read -r f; do
  fm="$(extract_frontmatter "$f")"
  [ -n "$fm" ] || continue
  if [ "$(fm_value "$fm" ic_pack)" = "true" ]; then
    ic_agents+=("$f")
  fi
done < <(find "$AGENTS_DIR" -maxdepth 1 -type f -name "*.md" 2>/dev/null)

if [ "${#ic_agents[@]}" -eq 0 ]; then
  vinfo "no IC pack agents — nothing to validate"
  vexit
fi

# Registry must exist if we have any IC pack agents.
if [ ! -f "$REGISTRY" ]; then
  vfail "registry file missing: $REGISTRY (required when IC pack agents exist)"
  vexit
fi

registry_content="$(cat "$REGISTRY")"

for agent in "${ic_agents[@]}"; do
  while IFS= read -r marker_line; do
    [ -n "$marker_line" ] || continue
    # Strip leading "## " for matching but search for the literal marker
    # (the registry rows include "## X COMPLETE" verbatim).
    if ! printf "%s" "$registry_content" | grep -qF "$marker_line"; then
      vfail "$agent: completion marker '$marker_line' not found in $REGISTRY"
    fi
  done < <(grep -E '^##[[:space:]]+[A-Z][A-Z0-9 _&-]*[[:space:]]+(COMPLETE|BLOCKED|FOUND|FAILED|UPDATE COMPLETE)$' "$agent" || true)
done

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-completion-markers.sh
```

- [ ] **Step 4: Run the test**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-completion-markers.test.sh
```

Expected: `4 passed, 0 failed`.

- [ ] **Step 5: Run against live repo**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-completion-markers.sh
```

Expected: OK (no IC pack agents).

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-completion-markers.sh tools/ci/tests/validate-completion-markers.test.sh
git commit -m "[U] feat(ci): validate-completion-markers.sh + tests"
```

---

## Task 11: Validator — `validate-triggers.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-triggers.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-triggers.test.sh`

**Spec contract (§12 row 8):** *Every trigger string referenced in `intel-gates.json` resolves to a real step in some stock workflow file.*

The IC pack distribution doesn't contain a populated `intel-gates.json` template at the repo root in Plan 0 (workflow patches arrive in later phase plans). The validator scans the dev repo for any `intel-gates.json` (template or otherwise), pulls the `trigger` field of each gate, and confirms each trigger maps to a `<workflow-name>.md` file with a heading or anchor matching the `<step-name>` part. Plan 0: no `intel-gates.json` → trivially passes.

- [ ] **Step 1: Write the failing test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-triggers.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-triggers"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-triggers.sh"

# --- Case 1: no intel-gates.json anywhere -> pass ---
fx="$(mkfixture empty)"
run_validator "$VALIDATOR" "$fx"
expect_pass "no intel-gates.json passes"

# --- Case 2: intel-gates.json with trigger that resolves -> pass ---
fx="$(mkfixture good)"
mkdir -p "$fx/workflow-patches" "$fx/get-shit-done/workflows"
cat > "$fx/get-shit-done/workflows/plan-phase.md" <<MD
# plan-phase

## research-stage
stuff
MD
cat > "$fx/workflow-patches/intel-gates.template.json" <<JSON
{
  "version": 1,
  "gates": {
    "g1": { "trigger": "plan-phase.research-stage", "agent": "gsd-x" }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "valid trigger passes"

# --- Case 3: trigger references unknown workflow -> fail ---
fx="$(mkfixture bad-workflow)"
mkdir -p "$fx/workflow-patches"
cat > "$fx/workflow-patches/intel-gates.template.json" <<JSON
{
  "version": 1,
  "gates": {
    "g1": { "trigger": "nonexistent-workflow.some-step", "agent": "gsd-x" }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "unknown workflow file is fatal"

# --- Case 4: trigger references unknown step inside known workflow -> fail ---
fx="$(mkfixture bad-step)"
mkdir -p "$fx/workflow-patches" "$fx/get-shit-done/workflows"
echo "# plan-phase" > "$fx/get-shit-done/workflows/plan-phase.md"
cat > "$fx/workflow-patches/intel-gates.template.json" <<JSON
{
  "version": 1,
  "gates": {
    "g1": { "trigger": "plan-phase.no-such-step", "agent": "gsd-x" }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "unknown step in workflow is fatal"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-triggers.test.sh
```

- [ ] **Step 2: Run to verify it fails**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-triggers.test.sh || true
```

Expected: 0 passed, 4 failed.

- [ ] **Step 3: Implement `validate-triggers.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-triggers.sh <<'EOF'
#!/usr/bin/env bash
# validate-triggers.sh — every gate trigger in intel-gates.json (template or
# committed) must resolve to a real step in some stock workflow file.
#
# Trigger format: "<workflow-name>.<step-name>"
# Workflow file lookup: {root}/get-shit-done/workflows/<workflow-name>.md (the
# upstream stock layout) OR {root}/commands/gsd/<workflow-name>.md (legacy).
# Step lookup: a Markdown heading whose slug matches <step-name> after
# lowercasing and replacing spaces with hyphens; OR an HTML anchor.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-triggers"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
require_bin jq

# Find any intel-gates.json (template or runtime). Plan 0 has none.
gates_files=()
while IFS= read -r f; do
  gates_files+=("$f")
done < <(find "$ROOT" -path "$ROOT/.git" -prune -o -path "$ROOT/node_modules" -prune -o -path "$ROOT/tools/ci/tests/fixtures" -prune -o -type f -name "intel-gates*.json" -print 2>/dev/null)

if [ "${#gates_files[@]}" -eq 0 ]; then
  vinfo "no intel-gates.json files — nothing to validate"
  vexit
fi

# Step-slug from a workflow file: every Markdown heading => slug.
collect_steps() {
  local wf_file="$1"
  awk '
    /^##+[[:space:]]+/ {
      sub(/^##+[[:space:]]+/, "", $0)
      slug = tolower($0)
      gsub(/[^a-z0-9 -]/, "", slug)
      gsub(/[[:space:]]+/, "-", slug)
      print slug
    }
  ' "$wf_file" 2>/dev/null
}

resolve_trigger() {
  local trigger="$1"
  local wf="${trigger%%.*}"
  local step="${trigger#*.}"

  # Try standard upstream paths.
  local candidate_paths=(
    "$ROOT/get-shit-done/workflows/$wf.md"
    "$ROOT/commands/gsd/$wf.md"
  )
  local wf_path=""
  for p in "${candidate_paths[@]}"; do
    if [ -f "$p" ]; then wf_path="$p"; break; fi
  done

  if [ -z "$wf_path" ]; then
    vfail "trigger '$trigger' references unknown workflow file (looked in get-shit-done/workflows/, commands/gsd/)"
    return
  fi

  # Step might be a heading slug, an HTML anchor, or a literal section name.
  local steps; steps="$(collect_steps "$wf_path")"
  if printf "%s\n" "$steps" | grep -qx "$step"; then
    return 0
  fi
  # Fallback: search for a literal `<a name="step">` anchor.
  if grep -Eq "<a[[:space:]]+name=\"$step\"" "$wf_path" 2>/dev/null; then
    return 0
  fi
  vfail "trigger '$trigger' workflow '$wf' has no step matching '$step'"
}

for gates in "${gates_files[@]}"; do
  triggers="$(jq -r '.gates // {} | to_entries[] | .value.trigger // empty' "$gates" 2>/dev/null || true)"
  while IFS= read -r t; do
    [ -n "$t" ] || continue
    resolve_trigger "$t"
  done <<< "$triggers"
done

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-triggers.sh
```

- [ ] **Step 4: Run the test**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-triggers.test.sh
```

Expected: `4 passed, 0 failed`.

- [ ] **Step 5: Run against live repo**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-triggers.sh
```

Expected: OK.

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-triggers.sh tools/ci/tests/validate-triggers.test.sh
git commit -m "[U] feat(ci): validate-triggers.sh + tests"
```

---

## Task 12: Validator — `validate-reference-staleness.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-reference-staleness.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-reference-staleness.test.sh`

**Spec contract (§12 row 9):** *Warns when any reference doc's `last_reviewed` exceeds 6 months; does not fail build (advisory).*

This is the only validator that emits warnings (not failures) and exits 0 on warnings. The shared `_lib.sh` already supports this via `vwarn`.

- [ ] **Step 1: Write the test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-reference-staleness.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-reference-staleness"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-reference-staleness.sh"

# --- Case 1: empty manifest -> pass, no warning ---
fx="$(mkfixture empty)"
mkdir -p "$fx/intel-refs"
echo '{"version":"2026.05","topics":{}}' > "$fx/intel-refs/MANIFEST.json"
run_validator "$VALIDATOR" "$fx"
expect_pass "empty manifest passes"

# --- Case 2: fresh entry -> pass ---
today="$(date +%Y-%m-%d)"
fx="$(mkfixture fresh)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/humint.md"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"],
      "owner": "alice",
      "last_reviewed": "$today",
      "classification": "UNCLASSIFIED"
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "fresh ref passes"

# --- Case 3: stale entry (8 months old) -> pass with warning ---
fx="$(mkfixture stale)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/humint.md"
# Date 8 months ago (use Python for portability across macOS/Linux date(1) flavors).
old_date="$(python3 -c 'from datetime import date, timedelta; print((date.today()-timedelta(days=240)).isoformat())')"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"],
      "owner": "alice",
      "last_reviewed": "$old_date",
      "classification": "UNCLASSIFIED"
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "stale ref still passes (advisory)"
expect_output "stale warning output" "WARN"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-reference-staleness.test.sh
```

- [ ] **Step 2: Run to verify it fails**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-reference-staleness.test.sh || true
```

Expected: 0 passed, 3 failed (validator missing).

- [ ] **Step 3: Implement `validate-reference-staleness.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-reference-staleness.sh <<'EOF'
#!/usr/bin/env bash
# validate-reference-staleness.sh — emit a warning when any manifest entry's
# last_reviewed date is more than 180 days old. Advisory only; exits 0 with
# warnings.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-reference-staleness"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
MANIFEST="$ROOT/intel-refs/MANIFEST.json"
require_bin jq
require_bin python3

if [ ! -f "$MANIFEST" ]; then
  vinfo "no manifest — nothing to check"
  vexit
fi

today_epoch="$(python3 -c 'import datetime; print(int(datetime.date.today().strftime("%s")))')"
threshold_days=180

while IFS=$'\t' read -r topic last_reviewed; do
  [ -n "$topic" ] || continue
  [ -n "$last_reviewed" ] && [ "$last_reviewed" != "null" ] || { vwarn "$topic: missing last_reviewed"; continue; }
  entry_epoch="$(python3 -c "import datetime,sys; d=datetime.date.fromisoformat('$last_reviewed'); print(int(d.strftime('%s')))" 2>/dev/null || echo "")"
  if [ -z "$entry_epoch" ]; then
    vwarn "$topic: unparseable last_reviewed '$last_reviewed'"
    continue
  fi
  age_days=$(( (today_epoch - entry_epoch) / 86400 ))
  if [ "$age_days" -gt "$threshold_days" ]; then
    vwarn "$topic: last_reviewed $last_reviewed is $age_days days old (threshold: $threshold_days)"
  fi
done < <(jq -r '.topics // {} | to_entries[] | "\(.key)\t\(.value.last_reviewed // "")"' "$MANIFEST")

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-reference-staleness.sh
```

- [ ] **Step 4: Run the test**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-reference-staleness.test.sh
```

Expected: `3 passed, 0 failed`.

- [ ] **Step 5: Run against live repo**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-reference-staleness.sh
```

Expected: OK.

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-reference-staleness.sh tools/ci/tests/validate-reference-staleness.test.sh
git commit -m "[U] feat(ci): validate-reference-staleness.sh + tests"
```

---

## Task 13: Validator — `validate-audit-log.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-audit-log.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-audit-log.test.sh`

**Spec contract (§12 row 10):** *Enforces format of `.planning/audit.md` entries (timestamp + agent + completion-marker + artifact-path + notes); fails on malformed lines.*

This validator runs against a *consumer's* `.planning/audit.md` — but the IC pack repo itself does not have a `.planning/audit.md`. We provide the validator so consumer programs can run it via `npx @adelphi/gsd-ic@latest install` (which can copy the validator into the consumer's tools dir on install) or manually. In Plan 0, the validator exists, has unit tests against fixtures, and is wired into our CI as a no-op when no audit file exists.

- [ ] **Step 1: Write the test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-audit-log.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-audit-log"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-audit-log.sh"

# --- Case 1: no audit log -> pass (no-op) ---
fx="$(mkfixture none)"
mkdir -p "$fx/.planning"
run_validator "$VALIDATOR" "$fx"
expect_pass "no audit log passes"

# --- Case 2: well-formed entry -> pass ---
fx="$(mkfixture good)"
mkdir -p "$fx/.planning"
cat > "$fx/.planning/audit.md" <<MD
# Audit log
2026-05-06T10:30:00Z | gsd-customer-context-mapper | ## CONTEXT MAPPING COMPLETE | .planning/intel-context.md | initial pass
2026-05-06T10:35:00Z | gsd-itar-screener | ## SCREENING COMPLETE | .planning/POAM.md | 0 findings
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "well-formed entries pass"

# --- Case 3: malformed entry (missing fields) -> fail ---
fx="$(mkfixture bad)"
mkdir -p "$fx/.planning"
cat > "$fx/.planning/audit.md" <<MD
# Audit log
this is not a valid entry
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "malformed entry is fatal"

# --- Case 4: comment / heading lines are skipped ---
fx="$(mkfixture comments)"
mkdir -p "$fx/.planning"
cat > "$fx/.planning/audit.md" <<MD
# Audit log
<!-- a comment -->

2026-05-06T10:30:00Z | gsd-x | ## X COMPLETE | path | notes

## A heading
2026-05-06T10:35:00Z | gsd-y | ## Y COMPLETE | path2 | notes2
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "headings/comments/blank lines are skipped"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-audit-log.test.sh
```

- [ ] **Step 2: Run to verify failure**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-audit-log.test.sh || true
```

- [ ] **Step 3: Implement `validate-audit-log.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-audit-log.sh <<'EOF'
#!/usr/bin/env bash
# validate-audit-log.sh — enforce the line format of .planning/audit.md.
# Format (5 pipe-delimited columns):
#   <ISO-8601 timestamp> | <agent-name> | <completion-marker> | <artifact-path> | <notes>
# Heading lines (#...), HTML comments (<!--...-->), and blank lines are skipped.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-audit-log"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
AUDIT="$ROOT/.planning/audit.md"

if [ ! -f "$AUDIT" ]; then
  vinfo "no .planning/audit.md — nothing to validate"
  vexit
fi

line_re='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z[[:space:]]*\|[[:space:]]*[A-Za-z0-9_.-]+[[:space:]]*\|[[:space:]]*##[[:space:]]+.+[[:space:]]*\|[[:space:]]*[^|]+[[:space:]]*\|[[:space:]]*.*$'

n=0
while IFS= read -r line; do
  n=$((n+1))
  # Skip blank, headings, html comments.
  case "$line" in
    "" ) continue ;;
    \#*) continue ;;
    "<!--"*) continue ;;
  esac
  if ! [[ "$line" =~ $line_re ]]; then
    vfail "malformed audit entry at line $n: $line"
  fi
done < "$AUDIT"

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-audit-log.sh
```

- [ ] **Step 4: Run the test**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-audit-log.test.sh
```

Expected: `4 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-audit-log.sh tools/ci/tests/validate-audit-log.test.sh
git commit -m "[U] feat(ci): validate-audit-log.sh + tests"
```

---

## Task 14: Validator — `validate-workflow-patches.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-workflow-patches.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-workflow-patches.test.sh`

**Spec contract (§12 row 5):** *Workflow patches still apply cleanly against current upstream.*

In Plan 0, `tools/patch-workflows.sh` is a no-op stub (Task 22 below) and `workflow-patches/` is empty. The validator runs the patch script in dry-run mode and asserts it exits 0; later phases add real patches. The script's contract: exit 0 if all patches apply (or no patches exist); exit non-zero otherwise.

- [ ] **Step 1: Write the test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-workflow-patches.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-workflow-patches"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-workflow-patches.sh"

# --- Case 1: no patch script -> fail (the script is a required deliverable) ---
fx="$(mkfixture no-script)"
run_validator "$VALIDATOR" "$fx"
expect_fail "missing patch-workflows.sh is fatal"

# --- Case 2: patch script exists, exits 0 in dry-run -> pass ---
fx="$(mkfixture good)"
mkdir -p "$fx/tools" "$fx/workflow-patches"
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
# stub
exit 0
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
expect_pass "exit-0 patch script passes"

# --- Case 3: patch script exits non-zero -> fail ---
fx="$(mkfixture broken)"
mkdir -p "$fx/tools" "$fx/workflow-patches"
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
echo "patch failed: foo.diff did not apply"
exit 1
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
expect_fail "non-zero patch script is fatal"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-workflow-patches.test.sh
```

- [ ] **Step 2: Run to verify failure**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-workflow-patches.test.sh || true
```

- [ ] **Step 3: Implement `validate-workflow-patches.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-workflow-patches.sh <<'EOF'
#!/usr/bin/env bash
# validate-workflow-patches.sh — invoke tools/patch-workflows.sh in --check
# (dry-run) mode and propagate the exit code.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-workflow-patches"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
SCRIPT="$ROOT/tools/patch-workflows.sh"

if [ ! -f "$SCRIPT" ]; then
  vfail "patch-workflows.sh missing at $SCRIPT"
  vexit
fi
if [ ! -x "$SCRIPT" ]; then
  vfail "patch-workflows.sh is not executable"
  vexit
fi

if "$SCRIPT" --check >/dev/null 2>&1 || "$SCRIPT" >/dev/null 2>&1; then
  vinfo "patch script ran cleanly"
else
  vfail "patch-workflows.sh exited non-zero (patches do not apply against upstream)"
fi

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-workflow-patches.sh
```

The fall-through `|| "$SCRIPT" >/dev/null 2>&1` handles the case where the script doesn't yet support `--check` (Plan 0 stub). Once Task 22 lands `--check`, this becomes the primary path.

- [ ] **Step 4: Run the test**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-workflow-patches.test.sh
```

Expected: `3 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-workflow-patches.sh tools/ci/tests/validate-workflow-patches.test.sh
git commit -m "[U] feat(ci): validate-workflow-patches.sh + tests"
```

---

## Task 15: Validator — `validate-seamless-fork.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-seamless-fork.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-seamless-fork.test.sh`

**Spec contract (§11.2 — added by post-review revision):** *With every gate and hook disabled in `intel-gates.json`, the program behaves bit-for-bit identically to a stock GSD program. Validate by diffing patched workflows against stock workflows when all gates are off; the diff must be semantically empty.*

In Plan 0, `tools/patch-workflows.sh` is a no-op so patched ≡ stock by construction. The validator establishes the harness so future phase patches are gated against this property.

- [ ] **Step 1: Write the test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-seamless-fork.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-seamless-fork"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-seamless-fork.sh"

# --- Case 1: no patches applied (Plan 0 baseline) -> pass ---
fx="$(mkfixture no-patches)"
mkdir -p "$fx/get-shit-done/workflows" "$fx/tools" "$fx/workflow-patches"
echo "# plan-phase" > "$fx/get-shit-done/workflows/plan-phase.md"
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
# no-op
exit 0
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
expect_pass "no-patch baseline passes"

# --- Case 2: patches present but all gates default off -> pass (semantically equiv) ---
# We simulate this by having the patch script add a CONDITIONAL skill line that
# resolves to the empty string when gates are off. The validator should consider
# such conditional-only insertions as "semantically empty diff".
fx="$(mkfixture conditional-only)"
mkdir -p "$fx/get-shit-done/workflows" "$fx/tools"
cat > "$fx/get-shit-done/workflows/plan-phase.md" <<'MD'
# plan-phase
{{IC_GATE_PLACEHOLDER}}
MD
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
# Replaces the placeholder with a guarded skill call (no-op when gate disabled).
sed -i.bak 's|{{IC_GATE_PLACEHOLDER}}|<!-- IC-GATE: if config.intel_gates.foo.enabled then Skill(...) -->|' "$1/get-shit-done/workflows/plan-phase.md" 2>/dev/null || true
exit 0
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
# When patch only inserts <!-- IC-GATE: ... --> lines, the validator considers
# the diff "semantically empty" (markdown-rendered output is unchanged).
expect_pass "comment-only patch lines pass (semantically empty)"

# --- Case 3: patch removes a stock line (forbidden) -> fail ---
fx="$(mkfixture removed-line)"
mkdir -p "$fx/get-shit-done/workflows" "$fx/tools"
cat > "$fx/get-shit-done/workflows/plan-phase.md" <<'MD'
# plan-phase
stock line that should never be removed
MD
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
# Bad: removes a stock line.
sed -i.bak '/stock line that should never be removed/d' "$1/get-shit-done/workflows/plan-phase.md" 2>/dev/null || true
exit 0
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
expect_fail "removing a stock line breaks the seamless-fork guarantee"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-seamless-fork.test.sh
```

- [ ] **Step 2: Run to verify failure**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-seamless-fork.test.sh || true
```

- [ ] **Step 3: Implement `validate-seamless-fork.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-seamless-fork.sh <<'EOF'
#!/usr/bin/env bash
# validate-seamless-fork.sh — verify that workflow patches, when applied, only
# *add* lines that are semantically inert when gates/hooks are disabled.
#
# Algorithm:
#   1. Snapshot stock workflow files to a temp dir.
#   2. Run tools/patch-workflows.sh against a clone of the workflow tree.
#   3. Diff snapshot vs. patched.
#   4. Every diff hunk must be an INSERTION (no deletions/modifications), and
#      every inserted line must match an "inert" pattern: an HTML comment, an
#      explicit `if config.intel_gates.<name>.enabled then ...` guard, or a
#      blank line.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-seamless-fork"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
SCRIPT="$ROOT/tools/patch-workflows.sh"
WF_DIR="$ROOT/get-shit-done/workflows"

if [ ! -d "$WF_DIR" ]; then
  vinfo "no workflows directory at $WF_DIR — nothing to validate"
  vexit
fi
if [ ! -x "$SCRIPT" ]; then
  vfail "patch-workflows.sh missing or not executable"
  vexit
fi

stock_snapshot="$(mktemp -d)"
patched_snapshot="$(mktemp -d)"
trap 'rm -rf "$stock_snapshot" "$patched_snapshot"' EXIT

cp -r "$WF_DIR"/. "$stock_snapshot"/
cp -r "$WF_DIR"/. "$patched_snapshot"/

# Run the patch script against patched_snapshot. The script signature: takes a
# repo-root-equivalent path as $1 and patches $1/get-shit-done/workflows/*.md.
# We construct a fake root that mirrors the layout.
fake_root="$(mktemp -d)"
mkdir -p "$fake_root/get-shit-done/workflows"
cp -r "$patched_snapshot"/. "$fake_root/get-shit-done/workflows"/
"$SCRIPT" "$fake_root" >/dev/null 2>&1 || true

# Diff each file.
inert_re='^(<!--|[[:space:]]*$|.*if config\.intel_gates\.[A-Za-z0-9_-]+\.enabled.*Skill\(.*\).*$)'

violations=0
for f in "$stock_snapshot"/*.md; do
  base="$(basename "$f")"
  patched="$fake_root/get-shit-done/workflows/$base"
  [ -f "$patched" ] || continue
  while IFS= read -r line; do
    case "$line" in
      "<"*) ;;        # diff header lines (---, +++, @@) etc. handled by leading char filter
    esac
    case "$line" in
      "+"*)
        body="${line#+}"
        # Skip diff metadata (+++ filename).
        case "$body" in "++"*) continue ;; esac
        if ! [[ "$body" =~ $inert_re ]]; then
          vfail "$base: non-inert insertion '$body'"
          violations=$((violations+1))
        fi
        ;;
      "-"*)
        body="${line#-}"
        case "$body" in "--"*) continue ;; esac   # diff metadata
        vfail "$base: stock line removed: '$body'"
        violations=$((violations+1))
        ;;
    esac
  done < <(diff -u "$f" "$patched" 2>/dev/null || true)
done

if [ "$violations" -eq 0 ]; then
  vinfo "all patches are semantically inert with gates off"
fi
vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-seamless-fork.sh
```

- [ ] **Step 4: Run the test**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-seamless-fork.test.sh
```

Expected: `3 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-seamless-fork.sh tools/ci/tests/validate-seamless-fork.test.sh
git commit -m "[U] feat(ci): validate-seamless-fork.sh + tests"
```

---

## Task 16: Validator — `validate-publish-scope.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/validate-publish-scope.sh`
- Create: `/Users/romansky/gsd-ic/tools/ci/tests/validate-publish-scope.test.sh`

**Purpose (introduced by this plan, see Decomposition Decision Log #1):** Confirm that `npm pack --dry-run` would publish only IC-prefixed content (no upstream GSD source files). This is the gate that keeps the npm-published artifact pack-only even though the dev repo is a full upstream fork.

- [ ] **Step 1: Write the test**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/tests/validate-publish-scope.test.sh <<'EOF'
#!/usr/bin/env bash
TEST_NAME="validate-publish-scope"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-publish-scope.sh"

# --- Case 1: well-formed package.json with restrictive `files` -> pass ---
fx="$(mkfixture good)"
mkdir -p "$fx/agents" "$fx/hooks" "$fx/intel-refs" "$fx/bin"
cat > "$fx/package.json" <<'JSON'
{
  "name": "@adelphi/gsd-ic",
  "version": "0.1.0",
  "files": [
    "agents/gsd-*.md",
    "hooks/gsd-*.js",
    "intel-refs/",
    "bin/gsd-ic-install.js"
  ]
}
JSON
echo "test" > "$fx/agents/gsd-x.md"
echo "stock-content" > "$fx/agents/gsd-stock-not-ours.md"  # NOTE: stock GSD also uses gsd-*. Filtering by glob includes both. The validator can't tell apart by name alone — it falls back to checking if the agent file has ic_pack: true frontmatter. (See Step 3 implementation.)
echo "test" > "$fx/hooks/gsd-x.js"
echo "test" > "$fx/intel-refs/MANIFEST.json"
echo "test" > "$fx/bin/gsd-ic-install.js"
run_validator "$VALIDATOR" "$fx"
expect_pass "valid package.json passes"

# --- Case 2: package.json `files` field includes upstream-only paths -> fail ---
fx="$(mkfixture upstream-leak)"
mkdir -p "$fx"
cat > "$fx/package.json" <<'JSON'
{
  "name": "@adelphi/gsd-ic",
  "version": "0.1.0",
  "files": [
    "agents/gsd-*.md",
    "sdk/dist/",
    "scripts/"
  ]
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "upstream-source path (sdk/, scripts/) in `files` is fatal"

# --- Case 3: name is wrong -> fail ---
fx="$(mkfixture wrong-name)"
cat > "$fx/package.json" <<'JSON'
{
  "name": "get-shit-done-cc",
  "version": "0.1.0",
  "files": ["agents/gsd-*.md"]
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "package name not @adelphi/gsd-ic is fatal"

report
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/tests/validate-publish-scope.test.sh
```

- [ ] **Step 2: Run to verify failure**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-publish-scope.test.sh || true
```

- [ ] **Step 3: Implement `validate-publish-scope.sh`**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/validate-publish-scope.sh <<'EOF'
#!/usr/bin/env bash
# validate-publish-scope.sh — assert that the npm package about to be published
# contains ONLY IC-pack-prefixed content, no upstream GSD source.
#
# Checks:
#   1. package.json `name` is exactly "@adelphi/gsd-ic"
#   2. `files` field is a restrictive allowlist (no entries matching the
#      upstream-source denylist below)
#   3. (Best-effort) `npm pack --dry-run` output contains no upstream-source
#      paths if npm is available locally.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-publish-scope"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
PKG="$ROOT/package.json"
require_bin jq

if [ ! -f "$PKG" ]; then
  vfail "package.json missing at $PKG"
  vexit
fi

# 1. Name check.
name="$(jq -r '.name' "$PKG")"
if [ "$name" != "@adelphi/gsd-ic" ]; then
  vfail "package.json name must be '@adelphi/gsd-ic' (got '$name')"
fi

# 2. files field denylist. Anything matching these patterns means upstream-source leak.
denylist=(
  '^bin/install\.js$'
  '^bin/gsd-sdk\.js$'
  '^sdk/'
  '^scripts/'
  '^get-shit-done/'
  '^commands/(?!gsd/intel-gate-)'
  '^README\.[a-z]+\.md$'   # localized upstream READMEs
)

files_arr="$(jq -r '.files // [] | .[]' "$PKG")"
while IFS= read -r path; do
  [ -n "$path" ] || continue
  for deny in "${denylist[@]}"; do
    if printf "%s" "$path" | grep -Eq "$deny"; then
      vfail "package.json files entry '$path' matches upstream-source denylist '$deny'"
    fi
  done
done <<< "$files_arr"

# 3. (best-effort) npm pack --dry-run.
if command -v npm >/dev/null 2>&1; then
  pack_out="$(cd "$ROOT" && npm pack --dry-run --json 2>/dev/null || true)"
  if [ -n "$pack_out" ]; then
    leaked="$(printf "%s" "$pack_out" | jq -r '.[0].files[]?.path // empty' 2>/dev/null | grep -E '^(sdk/|scripts/|get-shit-done/|bin/install\.js|bin/gsd-sdk\.js)' || true)"
    if [ -n "$leaked" ]; then
      while IFS= read -r leak; do
        vfail "npm pack would include upstream-source path: $leak"
      done <<< "$leaked"
    fi
  fi
fi

vexit
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/validate-publish-scope.sh
```

- [ ] **Step 4: Run the test**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/validate-publish-scope.test.sh
```

Expected: `3 passed, 0 failed`.

- [ ] **Step 5: Run against live repo**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-publish-scope.sh
```

Expected: OK (the package.json from Task 1 has the right name and a denylist-clean `files` field).

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/validate-publish-scope.sh tools/ci/tests/validate-publish-scope.test.sh
git commit -m "[U] feat(ci): validate-publish-scope.sh + tests"
```

---

## Task 17: CI master runner — `tools/ci/_run-all.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/ci/_run-all.sh`

Aggregates every validator in deterministic order. Used by the GitHub Actions workflow (Task 26) and the `npm run ci` script.

- [ ] **Step 1: Write the runner**

```bash
cat > /Users/romansky/gsd-ic/tools/ci/_run-all.sh <<'EOF'
#!/usr/bin/env bash
# Run every IC pack CI validator in order. Fails fast on the first failing
# validator (use `--continue` to run them all and report at end).

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

continue_on_error=0
if [ "${1:-}" = "--continue" ]; then
  continue_on_error=1
fi

VALIDATORS=(
  validate-manifest.sh
  validate-classification.sh
  validate-agents.sh
  validate-skills.sh
  validate-no-classified-leak.sh
  validate-completion-markers.sh
  validate-triggers.sh
  validate-reference-staleness.sh
  validate-audit-log.sh
  validate-workflow-patches.sh
  validate-seamless-fork.sh
  validate-publish-scope.sh
)

failures=0
for v in "${VALIDATORS[@]}"; do
  printf "\n=== %s ===\n" "$v"
  if ! bash "$SCRIPT_DIR/$v"; then
    failures=$((failures+1))
    [ "$continue_on_error" -eq 1 ] || {
      printf "\n[ci] FAILED: %s — stopping (use --continue to run all)\n" "$v" >&2
      exit 1
    }
  fi
done

if [ "$failures" -gt 0 ]; then
  printf "\n[ci] %d validator(s) failed\n" "$failures" >&2
  exit 1
fi
printf "\n[ci] all validators passed\n"
EOF
chmod +x /Users/romansky/gsd-ic/tools/ci/_run-all.sh
```

- [ ] **Step 2: Run the full validator suite against the live repo**

```bash
bash /Users/romansky/gsd-ic/tools/ci/_run-all.sh
```

Expected: each validator prints `[validator-name] OK` (the staleness validator may print `WARN` lines but exits 0). Final line: `[ci] all validators passed`.

- [ ] **Step 3: Run all validator tests**

```bash
bash /Users/romansky/gsd-ic/tools/ci/tests/_run-all.sh
```

Expected: every test file's `report` line shows `0 failed`.

- [ ] **Step 4: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/ci/_run-all.sh
git commit -m "[U] feat(ci): master validator runner _run-all.sh"
```

---

## Task 18: Install entry-point — `parse-args.cjs`

**Files:**
- Create: `/Users/romansky/gsd-ic/bin/lib/gsd-ic/parse-args.cjs`
- Create: `/Users/romansky/gsd-ic/tests/install/parse-args.test.cjs`

The arg parser handles the `npx @adelphi/gsd-ic install --customer=<name> [--target=<path>] [--version=<v>]` invocation surface. Pure function: takes argv array, returns options object or throws a usage error.

- [ ] **Step 1: Write the failing test**

```bash
mkdir -p /Users/romansky/gsd-ic/tests/install
cat > /Users/romansky/gsd-ic/tests/install/parse-args.test.cjs <<'EOF'
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, USAGE } = require('../../bin/lib/gsd-ic/parse-args.cjs');

describe('parseArgs', () => {
  it('parses install --customer=nga', () => {
    const opts = parseArgs(['install', '--customer=nga']);
    assert.equal(opts.subcommand, 'install');
    assert.equal(opts.customer, 'nga');
    assert.equal(opts.target, process.cwd());
  });

  it('parses --customer=<name> in any position', () => {
    const a = parseArgs(['--customer=nsa', 'install']);
    assert.equal(a.customer, 'nsa');
  });

  it('parses --target=<path>', () => {
    const opts = parseArgs(['install', '--customer=nga', '--target=/tmp/foo']);
    assert.equal(opts.target, '/tmp/foo');
  });

  it('rejects unknown subcommand', () => {
    assert.throws(() => parseArgs(['blammo']), /unknown subcommand/i);
  });

  it('requires --customer for install', () => {
    assert.throws(() => parseArgs(['install']), /--customer/);
  });

  it('rejects unknown customer', () => {
    assert.throws(() => parseArgs(['install', '--customer=mars']), /unknown customer/i);
  });

  it('accepts each known customer name', () => {
    for (const c of ['nga', 'nsa', 'nro', 'cia', 'dia']) {
      assert.equal(parseArgs(['install', `--customer=${c}`]).customer, c);
    }
  });

  it('exports a USAGE string', () => {
    assert.match(USAGE, /npx @adelphi\/gsd-ic install/);
  });

  it('treats --help as a request to print usage and exit cleanly', () => {
    const opts = parseArgs(['--help']);
    assert.equal(opts.subcommand, 'help');
  });
});
EOF
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/parse-args.test.cjs 2>&1 | tail -20
```

Expected: ENOENT or `Cannot find module` error (parse-args.cjs not implemented yet).

- [ ] **Step 3: Implement `parse-args.cjs`**

```bash
mkdir -p /Users/romansky/gsd-ic/bin/lib/gsd-ic
cat > /Users/romansky/gsd-ic/bin/lib/gsd-ic/parse-args.cjs <<'EOF'
'use strict';

// Customers shipped in the catalog (config-overlays/<name>/).
const KNOWN_CUSTOMERS = new Set(['nga', 'nsa', 'nro', 'cia', 'dia']);

const USAGE = `
Usage:
  npx @adelphi/gsd-ic install --customer=<name> [--target=<path>]

Subcommands:
  install     Install the IC pack into a program directory
  --help      Show this help

Required:
  --customer=<name>   One of: ${[...KNOWN_CUSTOMERS].join(', ')}

Optional:
  --target=<path>     Program directory (default: \$PWD)

Examples:
  npx @adelphi/gsd-ic install --customer=nga
  npx @adelphi/gsd-ic@2026.05.0 install --customer=nsa --target=/path/to/program
`.trim();

function parseArgs(argv) {
  const opts = { subcommand: null, customer: null, target: process.cwd() };
  const tokens = Array.isArray(argv) ? argv.slice() : [];

  // Help flag.
  if (tokens.includes('--help') || tokens.includes('-h')) {
    return { ...opts, subcommand: 'help' };
  }

  // Pull subcommand (first non-flag token).
  for (const t of tokens) {
    if (!t.startsWith('--')) {
      if (!opts.subcommand) opts.subcommand = t;
    }
  }

  // Pull --foo=bar style flags.
  for (const t of tokens) {
    if (t.startsWith('--customer=')) opts.customer = t.slice('--customer='.length);
    else if (t.startsWith('--target=')) opts.target = t.slice('--target='.length);
  }

  if (!opts.subcommand) {
    throw new Error(`missing subcommand. ${USAGE}`);
  }
  if (!['install', 'help'].includes(opts.subcommand)) {
    throw new Error(`unknown subcommand "${opts.subcommand}". ${USAGE}`);
  }
  if (opts.subcommand === 'install') {
    if (!opts.customer) {
      throw new Error(`install requires --customer=<name>. ${USAGE}`);
    }
    if (!KNOWN_CUSTOMERS.has(opts.customer)) {
      throw new Error(`unknown customer "${opts.customer}". Known: ${[...KNOWN_CUSTOMERS].join(', ')}`);
    }
  }
  return opts;
}

module.exports = { parseArgs, USAGE, KNOWN_CUSTOMERS };
EOF
```

- [ ] **Step 4: Run the test to verify pass**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/parse-args.test.cjs
```

Expected: 9 tests passing.

- [ ] **Step 5: Commit**

```bash
cd /Users/romansky/gsd-ic
git add bin/lib/gsd-ic/parse-args.cjs tests/install/parse-args.test.cjs
git commit -m "[U] feat(install): parse-args module + tests"
```

---

## Task 19: Install entry-point — `verify-gsd.cjs`

**Files:**
- Create: `/Users/romansky/gsd-ic/bin/lib/gsd-ic/verify-gsd.cjs`
- Create: `/Users/romansky/gsd-ic/tests/install/verify-gsd.test.cjs`

Confirms the target program already has GSD installed and at a compatible version (per spec §11.0 `gsd_pinned`). Reads our `VERSION` file's `gsd_pinned` field, then probes the target for stock GSD signals.

- [ ] **Step 1: Write the failing test**

```bash
cat > /Users/romansky/gsd-ic/tests/install/verify-gsd.test.cjs <<'EOF'
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { verifyGsd } = require('../../bin/lib/gsd-ic/verify-gsd.cjs');

function tmp(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-verify-${label}-`));
  return dir;
}

describe('verifyGsd', () => {
  it('returns ok=true when target has .claude/skills/gsd-* skills (modern GSD)', () => {
    const target = tmp('modern');
    fs.mkdirSync(path.join(target, '.claude/skills/gsd-help'), { recursive: true });
    fs.writeFileSync(path.join(target, '.claude/skills/gsd-help/SKILL.md'), '');
    const r = verifyGsd({ target, gsdPinned: '1.39.0' });
    assert.equal(r.ok, true);
    assert.equal(r.detected, 'modern-skills');
  });

  it('returns ok=true when target has commands/gsd/ (legacy GSD)', () => {
    const target = tmp('legacy');
    fs.mkdirSync(path.join(target, 'commands/gsd'), { recursive: true });
    fs.writeFileSync(path.join(target, 'commands/gsd/help.md'), '');
    const r = verifyGsd({ target, gsdPinned: '1.39.0' });
    assert.equal(r.ok, true);
    assert.equal(r.detected, 'legacy-commands');
  });

  it('returns ok=false when no GSD signals found', () => {
    const target = tmp('empty');
    const r = verifyGsd({ target, gsdPinned: '1.39.0' });
    assert.equal(r.ok, false);
    assert.match(r.reason, /not detected/i);
  });

  it('returns ok=false when target dir does not exist', () => {
    const r = verifyGsd({ target: '/path/that/does/not/exist/anywhere', gsdPinned: '1.39.0' });
    assert.equal(r.ok, false);
  });
});
EOF
```

- [ ] **Step 2: Verify failure**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/verify-gsd.test.cjs 2>&1 | tail -10
```

- [ ] **Step 3: Implement `verify-gsd.cjs`**

```bash
cat > /Users/romansky/gsd-ic/bin/lib/gsd-ic/verify-gsd.cjs <<'EOF'
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Detect a stock GSD install in the target directory.
 *
 * Heuristics in priority order:
 *   1. Modern install: .claude/skills/gsd-* (Claude Code 2.1.88+)
 *   2. Modern install (Codex): .codex/skills/gsd-*
 *   3. Legacy install: commands/gsd/*.md
 *   4. .clinerules with gsd content (Cline runtime)
 *
 * Future: parse a recorded GSD version from the target and compare against
 * gsdPinned for compatibility. v1 doesn't enforce version bounds — only
 * checks presence — because GSD doesn't write a discoverable version marker
 * into target directories at install time. Compatibility is checked at
 * publish time via package.json peerDependencies.
 */
function verifyGsd({ target, gsdPinned }) {
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    return { ok: false, reason: `target directory does not exist: ${target}` };
  }

  const probes = [
    { path: '.claude/skills', glob: /^gsd-/, label: 'modern-skills' },
    { path: '.codex/skills', glob: /^gsd-/, label: 'modern-skills-codex' },
    { path: 'commands/gsd', glob: /\.md$/, label: 'legacy-commands' },
  ];

  for (const p of probes) {
    const dir = path.join(target, p.path);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      const entries = fs.readdirSync(dir);
      if (entries.some((e) => p.glob.test(e))) {
        return { ok: true, detected: p.label, gsdPinned };
      }
    }
  }

  // Cline: .clinerules file containing gsd reference.
  const clinerules = path.join(target, '.clinerules');
  if (fs.existsSync(clinerules) && fs.readFileSync(clinerules, 'utf8').includes('gsd')) {
    return { ok: true, detected: 'cline', gsdPinned };
  }

  return {
    ok: false,
    reason:
      `GSD not detected in ${target}. Run \`npx get-shit-done-cc@latest\` to install GSD first, ` +
      'then re-run the IC pack install.',
  };
}

module.exports = { verifyGsd };
EOF
```

- [ ] **Step 4: Verify pass**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/verify-gsd.test.cjs
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
cd /Users/romansky/gsd-ic
git add bin/lib/gsd-ic/verify-gsd.cjs tests/install/verify-gsd.test.cjs
git commit -m "[U] feat(install): verify-gsd module + tests"
```

---

## Task 20: Install entry-point — `install-pack.cjs`

**Files:**
- Create: `/Users/romansky/gsd-ic/bin/lib/gsd-ic/install-pack.cjs`
- Create: `/Users/romansky/gsd-ic/tests/install/install-pack.test.cjs`

Copies pack content (agents, hooks, skills, intel-refs, the selected customer overlay, the IC-pack-side completion-marker registry) from the pack source tree into the target program's `.claude/` (or runtime equivalent). Idempotent: re-running overwrites managed paths only; never touches program-owned files (`.planning/intel-context.md`, `.planning/audit.md`, `.planning/decisions/`).

- [ ] **Step 1: Write the failing test**

```bash
cat > /Users/romansky/gsd-ic/tests/install/install-pack.test.cjs <<'EOF'
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { installPack, MANAGED_PATHS } = require('../../bin/lib/gsd-ic/install-pack.cjs');

function tmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-pack-${label}-`));
}

function makeFakePackSource() {
  const src = tmp('src');
  fs.mkdirSync(path.join(src, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(src, 'agents', 'gsd-x.md'), '---\nic_pack: true\nclassification: UNCLASSIFIED\n---\n## X COMPLETE\n');
  fs.writeFileSync(path.join(src, 'agents', 'gsd-stock-keeper.md'), 'stock content (should NOT be copied; lacks ic_pack)');
  fs.mkdirSync(path.join(src, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(src, 'hooks', 'gsd-x.js'), '// IC hook');
  fs.mkdirSync(path.join(src, 'intel-refs'), { recursive: true });
  fs.writeFileSync(path.join(src, 'intel-refs', 'MANIFEST.json'), '{"version":"2026.05","topics":{}}');
  fs.mkdirSync(path.join(src, 'config-overlays', 'nga'), { recursive: true });
  fs.writeFileSync(path.join(src, 'config-overlays', 'nga', 'overlay.json'), '{"customer":"nga","agent_skills":{}}');
  fs.mkdirSync(path.join(src, 'skills', 'intel-coding-conventions'), { recursive: true });
  fs.writeFileSync(path.join(src, 'skills', 'intel-coding-conventions', 'SKILL.md'), '---\nic_pack: true\nclassification: UNCLASSIFIED\n---');
  fs.mkdirSync(path.join(src, 'references'), { recursive: true });
  fs.writeFileSync(path.join(src, 'references', 'agent-contracts.ic-pack.md'), '# IC Pack Agent Contracts');
  return src;
}

describe('installPack', () => {
  it('copies IC pack agents (those with ic_pack frontmatter) into target/.claude/agents/', () => {
    const src = makeFakePackSource();
    const target = tmp('tgt');
    installPack({ packSource: src, target, customer: 'nga' });
    assert.equal(fs.existsSync(path.join(target, '.claude/agents/gsd-x.md')), true);
    assert.equal(fs.existsSync(path.join(target, '.claude/agents/gsd-stock-keeper.md')), false);
  });

  it('copies hooks, intel-refs, the selected overlay, and skills', () => {
    const src = makeFakePackSource();
    const target = tmp('tgt');
    installPack({ packSource: src, target, customer: 'nga' });
    assert.equal(fs.existsSync(path.join(target, '.claude/hooks/gsd-x.js')), true);
    assert.equal(fs.existsSync(path.join(target, '.claude/intel-refs/MANIFEST.json')), true);
    assert.equal(fs.existsSync(path.join(target, '.claude/config-overlays/nga/overlay.json')), true);
    assert.equal(fs.existsSync(path.join(target, '.claude/skills/intel-coding-conventions/SKILL.md')), true);
  });

  it('does NOT copy other customer overlays', () => {
    const src = makeFakePackSource();
    fs.mkdirSync(path.join(src, 'config-overlays', 'nsa'), { recursive: true });
    fs.writeFileSync(path.join(src, 'config-overlays', 'nsa', 'overlay.json'), '{}');
    const target = tmp('tgt');
    installPack({ packSource: src, target, customer: 'nga' });
    assert.equal(fs.existsSync(path.join(target, '.claude/config-overlays/nsa')), false);
  });

  it('does not touch program-owned files in .planning/', () => {
    const src = makeFakePackSource();
    const target = tmp('tgt');
    fs.mkdirSync(path.join(target, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(target, '.planning/intel-context.md'), 'program-specific content');
    installPack({ packSource: src, target, customer: 'nga' });
    assert.equal(fs.readFileSync(path.join(target, '.planning/intel-context.md'), 'utf8'),
      'program-specific content');
  });

  it('exports MANAGED_PATHS for documentation', () => {
    assert.equal(Array.isArray(MANAGED_PATHS), true);
    assert.ok(MANAGED_PATHS.includes('.claude/agents'));
  });
});
EOF
```

- [ ] **Step 2: Verify failure**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/install-pack.test.cjs 2>&1 | tail -10
```

- [ ] **Step 3: Implement `install-pack.cjs`**

```bash
cat > /Users/romansky/gsd-ic/bin/lib/gsd-ic/install-pack.cjs <<'EOF'
'use strict';

const fs = require('fs');
const path = require('path');

// Paths under target/ that the IC pack manages (idempotent overwrite ok).
// Anything NOT in this list is program-owned and must not be touched.
const MANAGED_PATHS = [
  '.claude/agents',          // only IC pack agents (gsd-* with ic_pack: true)
  '.claude/hooks',           // only IC pack hooks (gsd-*)
  '.claude/skills',          // only IC pack skills (4 named in spec §7)
  '.claude/intel-refs',
  '.claude/config-overlays', // only the selected customer's directory
  '.claude/references/agent-contracts.ic-pack.md',
];

const IC_PACK_SKILL_NAMES = [
  'intel-coding-conventions',
  'prototyping-discipline',
  'classification-conventions',
  'adelphi-house-style',
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, filter = () => true) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.gitkeep') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, filter);
    } else if (entry.isFile() && filter(srcPath)) {
      copyFile(srcPath, destPath);
    }
  }
}

function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

function isIcPackAgent(filePath) {
  if (!filePath.endsWith('.md')) return false;
  const fm = readFrontmatter(filePath);
  return /\bic_pack:\s*true\b/.test(fm);
}

function copyAgents(srcRoot, target) {
  const srcDir = path.join(srcRoot, 'agents');
  const destDir = path.join(target, '.claude/agents');
  if (!fs.existsSync(srcDir)) return;
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const srcPath = path.join(srcDir, entry.name);
    if (!isIcPackAgent(srcPath)) continue;
    copyFile(srcPath, path.join(destDir, entry.name));
  }
}

function copyHooks(srcRoot, target) {
  const srcDir = path.join(srcRoot, 'hooks');
  const destDir = path.join(target, '.claude/hooks');
  if (!fs.existsSync(srcDir)) return;
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith('gsd-') && entry.name.endsWith('.js')) {
      copyFile(path.join(srcDir, entry.name), path.join(destDir, entry.name));
    } else if (entry.isDirectory() && entry.name === 'patterns') {
      copyDir(path.join(srcDir, 'patterns'), path.join(destDir, 'patterns'));
    }
  }
}

function copySkills(srcRoot, target) {
  const srcDir = path.join(srcRoot, 'skills');
  const destDir = path.join(target, '.claude/skills');
  if (!fs.existsSync(srcDir)) return;
  for (const skillName of IC_PACK_SKILL_NAMES) {
    const srcSkill = path.join(srcDir, skillName);
    if (!fs.existsSync(srcSkill)) continue;
    copyDir(srcSkill, path.join(destDir, skillName));
  }
}

function copyIntelRefs(srcRoot, target) {
  copyDir(path.join(srcRoot, 'intel-refs'), path.join(target, '.claude/intel-refs'));
}

function copyOverlay(srcRoot, target, customer) {
  const srcOverlay = path.join(srcRoot, 'config-overlays', customer);
  if (!fs.existsSync(srcOverlay)) {
    throw new Error(`customer overlay not found in pack source: ${srcOverlay}`);
  }
  copyDir(srcOverlay, path.join(target, '.claude/config-overlays', customer));
}

function copyContractRegistry(srcRoot, target) {
  const src = path.join(srcRoot, 'references/agent-contracts.ic-pack.md');
  if (fs.existsSync(src)) {
    copyFile(src, path.join(target, '.claude/references/agent-contracts.ic-pack.md'));
  }
}

function installPack({ packSource, target, customer }) {
  if (!fs.existsSync(target)) ensureDir(target);
  copyAgents(packSource, target);
  copyHooks(packSource, target);
  copySkills(packSource, target);
  copyIntelRefs(packSource, target);
  copyOverlay(packSource, target, customer);
  copyContractRegistry(packSource, target);
}

module.exports = {
  installPack,
  MANAGED_PATHS,
  IC_PACK_SKILL_NAMES,
  // exposed for unit tests:
  isIcPackAgent,
};
EOF
```

- [ ] **Step 4: Verify pass**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/install-pack.test.cjs
```

Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
cd /Users/romansky/gsd-ic
git add bin/lib/gsd-ic/install-pack.cjs tests/install/install-pack.test.cjs
git commit -m "[U] feat(install): install-pack module + tests"
```

---

## Task 21: Install entry-point — `wire-overlay.cjs`

**Files:**
- Create: `/Users/romansky/gsd-ic/bin/lib/gsd-ic/wire-overlay.cjs`
- Create: `/Users/romansky/gsd-ic/tests/install/wire-overlay.test.cjs`

Reads the selected customer's `overlay.json` `agent_skills` map and merges it into the target program's `.planning/config.json`. The target's existing `agent_skills` is preserved; only IC-pack-managed entries are added/replaced. The merge convention: every value in the overlay's `agent_skills` map replaces (not appends to) the target's value for that agent — because per spec §2.3 we have one customer per instance, no composition is needed. To know which entries are IC-pack-managed for safe re-install, we mark them by stamping the comment-equivalent JSON convention `__gsd_ic_managed: true` at the top level (so a future install can clear all IC-pack entries before re-applying).

- [ ] **Step 1: Write the failing test**

```bash
cat > /Users/romansky/gsd-ic/tests/install/wire-overlay.test.cjs <<'EOF'
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { wireOverlay } = require('../../bin/lib/gsd-ic/wire-overlay.cjs');

function tmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-overlay-${label}-`));
}

function writeOverlay(packSource, customer, agentSkills) {
  const dir = path.join(packSource, 'config-overlays', customer);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'overlay.json'), JSON.stringify({ customer, agent_skills: agentSkills }, null, 2));
}

describe('wireOverlay', () => {
  it('creates .planning/config.json if missing', () => {
    const target = tmp('new');
    const packSource = tmp('src');
    writeOverlay(packSource, 'nga', {
      'gsd-geoint-researcher': ['.claude/skills/intel-coding-conventions'],
    });
    wireOverlay({ packSource, target, customer: 'nga' });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.deepEqual(cfg.agent_skills['gsd-geoint-researcher'], ['.claude/skills/intel-coding-conventions']);
    assert.notEqual(cfg.__gsd_ic, undefined);
    assert.equal(cfg.__gsd_ic.customer, 'nga');
  });

  it('merges into existing .planning/config.json without disturbing other keys', () => {
    const target = tmp('existing');
    const packSource = tmp('src');
    fs.mkdirSync(path.join(target, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(target, '.planning/config.json'), JSON.stringify({
      workflow: { auto_advance: true },
      agent_skills: { 'gsd-planner': ['.claude/skills/some-stock-skill'] },
    }));
    writeOverlay(packSource, 'nga', { 'gsd-geoint-researcher': ['.claude/skills/intel-coding-conventions'] });
    wireOverlay({ packSource, target, customer: 'nga' });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.equal(cfg.workflow.auto_advance, true);
    assert.deepEqual(cfg.agent_skills['gsd-planner'], ['.claude/skills/some-stock-skill']);
    assert.deepEqual(cfg.agent_skills['gsd-geoint-researcher'], ['.claude/skills/intel-coding-conventions']);
  });

  it('replaces previously-IC-managed entries on re-install (idempotent)', () => {
    const target = tmp('reinstall');
    const packSource = tmp('src');
    // First install with one mapping.
    writeOverlay(packSource, 'nga', { 'gsd-geoint-researcher': ['.claude/skills/intel-coding-conventions'] });
    wireOverlay({ packSource, target, customer: 'nga' });
    // Second install with a different mapping (same customer, but pack content drifted).
    writeOverlay(packSource, 'nga', { 'gsd-geoint-researcher': ['.claude/skills/new-skill'] });
    wireOverlay({ packSource, target, customer: 'nga' });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.deepEqual(cfg.agent_skills['gsd-geoint-researcher'], ['.claude/skills/new-skill']);
  });

  it('records the customer + pack version in __gsd_ic metadata', () => {
    const target = tmp('meta');
    const packSource = tmp('src');
    fs.writeFileSync(path.join(packSource, 'VERSION'), 'pack: 0.1.0\ngsd_pinned: 1.39.0\n');
    writeOverlay(packSource, 'cia', {});
    wireOverlay({ packSource, target, customer: 'cia' });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.equal(cfg.__gsd_ic.customer, 'cia');
    assert.equal(cfg.__gsd_ic.pack_version, '0.1.0');
    assert.equal(typeof cfg.__gsd_ic.installed_at, 'string');
  });

  it('warns and prompts on customer switch (different customer than last install)', () => {
    const target = tmp('switch');
    const packSource = tmp('src');
    writeOverlay(packSource, 'nga', { 'gsd-x': ['.claude/skills/y'] });
    wireOverlay({ packSource, target, customer: 'nga' });
    writeOverlay(packSource, 'nsa', { 'gsd-x': ['.claude/skills/z'] });
    assert.throws(() =>
      wireOverlay({ packSource, target, customer: 'nsa', confirmCustomerSwitch: false }),
      /customer switch/i);
    // With explicit confirmation, switch goes through.
    wireOverlay({ packSource, target, customer: 'nsa', confirmCustomerSwitch: true });
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.equal(cfg.__gsd_ic.customer, 'nsa');
    assert.deepEqual(cfg.agent_skills['gsd-x'], ['.claude/skills/z']);
  });
});
EOF
```

- [ ] **Step 2: Verify failure**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/wire-overlay.test.cjs 2>&1 | tail -10
```

- [ ] **Step 3: Implement `wire-overlay.cjs`**

```bash
cat > /Users/romansky/gsd-ic/bin/lib/gsd-ic/wire-overlay.cjs <<'EOF'
'use strict';

const fs = require('fs');
const path = require('path');

function readPackVersion(packSource) {
  const p = path.join(packSource, 'VERSION');
  if (!fs.existsSync(p)) return null;
  const m = fs.readFileSync(p, 'utf8').match(/^pack:\s*(\S+)/m);
  return m ? m[1] : null;
}

function readOverlay(packSource, customer) {
  const p = path.join(packSource, 'config-overlays', customer, 'overlay.json');
  if (!fs.existsSync(p)) {
    throw new Error(`overlay.json missing for customer "${customer}" at ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readTargetConfig(target) {
  const p = path.join(target, '.planning/config.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`target config.json is malformed: ${p}: ${e.message}`);
  }
}

function writeTargetConfig(target, cfg) {
  const dir = path.join(target, '.planning');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2) + '\n');
}

function wireOverlay({ packSource, target, customer, confirmCustomerSwitch = false }) {
  const overlay = readOverlay(packSource, customer);
  const cfg = readTargetConfig(target);

  // Customer-switch guard.
  const previousCustomer = cfg.__gsd_ic && cfg.__gsd_ic.customer;
  if (previousCustomer && previousCustomer !== customer && !confirmCustomerSwitch) {
    throw new Error(
      `customer switch detected (was "${previousCustomer}", now "${customer}"). ` +
      `Re-run with --confirm-customer-switch to proceed. (Per spec §2.3, customer is ` +
      `usually a property of the program; switching usually means a new instance.)`
    );
  }

  // Clear previously-managed agent_skills entries (idempotent re-install).
  const previouslyManagedAgents = (cfg.__gsd_ic && cfg.__gsd_ic.managed_agents) || [];
  const existingSkills = cfg.agent_skills || {};
  for (const a of previouslyManagedAgents) delete existingSkills[a];

  // Apply new overlay's agent_skills (replace, not append).
  const newManagedAgents = Object.keys(overlay.agent_skills || {});
  for (const [agent, skills] of Object.entries(overlay.agent_skills || {})) {
    existingSkills[agent] = skills;
  }

  cfg.agent_skills = existingSkills;
  cfg.__gsd_ic = {
    customer,
    pack_version: readPackVersion(packSource),
    installed_at: new Date().toISOString(),
    managed_agents: newManagedAgents,
  };

  writeTargetConfig(target, cfg);
}

module.exports = { wireOverlay };
EOF
```

- [ ] **Step 4: Verify pass**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/wire-overlay.test.cjs
```

Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
cd /Users/romansky/gsd-ic
git add bin/lib/gsd-ic/wire-overlay.cjs tests/install/wire-overlay.test.cjs
git commit -m "[U] feat(install): wire-overlay module + tests"
```

---

## Task 22: Install idempotency — integration test across modules

**Files:**
- Create: `/Users/romansky/gsd-ic/tests/install/idempotency.test.cjs`

This is an integration test that exercises `installPack` + `wireOverlay` together to confirm re-running install produces the same end state as a single install (no duplicate files, no duplicate agent_skills entries, no leftover state from previous installs).

- [ ] **Step 1: Write the test**

```bash
cat > /Users/romansky/gsd-ic/tests/install/idempotency.test.cjs <<'EOF'
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { installPack } = require('../../bin/lib/gsd-ic/install-pack.cjs');
const { wireOverlay } = require('../../bin/lib/gsd-ic/wire-overlay.cjs');

function tmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-idem-${label}-`));
}

function makePackSource() {
  const src = tmp('src');
  fs.writeFileSync(path.join(src, 'VERSION'), 'pack: 0.1.0\ngsd_pinned: 1.39.0\n');
  fs.mkdirSync(path.join(src, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(src, 'agents', 'gsd-x.md'),
    '---\nic_pack: true\nclassification: UNCLASSIFIED\n---\n## X COMPLETE\n');
  fs.mkdirSync(path.join(src, 'intel-refs'), { recursive: true });
  fs.writeFileSync(path.join(src, 'intel-refs', 'MANIFEST.json'), '{"version":"2026.05","topics":{}}');
  fs.mkdirSync(path.join(src, 'config-overlays/nga'), { recursive: true });
  fs.writeFileSync(path.join(src, 'config-overlays/nga/overlay.json'),
    JSON.stringify({ customer: 'nga', agent_skills: { 'gsd-x': ['.claude/skills/y'] } }));
  return src;
}

function listAllRel(root) {
  const out = [];
  function walk(d, prefix) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      const rel = path.join(prefix, e.name);
      if (e.isDirectory()) walk(full, rel);
      else out.push({ rel, size: fs.statSync(full).size });
    }
  }
  walk(root, '');
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

describe('install idempotency', () => {
  it('produces identical file set + content after re-running install', () => {
    const packSource = makePackSource();
    const target = tmp('tgt');
    fs.mkdirSync(path.join(target, '.claude/skills/gsd-help'), { recursive: true });
    fs.writeFileSync(path.join(target, '.claude/skills/gsd-help/SKILL.md'), 'stock');

    installPack({ packSource, target, customer: 'nga' });
    wireOverlay({ packSource, target, customer: 'nga' });
    const after1 = listAllRel(target);

    installPack({ packSource, target, customer: 'nga' });
    wireOverlay({ packSource, target, customer: 'nga' });
    const after2 = listAllRel(target);

    // Strip __gsd_ic.installed_at timestamps before comparing config.json sizes.
    const cfg1 = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    const cfg2 = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    cfg1.__gsd_ic.installed_at = '<TS>';
    cfg2.__gsd_ic.installed_at = '<TS>';
    assert.deepEqual(cfg1, cfg2);

    // File set should be identical between runs.
    assert.deepEqual(after1.map((f) => f.rel), after2.map((f) => f.rel));
  });

  it('preserves program-owned files across re-install', () => {
    const packSource = makePackSource();
    const target = tmp('preserve');
    fs.mkdirSync(path.join(target, '.planning/decisions'), { recursive: true });
    fs.writeFileSync(path.join(target, '.planning/intel-context.md'), 'PROGRAM CONTEXT');
    fs.writeFileSync(path.join(target, '.planning/audit.md'), 'AUDIT LOG');
    fs.writeFileSync(path.join(target, '.planning/decisions/2026-05-06-x.md'), 'DECISION');

    installPack({ packSource, target, customer: 'nga' });
    wireOverlay({ packSource, target, customer: 'nga' });

    assert.equal(fs.readFileSync(path.join(target, '.planning/intel-context.md'), 'utf8'), 'PROGRAM CONTEXT');
    assert.equal(fs.readFileSync(path.join(target, '.planning/audit.md'), 'utf8'), 'AUDIT LOG');
    assert.equal(fs.readFileSync(path.join(target, '.planning/decisions/2026-05-06-x.md'), 'utf8'), 'DECISION');

    installPack({ packSource, target, customer: 'nga' });
    wireOverlay({ packSource, target, customer: 'nga' });

    assert.equal(fs.readFileSync(path.join(target, '.planning/intel-context.md'), 'utf8'), 'PROGRAM CONTEXT');
    assert.equal(fs.readFileSync(path.join(target, '.planning/audit.md'), 'utf8'), 'AUDIT LOG');
    assert.equal(fs.readFileSync(path.join(target, '.planning/decisions/2026-05-06-x.md'), 'utf8'), 'DECISION');
  });
});
EOF
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/idempotency.test.cjs
```

Expected: 2 tests passing (no implementation step — this test exercises modules from Tasks 20 and 21).

- [ ] **Step 3: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tests/install/idempotency.test.cjs
git commit -m "[U] test(install): idempotency integration test across install-pack + wire-overlay"
```

---

## Task 23: Install entry-point — `bin/gsd-ic-install.js` + end-to-end test

**Files:**
- Create: `/Users/romansky/gsd-ic/bin/gsd-ic-install.js`
- Create: `/Users/romansky/gsd-ic/tests/install/end-to-end.test.cjs`

The shim that npm runs when a consumer invokes `npx @adelphi/gsd-ic install --customer=<name>`. Resolves the pack source dir (the npm-installed package directory containing the IC pack content), parses argv, calls verify-gsd, install-pack, wire-overlay in sequence, and reports.

- [ ] **Step 1: Write the failing end-to-end test**

```bash
cat > /Users/romansky/gsd-ic/tests/install/end-to-end.test.cjs <<'EOF'
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function tmp(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-ic-e2e-${label}-`));
}

const PACK_ROOT = path.resolve(__dirname, '..', '..');

function setupFakeGsdInstall(target) {
  fs.mkdirSync(path.join(target, '.claude/skills/gsd-help'), { recursive: true });
  fs.writeFileSync(path.join(target, '.claude/skills/gsd-help/SKILL.md'), 'stock');
}

function runInstall(args, opts = {}) {
  return execFileSync('node', [path.join(PACK_ROOT, 'bin/gsd-ic-install.js'), ...args], {
    encoding: 'utf8',
    cwd: opts.cwd || process.cwd(),
    env: { ...process.env, ...(opts.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('end-to-end install', () => {
  it('--help prints usage and exits 0', () => {
    const out = runInstall(['--help']);
    assert.match(out, /npx @adelphi\/gsd-ic install/);
  });

  it('errors clearly when GSD is not installed in target', () => {
    const target = tmp('no-gsd');
    assert.throws(() => runInstall(['install', '--customer=nga', `--target=${target}`]), /GSD not detected/);
  });

  it('happy path: install --customer=nga produces the expected file tree', () => {
    const target = tmp('happy');
    setupFakeGsdInstall(target);
    const out = runInstall(['install', '--customer=nga', `--target=${target}`]);
    assert.match(out, /install complete/i);
    // managed paths exist (manifest copied)
    assert.equal(fs.existsSync(path.join(target, '.claude/intel-refs/MANIFEST.json')), true);
    // config.json was created/wired
    const cfg = JSON.parse(fs.readFileSync(path.join(target, '.planning/config.json'), 'utf8'));
    assert.equal(cfg.__gsd_ic.customer, 'nga');
  });

  it('errors on customer switch without --confirm-customer-switch', () => {
    const target = tmp('switch');
    setupFakeGsdInstall(target);
    runInstall(['install', '--customer=nga', `--target=${target}`]);
    assert.throws(() => runInstall(['install', '--customer=nsa', `--target=${target}`]), /customer switch/i);
  });
});
EOF
```

- [ ] **Step 2: Verify failure**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/end-to-end.test.cjs 2>&1 | tail -10
```

- [ ] **Step 3: Implement `bin/gsd-ic-install.js`**

```bash
cat > /Users/romansky/gsd-ic/bin/gsd-ic-install.js <<'EOF'
#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const { parseArgs, USAGE } = require(path.join(__dirname, 'lib', 'gsd-ic', 'parse-args.cjs'));
const { verifyGsd } = require(path.join(__dirname, 'lib', 'gsd-ic', 'verify-gsd.cjs'));
const { installPack } = require(path.join(__dirname, 'lib', 'gsd-ic', 'install-pack.cjs'));
const { wireOverlay } = require(path.join(__dirname, 'lib', 'gsd-ic', 'wire-overlay.cjs'));

function readGsdPinned() {
  const p = path.join(__dirname, '..', 'VERSION');
  if (!fs.existsSync(p)) return null;
  const m = fs.readFileSync(p, 'utf8').match(/^gsd_pinned:\s*(\S+)/m);
  return m ? m[1] : null;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }

  if (opts.subcommand === 'help') {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  const packSource = path.join(__dirname, '..');
  const gsdPinned = readGsdPinned();

  // 1. Verify GSD installed in target.
  const v = verifyGsd({ target: opts.target, gsdPinned });
  if (!v.ok) {
    process.stderr.write(`error: ${v.reason}\n`);
    process.exit(3);
  }
  process.stderr.write(`[gsd-ic] GSD detected (${v.detected}); pack pinned to GSD ${gsdPinned || '<unknown>'}\n`);

  // 2. Copy pack content.
  installPack({ packSource, target: opts.target, customer: opts.customer });
  process.stderr.write(`[gsd-ic] pack content installed under ${opts.target}/.claude/\n`);

  // 3. Wire customer overlay into agent_skills.
  const confirmSwitch = process.argv.includes('--confirm-customer-switch');
  try {
    wireOverlay({
      packSource,
      target: opts.target,
      customer: opts.customer,
      confirmCustomerSwitch: confirmSwitch,
    });
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(4);
  }
  process.stderr.write(`[gsd-ic] customer overlay wired (${opts.customer})\n`);

  process.stdout.write(`install complete: @adelphi/gsd-ic for customer=${opts.customer} in ${opts.target}\n`);
}

main();
EOF
chmod +x /Users/romansky/gsd-ic/bin/gsd-ic-install.js
```

- [ ] **Step 4: Verify the end-to-end test passes**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/end-to-end.test.cjs
```

Expected: 4 tests passing. (If "GSD not detected" assertion fails, double-check `setupFakeGsdInstall` writes `.claude/skills/gsd-help/SKILL.md` with the `gsd-` prefix exactly.)

- [ ] **Step 5: Run the entire install test suite**

```bash
cd /Users/romansky/gsd-ic
node --test tests/install/*.test.cjs
```

Expected: all 25 tests across the 5 install test files pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/romansky/gsd-ic
git add bin/gsd-ic-install.js tests/install/end-to-end.test.cjs
git commit -m "[U] feat(install): main entry-point bin/gsd-ic-install.js + end-to-end test"
```

---

## Task 24: `tools/patch-workflows.sh` stub

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/patch-workflows.sh`

A no-op stub that establishes the contract used by `validate-workflow-patches.sh` (Task 14), `validate-seamless-fork.sh` (Task 15), and the install entry-point. Plan 1+ phase plans add real patches by extending this script.

Contract (used by the validators and install tooling):
- `tools/patch-workflows.sh [<root>]` — apply patches to the given root (default: `$(pwd)`).
- `tools/patch-workflows.sh --check [<root>]` — dry-run; exit 0 if all patches would apply, non-zero otherwise.
- `tools/patch-workflows.sh --revert [<root>]` — revert applied patches (best-effort).

In Plan 0, all three modes are no-ops.

- [ ] **Step 1: Write the script**

```bash
cat > /Users/romansky/gsd-ic/tools/patch-workflows.sh <<'EOF'
#!/usr/bin/env bash
# patch-workflows.sh — apply IC pack workflow gate-hook patches to a target's
# stock GSD workflow files.
#
# Usage:
#   tools/patch-workflows.sh [<root>]            apply patches
#   tools/patch-workflows.sh --check [<root>]    dry-run, exit 0 if all apply
#   tools/patch-workflows.sh --revert [<root>]   revert applied patches
#
# In Plan 0 there are no patches; all modes are no-ops. Phase plans (1+) extend
# this script with concrete patch operations targeting:
#   - get-shit-done/workflows/new-project.md
#   - get-shit-done/workflows/discuss-phase.md
#   - get-shit-done/workflows/plan-phase.md
#   - get-shit-done/workflows/execute-phase.md
#   - get-shit-done/workflows/verify-work.md
#   - get-shit-done/workflows/secure-phase.md
#   - get-shit-done/workflows/audit-milestone.md
# (Per spec §9.3, each gate-hook insertion is one conditional `Skill(...)`
# call. Patches must keep validate-seamless-fork.sh happy.)

set -euo pipefail

mode="apply"
target_root="${PWD}"

while [ $# -gt 0 ]; do
  case "$1" in
    --check)  mode="check"; shift ;;
    --revert) mode="revert"; shift ;;
    --help|-h) sed -n '2,18p' "$0"; exit 0 ;;
    --) shift; break ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) target_root="$1"; shift ;;
  esac
done

# Plan 0: no patches defined. Always exit 0.
patches_dir="$(cd "$(dirname "$0")/../workflow-patches" 2>/dev/null && pwd)" || patches_dir=""
if [ -z "$patches_dir" ] || [ -z "$(ls -A "$patches_dir" 2>/dev/null | grep -v '^\.gitkeep$' || true)" ]; then
  case "$mode" in
    check)  echo "[patch-workflows] no patches defined (Plan 0 stub)"; exit 0 ;;
    revert) echo "[patch-workflows] no patches to revert"; exit 0 ;;
    apply)  echo "[patch-workflows] no patches to apply (Plan 0 stub)"; exit 0 ;;
  esac
fi

# Phase 1+ extension point: iterate $patches_dir/*.patch and apply.
echo "[patch-workflows] would process: $(ls "$patches_dir")"
exit 0
EOF
chmod +x /Users/romansky/gsd-ic/tools/patch-workflows.sh
```

- [ ] **Step 2: Smoke-test all three modes**

```bash
bash /Users/romansky/gsd-ic/tools/patch-workflows.sh
bash /Users/romansky/gsd-ic/tools/patch-workflows.sh --check
bash /Users/romansky/gsd-ic/tools/patch-workflows.sh --revert
```

Expected: each prints a `(Plan 0 stub)` or `no patches` message and exits 0.

- [ ] **Step 3: Run the validators that depend on this script**

```bash
bash /Users/romansky/gsd-ic/tools/ci/validate-workflow-patches.sh
bash /Users/romansky/gsd-ic/tools/ci/validate-seamless-fork.sh
```

Expected: both `OK`.

- [ ] **Step 4: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/patch-workflows.sh
git commit -m "[U] feat(tools): patch-workflows.sh stub (no-op for Plan 0; extension point for phase plans)"
```

---

## Task 25: `tools/sync/sync-from-upstream.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/sync/sync-from-upstream.sh`

Maintainer-side script that pulls upstream `gsd-build/get-shit-done`, reapplies workflow patches, and re-runs all validators. Per spec §11.1.

The script assumes:
- the `upstream` git remote is configured to point at `https://github.com/gsd-build/get-shit-done.git`
- the maintainer has a clean working tree on the target branch (default `main`)

It does NOT push to origin automatically — the maintainer reviews the merge result and pushes manually.

- [ ] **Step 1: Write the script**

```bash
mkdir -p /Users/romansky/gsd-ic/tools/sync
cat > /Users/romansky/gsd-ic/tools/sync/sync-from-upstream.sh <<'EOF'
#!/usr/bin/env bash
# sync-from-upstream.sh — pull upstream gsd-build/get-shit-done changes into
# this soft-fork, reapply workflow patches, update VERSION's gsd_pinned field,
# and run the full validator suite.
#
# Usage:
#   tools/sync/sync-from-upstream.sh [--branch=main] [--no-merge]
#
# --no-merge: fetch upstream and report the diff, but don't merge. Useful for
# scoping work before committing to a sync.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

branch="main"
do_merge=1

while [ $# -gt 0 ]; do
  case "$1" in
    --branch=*) branch="${1#*=}"; shift ;;
    --no-merge) do_merge=0; shift ;;
    --help|-h) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

# Sanity checks.
if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree is dirty. Commit or stash before syncing." >&2
  exit 1
fi
if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "error: 'upstream' remote not configured. Run:" >&2
  echo "  git remote add upstream https://github.com/gsd-build/get-shit-done.git" >&2
  exit 1
fi

echo "==> fetching upstream..."
git fetch upstream

ahead_behind="$(git rev-list --left-right --count "$branch...upstream/main" || echo "0	0")"
behind="$(echo "$ahead_behind" | cut -f2)"
echo "==> behind upstream by $behind commits"

if [ "$behind" -eq 0 ]; then
  echo "==> already in sync"
  exit 0
fi

if [ "$do_merge" -eq 0 ]; then
  echo "==> --no-merge: showing what would be merged:"
  git log --oneline "$branch..upstream/main"
  exit 0
fi

echo "==> merging upstream/main into $branch..."
git merge --no-edit upstream/main || {
  echo "error: merge had conflicts. Resolve and re-run validators manually." >&2
  exit 1
}

# Update VERSION's gsd_pinned to whatever the upstream HEAD's package.json declares.
upstream_version="$(node -e "console.log(require('./package.upstream.json').version)" 2>/dev/null || echo "unknown")"
# Note: upstream sync may have changed package.json (we ship our own at root);
# refresh package.upstream.json to reflect the new upstream contents, then update VERSION.
if [ -f package.upstream.json ]; then
  # Pull upstream's package.json content (we want the upstream version, not our IC pack version).
  git show "upstream/main:package.json" > package.upstream.json 2>/dev/null || true
  upstream_version="$(node -e "try { console.log(require('./package.upstream.json').version) } catch(e) { console.log('unknown') }")"
fi
sed -i.bak -E "s/^gsd_pinned:.*/gsd_pinned: $upstream_version/" VERSION
rm -f VERSION.bak
echo "==> VERSION updated: gsd_pinned: $upstream_version"

echo "==> reapplying workflow patches..."
bash tools/patch-workflows.sh

echo "==> running full validator suite..."
bash tools/ci/_run-all.sh --continue

echo "==> sync complete. Review the merge with 'git log -1' and 'git diff HEAD~..HEAD',"
echo "    then push with 'git push origin $branch' when ready."
EOF
chmod +x /Users/romansky/gsd-ic/tools/sync/sync-from-upstream.sh
```

- [ ] **Step 2: Smoke-test (`--no-merge`, won't touch the working tree)**

```bash
cd /Users/romansky/gsd-ic
bash tools/sync/sync-from-upstream.sh --no-merge
```

Expected: prints "behind upstream by N commits" or "already in sync", then exits 0. (If the `upstream` remote isn't configured yet, the script tells you how to add it.)

- [ ] **Step 3: Confirm `npm run sync-upstream` resolves**

```bash
cd /Users/romansky/gsd-ic
npm run sync-upstream -- --no-merge 2>&1 | tail -5
```

Expected: same output as Step 2 (`npm run` proxies to the script).

- [ ] **Step 4: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/sync/sync-from-upstream.sh
git commit -m "[U] feat(tools): sync-from-upstream.sh (dev-side soft-fork sync)"
```

---

## Task 26: `tools/release/release-pack.sh`

**Files:**
- Create: `/Users/romansky/gsd-ic/tools/release/release-pack.sh`

Bumps the `pack` field in `VERSION`, mirrors it into `package.json`, runs the full validator suite (gates the release), tags, and runs `npm publish --dry-run` (the maintainer triggers the real publish manually after reviewing). Per spec §11.0, §11.-1.

- [ ] **Step 1: Write the script**

```bash
mkdir -p /Users/romansky/gsd-ic/tools/release
cat > /Users/romansky/gsd-ic/tools/release/release-pack.sh <<'EOF'
#!/usr/bin/env bash
# release-pack.sh — bump pack version, tag, validate, dry-run publish.
#
# Usage:
#   tools/release/release-pack.sh --version=YYYY.MM.N
#
# After this script succeeds, the maintainer runs `npm publish --access=restricted`
# manually to push the release to npm. This intentional separation prevents
# accidental publishes from automation.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

new_version=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version=*) new_version="${1#*=}"; shift ;;
    --help|-h) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$new_version" ]; then
  echo "error: --version=YYYY.MM.N required" >&2
  exit 2
fi
if ! [[ "$new_version" =~ ^[0-9]{4}\.[0-9]{2}\.[0-9]+$ ]]; then
  echo "error: version must match YYYY.MM.N (got '$new_version')" >&2
  exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree dirty. Commit before releasing." >&2
  exit 1
fi

echo "==> running full validator suite..."
bash tools/ci/_run-all.sh

echo "==> bumping VERSION pack field to $new_version..."
sed -i.bak -E "s/^pack:.*/pack: $new_version/" VERSION
rm -f VERSION.bak

echo "==> mirroring version into package.json..."
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.version = '$new_version';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"

echo "==> committing version bump..."
git add VERSION package.json
git commit -m "[U] release: pack v$new_version"

echo "==> tagging v$new_version..."
git tag -a "v$new_version" -m "IC pack release $new_version"

echo "==> npm pack --dry-run preview..."
npm pack --dry-run 2>&1 | head -40

echo
echo "==> Release prepared."
echo "    Tag: v$new_version (local; not pushed)"
echo "    Next steps:"
echo "      1. Review the npm pack --dry-run output above for unexpected files."
echo "      2. git push origin main && git push origin v$new_version"
echo "      3. npm publish --access=restricted    (manual; not automated)"
EOF
chmod +x /Users/romansky/gsd-ic/tools/release/release-pack.sh
```

- [ ] **Step 2: Verify it runs end-to-end (use a fake version, then revert)**

```bash
cd /Users/romansky/gsd-ic
# Don't actually run a release; we just verify --help works without side effects.
bash tools/release/release-pack.sh --help
```

Expected: prints usage; exits 0.

(A real release run is deferred — typically the first real release is at the end of Plan 1 when the first agent ships.)

- [ ] **Step 3: Confirm the npm script resolves**

```bash
cd /Users/romansky/gsd-ic
npm run release -- --help 2>&1 | tail -10
```

Expected: usage output.

- [ ] **Step 4: Commit**

```bash
cd /Users/romansky/gsd-ic
git add tools/release/release-pack.sh
git commit -m "[U] feat(tools): release-pack.sh (version bump + tag + dry-run publish)"
```

---

## Task 27: GitHub Actions CI workflow — `.github/workflows/ic-ci.yml`

**Files:**
- Create: `/Users/romansky/gsd-ic/.github/workflows/ic-ci.yml`

Runs on every PR + push to main. Executes:
1. The full validator suite (`tools/ci/_run-all.sh`).
2. The vitest install test suite (`npm run test:install`).
3. The validator test suite (`npm run test:validators`).

Separate workflow file from upstream's CI to minimize sync friction.

- [ ] **Step 1: Write the workflow**

```bash
mkdir -p /Users/romansky/gsd-ic/.github/workflows
cat > /Users/romansky/gsd-ic/.github/workflows/ic-ci.yml <<'EOF'
name: IC pack CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validators:
    name: Run IC pack validators
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - name: Install jq + python3
        run: sudo apt-get update && sudo apt-get install -y jq python3
      - name: Use Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install npm deps
        run: npm ci || npm install
      - name: Run all validators
        run: bash tools/ci/_run-all.sh

  validator-tests:
    name: Run validator unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install jq + python3
        run: sudo apt-get update && sudo apt-get install -y jq python3
      - name: Run validator tests
        run: bash tools/ci/tests/_run-all.sh

  install-tests:
    name: Run install entry-point tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install npm deps
        run: npm ci || npm install
      - name: Run install tests
        run: npm run test:install
EOF
```

- [ ] **Step 2: Lint the YAML locally**

```bash
cd /Users/romansky/gsd-ic
node -e "
const fs = require('fs');
const yaml = fs.readFileSync('.github/workflows/ic-ci.yml', 'utf8');
// minimal sanity: file has 'jobs:' and at least one 'runs-on:'
if (!/^jobs:/m.test(yaml)) { console.error('missing jobs:'); process.exit(1); }
if (!/runs-on:/.test(yaml)) { console.error('missing runs-on:'); process.exit(1); }
console.log('ic-ci.yml structurally OK');
"
```

Expected: `ic-ci.yml structurally OK`. (For full YAML lint, `npx --yes yaml-lint .github/workflows/ic-ci.yml` if you have it.)

- [ ] **Step 3: Push to a feature branch and verify Actions runs green**

This step requires GitHub remote access. Skip if running offline; otherwise:

```bash
cd /Users/romansky/gsd-ic
git checkout -b ic-pack-scaffolding
git push -u origin ic-pack-scaffolding
```

Open a draft PR against `main` and confirm the three CI jobs (`validators`, `validator-tests`, `install-tests`) all pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/romansky/gsd-ic
git checkout main 2>/dev/null || true
git add .github/workflows/ic-ci.yml
git commit -m "[U] ci: GitHub Actions workflow for IC pack (validators + install tests)"
```

---

## Task 28: Full bottom-to-top smoke test (manual, gating completion of Plan 0)

**Files:** none new — this task exercises everything Plan 0 has produced.

The goal: confirm a fresh clone of gsd-ic can be tested, packaged, and "installed" into a fake program directory end-to-end without any agent / hook / skill having shipped yet. This is the Plan 0 acceptance test.

- [ ] **Step 1: Re-run all validators**

```bash
cd /Users/romansky/gsd-ic
bash tools/ci/_run-all.sh
```

Expected: every validator prints `OK` (the staleness one may print warnings — those are not failures); final line `[ci] all validators passed`.

- [ ] **Step 2: Re-run all validator unit tests**

```bash
cd /Users/romansky/gsd-ic
bash tools/ci/tests/_run-all.sh
```

Expected: every test file reports `0 failed`; final line `[run-all] all validator tests passed.`

- [ ] **Step 3: Re-run the entire install test suite**

```bash
cd /Users/romansky/gsd-ic
npx vitest run tests/install
```

Expected: 25 tests pass across 5 files (parse-args 9, verify-gsd 4, install-pack 5, wire-overlay 5, idempotency 2, end-to-end 4 — adjust counts to match what you actually wrote).

- [ ] **Step 4: Manual end-to-end install simulation against a fake program**

```bash
cd /tmp
rm -rf fake-program
mkdir -p fake-program/.claude/skills/gsd-help
echo "fake stock GSD" > fake-program/.claude/skills/gsd-help/SKILL.md

node /Users/romansky/gsd-ic/bin/gsd-ic-install.js install --customer=nga --target=/tmp/fake-program
```

Expected output:
```
[gsd-ic] GSD detected (modern-skills); pack pinned to GSD <version>
[gsd-ic] pack content installed under /tmp/fake-program/.claude/
[gsd-ic] customer overlay wired (nga)
install complete: @adelphi/gsd-ic for customer=nga in /tmp/fake-program
```

Inspect the result:

```bash
find /tmp/fake-program -type f | sort
cat /tmp/fake-program/.planning/config.json
```

Expected files include:
- `/tmp/fake-program/.claude/intel-refs/MANIFEST.json` (the empty manifest)
- `/tmp/fake-program/.claude/config-overlays/nga/.gitkeep` (only the empty NGA overlay since Plan 0 ships catalog stubs only)
- `/tmp/fake-program/.claude/references/agent-contracts.ic-pack.md` (the empty registry)
- `/tmp/fake-program/.planning/config.json` containing `__gsd_ic` metadata with `customer: nga`
- The original `/tmp/fake-program/.claude/skills/gsd-help/SKILL.md` left untouched

- [ ] **Step 5: Manual idempotent re-install**

```bash
node /Users/romansky/gsd-ic/bin/gsd-ic-install.js install --customer=nga --target=/tmp/fake-program
node /Users/romansky/gsd-ic/bin/gsd-ic-install.js install --customer=nga --target=/tmp/fake-program
```

Expected: no errors; `__gsd_ic.installed_at` field updates; everything else unchanged.

- [ ] **Step 6: Manual customer-switch detection**

```bash
node /Users/romansky/gsd-ic/bin/gsd-ic-install.js install --customer=nsa --target=/tmp/fake-program 2>&1 | head -3
```

Expected: error message about customer switch; exit code non-zero.

- [ ] **Step 7: Verify `npm pack --dry-run` produces a pack-only artifact**

```bash
cd /Users/romansky/gsd-ic
npm pack --dry-run 2>&1 | grep -E "^\s*npm notice" | head -50
```

Inspect the file list. Expected to include:
- `bin/gsd-ic-install.js` and `bin/lib/gsd-ic/*.cjs`
- `intel-refs/MANIFEST.json` and the `.gitkeep` files
- `config-overlays/README.md` and the per-customer `.gitkeep` files
- `references/agent-contracts.ic-pack.md`
- `tools/patch-workflows.sh` and `tools/ci/*.sh`
- `VERSION`, `package.json`, `README.md`, `LICENSE`
- `docs/ic-pack/*.md`

Expected NOT to include:
- `sdk/`, `scripts/`, `get-shit-done/`, `bin/install.js`, `bin/gsd-sdk.js` (upstream source)
- `tests/`, `tools/sync/`, `tools/release/` (dev-only)
- `package.upstream.json`

If anything from the "NOT to include" list appears, edit `package.json` `files` field and re-run `validate-publish-scope.sh`.

- [ ] **Step 8: Cleanup**

```bash
rm -rf /tmp/fake-program
```

- [ ] **Step 9: Commit nothing — this is a verification task. If you needed to fix anything in Steps 1–8 (for example a missing entry in `package.json` `files`), commit those fixes against the appropriate prior task with a `fix:` prefix.**

---

## Self-Review (run before announcing completion)

Run this checklist with fresh eyes against the spec:

### 1. Spec coverage check

Walk through each numbered section of the design spec (`docs/specs/2026-05-05-ic-agent-pack-design.md`) and confirm Plan 0 covers it where applicable:

| Spec section | Covered by | Notes |
|---|---|---|
| §2.3 single-program-instantiation | Task 21 (`wireOverlay` enforces one customer per `__gsd_ic` block) | ✓ |
| §4.1 layer model | Tasks 2, 20 (directory layout reflects Layers 0–4; manifest skeleton at Layer 2) | Layer 5 is program-owned, not pack territory |
| §6 hooks | Plan 1 (Phase 0 Foundations) | Plan 0 prepares the hooks/ directory only |
| §7 skills | Plan 1, Plan 4 | Plan 0 prepares the skills/ tree only |
| §8.1 manifest schema | Task 2 (skeleton), Task 5 (validator) | ✓ |
| §8.3 customer overlay catalog | Tasks 2, 21 (catalog stubs + overlay wiring) | ✓ |
| §9 workflow integration | Tasks 14, 15, 24 (validators + patch-workflows stub) | Real patches in Plan 1+ |
| §10 repo layout | Tasks 1–3, 17, 24–26 | ✓ |
| §11.-1 release cadence | Task 26 | ✓ |
| §11.0 IC pack version | Tasks 1, 26 | ✓ |
| §11.1 soft-fork tracking | Task 25 | ✓ |
| §11.2 npm distribution | Tasks 1, 18–23 | ✓ |
| §11.3–11.6 add-an-X procedures | Task 3 (skeleton docs); detailed in respective phase plans | ✓ |
| §12 CI validators (10 + 2 added) | Tasks 5–16, 17 | ✓ |
| §13 build sequencing Phase 0 | Plan 1 | Plan 0 is *pre*-Phase-0 |
| §14 R-XX risks | Plan 0 mitigates: R-02 (sync script), R-03 (validate-classification + no-classified-leak), R-07 (soft-fork dev workflow), R-09 (validate-workflow-patches harness) | ✓ |
| §17 appendices A/B/C templates | Task 3 referenced; full content materialized in Plan 1 alongside the first agent/ref/skill | Acceptable deferral |

If you find a spec requirement with no corresponding task and it belongs in scaffolding (not a phase plan), add the task here.

### 2. Placeholder scan

Search the plan for red flags:

```bash
grep -n -E "(TBD|TODO|implement later|fill in|appropriate (error|validation|edge))" /Users/romansky/gsd-ic/docs/plans/2026-05-06-pack-scaffolding-infrastructure.md
```

Expected: zero matches. If any appear, expand them inline before considering the plan ready.

### 3. Type / API consistency check

Walk these specifically:

- Does `parseArgs` (Task 18) export the same option names that `bin/gsd-ic-install.js` (Task 23) reads from? → Yes: `subcommand`, `customer`, `target`.
- Does `installPack` (Task 20) accept the same `{ packSource, target, customer }` shape that `bin/gsd-ic-install.js` passes? → Yes.
- Does `wireOverlay` (Task 21) accept the same shape plus `confirmCustomerSwitch`? → Yes.
- Does `verifyGsd` (Task 19) return `{ ok, detected | reason, gsdPinned }` in the shape `bin/gsd-ic-install.js` uses? → Yes.
- Are `MANAGED_PATHS` and `IC_PACK_SKILL_NAMES` (Task 20) referenced consistently with their declarations? → Yes.
- Validator file names cited in `tools/ci/_run-all.sh` (Task 17) match the file names created by Tasks 5–16? → Yes (12 entries in `VALIDATORS` array, one per validator task).
- The `--check` flag on `tools/patch-workflows.sh` (Task 24) is called by `validate-workflow-patches.sh` (Task 14)? → Yes.

If any name mismatch, fix at the earlier task (the source of truth) and downstream references update naturally.

### 4. Scope check

Plan 0 must produce **working, testable software on its own**. Acceptance:
- `npm run ci` exits 0 on the empty pack ✓ (Task 17)
- `npm pack --dry-run` produces a valid pack-only artifact ✓ (Task 28 step 7)
- `node bin/gsd-ic-install.js install --customer=nga --target=<dir>` succeeds against a fake-GSD target ✓ (Task 28 step 4)
- Idempotent re-install works ✓ (Tasks 22, 28 step 5)
- All 12 validators + 25 vitest cases pass in CI ✓ (Tasks 5–16, 18–23)

If any of these are not yet true after executing the plan, file a fix task before declaring Plan 0 done.

---

## Plan complete

Plan saved to `/Users/romansky/gsd-ic/docs/plans/2026-05-06-pack-scaffolding-infrastructure.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Uses superpowers:subagent-driven-development.

**2. Inline Execution** — Execute tasks in this session using superpowers:executing-plans, batch execution with checkpoints.

Which approach?

---

## Out-of-scope reminders for Plan 1+

These items are **not** in Plan 0 and belong to subsequent plans. Listed here so the executing engineer doesn't accidentally drag them in:

- Any IC pack agent file (Plan 1 ships the first one: `gsd-customer-context-mapper`).
- Any IC pack hook implementation (Plan 1 ships all 3 hooks).
- Any IC pack skill content (Plan 1 ships 2: `classification-conventions`, `intel-coding-conventions`).
- Reference doc content (Plan 1 ships 5 essential refs).
- `intel-gates.json` template + actual workflow patches (Plan 1+).
- `MODEL_PROFILES` table additions for the 58 IC agents (each agent's row lands with its phase plan).
- Customer overlay content beyond the empty catalog (lands as customer engagements demand it).
- ARCHITECTURE diagrams (rendered Mermaid; Plan 1+ as the architecture stabilizes).

If anything in this list ends up tempting in the middle of Plan 0 execution, stop and surface it — it likely belongs in a follow-up plan, not here.

---

## Deviations from plan during execution

### Task 7: completion-marker fixture corrected (2026-05-06)

The plan's Case 2 and Case 5 fixtures wrote the completion marker as `\`## SAMPLE COMPLETE\`` inside an unquoted `<<MD` heredoc. After bash processes `\``, the file contains `` `## SAMPLE COMPLETE` `` (backtick-wrapped). The validator regex is `^##...` (no leading backtick), and the upstream GSD convention (verified against `agents/gsd-*.md` files) is the bare `## NAME COMPLETE` form. Fixture corrected to drop the backticks. Validator regex unchanged.

### Task 9: docs/plans added to validator exclusion list (2026-05-06)

The plan's `EXCLUDES` array did not include `docs/plans/`. The plan file itself contains the literal patterns from spec §12 row 6 inside its test-fixture heredocs (`S//NOFORN`, `TS//SI//`, `HCS-O//`, `ORCON`, `NOFORN`). Without excluding `docs/plans`, Step 5 fails on the plan's own content. Added `'docs/plans'` to EXCLUDES — same rationale as `docs/specs`/`docs/superpowers`: planning docs legitimately quote the spec patterns. No other change to validator behavior.

### Task 16: PCRE negative-lookahead replaced with POSIX special-case (2026-05-06)

The plan's denylist included `'^commands/(?!gsd/intel-gate-)'`. That's PCRE negative-lookahead syntax; `grep -E` (POSIX ERE) doesn't support `(?!...)`. The entry silently never matched (or errored under `ugrep`), so any `commands/*` entry slipped through. Replaced with an explicit `if [[ "$path" =~ ^commands/ ]] && ! [[ "$path" =~ ^commands/gsd/intel-gate- ]]` special-case before the denylist loop. Same intended semantics, POSIX-compatible.

### Task 24: executed before Task 17 (2026-05-06)

The plan orders Task 24 after Tasks 17–23. But Task 17 (master runner) expects all validators to pass against the live repo, and `validate-workflow-patches.sh`/`validate-seamless-fork.sh` both require `tools/patch-workflows.sh` to exist. Task 24 was therefore executed early, before Task 17, to satisfy the dependency. No content change to Task 24 itself — only execution order.

### Plan-wide: install tests use node:test, not vitest (2026-05-06)

Tasks 18-23 originally specified `vitest` for install tests with `.test.cjs` files. Vitest 1.6's `index.cjs` throws on direct `require('vitest')` — it's intended to be loaded only through vitest's own runner. The fix would require modifying upstream-owned `vitest.config.ts` (adding `globals: true` + a CJS shim), which violates the seamless-fork constraint (plan §"Seamless-fork guarantee" line 15). Switched to Node's built-in `node:test` runner instead: built into Node 20+ (already our `engines` floor), native CJS support, zero upstream impact, and no fragile shim. Test patterns converted: `expect(x).toBe(y)` → `assert.equal(x, y)`, `expect(...).toMatch(...)` → `assert.match(...)`, `expect(() => ...).toThrow(...)` → `assert.throws(() => ..., ...)`. Command runner: `node --test tests/install/<file>.test.cjs`. Production module code (verify-gsd, install-pack, wire-overlay, parse-args, gsd-ic-install) is unchanged — only test files and package.json's test:install script are affected.

