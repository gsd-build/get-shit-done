# Contributor Standards

Standards for working with `CONTEXT.md`, `docs/adr/`, and AI-agent-assisted contributions.

These apply to every PR — fix, enhancement, or feature. They are part of the merge contract, not optional background reading.

**Standards hierarchy** (canonical, in order):

1. `CONTEXT.md` — domain language and module naming
2. `docs/adr/` — accepted architectural decisions
3. Approved issue scope

---

## CONTEXT.md

### What it is

`CONTEXT.md` is the single source of truth for domain vocabulary. It defines:

- **Domain terms** — canonical Module names, seam vocabulary, and Interface names (e.g. Dispatch Policy Module, Command Contract Validation Module, Planning Workspace Module)
- **Recurring PR mistakes** — CodeRabbit findings that recur; covers tests, shell guards, changesets, docs
- **Workflow learnings** — patterns distilled from triage + PR cycles

### Format

`CONTEXT.md` is written as flat named sections under `## Domain terms` (for Modules/seams) and `##` sections for recurring rules. Machine-oriented predicates use `KEY.SUBKEY=value` flat format in code blocks under `## AI Ops Memory`.

Adding a new Module or seam:

- Add a `### <Module Name>` entry under `## Domain terms`.
- Write one paragraph. State what the Module owns. Be concrete — list the Interface names and policy boundaries it covers.
- Do not add synonyms; pick one name and use it everywhere.

Extending an existing predicate:

- Add a `KEY.SUBKEY=value` line inside the relevant `## AI Ops Memory` block.
- Do not create a new top-level section for a variation on an existing concept.

When to add a new predicate vs extend an existing one:

- New predicate: the concept has a distinct identity, distinct owner, and is not covered by any existing section.
- Extend existing: the new fact qualifies, constrains, or amends an already-named Module. Add it as a sub-entry or amendment paragraph.

### Contributor requirements

- Read `CONTEXT.md` in full before naming anything (modules, interfaces, seams, tests, PRs).
- Use `CONTEXT.md` vocabulary consistently in code comments, tests, issue/PR text, and docs.
- Do not invent synonyms. If you need a concept that is not in the glossary, note it explicitly in the issue or PR rather than using ad-hoc language.
- Do not rewrite `CONTEXT.md` as part of drive-by cleanup; propose focused updates tied to the approved issue scope.
- `CONTEXT.md` is maintainer-owned. Contributors can propose additions via issue discussion, but final wording is the maintainer's call.

### Example (correct)

A PR that adds a new query adapter should use the term **Native Dispatch Adapter Module** (from `CONTEXT.md`), not "native adapter," "query native handler," or any other variant.

---

## ADRs

### What they are

`docs/adr/` contains Architecture Decision Records. Each ADR is a concise record of one accepted decision: the problem, the decision, and the consequences. Accepted ADRs are the current standard.

Currently accepted ADRs:

| File | Decision |
|------|----------|
| `0001-dispatch-policy-module.md` | Dispatch Policy Module as the single seam for query execution outcomes |
| `0002-command-contract-validation-module.md` | Command Contract Validation Module / command contract centralization |
| `0003-model-catalog-module.md` | Model Catalog Module as the single source of truth for agent profiles and runtime tier defaults |
| `0004-worktree-workstream-seam-module.md` | Planning Workspace Module as single seam for worktree and workstream state |
| `0005-sdk-architecture-seam-map.md` | SDK Architecture seam map for query/runtime surfaces |
| `0006-planning-path-projection-module.md` | Planning Path Projection Module for SDK query handlers |
| `0007-sdk-package-seam-module.md` | SDK Package Seam Module owns SDK-to-get-shit-done-cc compatibility |

### When an ADR is required

An ADR is required when a decision:

- Introduces or removes a Module seam that other code will depend on.
- Changes the policy contract of an existing accepted ADR.
- Establishes a new architectural invariant (naming convention, test contract, CI enforcement).

An ADR is optional (a comment in the relevant issue or PR is sufficient) when:

- The change is a bugfix that lands squarely within an existing accepted decision.
- The change is a docs or test improvement with no architectural surface.

### Naming conventions

**New ADRs and PRDs use issue#-prefix slug naming. This is a contributor requirement, not a suggestion.**

```text
docs/adr/<issue#>-<kebab-slug>.md    (new ADRs)
docs/prd/<issue#>-<kebab-slug>.md    (new PRDs)
```

Example: `docs/adr/3485-adr-prd-naming-convention.md`.

**Why:** GitHub issue numbers are server-assigned and atomic — the reservation mechanism already exists because the issue-first rule requires it. Promoting the issue# to the artifact ID eliminates the entire collision class that the `NNNN-*` local-compute scheme created (see the `0010-*` × 2 and `0011-*` × 3 duplicates on disk).

