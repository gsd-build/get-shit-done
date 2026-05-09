# Context

## Domain terms

### Dispatch Policy Module
Module owning dispatch error mapping, fallback policy, timeout classification, and CLI exit mapping contract.

Canonical error kind set:
- `unknown_command`
- `native_failure`
- `native_timeout`
- `fallback_failure`
- `validation_error`
- `internal_error`

### Command Definition Module
Canonical command metadata Interface powering alias, catalog, and semantics generation.

### Query Runtime Context Module
Module owning query-time context resolution for `projectDir` and `ws`, including precedence and validation policy used by query adapters.

### Native Dispatch Adapter Module
Adapter Module that satisfies native query dispatch at the Dispatch Policy seam, so policy modules consume a focused dispatch Interface instead of closure-wired call sites.

### Query CLI Output Module
Module owning projection from dispatch results/errors to CLI `{ exitCode, stdoutChunks, stderrLines }` output contract.

### Query Execution Policy Module
Module owning query transport routing policy projection (`preferNative`, fallback policy, workstream subprocess forcing) at execution seam.

### Query Subprocess Adapter Module
Adapter Module owning subprocess execution contract for query commands (JSON/raw invocation, `@file:` indirection parsing, timeout/exit error projection).

### Query Command Resolution Module
Canonical command normalization and resolution Interface (`query-command-resolution-strategy`) used by internal query/transport paths after dead-wrapper convergence.

### Command Topology Module
Module owning command resolution, policy projection (`mutation`, `output_mode`), unknown-command diagnosis, and handler Adapter binding at one seam for query dispatch.

### Query Pre-Project Config Policy Module
Module policy that defines query-time behavior when `.planning/config.json` is absent: use built-in defaults for parity-sensitive query Interfaces, and emit parity-aligned empty model ids for pre-project model resolution surfaces.

### Planning Workspace Module
Module owning `.planning` path resolution, active workstream pointer policy (`session-scoped > shared`), pointer self-heal behavior, and planning lock semantics for workstream-aware execution.

### Worktree Root Resolution Adapter Module
Adapter Module owning linked-worktree root mapping and metadata-prune policy (`git worktree prune` non-destructive default) for planning/workstream callers.

### SDK Package Seam Module
Module owning SDK-to-`get-shit-done-cc` compatibility policy: legacy asset discovery, install-layout probing, transition-only error messaging, and thin Adapter access for CJS-era assets that native SDK Modules have not replaced yet.

### Runtime-Global Skills Policy Module
Module owning runtime-aware global skills directory policy for SDK query surfaces. Resolves runtime-global skills bases/skill paths from runtime + env precedence, renders display paths for warnings/manifests, and reports unsupported runtimes with no skills directory.

