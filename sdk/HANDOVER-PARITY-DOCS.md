# Handover: Parity exceptions doc + CJS-only matrix (next session)

**Status:** The deliverables described below are implemented in `sdk/src/query/QUERY-HANDLERS.md` (sections **Golden parity: coverage and exceptions** and **CJS command surface vs SDK registry**). Use that file as the canonical registry + parity reference; this handover remains useful for issue **#2302** scope and parent **#2007** links.

Paste this document (or `@sdk/HANDOVER-PARITY-DOCS.md`) at the start of a new chat so work continues without re-auditing issue scope.

## Goal for this session

1. **Parity “exceptions” documentation** — A clear, maintainable description of where **full JSON equality** between `gsd-tools.cjs` and `createRegistry()` is **not** expected or not attempted, and why (stubs, structural-only tests, environment-dependent fields, ordering, etc.). Map this to **#2007 / #2302** expectations: no *undocumented* gap.
2. **CJS-only matrix** — A **single authoritative table**: each relevant `gsd-tools.cjs` surface (top-level command or documented cluster) → **registered in SDK** vs **permanent CLI-only** vs **alias / naming difference**, with a **one-line justification** where not registered.

## Parent tracking

- **Issue:** [gsd-build/get-shit-done#2302](https://github.com/gsd-build/get-shit-done/issues/2302) — Phase 3 SDK query parity, registry, docs (parent umbrella #2007).
- **Acceptance criteria touched here:** parity coverage/exceptions documented; registry audit reflected in a **matrix** (issue wording: “every required CJS surface either has a handler or appears in the CJS-only matrix with justification”).

## Repo / branch

- **Workspace:** `D:\Repos\get-shit-done` (PBR backport); adjust path if different machine.
- **Feature branch (typical):** `feat/sdk-phase3-query-layer` — confirm with `git branch` before editing.
- **Upstream:** `gsd-build/get-shit-done`.

## What already exists (do not duplicate blindly)

- `sdk/src/query/QUERY-HANDLERS.md` — Registry conventions, partial “not registered” list (**graphify**, **from-gsd2**), CLI name differences (**summary-extract** vs **summary.extract**, **scaffold** vs **phase.scaffold**), **intel.update** (CJS JSON parity; refresh via agent), **skill-manifest --write** / mutation events, **docs-init** golden note (agent install fields), **stateExtractField** rule.
- `sdk/src/golden/golden.integration.test.ts` — Source of truth for **which commands** are golden-tested and **how** (full equality vs subset vs normalized `existing_docs` vs omitted fields; `init.quick` strips clock-derived keys via `init-golden-normalize.ts`).
- `sdk/src/golden/capture.ts` — `captureGsdToolsOutput()` spawns `get-shit-done/bin/gsd-tools.cjs`.
- `docs/CLI-TOOLS.md` — User-facing CLI reference; should **link** to the parity exceptions + matrix (or host a short summary with pointer to `sdk/`).

## Deliverables (suggested shape)

### A) Parity exceptions section

Add or extend a dedicated section (prefer `QUERY-HANDLERS.md` under a heading like **"Golden parity: coverage and exceptions"**, or a new `sdk/PARITY.md` if the team wants less churn in QUERY-HANDLERS — **pick one canonical location** and link from the other).

Cover at least:


| Category                      | Examples to document                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Full JSON parity**          | Commands where tests use `toEqual` on `sdkResult.data` vs CJS stdout JSON.                                                            |
| **Structural / field subset** | Tests that compare only selected keys (e.g. `frontmatter.get`, `find-phase` — SDK subset vs CJS). Full parity for `roadmap.analyze`, `init.*` (except `init.quick` volatile keys), etc. — see `QUERY-HANDLERS.md` matrix. |
| **Normalized comparison**     | e.g. `docs-init`: `existing_docs` sorted by path; `agents_installed` / `missing_agents` omitted between subprocess vs in-process. |
| **CLI parity without in-process refresh** | `intel.update` — JSON matches CJS `intel.cjs` (spawn hint or disabled); refresh is agent-driven.                                                                                    |
| **Conditional behavior**      | `skill-manifest`: writes only with `--write`; not in `QUERY_MUTATION_COMMANDS`.                                                   |
| **Environment / time**        | `current-timestamp`: structure and format, not same instant.                                                                      |
| **Not in golden suite**       | Commands registered but not (yet) covered — list as **coverage gap** or **out of scope for golden** with rationale.                   |


### B) CJS-only matrix

Build the table by **diffing** `get-shit-done/bin/gsd-tools.cjs` `switch (command)` top-level cases against `createRegistry()` registrations in `sdk/src/query/index.ts`.

**Already documented as product-out-of-scope for registry:** **graphify**, **from-gsd2** / **gsd2-import**.

**Already documented as naming/alias differences (registered, different string):** **summary-extract** ↔ **summary.extract**; top-level **scaffold** ↔ **phase.scaffold**.

Matrix columns (suggested):

- **CJS command** (or subcommand pattern)
- **SDK dispatch name(s)** if any
- **Disposition:** Registered / CLI-only / Alias-only / Stub / N/A
- **Justification** (one line) if not a straight registered parity

Optional: footnote that `detect-custom-files` skips multi-repo root resolution in CJS (`SKIP_ROOT_RESOLUTION`) — behavior is documented in CLI; matrix can mention if relevant.

## Files likely to edit


| Path                              | Role                                                              |
| --------------------------------- | ----------------------------------------------------------------- |
| `sdk/src/query/QUERY-HANDLERS.md` | Primary home for exceptions + matrix, or link hub.                |
| `sdk/PARITY.md`                   | Optional dedicated file if QUERY-HANDLERS becomes too long.       |
| `docs/CLI-TOOLS.md`               | Short “Parity & registry” subsection with links into `sdk/` docs. |
| `sdk/HANDOVER-GOLDEN-PARITY.md`   | Optional one-line pointer to new parity doc section when done.    |


## Out of scope for *this* handover session

- Implementing runner alignment (`GSDTools` → registry) — separate #2302 work.
- Adding `@deprecated` headers to `gsd-tools.cjs` — separate task.
- **CHANGELOG** — only if you batch doc work with release notes in same PR (optional).

## Verification

- No code behavior change required for pure docs; run `npm run build` in `sdk/` only if TypeScript-adjacent files were touched.
- Proofread: every **CLI-only** row has a **justification**; every **exception** in golden tests appears in the exceptions doc.

## Success criteria

- A reader can answer: **“Which commands are fully golden-parity vs partial vs stub vs untested?”** without reading the whole test file.
- A reader can answer: **“Which `gsd-tools` top-level commands are not registered and why?”** from one table.
- **#2302** acceptance bullets on parity documentation and registry matrix are satisfied for the **documentation** slice (remaining issue items may still be open for code).

---

*Created for handoff to “parity exceptions + CJS-only matrix” session. Update when the canonical doc location or golden coverage changes.*