**Migration policy:** Legacy ADRs `0001-*` through `0011-*` keep their numbers as immutable historical record. The new convention applies to all ADRs and PRDs created on or after the merge of the implementing PR (#3485). Do not renumber legacy files.

For the end-to-end workflow — opening the issue, waiting for approval, creating the file, and submitting the PR — see **[CONTRIBUTING.md — "Proposing an ADR or PRD"](../CONTRIBUTING.md#proposing-an-adr-or-prd)**.

The legacy four-digit scheme (`0003-model-catalog-module.md`) applies only to pre-existing files.

### Required sections

Every ADR must open with:

```md
# <Title>

- **Status:** Accepted | Proposed | Deprecated
- **Date:** YYYY-MM-DD
```

Body: one-paragraph decision summary, then `## Decision` (specifics), then `## Consequences` (behavioral changes downstream callers can rely on).

Amendments are appended as `## Amendment (YYYY-MM-DD): <topic>` sections — the original body is never rewritten.

### Status block format

```md
- **Status:** Accepted
- **Date:** 2026-05-09
```

Status values: `Proposed` (under discussion), `Accepted` (current standard), `Deprecated` (superseded — include a forward reference to the replacement).

### Cross-reference style

Reference sibling ADRs by filename, not by title prose: `see \`0001-dispatch-policy-module.md\``. This survives title edits.

### ADR README index

`docs/adr/README.md` maintains the canonical index table and the naming convention documentation. The table in this document (above) covers accepted ADRs for contributor reference. If an ADR is added, update both tables in the same PR.

### Governance

- ADR creation and final wording is **maintainer-owned**. Contributors must not open ADR files as part of a contribution PR.
- Contributors can — and should — give input on proposed ADR direction in the linked issue discussion.
- Once an ADR is `Accepted`, reopening the decision must be explicit (a dedicated issue with rationale), not implied by a drive-by PR change.
- If your PR intentionally revisits an accepted ADR decision, call it out explicitly in the issue and the PR body: *"This revisits ADR-0002 because…"*

---

## AI-agent-assisted work

### When AI assistance is appropriate

AI assistance is appropriate for every contribution type. The bar for correctness and review quality does not change because the code was AI-assisted.

### Pre-work requirements

Before any AI agent writes a single line of code or docs, it must read:

1. `CONTEXT.md` in full.
2. The ADRs relevant to the area being changed (check `docs/adr/`).
3. The approved issue scope.

If you are dispatching an AI agent, include these reads in the agent's prompt explicitly. An agent that invents synonyms for `CONTEXT.md` vocabulary or contradicts an accepted ADR without flagging it has failed the pre-work requirement.

**In the PR body**, state which ADR or standards section was followed. If using an AI assistant, this statement is your responsibility as the author — not the agent's.

### Worktree isolation

Agent-written code must use an isolated worktree to prevent branch pollution. The standard pattern:

```bash
git worktree add ../my-feature-worktree fix/NNNN-short-description
```

Never commit agent output directly to `main` or to an already-open feature branch without review.

### Model selection

**Sonnet for most tasks** — implementation, test writing, docs, triage. Use the current Sonnet model unless the task requires deep reasoning over a large context.

**Opus for architecture-level tasks** — ADR authorship (maintainer only), cross-cutting refactors, adversarial review of complex PRs. Using a more capable model when a capable model suffices wastes context and delays the cycle.

General-purpose vs specialist agents: prefer the specialist agent for the domain (e.g. a TypeScript-aware agent for SDK surface changes, a docs-aware agent for contributor docs) over a general-purpose agent. Specialist agents load less irrelevant context.

### TDD discipline

For any Behavior-Adding Task (see `CONTEXT.md`):

1. **RED** — commit a failing test that names the expected behavior before writing the implementation.
2. **GREEN** — write the minimum implementation that makes the test pass.
3. **REFACTOR** — polish without changing behavior; tests must still pass.

Commit each phase separately. A PR that has no failing-test commit for a new behavior will be asked to add one before merge.

### Adversarial review requirement

Before opening a PR:

- Read each changed section as if you are a hostile reviewer. Does it stand alone? Does it cite existing artefacts accurately? Is anything aspirational that is not actually current practice?
- Mark aspirational items as `[proposed]` in the text if they describe future intent rather than current behavior.
- Check that every cross-reference (file path, ADR number, CONTEXT.md term) resolves to something that actually exists on disk.

### CR-loop discipline

After a reviewer thread is addressed:

- Fix the code or docs in a new commit (never amend a pushed commit).
- Resolve the thread via GraphQL mutation — do not rely on auto-resolve and do not post a reply comment:

```bash
gh api graphql -f query='mutation { resolveReviewThread(input:{threadId:"PRRT_..."}) { thread { isResolved } } }'
```

Address every reviewer finding claim-by-claim. Do not dismiss a thread because one sub-claim is a false positive — read all sub-claims before deciding.

### Standards followed — block (proposed)

The maintainer is evaluating whether to require a `## Standards followed` block in every issue and PR body. Current proposal:

- **Enhancements and features**: required. List the ADR(s) and CONTEXT.md section(s) consulted.
- **Bug fixes**: lighter-weight. A one-line note suffices: *"Follows ADR-0002 command contract."*

This is marked `[proposed]` — it is not yet a merge gate. Feedback on workflow impact is welcome in issue #3232.