### MVP Mode
Phase-level planning mode that frames work as a vertical slice (UI → API → DB) of one user-visible capability instead of horizontal layers. Resolved at workflow init via the precedence chain: `--mvp` CLI flag → ROADMAP.md `**Mode:** mvp` field → `workflow.mvp_mode` config → false. All-or-nothing per phase (PRD #2826 Q1). Surfaced as `MVP_MODE=true|false` to the planner, executor, verifier, and discovery surfaces (progress, stats, graphify). Canonical parser: `roadmap.cjs` `**Mode:**` field; canonical resolution chain documented in `workflows/plan-phase.md`. Concept index: `references/mvp-concepts.md`.

### User Story
Phase-goal format under MVP Mode: `As a [role], I want to [capability], so that [outcome].` Required regex shape: `/^As a .+, I want to .+, so that .+\.$/`. Used as the framing input by `gsd-planner` (emits as bolded `## Phase Goal` header in PLAN.md) and as the verification target by `gsd-verifier` (the `[outcome]` clause is the goal-backward verification anchor). Authored interactively by `/gsd-mvp-phase`, validated by SPIDR Splitting when too large.

### Walking Skeleton
Phase 1 deliverable under `--mvp` on a new project: the thinnest end-to-end stack proving every layer (framework, DB, routing, deployment) works together. Emitted as `SKELETON.md` capturing the architectural decisions subsequent vertical slices inherit. Gate fires when `phase_number == "01"` AND `prior_summaries == 0` AND `MVP_MODE=true`. Scope intentionally narrow (PRD #2826 Q2) — does not retrofit existing projects.

### Vertical Slice
Single-feature task that moves one user capability from open-to-close (happy path) end-to-end. Contrast with the horizontal layer (all models, then all APIs, then all UI). The MVP Mode planning unit; SPIDR Splitting axes (Spike, Paths, Interfaces, Data, Rules) are the canonical decomposition tools when a slice is too large for one phase.

### Behavior-Adding Task
Predicate over a PLAN.md task: `tdd="true"` frontmatter AND `<behavior>` block names a user-visible outcome AND `<files>` includes at least one non-`*.md` / non-`*.json` / non-`*.test.*` source file. Pure doc/config/test-only tasks are exempt. The MVP+TDD Gate (in `references/execute-mvp-tdd.md`) only halts execution on this predicate; the gsd-executor agent applies all three checks at runtime. Currently a prose-only specification — no shared utility.

### MVP+TDD Gate
Per-task runtime gate in `/gsd-execute-phase` that, when both `MVP_MODE` and `TDD_MODE` are true, refuses to advance a Behavior-Adding Task until a failing-test commit (`test({phase}-{plan})`) exists for it. The `tdd_review_checkpoint` end-of-phase review escalates from advisory to blocking under the same condition. Documented contract: `references/execute-mvp-tdd.md`. Reserved escape hatch `--force-mvp-gate` is documented but not implemented.

### SPIDR Splitting
Five-axis story decomposition discipline (**S**pike, **P**aths, **I**nterfaces, **D**ata, **R**ules) used by `/gsd-mvp-phase` when a User Story is too large for one phase. Full interactive flow per PRD #2826 Q3 (not a lightweight filter). Reference: `get-shit-done/references/spidr-splitting.md`.

---

## Recurring PR mistakes (distilled from CodeRabbit reviews, 2026-05-05)

### Tests — no source-grep
- **Rule**: never bind `readFileSync` result to a var then call `.includes()` / `.match()` / `.startsWith()` on it. CI runs `scripts/lint-no-source-grep.cjs` and exits 1.
- **Escape**: add `// allow-test-rule: <reason>` anywhere in the file to exempt the whole file. Use when reading product markdown or runtime output (not `.cjs` source).
- **Pattern to reach for instead**: call the exported function, capture stdout/JSON, assert on typed fields.

### Tests — no unescaped RegExp interpolation
- `new RegExp(\`prefix${someVar}\`)` — if `someVar` can contain `.` or other metacharacters (e.g. phase id `5.1`), the pattern is wrong. Always `escapeRegex(someVar)`. The `escapeRegex` utility is in `core.cjs` and already imported in most modules.

### Tests — no dead regex branches in `.includes()`
- `src.includes('foo.*bar')` is always false — `.*` is a regex metacharacter, not a wildcard in `includes`. Either use `new RegExp('foo.*bar').test(src)` or delete the branch.

### Tests — guard top-level `readFileSync` against ENOENT
- Module-level `const src = fs.readFileSync(...)` throws before any `test()` registers, aborting the runner with an unhandled exception instead of a named failure. Wrap in try/catch and rethrow with a helpful message.

### Changesets — `pr:` field must be the PR number, not the issue number
- The `pr:` key in `.changeset/*.md` frontmatter must reference the PR introducing the fix (e.g. `3142`), not the issue it closes (e.g. `3120`). Changelog tooling links to GitHub PRs by this value.

### Shell hooks — never interpolate `$VAR` into single-quoted JS strings
- `node -e "require('$HOOK_DIR/lib/foo.js')"` breaks silently if `$HOOK_DIR` contains a single quote (POSIX-legal). Pass paths via env vars: `GIT_CMD_LIB="$HOOK_DIR/lib/foo.js" node -e "require(process.env.GIT_CMD_LIB)"`.

### Shell guards — `[ -f .git ]` does not detect worktrees from main repo
- In the main repo `.git` is a directory, so `[ -f .git ]` is false and the entire guard is skipped. Use `git rev-parse --git-dir` and match `*.git/worktrees/*` in a `case` statement instead.

### Shell guards — absolute-path containment must use `root/` prefix, not glob
- `[[ "$PATH" != "$ROOT"* ]]` matches sibling prefixes (`/repo-extra` passes when `ROOT=/repo`). Use `[[ "$P" != "$ROOT" && "$P" != "$ROOT/"* ]]`. Also: check `[ -z "$ROOT" ]` and exit 1 before the containment test. Warn → fail-closed for security-relevant path checks.

### Workstream migration names — enforce one canonical slug contract
- **Invariant**: every directory under `.planning/workstreams/*` must be addressable by `workstream status/set/complete`, so creation and migration must share the same name contract.
- **Failure class**: accepting raw `--migrate-name` values created directories that later commands reject (e.g. `Bad Name` directory exists but CLI rejects it as invalid).
- **Rule**: normalize `--migrate-name` through the same slug transform as `workstream create` (`[a-z0-9-]`), and fail fast if normalization yields empty.
- **TDD sentinel**: keep regression asserting `workstream create ... --migrate-name 'Bad Name'` migrates to `bad-name` and does not leave `Bad Name` on disk.

### Docs — keep internal reference counts consistent
- When a heading says `(N shipped)` and a footnote says `N-1 top-level references`, update the footnote. CodeRabbit catches this every time.

---

## Workflow learnings (distilled from triage + PR cycle, 2026-05-05)

### Skill consolidation gap class — missing workflow files
- When a command absorbs a micro-skill as a flag (e.g. `capture --backlog`), the old command's process steps must be ported to a `get-shit-done/workflows/<name>.md` file. The routing wrapper in `commands/gsd/*.md` declares an `execution_context` `@`-reference to that workflow — if the file doesn't exist the agent loads nothing and has no steps to follow.
- **Detection**: `tests/bug-3135-capture-backlog-workflow.test.cjs` adds a broad regression — every `execution_context` `@`-reference in any `commands/gsd/*.md` must resolve to an existing file on disk. This test will catch all future gaps of this class immediately.
- **Prior art**: `reapply-patches.md` was the first gap found and fixed in PR #2824 itself. `add-backlog.md` was missed in the same PR and caught later in #3135. Run the regression test after every consolidation PR.

### CodeRabbit thread resolution — stale threads after allow-test-rule fixes
- After adding `// allow-test-rule:` to silence lint, CodeRabbit's existing inline threads remain open even though the acknowledged fix is in place. Resolve them via `resolveReviewThread` GraphQL mutation before merging — open threads block clean merge history and mislead future reviewers.
- Pattern: `gh api graphql -f query='mutation { resolveReviewThread(input:{threadId:"PRRT_..."}) { thread { isResolved } } }'`

### PR discipline — split unrelated changes into separate PRs
- A bug fix and a docs rewrite committed to the same branch produce a noisy diff and a PR that reviewers can't cleanly approve. Cherry-pick doc changes to a dedicated branch (`docs/`) immediately, then force-push the original branch to remove the commit. One concern per PR.

### INVENTORY.md must be updated alongside every workflow file addition/removal
- `docs/INVENTORY.md` tracks the shipped workflow count (`## Workflows (N shipped)`) and has one row per file. Adding or removing a workflow without updating INVENTORY produces an internally inconsistent doc.
- Also update `docs/INVENTORY-MANIFEST.json` — it is the machine-readable manifest and must stay in sync with the filesystem.
- When a flag absorbs a micro-skill, the old skill's `Invoked by` attribution in INVENTORY must move to the new parent (e.g. `add-todo.md` incorrectly claimed `/gsd-capture --backlog` until #3135 corrected it).

### README — keep root README as storyline only; all detail lives in docs/
- Root `README.md` should be ≤300 lines: hero, author note, 6-step loop, install, core command table, why-it-works bullets, config key dials, docs index, minimal troubleshooting.
- Every removed detail section needs a link to the canonical doc that covers it. All doc links must resolve before committing.
- Markdownlint rules to watch: MD001 (heading level skip — don't use `###` directly inside admonitions; use bold instead), MD040 (fenced code blocks must declare a language identifier).

### Issue triage — always check for existing work before filing as new
- Before writing an agent brief for a confirmed bug, check: (1) local branches (`git branch -a | grep <issue>`), (2) untracked/modified files on that branch, (3) stash, (4) open PRs with matching head branch. A crash may have left work 90% done — recover and commit rather than re-implementing.

### SDK-only verbs — golden-policy exemption required
- Any `gsd-sdk query` verb implemented only in the SDK native registry (no `gsd-tools.cjs` mirror) must be added to `NO_CJS_SUBPROCESS_REASON` in `sdk/src/golden/golden-policy.ts`. Without this entry the golden-policy test fails, treating the verb as a missing implementation rather than an intentional SDK-only path.

---

## Recurring findings from ADR-0002 PR review (2026-05-05)

### allowed-tools must include every tool the workflow uses
When a command delegates to a workflow via `execution_context`, the command's `allowed-tools` must cover every tool the workflow calls — including `Write` for file creation. The thin wrapper pattern makes this easy to miss: the process steps live in the workflow, but the tool grant lives in the command frontmatter. Missing a tool silently fails at runtime.

### User-supplied slug/path args always need sanitization before file path construction
Any workflow step that takes user input (subcommand argument, `$ARGUMENTS`, or parsed remainder) and constructs a `.planning/…/{SLUG}.md` path must sanitize first: strip non-`[a-z0-9-]` chars, reject `..`/`/`/`\`, enforce max length. Document the sanitization inline at the step, not just in `<security_notes>`. Steps that say "(already sanitized)" must trace back to an explicit sanitization guard — not just a preceding describe block.

### RESUME/fallback modes bypass sanitization guards written for primary modes
CLOSE and STATUS modes that document "(already sanitized)" do not automatically cover RESUME or default modes. Each mode that constructs a file path from user input needs its own guard — don't assume sibling modes share state.

### Shared helpers prevent lint/test disagreement
When a lint script and a test suite both implement the same constant (`CANONICAL_TOOLS`) or parser (`parseFrontmatter`, `executionContextRefs`), they will silently diverge. Extract to a `scripts/*-helpers.cjs` module required by both. A tool added to the lint's allowlist but not the test's (or vice versa) causes one layer to pass while the other fails.

### readFileSync outside test() crashes the runner before any test registers
Module-level or suite-registration-time `readFileSync` throws as an unhandled exception if the file is absent, aborting the runner with no test output. Move reads inside `test()` callbacks so failures surface as named test failures.

### Global regex with `g` flag carries `lastIndex` state between calls
A `const RE = /pattern/g` shared across functions retains `lastIndex` after `.test()` or `.exec()`. Use a non-global pattern for boolean checks (`/pattern/.test(s)`) and create a new `RegExp(pattern, 'g')` per iteration when you need `exec()` loops. Forgetting `lastIndex = 0` resets causes intermittent false negatives.

### ADR files need Status + Date headers
Every `docs/adr/NNNN-*.md` file must open with `- **Status:** Accepted` (or Proposed/Deprecated) and `- **Date:** YYYY-MM-DD` immediately after the title. Without them the ADR is undatable and untriageable when the list grows.

### Step names in workflow XML must use hyphens, not underscores
All workflow file names use hyphens; `<step name="...">` attributes inside those files must match: `extract-learnings` not `extract_learnings`. Tests asserting `content.includes('<step name=')` should tighten to the exact hyphenated name so renames are caught.

### INVENTORY-MANIFEST.json has two workflow lists — only families.workflows is canonical
`docs/INVENTORY-MANIFEST.json` has `families.workflows` (canonical, read by tooling) and a stale top-level `workflows` key (introduced by a node update script that wrote to the wrong key). Always update `families.workflows`. Delete any top-level `workflows` key if it appears.

### "Follow the X workflow" prose fragments are non-standard — use "Execute end-to-end."
After stripping prose @-refs, some command `<process>` blocks retained bolded "**Follow the X workflow**" fragments. ADR-0002 standard is `Execute end-to-end.` for single-workflow commands. Routing commands with flag dispatch use `execute the X workflow end-to-end.` in routing bullets (no bold, no redundant path).

---

## Recurring CodeRabbit review patterns (2026-05-05, PRs #3152/#3154/#3155)

### Changeset metadata drift (`pr:` points at issue instead of PR)
- In `.changeset/*.md`, reviewers repeatedly flag `pr:` values that accidentally reference issue ids.
- **Rule**: `pr:` must equal the GitHub PR number carrying the change.
- **Pre-flight check**: before push, verify each new changeset file against current branch PR number.

### Test diagnostics quality for command-output parsing
- Even when behavior is correct, CR requests clearer failure surfaces before `.map()` on parsed output.
- **Rule**: after `JSON.parse`, assert output object shape (e.g., `Array.isArray(output.phases)`) with raw-output-prefix diagnostics.
- This prevents opaque `TypeError` failures and shortens triage loops when CLI output shape changes.

### Merge gate discipline: CodeRabbit pass is necessary but not sufficient
- CI/checks can be green while unresolved review threads still block clean merge policy.
- **Rule**: always gate on all three together: required checks green, CodeRabbit pass, unresolved thread count = 0.
- Keep using GraphQL `reviewThreads` as authoritative unresolved state, not summary comments/check badge alone.

---

## SDK Runtime Bridge review synthesis (PR #3158, 2026-05-05)

### What we fixed
- Deepened one **SDK Runtime Bridge Module** seam (`sdk/src/query-runtime-bridge.ts`) for dispatch routing and observability.
- Replaced orphan event typing with a canonical union (`RuntimeBridgeEvent`).
- Made bridge observability non-intrusive: `onDispatchEvent` now runs behind a safe emitter so callback failures cannot alter dispatch outcomes.
- Corrected strict-mode event semantics: strict native-adapter rejection now reports `dispatchMode: 'native'` (no fake subprocess attempt).
- Preserved execution policy defaults by passing `allowFallbackToSubprocess` through as `undefined` when unset (no forced override in `GSDTools`).
- Fixed transport decision ordering: fallback-disabled guard now throws before emitting subprocess decision events.
- Added explicit invariant in `subprocessReason` for impossible states (fail loud on contract drift).
- Updated user-facing docs (`README.md`, `docs/CLI-TOOLS.md`, `docs/ARCHITECTURE.md`) and ADR narrative consistency.

### What we should not do again
- Do not let observability callbacks sit on the critical path without isolation.
- Do not emit structured events that claim a transport mode that never happened.
- Do not force option defaults at call sites when policy Modules already define defaults.
- Do not keep duplicate/inert exported types; expose one canonical union Interface.
- Do not emit decision events before guard checks that may reject the path.
- Do not leave architectural docs with ambiguous seam ownership between CLI and SDK paths.

---

## AI Ops Memory (2026-05-09, machine-oriented)

`RULESET.CONTRIB.GATE.ORDER=issue-first -> approval-label -> code -> PR-link -> changeset/no-changelog`
`RULESET.CONTRIB.CLASSIFY.fix=requires confirmed/confirmed-bug before implementation`
`RULESET.CONTRIB.CLASSIFY.enhancement=requires approved-enhancement before implementation`
`RULESET.CONTRIB.CLASSIFY.feature=requires approved-feature before implementation`

`CI.GATE.issue-link-required=hard-fail if PR body lacks closes/fixes/resolves #<issue>`
`CI.GATE.changeset-lint=hard-fail for user-facing code diffs unless .changeset/* or PR has no-changelog label`
`CI.GATE.repair-sequence(PR)=create issue -> apply approval label -> edit PR body w/ closing keyword -> apply no-changelog if appropriate -> re-run checks`

`PR.3267.POSTMORTEM.root-cause=[missing issue link, missing changeset/no-changelog]`
`PR.3267.POSTMORTEM.recovery=[issue#3270 created, label approved-enhancement applied, PR reopened, body includes "Closes #3270", label no-changelog applied]`

`WORKTREE.SEAM.current=Worktree Safety Policy Module`
`WORKTREE.SEAM.files=[get-shit-done/bin/lib/worktree-safety.cjs, get-shit-done/bin/lib/core.cjs]`
`WORKTREE.SEAM.interface=[resolveWorktreeContext, parseWorktreePorcelain, planWorktreePrune, executeWorktreePrunePlan]`
`WORKTREE.SEAM.default-prune-policy=metadata_prune_only (non-destructive)`
`WORKTREE.SEAM.decision-1=retain non-destructive default; destructive path only as explicit future opt-in scaffold`

`WORKSTREAM.INVARIANT.migrate-name=must normalize through canonical slug policy`
`WORKSTREAM.INVARIANT.slug-contract=all .planning/workstreams/<name> must be addressable by set/get/status/complete`
`WORKSTREAM.REGRESSION.test-anchor=tests/workstream.test.cjs::normalizes --migrate-name to a valid workstream slug`

`ARCH.SKILL.improve-codebase.next-candidates=[Workstream Name Policy Module, Workstream Progress Projection Module, Active Workstream Pointer Store Module]`

`WORKTREE.SEAM.test-policy=cover all decision branches in policy module before changing prune behavior`
`WORKTREE.SEAM.test-anchors=[resolveWorktreeContext:has_local_planning|linked_worktree|not_git_repo|main_worktree, planWorktreePrune:git_list_failed|worktrees_present|no_worktrees|parser_throw_fallback, executeWorktreePrunePlan:missing_plan|skip_passthrough|unsupported_action|metadata_prune_only]`
`WORKTREE.SEAM.invariant=parser failure must degrade to metadata_prune_only and never escalate to destructive removal`
`WORKTREE.SEAM.execution-rule=prefer node --test tests/worktree-safety-policy.test.cjs for fast seam validation; avoid full npm test loop for seam-only changes`
`WORKTREE.SEAM.inventory-interface=[listLinkedWorktreePaths, inspectWorktreeHealth]`
`WORKTREE.SEAM.caller-rule=verify.cjs must consume inspectWorktreeHealth for W017 classification; no ad-hoc porcelain parsing in callers`
`WORKTREE.SEAM.test-anchor-w017=tests/orphan-worktree-detection.test.cjs + tests/worktree-safety-policy.test.cjs`
`WORKTREE.SEAM.inventory-snapshot=snapshotWorktreeInventory(repoRoot,{staleAfterMs,nowMs}) is canonical linked-worktree health snapshot for callers`
`PLANNING.PATH.PARITY.sdk-project-scope=.planning/<project> (never .planning/projects/<project>); mirror planning-workspace.cjs planningDir()`
`PLANNING.PATH.SEAM.sdk=helpers.planningPaths delegates to workspacePlanningPaths + resolveWorkspaceContext; precedence explicit-ws > env-ws > env-project > root`
`PLANNING.PATH.SEAM.init-handlers=[initExecutePhase, initPlanPhase, initPhaseOp, initMilestoneOp] consume helpers.planningPaths().planning (no direct relPlanningPath join)`
`WORKSTREAM.NAME.POLICY.cjs-module=get-shit-done/bin/lib/workstream-name-policy.cjs owns toWorkstreamSlug + active-name/path-segment validation`
`WORKSTREAM.POINTER.SEAM.sdk-module=sdk/src/query/active-workstream-store.ts owns read/write self-heal for .planning/active-workstream`
`CONFIG.SEAM.loadConfig-context=loadConfig(cwd,{workstream}) replaces env-mutation fallback; no temporary process.env GSD_WORKSTREAM rewrites`

---

## Release Notes Standard (2026-05-09, machine-oriented)

`RELEASE-NOTES.SCOPE=GitHub Releases body for tags vX.Y.Z, vX.Y.Z-rcN; not CHANGELOG.md (changeset workflow owns that)`
`RELEASE-NOTES.DEFAULT-STATE=auto-generated body is "What's Changed" PR list + Full Changelog link; treat as draft, not final`
`RELEASE-NOTES.GATE.hotfix=manual edit required; auto-generated body for vX.Y.{Z>0} is "Full Changelog only" and must be replaced with structured body`
`RELEASE-NOTES.GATE.rc=manual edit recommended; auto-generated PR list is acceptable for early RCs but final RC before vX.Y.0 should match standard`
`RELEASE-NOTES.GATE.minor=auto-generated body acceptable when PR titles are clean; promote to structured body when >20 PRs or contains feature+refactor+fix mix`

`RELEASE-NOTES.STANDARD.taxonomy=Keep-a-Changelog 1.1.0: Added | Changed | Deprecated | Removed | Fixed | Security | Documentation`
`RELEASE-NOTES.STANDARD.heading-level=## for category, ### for subgroup (area), - for bullet`
`RELEASE-NOTES.STANDARD.bullet-shape=**Bold user-visible change** — explanation of what was broken or what's new, leading with symptom not implementation. Trailing (#NNN) PR ref.`
`RELEASE-NOTES.STANDARD.subgroups=phase-planning-state | workstream | query-dispatch-cli | code-review | install | capture | docs | architecture | security`
`RELEASE-NOTES.STANDARD.footer.hotfix=Install/upgrade: \`npx get-shit-done-cc@latest\``
`RELEASE-NOTES.STANDARD.footer.rc=Install for testing: \`npx get-shit-done-cc@next\` (per branch->dist-tag policy)`
`RELEASE-NOTES.STANDARD.footer.canary=Install: \`npx get-shit-done-cc@canary\``
`RELEASE-NOTES.STANDARD.footer.full-changelog=**Full Changelog**: https://github.com/gsd-build/get-shit-done/compare/<prev>...<this>`
`RELEASE-NOTES.STANDARD.intro=optional one-paragraph framing for RC/feature releases; omit for pure-fix hotfixes`

`RELEASE-NOTES.SOURCE.commits=git log <prev-tag>..<this-tag> --pretty=format:'%s%n%n%b' --no-merges`
`RELEASE-NOTES.SOURCE.changesets=.changeset/*.md (frontmatter pr: + body bullets)`
`RELEASE-NOTES.SOURCE.pr-bodies=gh pr view <NNN> --json title,body for fixes lacking a changeset`
`RELEASE-NOTES.SOURCE.precedence=changeset body > commit body > PR body > commit subject (prefer authored content over auto-generated)`

`RELEASE-NOTES.WORKFLOW.edit=gh release edit <tag> --notes-file <path>`
`RELEASE-NOTES.WORKFLOW.view=gh release view <tag> --json body --jq .body`
`RELEASE-NOTES.WORKFLOW.token=must use .envrc GITHUB_TOKEN per project CLAUDE.md; never ambient gh auth`
`RELEASE-NOTES.WORKFLOW.idempotency=gh release edit overwrites body wholesale; safe to re-run after refining`

`RELEASE-NOTES.ANTI-PATTERN=raw "What's Changed" PR list as final body for hotfix or feature release; "Full Changelog only" body for tagged release with >0 user-facing fixes`
`RELEASE-NOTES.ANTI-PATTERN.implementation-first=do not lead bullet with file path or function name; lead with symptom/user-visible behavior`
`RELEASE-NOTES.ANTI-PATTERN.risk-commentary=do not include "may break", "be careful", "test thoroughly" - per global CLAUDE.md no-risk-commentary rule`

`RELEASE-NOTES.EXAMPLE.hotfix=v1.41.1 (https://github.com/gsd-build/get-shit-done/releases/tag/v1.41.1) - 14 fixes grouped by 6 subgroups`
`RELEASE-NOTES.EXAMPLE.rc=v1.42.0-rc1 (https://github.com/gsd-build/get-shit-done/releases/tag/v1.42.0-rc1) - intro + Added/Changed/Fixed/Documentation taxonomy`
`RELEASE-NOTES.EXAMPLE.minor-auto-acceptable=v1.41.0 - kept auto-generated body; many small fixes with clean conventional-commit titles`

`RELEASE-NOTES.TEMPLATE.hotfix=## Fixed\n\n### <subgroup>\n- **<bold change>** — <explanation>. (#<PR>)\n\n---\n\nInstall/upgrade: \`npx get-shit-done-cc@latest\`\n\n**Full Changelog**: <compare-url>`
`RELEASE-NOTES.TEMPLATE.rc=<one-paragraph intro>\n\n## Added\n### <subgroup>\n- **<change>** — <explanation>. (#<PR>)\n\n## Changed\n### Architecture\n- **<refactor>** — <user-visible benefit>. (#<PR>)\n\n## Fixed\n### <subgroup>\n- **<fix>** — <explanation>. (#<PR>)\n\n## Documentation\n- **<docs change>** — <reason>. (#<PR>)\n\n---\n\nThis is a release candidate. Install for testing:\n\`\`\`bash\nnpx get-shit-done-cc@next\n\`\`\`\n\n**Full Changelog**: <compare-url>`

`RELEASE-NOTES.RELEASE-STREAM.dev-branch=canary dist-tag (only); install via @canary`
`RELEASE-NOTES.RELEASE-STREAM.main-branch=next (RCs) + latest (stable); install via @next or @latest`
`RELEASE-NOTES.RELEASE-STREAM.rule=streams do not mix; do not document @canary install in RC notes or @next in canary notes`
