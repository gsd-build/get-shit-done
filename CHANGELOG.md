# Changelog

All notable changes to GSD will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased](https://github.com/gsd-build/get-shit-done/compare/v1.37.1...HEAD)

### Enhancement: richer architecture docs from `/gsd-map-codebase` (#2500)

`/gsd-map-codebase` (arch focus) now produces a `.planning/codebase/ARCHITECTURE.md` with the same richness as the research version created at project creation:

- **ASCII system overview diagram** — component boxes and request-flow arrows, generated from actual codebase analysis
- **Component responsibility table** — Component / Responsibility / File columns for at-a-glance orientation
- **Data flow traces** — Primary request path and secondary flows with numbered steps and code references (`file:line`)
- **Architectural constraints** — Threading model, global state inventory, circular import chains
- **Anti-patterns** — Codebase-specific patterns to avoid, with the correct alternative
- **`<!-- refreshed: {date} -->`** marker at the top so users can see when the doc was last generated

Running `/gsd-map-codebase` or `/gsd-scan --focus arch` after a major refactor now produces an up-to-date architectural reference that includes the visual diagrams previously only available in the (non-refreshable) research version.

### SDK query layer — Phase 3 (what you get)

If you use GSD **as a workflow**—milestones, phases, `.planning/` artifacts, bundled workflows, and `**/gsd:`** commands—Phase 3 is about **behavior matching what the docs and steps promise**, and **a bit less overhead** when the framework advances a phase or bootstraps a new project for you.

- **Your workflow shouldn’t silently drift from the docs** — The actions that touch **STATE**, **ROADMAP**, git commits, config, and init/bootstrap are **continuously compared** to the legacy `gsd-tools.cjs` behavior in automated tests. The point for you: fewer “the workflow said X but the tooling did Y” moments as GSD ships updates (#2302).
- **Snappier phase and new-project flows (typical path)** — When you’re **not** on a workstream override, the frequent “where is this phase?”, “what’s left to run?”, “mark phase complete”, and similar steps **avoid spawning a whole extra Node process every time**. Same outcomes you expect from the workflow; it should just feel **lighter** when things run headless or in tight loops (#2302).
- **You can see what to run next** — Documentation now states clearly **when to use `gsd-sdk query`** and **when a step still needs the legacy script** (only a few tools). The legacy script is **marked deprecated** in source but **not removed**—existing hooks and scripts keep working while you align with current examples (#2302).

### Added

- **`gsd-sdk query check auto-mode`** — Decision-routing audit Tier 2: one JSON blob for `workflow.auto_advance` + `workflow._auto_chain_active` with `active`, `source`, and per-flag fields; workflows use `--pick active` or `--pick auto_chain_active` instead of paired `config-get` calls (#2302).
- **SDK Phase 3 — parity and regression guardrails** — Behind the scenes, exhaustive tests ensure the **workflow-facing query commands** stay aligned with the legacy CLI (including write paths and multi-step init). *Contributors:* policy coverage, read-only JSON parity, mutation sandboxes, `init.*` composition tests; `verifyGoldenPolicyComplete()`, `read-only-golden-rows`, `mutation-subprocess.integration.test.ts` (#2302).

### Changed

- **SDK Phase 3 — runner hot path uses the registry directly** — When you run **phase lifecycle** or **new-project init** through the SDK, the common STATE/roadmap/plan-index/complete/commit/config calls **skip extra subprocess overhead** on the default path (workstreams and test overrides unchanged). *Contributors:* `GSDTools` → `initPhaseOp`, `phasePlanIndex`, `phaseComplete`, `initNewProject`, `configSet`, `commit` (#2302).
- **Docs — `docs/CLI-TOOLS.md`** — New **SDK and programmatic access** section (registry-first guidance, CJS→`gsd-sdk query` examples, `GSDTools`/workstream behavior, `state load` vs registry state handlers, CLI-only commands); **See also** links to `QUERY-HANDLERS.md`, Architecture, and COMMANDS (#2302).
- **Docs — `docs/USER-GUIDE.md`** — Programmatic CLI subsection: corrected CLI-only vs registry commands; anchor link to CLI-TOOLS SDK section; `state load` caveat cross-reference (#2302).
- **CJS deprecation** — `get-shit-done/bin/gsd-tools.cjs` documents `@deprecated` in favor of `gsd-sdk query` and `@gsd-build/sdk` (#2302).

### Fixed

- **End-of-phase routing suggestions now use `/gsd-<cmd>` (not the retired `/gsd:<cmd>`)** — All user-visible command suggestions in workflows (`execute-phase.md`, `transition.md`), tool output (`profile-output.cjs`, `init.cjs`), references, and templates have been updated from `/gsd:<cmd>` to `/gsd-<cmd>`, matching the Claude Code skill directory name and the user-typed slash-command format. Internal `Skill(skill="gsd:<cmd>")` calls (no leading slash) are preserved unchanged — those resolve by frontmatter `name:` not directory name. The namespace test (`bug-2543-gsd-slash-namespace.test.cjs`) has been updated to enforce the current invariant. Closes #2697.

- **`gsd-sdk query` now resolves parent `.planning/` root in multi-repo (`sub_repos`) workspaces** — when invoked from inside a `sub_repos`-listed child repo (e.g. `workspace/app/`), the SDK now walks up to the parent workspace that owns `.planning/`, matching the legacy `gsd-tools.cjs` `findProjectRoot` behavior. Previously `gsd-sdk query init.new-milestone` reported `project_exists: false` from the sub-repo, while `gsd-tools.cjs` resolved the parent root correctly. Resolution happens once in `cli.ts` before dispatch; if `projectDir` already owns `.planning/` (including explicit `--project-dir`), the walk is a no-op. Ported as `findProjectRoot` in `sdk/src/query/helpers.ts` with the same detection order (own `.planning/` wins, then parent `sub_repos` match, then legacy `multiRepo: true`, then `.git` heuristic), capped at 10 parent levels and never crossing `$HOME`. Closes #2623.
- **Shell hooks falsely flagged as stale on every session** — `gsd-phase-boundary.sh`, `gsd-session-state.sh`, and `gsd-validate-commit.sh` now ship with a `# gsd-hook-version: {{GSD_VERSION}}` header; the installer substitutes `{{GSD_VERSION}}` in `.sh` hooks the same way it does for `.js` hooks; and the stale-hook detector in `gsd-check-update.js` now matches bash `#` comment syntax in addition to JS `//` syntax. All three changes are required together — neither the regex fix alone nor the install fix alone is sufficient to resolve the false positive (#2136, #2206, #2209, #2210, #2212)

## [1.38.2] - 2026-04-19

### Fixed
- **SDK decoupled from build-from-source install** — replaces the fragile `tsc` + `npm install -g ./sdk` dance on user machines with a prebuilt `sdk/dist/` shipped inside the parent `get-shit-done-cc` tarball. The `gsd-sdk` CLI is now a `bin/gsd-sdk.js` shim in the parent package that resolves `sdk/dist/cli.js` and invokes it via `node`, so npm chmods the bin entry from the tarball (not from a secondary local install) and PATH/exec-bit issues cannot occur. Repurposes `installSdkIfNeeded()` in `bin/install.js` to only verify `sdk/dist/cli.js` exists and fix its execute bit (non-fatal); deletes `resolveGsdSdk()`, `detectShellRc()`, `emitSdkFatal()` and the source-build/global-install logic (162 lines removed). `release.yml` now runs `npm run build:sdk` before publish in both rc and finalize jobs, so every published tarball contains fresh SDK dist. `sdk/package.json` `prepublishOnly` is the final safety net (`rm -rf dist && tsc && chmod +x dist/cli.js`). `install-smoke.yml` adds an `smoke-unpacked` variant that installs from the unpacked dir with the exec bit stripped, so this class of regression cannot ship again. Closes #2441 and #2453.
- **`--sdk` flag semantics changed** — previously forced a rebuild of the SDK from source; now verifies the bundled `sdk/dist/` is resolvable. Users who were invoking `get-shit-done-cc --sdk` as a "force rebuild" no longer need it — the SDK ships prebuilt.

### Added
- **`/gsd-ingest-docs` command** — Scan a repo containing mixed ADRs, PRDs, SPECs, and DOCs and bootstrap or merge the full `.planning/` setup from them in a single pass. Parallel classification (`gsd-doc-classifier`), synthesis with precedence rules and cycle detection (`gsd-doc-synthesizer`), three-bucket conflicts report (`INGEST-CONFLICTS.md`: auto-resolved, competing-variants, unresolved-blockers), and hard-block on LOCKED-vs-LOCKED ADR contradictions in both new and merge modes. Supports directory-convention discovery and `--manifest <file>` YAML override with per-doc precedence. v1 caps at 50 docs per invocation; `--resolve interactive` is reserved. Extracts shared conflict-detection contract into `references/doc-conflict-engine.md` which `/gsd-import` now also consumes (#2387)
- **`/gsd-plan-review-convergence` command** — Cross-AI plan convergence loop that automates `plan-phase → review → replan → re-review` cycles. Spawns isolated agents for `gsd-plan-phase` and `gsd-review`; orchestrator only does loop control, HIGH concern counting, stall detection, and escalation. Supports `--codex`, `--gemini`, `--claude`, `--opencode`, `--all` reviewers and `--max-cycles N` (default 3). Loop exits when no HIGH concerns remain; stall detection warns when count isn't decreasing; escalation gate asks user to proceed or review manually when max cycles reached (#2306)

### Fixed
- **`gsd-read-injection-scanner` hook now ships to users** — the scanner was added in 1.37.0 (#2201) but was never added to `scripts/build-hooks.js`' `HOOKS_TO_COPY` allowlist, so it never landed in `hooks/dist/` and `install.js` skipped it with "Skipped read injection scanner hook — gsd-read-injection-scanner.js not found at target". Effectively disabled the read-time prompt-injection scanner for every user on 1.37.0/1.37.1. Added to the build allowlist and regression test. Also dropped a redundant non-absolute `.claude/hooks/` path check that was bypassing the installer's runtime-path templating and leaking `.claude/` references into non-Claude installs (#2406)
- **SDK `checkAgentsInstalled` is now runtime-aware** — `sdk/src/query/init.ts::checkAgentsInstalled` only knew where Claude Code put agents (`~/.claude/agents`). Users running GSD on Codex, OpenCode, Gemini, Kilo, Copilot, Antigravity, Cursor, Windsurf, Augment, Trae, Qwen, CodeBuddy, or Cline got `agents_installed: false` even with a complete install, which hard-blocked any workflow that gates subagent spawning on that flag. `sdk/src/query/helpers.ts` now resolves the right directory via three-tier detection (`GSD_RUNTIME` env → `config.runtime` → `claude` fallback) and mirrors `bin/install.js::getGlobalDir()` for all 14 runtimes. `GSD_AGENTS_DIR` still short-circuits the chain. `init-runner.ts` stays Claude-only by design (#2402)
- **`init` query agents-installed check looks at the correct directory** — `checkAgentsInstalled` in `sdk/src/query/init.ts` defaulted to `~/.claude/get-shit-done/agents/`, but the installer writes GSD agents to `~/.claude/agents/`. Every init query therefore reported `agents_installed: false` on clean installs, which made workflows refuse to spawn `gsd-executor` and other parallel subagents. The default now matches `sdk/src/init-runner.ts` and the installer (#2400)
- **Installer now installs `@gsd-build/sdk` automatically** so `gsd-sdk` lands on PATH. Resolves `command not found: gsd-sdk` errors that affected every `/gsd-*` command after a fresh install or `/gsd-update` to 1.36+. Adds `--no-sdk` to opt out and `--sdk` to force reinstall. Implements the `--sdk` flag that was previously documented in README but never wired up (#2385)

## [1.37.1] - 2026-04-17

### Fixed
- UI-phase researcher now loads sketch findings skills, preventing re-asking questions already answered during `/gsd-sketch`

## [1.37.0] - 2026-04-17

### Added
- **`/gsd-spike` and `/gsd-sketch` commands** — First-class GSD commands for rapid feasibility spiking and UI design sketching. Each produces throwaway experiments (spikes) or HTML mockups with multi-variant exploration (sketches), saved to `.planning/spikes/` and `.planning/sketches/` with full GSD integration: banners, checkpoint boxes, `gsd-sdk query` commits, and `--quick` flag to skip intake. Neither requires `/gsd-new-project` — auto-creates `.planning/` subdirs on demand
- **`/gsd-spike-wrap-up` and `/gsd-sketch-wrap-up` commands** — Package spike/sketch findings into project-local skills at `./.claude/skills/` with a planning summary at `.planning/`. Curates each spike/sketch one-at-a-time, groups by feature/design area, and adds auto-load routing to project CLAUDE.md
- **Spike/sketch pipeline integration** — `new-project` detects prior spike/sketch work on init, `discuss-phase` loads findings into prior context, `plan-phase` includes findings in planner `<files_to_read>`, `explore` offers spike/sketch as output routes, `next` surfaces pending spike/sketch work as notices, `pause-work` detects active sketch context for handoff, `do` routes spike/sketch intent to new commands
- **`/gsd-spec-phase` command** — Socratic spec refinement with ambiguity scoring to clarify WHAT a phase delivers before discuss-phase. Produces a SPEC.md with falsifiable requirements locked before implementation decisions begin (#2213)
- **`/gsd-progress --forensic` flag** — Appends a 6-check integrity audit after the standard progress report (#2231)
- **`/gsd-discuss-phase --all` flag** — Skip area selection and discuss all gray areas interactively (#2230)
- **Parallel discuss across independent phases** — Multiple phases without dependencies can be discussed concurrently (#2268)
- **`gsd-read-injection-scanner` hook** — PostToolUse hook that scans for prompt injection attempts in read file contents (#2201)
- **SDK Phase 2 caller migration** — Workflows, agents, and commands now use `gsd-sdk query` instead of raw `gsd-tools.cjs` calls (#2179)
- **Project identity in Next Up blocks** — All Next Up blocks include workspace context for multi-project clarity (#1948)
- **Agent size-budget enforcement** — New `tests/agent-size-budget.test.cjs` enforces tiered line-count limits on every `gsd-*.md` agent (XL=1600, LARGE=1000, DEFAULT=500). Unbounded agent growth is paid in context on every subagent dispatch; the test prevents regressions and requires a deliberate PR rationale to raise a budget (#2361)
- **Shared `references/mandatory-initial-read.md`** — Extracts the `<required_reading>` enforcement block that was duplicated across 5 top agents. Agents now include it via a single `@~/.claude/get-shit-done/references/mandatory-initial-read.md` line, using Claude Code's progressive-disclosure `@file` reference mechanism (#2361)
- **Shared `references/project-skills-discovery.md`** — Extracts the 5-step project skills discovery checklist that was copy-pasted across 5 top agents with slight divergence. Single source of truth with a per-agent "Application" paragraph documenting how planners, executors, researchers, verifiers, and debuggers each apply the rules (#2361)

### Changed
- **`gsd-debugger` philosophy extracted to shared reference** — The 76-line `<philosophy>` block containing evergreen debugging disciplines (user-as-reporter framing, meta-debugging, foundation principles, cognitive-bias table, systematic investigation, when-to-restart protocol) is now in `get-shit-done/references/debugger-philosophy.md` and pulled into the agent via a single `@file` include. Same content, lighter per-dispatch context footprint (#2363)
- **`gsd-planner`, `gsd-executor`, `gsd-debugger`, `gsd-verifier`, `gsd-phase-researcher`** — Migrated to `@file` includes for the mandatory-initial-read and project-skills-discovery boilerplate. Reduces per-dispatch context load without changing behavior (#2361)
- **Consolidated emphasis-marker density in top 4 agent files** — `gsd-planner.md` (23 → 15), `gsd-phase-researcher.md` (14 → 9), `gsd-doc-writer.md` (11 → 6), and `gsd-executor.md` (10 → 7). Removed `CRITICAL:` prefixes from H2/H3 headings and dropped redundant `CRITICAL:` + `MUST` / `ALWAYS:` + `NEVER:` stacking. RFC-2119 `MUST`/`NEVER` verbs inside normative sentences are preserved. Behavior-preserving; no content removed (#2368)

### Fixed
- **Broken `@planner-source-audit.md` relative references in `gsd-planner.md`** — Two locations referenced `@planner-source-audit.md` (resolves relative to working directory, almost always missing) instead of the correct absolute `@~/.claude/get-shit-done/references/planner-source-audit.md`. The planner's source audit discipline was silently unenforced (#2361)
- **Shell hooks falsely flagged as stale** — `.sh` hooks now ship with version headers; installer stamps them; stale-hook detector matches bash comment syntax (#2136)
- **Worktree cleanup** — Orphaned worktrees pruned in code, not prose; pre-merge deletion guard in quick.md (#2367, #2275)
- **`/gsd-quick` crashes** — gsd-sdk pre-flight check with install hint (#2334); rescue uncommitted SUMMARY.md before worktree removal (#2296)
- **Pattern mapper redundant reads** — Early-stop rule prevents re-reading files (#2312)
- **Context meter scaling** — Respects `CLAUDE_CODE_AUTO_COMPACT_WINDOW` for accurate context bar (#2219)
- **Codex install paths** — Replace all `~/.claude/` paths in Codex `.toml` files (#2320)
- **Graphify edge fallback** — Falls back to `graph.links` when `graph.edges` is absent (#2323)
- **New-project saved defaults** — Display saved defaults before prompting to use them (#2333)
- **UAT parser** — Accept bracketed result values and fix decimal phase renumber padding (#2283)
- **Stats duplicate rows** — Normalize phase numbers in Map to prevent duplicates (#2220)
- **Review prompt shell expansion** — Pipe prompts via stdin (#2222)
- **Intel scope resolution** — Detect .kilo runtime layout (#2351)
- **Read-guard CLAUDECODE env** — Check env var in skip condition (#2344)
- **Add-backlog directory ordering** — Write ROADMAP entry before directory creation (#2286)
- **Settings workstream routing** — Route reads/writes through workstream-aware config path (#2285)
- **Quick normalize flags** — `--discuss --research --validate` combo normalizes to FULL_MODE (#2274)
- **Windows path normalization** — Normalize in update scope detection (#2278)
- **Codex/OpenCode model overrides** — Embed model_overrides in agent files (#2279)
- **Installer custom files** — Restore detect-custom-files and backup_custom_files (#1997)
- **Agent re-read loops** — Add no-re-read critical rules to ui-checker and planner (#2346)

## [1.36.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.36.0) - 2026-04-14

### SDK query layer — Phases 1 & 2 (what you get)

Day to day, GSD still revolves around **your planning tree** (ROADMAP, STATE, phase folders, config) and **following the workflow** (discuss → plan → execute → verify, milestone closes, etc.). Phases 1 and 2 introduce `**gsd-sdk query`** so those “plumbing” steps have a **supported, first-class CLI**—and so **what workflows and `/gsd:` docs tell you to paste** is closer to what actually runs.

- **Phase 1 — Unblock faster when a step fails (#2118)** — The same kinds of checks and updates your **workflows, hooks, and agents** rely on—reading phase context, roadmap, STATE, init payloads, config, validation—can go through `**gsd-sdk query`**. When something is wrong (bad path, missing file, invalid args), you get **errors you can act on**, not an opaque script dump—so a stuck phase or a bad copy-paste is easier to fix, and **your own** terminal or CI glue beside GSD is easier to keep stable.
- **Phase 2 — Trust the examples in workflows (#2122, #2008)** — The `**gsd-sdk query`** CLI **only runs commands that exist**—no accidental fallback to something else. **Workflow and agent examples** were updated to match. A few **special-case tools** (e.g. **graphify**, **from-gsd2**) still call the legacy binary until they’re brought onto the same path; `**docs/CLI-TOOLS.md`** and `**sdk/src/query/QUERY-HANDLERS.md**` list what’s in scope. Hardening (commits, locks, paths, argument parsing) mostly shows up as **fewer odd failures mid-milestone** when STATE, roadmap, and git steps run.

Technical implementation details for Phase 2 appear in the **Changed** section below.

### Added

- `**/gsd-graphify` integration** — Knowledge graph for planning agents, enabling richer context connections between project artifacts (#2164)
- `**gsd-pattern-mapper` agent** — Codebase pattern analysis agent for identifying recurring patterns and conventions (#1861)
- `**@gsd-build/sdk` — Phase 1 typed query foundation (#2118)** — Introduces `**gsd-sdk query`** and registry-backed handlers; see **SDK query layer — Phases 1 & 2** above for how that fits the workflow.
- **Opt-in TDD pipeline mode** — `tdd_mode` exposed in init JSON with `--tdd` flag override for test-driven development workflows (#2119, #2124)
- **Stale/orphan worktree detection (W017)** — `validate-health` now detects stale and orphan worktrees (#2175)
- **Seed scanning in new-milestone** — Planted seeds are scanned during milestone step 2.5 for automatic surfacing (#2177)
- **Artifact audit gate** — Open artifact auditing for milestone close and phase verify (#2157, #2158, #2160)
- `**/gsd-quick` and `/gsd-thread` subcommands** — Added list/status/resume/close subcommands (#2159)
- **Debug skill dispatch and session manager** — Sub-orchestrator for `/gsd-debug` sessions (#2154)
- **Project skills awareness** — 9 GSD agents now discover and use project-scoped skills (#2152)
- `**/gsd-debug` session management** — TDD gate, reasoning checkpoint, and security hardening (#2146)
- **Context-window-aware prompt thinning** — Automatic prompt size reduction for sub-200K models (#1978)
- **SDK `--ws` flag** — Workstream-aware execution support (#1884)
- `**/gsd-extract-learnings` command** — Phase knowledge capture workflow (#1873)
- **Cross-AI execution hook** — Step 2.5 in execute-phase for external AI integration (#1875)
- **Ship workflow external review hook** — External code review command hook in ship workflow
- **Plan bounce hook** — Optional external refinement step (12.5) in plan-phase workflow
- **Cursor CLI self-detection** — Cursor detection and REVIEWS.md template for `/gsd-review` (#1960)
- **Architectural Responsibility Mapping** — Added to phase-researcher pipeline (#1988, #2103)
- **Configurable `claude_md_path`** — Custom CLAUDE.md path setting (#2010, #2102)
- `**/gsd-skill-manifest` command** — Pre-compute skill discovery for faster session starts (#2101)
- `**--dry-run` mode and resolved blocker pruning** — State management improvements (#1970)
- **State prune command** — Prune unbounded section growth in STATE.md (#1970)
- **Global skills support** — Support `~/.claude/skills/` in `agent_skills` config (#1992)
- **Context exhaustion auto-recording** — Hooks auto-record session state on context exhaustion (#1974)
- **Metrics table pruning** — Auto-prune on phase complete for STATE.md metrics (#2087, #2120)
- **Flow diagram directive for phase researcher** — Data-flow architecture diagrams enforced (#2139, #2147)

### Changed

- **Planner context-cost sizing** — Replaced time-based reasoning with context-cost sizing and multi-source coverage audit (#2091, #2092, #2114)
- `**/gsd-next` prior-phase completeness scan** — Replaced consecutive-call counter with completeness scan (#2097)
- **Inline execution for small plans** — Default to inline execution, skip subagent overhead for small plans (#1979)
- **Prior-phase context optimization** — Limited to 3 most recent phases and includes `Depends on` phases (#1969)
- **Non-technical owner adaptation** — `discuss-phase` adapts gray area language for non-technical owners via USER-PROFILE.md (#2125, #2173)
- **Agent specs standardization** — Standardized `required_reading` patterns across agent specs (#2176)
- **CI upgrades** — GitHub Actions upgraded to Node 22+ runtimes; release pipeline fixes (#2128, #1956)
- **Branch cleanup workflow** — Auto-delete on merge + weekly sweep (#2051)
- **PR #2179 maintainer review (Trek-e)** — Scoped SDK to Phase 2 (#2122): removed `gsd-sdk query` passthrough to `gsd-tools.cjs` and `GSD_TOOLS_PATH` override; argv routing consolidated in `resolveQueryArgv()`. `GSDTools` JSON parsing now reports `@file:` indirection read failures instead of failing opaquely. `execute-plan.md` defers Task Commit Protocol to `agents/gsd-executor.md` (single source of truth). Stale `/gsd:` scan (#1748) skips `.planning/` and root `CLAUDE.md` so local gitignored overlays do not fail CI.
- **SDK query registry (PR #2179 review)** — Register `summary-extract` as an alias of `summary.extract` so workflows/agents match CJS naming. Correct `audit-fix.md` to call `audit-uat` instead of nonexistent `init.audit-uat`.
- `**gsd-tools audit-open`** — Use `core.output()` (was undefined `output()`), and pass the artifact object for `--json` so stdout is JSON (not double-stringified).
- **SDK query layer (PR review hardening)** — `commit-to-subrepo` uses realpath-aware path containment and sanitized commit messages; `state.planned-phase` uses the STATE.md lockfile; `verifyKeyLinks` mitigates ReDoS on frontmatter patterns; frontmatter handlers resolve paths under the real project root; phase directory names reject `..` and separators; `gsd-sdk` restores strict CLI parsing by stripping `--pick` before `parseArgs`; `QueryRegistry.commands()` for enumeration; `todoComplete` uses static error imports.
- `**gsd-sdk query` routing (Phase 2 scope)** — `resolveQueryArgv()` maps argv to registered handlers (longest-prefix match on dotted and spaced command keys; optional single-token dotted split). Unregistered commands are rejected at the CLI; use `node …/gsd-tools.cjs` for CJS-only subcommands. `resolveGsdToolsPath()` probes the SDK-bundled copy, then project and user `~/.claude/get-shit-done/` installs (no `GSD_TOOLS_PATH` override). Broader “CLI parity” passthrough is explicitly out of scope for #2122 and tracked separately for a future approved issue.
- **SDK query follow-up (tests, docs, registry)** — Expanded `QUERY_MUTATION_COMMANDS` for event emission; stale lock cleanup uses PID liveness (`process.kill(pid, 0)`) when a lock file exists; `searchJsonEntries` is depth-bounded (`MAX_JSON_SEARCH_DEPTH`); removed unnecessary `readdirSync`/`Dirent` casts across query handlers; added `sdk/src/query/QUERY-HANDLERS.md` (error vs `{ data.error }`, mutations, locks, intel limits); unit tests for intel, profile, uat, skills, summary, websearch, workstream, registry vs `QUERY_MUTATION_COMMANDS`, and frontmatter extract/splice round-trip.
- **Phase 2 caller migration (#2122)** — Workflows, agents, and commands prefer `gsd-sdk query` for registered handlers; extended migration to additional orchestration call sites (review, plan-phase, execute-plan, ship, extract_learnings, ai-integration-phase, eval-review, next, profile-user, autonomous, thread command) and researcher agents; dual-path and CJS-only exceptions documented in `docs/CLI-TOOLS.md` and `docs/ARCHITECTURE.md`; relaxed `tests/gsd-tools-path-refs.test.cjs` so `commands/gsd/workstreams.md` may document `gsd-sdk query` without `node` + `gsd-tools.cjs`. CJS `gsd-tools.cjs` remains on disk; graphify and other non-registry commands stay on CJS until registered. (#2008)
- **Phase 2 docs and call sites (follow-up)** — `docs/USER-GUIDE.md` now explains `gsd-sdk query` vs legacy CJS and lists CJS-only commands (`state validate`/`sync`, `audit-open`, `graphify`, `from-gsd2`). Updated `commands/gsd` (`debug`, `quick`, `intel`), `agents/gsd-debug-session-manager.md`, and workflows (`milestone-summary`, `forensics`, `next`, `complete-milestone`, `verify-work`, `discuss-phase`, `progress`, `verify-phase`, `add-phase`/`insert-phase`/`remove-phase`, `transition`, `manager`, `quick`) for `gsd-sdk query` or explicit CJS exceptions (`audit-open`).
- **Phase 2 orchestration doc pass (#2122)** — Aligned `commands/gsd` (`execute-phase`, `code-review`, `code-review-fix`, `from-gsd2`, `graphify`) and agents (`gsd-verifier`, `gsd-plan-checker`, `gsd-code-fixer`, `gsd-executor`, `gsd-planner`, researchers, debugger) so examples use `init.*` query names, correct `frontmatter.get` positional field, `state.*` positional args, and `commit` with positional file paths (not `--files`, except `commit-to-subrepo` which keeps `--files`).
- **Phase 2 `commit` example sweep (#2122)** — Normalized `gsd-sdk query commit` usage across `get-shit-done/workflows/**/*.md`, `get-shit-done/references/**/*.md`, and `commands/gsd/**/*.md` so file paths follow the message positionally (SDK `commit` handler); `gsd-sdk query commit-to-subrepo … --files …` unchanged. Updated `get-shit-done/references/git-planning-commit.md` prose; adjusted workflow contract tests (`claude-md`, forensics, milestone-summary, gates taxonomy CRLF-safe `required_reading`, verifier `roadmap.analyze`) for the new examples.

### Fixed

- **Init ignores archived phases** — Archived phases from prior milestones sharing a phase number no longer interfere (#2186)
- **UAT file listing** — Removed `head -5` truncation from verify-work (#2172)
- **Intel status relative time** — Display relative time correctly (#2132)
- **Codex hook install** — Copy hook files to Codex install target (#2153, #2166)
- **Phase add-batch duplicate prevention** — Prevents duplicate phase numbers on parallel invocations (#2165, #2170)
- **Stale hooks warning** — Show contextual warning for dev installs with stale hooks (#2162)
- **Worktree submodule skip** — Skip worktree isolation when `.gitmodules` detected (#2144)
- **Worktree STATE.md backup** — Use `cp` instead of `git-show` (#2143)
- **Bash hooks staleness check** — Add missing bash hooks to `MANAGED_HOOKS` (#2141)
- **Code-review parser fix** — Fix SUMMARY.md parser section-reset for top-level keys (#2142)
- **Backlog phase exclusion** — Exclude 999.x backlog phases from next-phase and all_complete (#2135)
- **Frontmatter regex anchor** — Anchor `extractFrontmatter` regex to file start (#2133)
- **Qwen Code install paths** — Eliminate Claude reference leaks (#2112)
- **Plan bounce default** — Correct `plan_bounce_passes` default from 1 to 2
- **GSD temp directory** — Use dedicated temp subdirectory for GSD temp files (#1975, #2100)
- **Workspace path quoting** — Quote path variables in workspace next-step examples (#2096)
- **Answer validation loop** — Carve out Other+empty exception from retry loop (#2093)
- **Test race condition** — Add `before()` hook to bug-1736 test (#2099)
- **Qwen Code path replacement** — Dedicated path replacement branches and finishInstall labels (#2082)
- **Global skill symlink guard** — Tests and empty-name handling for config (#1992)
- **Context exhaustion hook defects** — Three blocking defects fixed (#1974)
- **State disk scan cache** — Invalidate disk scan cache in writeStateMd (#1967)
- **State frontmatter caching** — Cache buildStateFrontmatter disk scan per process (#1967)
- **Grep anchor and threshold guard** — Correct grep anchor and add threshold=0 guard (#1979)
- **Atomic write coverage** — Extend atomicWriteFileSync to milestone, phase, and frontmatter (#1972)
- **Health check optimization** — Merge four readdirSync passes into one (#1973)
- **SDK query layer hardening** — Realpath-aware path containment, ReDoS mitigation, strict CLI parsing, phase directory sanitization (#2118)
- **Prompt injection scan** — Allowlist plan-phase.md

## [1.35.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.35.0) - 2026-04-10

### Added

- **Cline runtime support** — First-class Cline runtime via rules-based integration. Installs to `~/.cline/` or `./.cline/` as `.clinerules`. No custom slash commands — uses rules. `--cline` flag. (#1605 follow-up)
- **CodeBuddy runtime support** — Skills-based install to `~/.codebuddy/skills/gsd-*/SKILL.md`. `--codebuddy` flag.
- **Qwen Code runtime support** — Skills-based install to `~/.qwen/skills/gsd-*/SKILL.md`, same open standard as Claude Code 2.1.88+. `QWEN_CONFIG_DIR` env var for custom paths. `--qwen` flag.
- `**/gsd-from-gsd2` command** (`gsd:from-gsd2`) — Reverse migration from GSD-2 format (`.gsd/` with Milestone→Slice→Task hierarchy) back to v1 `.planning/` format. Flags: `--dry-run` (preview only), `--force` (overwrite existing `.planning/`), `--path <dir>` (specify GSD-2 root). Produces `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, and sequential phase dirs. Flattens Milestone→Slice hierarchy to sequential phase numbers (M001/S01→phase 01, M001/S02→phase 02, M002/S01→phase 03, etc.).
- `**/gsd-ai-integration-phase` command** (`gsd:ai-integration-phase`) — AI framework selection wizard for integrating AI/LLM capabilities into a project phase. Interactive decision matrix with domain-specific failure modes and eval criteria. Produces `AI-SPEC.md` with framework recommendation, implementation guidance, and evaluation strategy. Runs 3 parallel specialist agents: domain-researcher, framework-selector, ai-researcher, eval-planner.
- `**/gsd-eval-review` command** (`gsd:eval-review`) — Retroactive audit of an implemented AI phase's evaluation coverage. Checks implementation against `AI-SPEC.md` evaluation plan. Scores each eval dimension as COVERED/PARTIAL/MISSING. Produces `EVAL-REVIEW.md` with findings, gaps, and remediation guidance.
- **Review model configuration** — Per-CLI model selection for /gsd-review via `review.models.<cli>` config keys. Falls back to CLI defaults when not set. (#1849)
- **Statusline now surfaces GSD milestone/phase/status** — when no `in_progress` todo is active, `gsd-statusline.js` reads `.planning/STATE.md` (walking up from the workspace dir) and fills the middle slot with `<milestone> · <status> · <phase> (N/total)`. Gracefully degrades when fields are missing; identical to previous behavior when there is no STATE.md or an active todo wins the slot. Uses the YAML frontmatter added for #628.
- **Qwen Code and Cursor CLI peer reviewers** — Added as reviewers in `/gsd-review` with `--qwen` and `--cursor` flags. (#1966)

### Changed

- **Worktree safety — `git clean` prohibition** — `gsd-executor` now prohibits `git clean` in worktree context to prevent deletion of prior wave output. (#2075)
- **Executor deletion verification** — Pre-merge deletion checks added to catch missing artifacts before executor commit. (#2070)
- **Hard reset in worktree branch check** — `--hard` flag in `worktree_branch_check` now correctly resets the file tree, not just HEAD. (#2073)

### Fixed

- **Context7 MCP CLI fallback** — Handles `tools: []` response that previously broke Context7 availability detection. (#1885)
- `**Agent` tool in gsd-autonomous** — Added `Agent` to `allowed-tools` to unblock subagent spawning. (#2043)
- `**intel.enabled` in config-set whitelist** — Config key now accepted by `config-set` without validation error. (#2021)
- `**writeSettings` null guard** — Guards against null `settingsPath` for Cline runtime to prevent crash on install. (#2046)
- **Shell hook absolute paths** — `.sh` hooks now receive absolute quoted paths in `buildHookCommand`, fixing path resolution in non-standard working directories. (#2045)
- `**processAttribution` runtime-aware** — Was hardcoded to `'claude'`; now reads actual runtime from environment.
- `**AskUserQuestion` plain-text fallback** — Non-Claude runtimes now receive plain-text numbered lists instead of broken TUI menus.
- **iOS app scaffold uses XcodeGen** — Prevents SPM execution errors in generated iOS scaffolds. (#2023)
- `**acceptance_criteria` hard gate** — Enforced as a hard gate in executor — plans missing acceptance criteria are rejected before execution begins. (#1958)
- `**normalizePhaseName` preserves letter suffix case** — Phase names with letter suffixes (e.g., `1a`, `2B`) now preserve original case. (#1963)

## [1.34.2](https://github.com/gsd-build/get-shit-done/releases/tag/v1.34.2) - 2026-04-06

### Changed

- **Node.js minimum lowered to 22** — `engines.node` was raised to `>=24.0.0` based on a CI matrix change, but Node 22 is still in Active LTS until October 2026. Restoring Node 22 support eliminates the `EBADENGINE` warning for users on the previous LTS line. CI matrix now tests against both Node 22 and Node 24.

## [1.34.1](https://github.com/gsd-build/get-shit-done/releases/tag/v1.34.1) - 2026-04-06

### Fixed

- **npm publish catchup** — v1.33.0 and v1.34.0 were tagged but never published to npm; this release makes all changes available via `npx get-shit-done-cc@latest`
- Removed npm v1.32.0 stuck notice from README

## [1.34.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.34.0) - 2026-04-06

### Added

- **Gates taxonomy reference** — 4 canonical gate types (pre-flight, revision, escalation, abort) with phase matrix wired into plan-checker and verifier agents (#1781)
- **Post-merge hunk verification** — `reapply-patches` now detects silently dropped hunks after three-way merge (#1775)
- **Execution context profiles** — Three context profiles (`dev`, `research`, `review`) for mode-specific agent output guidance (#1807)

### Fixed

- **Shell hooks missing from npm package** — `hooks/*.sh` files excluded from tarball due to `hooks/dist` allowlist; changed to `hooks` (#1852 #1862)
- **detectConfigDir priority** — `.claude` now searched first so Claude Code users don't see false update warnings when multiple runtimes are installed (#1860)
- **Milestone backlog preservation** — `phases clear` no longer wipes 999.x backlog phases (#1858)

## [1.33.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.33.0) - 2026-04-05

### Added

- **Queryable codebase intelligence system** -- Persistent `.planning/intel/` store with structured JSON files (files, exports, symbols, patterns, dependencies). Query via `gsd-tools intel` subcommands. Incremental updates via `gsd-intel-updater` agent. Opt-in; projects without intel store are unaffected. (#1688)
- **Shared behavioral references** — Add questioning, domain-probes, and UI-brand reference docs wired into workflows (#1658)
- **Chore / Maintenance issue template** — Structured template for internal maintenance tasks (#1689)
- **Typed contribution templates** — Separate Bug, Enhancement, and Feature issue/PR templates with approval gates (#1673)
- **MODEL_ALIAS_MAP regression test** — Ensures model aliases stay current (#1698)

### Changed

- **CONFIG_DEFAULTS constant** — Deduplicate config defaults into single source of truth in core.cjs (#1708)
- **Test standardization** — All tests migrated to `node:assert/strict` and `t.after()` cleanup per CONTRIBUTING.md (#1675)
- **CI matrix** — Drop Windows runner, add static hardcoded-path detection (#1676)

### Fixed

- **Kilo path replacement** — `copyFlattenedCommands` now applies path replacement for Kilo runtime (#1710)
- **Prompt guard injection pattern** — Add missing 'act as' pattern to hook (#1697)
- **Frontmatter inline array parser** — Respect quoted commas in array values (REG-04) (#1695)
- **Cross-platform planning lock** — Replace shell `sleep` with `Atomics.wait` for Windows compatibility (#1693)
- **MODEL_ALIAS_MAP** — Update to current Claude model IDs: opus→claude-opus-4-6, sonnet→claude-sonnet-4-6, haiku→claude-haiku-4-5 (#1691)
- **Skill path replacement** — `copyCommandsAsClaudeSkills` now applies path replacement correctly (#1677)
- **Runtime detection for /gsd-review** — Environment-based detection instead of hardcoded paths (#1463)
- **Marketing text in runtime prompt** — Remove marketing taglines from runtime selection (#1672, #1655)
- **Discord invite link** — Update from vanity URL to permanent invite link (#1648)

### Documentation

- **COMMANDS.md** — Add /gsd-secure-phase and /gsd-docs-update (#1706)
- **AGENTS.md** — Add 3 missing agents, fix stale counts (#1703)
- **ARCHITECTURE.md** — Update component counts and missing entries (#1701)
- **Localized documentation** — Full v1.32.0 audit for all language READMEs

## [1.32.0] - 2026-04-04

### Added

- **Trae runtime support** — Install GSD for Trae IDE via `--trae` flag (#1566)
- **Kilo CLI runtime support** — Full Kilo runtime integration with skill conversion and config management
- **Augment Code runtime support** — Full Augment runtime with skill conversion
- **Cline runtime support** — Install GSD for Cline via `.clinerules` (#1605)
- `**state validate` command** — Detects drift between STATE.md and filesystem reality (#1627)
- `**state sync` command** — Reconstructs STATE.md from actual project state with `--verify` dry-run (#1627)
- `**state planned-phase` command** — Records state transition after plan-phase completes (#1627)
- `**--to N` flag for autonomous mode** — Stop execution after completing a specific phase (#1644)
- `**--power` flag for discuss-phase** — File-based bulk question answering (#1513)
- `**--interactive` flag for autonomous** — Lean context with user input
- `**--diagnose` flag for debug** — Diagnosis-only mode without fix attempts (#1396)
- `**/gsd-analyze-dependencies` command** — Detect phase dependencies (#1607)
- **Anti-pattern severity levels** — Mandatory understanding checks at resume (#1491)
- **Methodology artifact type** — Consumption mechanisms for methodology documents (#1488)
- **Planner reachability check** — Validates plan steps are achievable (#1606)
- **Playwright-MCP automated UI verification** — Optional visual verification in verify-phase (#1604)
- **Pause-work expansion** — Supports non-phase contexts with richer handoffs (#1608)
- **Research gate** — Blocks planning when RESEARCH.md has unresolved open questions (#1618)
- **Context reduction** — Markdown truncation and cache-friendly prompt ordering for SDK (#1615)
- **Verifier milestone scope filtering** — Gaps addressed in later phases marked as deferred, not gaps (#1624)
- **Read-before-edit guard hook** — Advisory PreToolUse hook prevents infinite retry loops in non-Claude runtimes (#1628)
- **Response language config** — `response_language` setting for cross-phase language consistency (#1412)
- **Manual update procedure** — `docs/manual-update.md` for non-npm installs
- **Commit-docs hook** — Guard for `commit_docs` enforcement (#1395)
- **Community hooks opt-in** — Optional hooks for GSD projects
- **OpenCode reviewer** — Added as peer reviewer in `/gsd-review`
- **Multi-project workspace** — `GSD_PROJECT` env var support
- **Manager passthrough flags** — Per-step flag configuration via config (#1410)
- **Adaptive context enrichment** — For 1M-token models
- **Test quality audit step** — Added to verify-phase workflow

### Changed

- **Modular planner decomposition** — `gsd-planner.md` split into reference files to stay under 50K char limit (#1612)
- **Sequential worktree dispatch** — Replaced timing-based stagger with sequential `Task()` + `run_in_background` (#1541)
- **Skill format migration** — All user-facing suggestions updated from `/gsd:xxx` to `/gsd-xxx` (#1579)

### Fixed

- **Phase resolution prefix collision** — `find-phase` now uses exact token matching; `1009` no longer matches `1009A` (#1635)
- **Roadmap backlog phase lookup** — `roadmap get-phase` falls back to full ROADMAP.md for phases outside current milestone (#1634)
- **Performance Metrics in `phase complete`** — Now updates Velocity and By Phase table on phase completion (#1627)
- **Ghost `state update-position` command** — Removed dead reference from execute-phase.md (#1627)
- **Semver comparison for update check** — Proper `isNewer()` comparison replaces `!==`; no longer flags newer-than-npm as update available (#1617)
- **Next Up block ordering** — `/clear` shown before command (#1631)
- **Chain flag preservation** — Preserved across discuss → plan → execute (#1633)
- **Config key validation** — Unrecognized keys in config.json now warn instead of silent drop (#1542)
- **Parallel worktree STATE.md overwrites** — Orchestrator owns STATE.md/ROADMAP.md writes (#1599)
- **Dependent plan wave ordering** — Detects `files_modified` overlap and enforces wave ordering (#1587)
- **Windows session path hash** — Uses `realpathSync.native` (#1593)
- **STATE.md progress counters** — Corrected during plan execution (#1597)
- **Workspace agent path resolution** — Correct in worktree context (#1512)
- **Milestone phase cleanup** — Clears phases directory on new milestone (#1588)
- **Workstreams allowed-tools** — Removed unnecessary Write permission (#1637)
- **Executor/planner MCP tools** — Instructed to use available MCP tools (#1603)
- **Bold plan checkboxes** — Fixed in ROADMAP.md
- **Backlog recommendations** — Fixed BACKLOG phase handling
- **Session ID path traversal** — Validated `planningDir`
- **Copilot executor Task descriptions** — Added required `description` param
- **OpenCode permission string guard** — Fixed string-valued permission config
- **Concurrency safety** — Atomic state writes
- **Health validation** — STATE/ROADMAP cross-validation
- **Workstream session routing** — Isolated per session with fallback

## [1.31.0] - 2026-04-01

### Added

- **Claude Code 2.1.88+ skills migration** — Commands now install as `skills/gsd-*/SKILL.md` instead of deprecated `commands/gsd/`. Auto-cleans legacy directory on install
- `**/gsd:docs-update` command** — Verified documentation generation with doc-writer and doc-verifier agents
- `**--chain` flag for discuss-phase** — Interactive discuss that auto-chains into plan+execute
- `**--only N` flag for autonomous** — Execute a single phase instead of all remaining
- **Schema drift detection** — Prevents false-positive verification when ORM schema files change without migration
- `**/gsd:secure-phase` command** — Security enforcement layer with threat-model-anchored verification
- **Claim provenance tagging** — Researcher marks claims with source evidence
- **Scope reduction detection** — Planner blocked from silently dropping requirements
- `**workflow.use_worktrees` config** — Toggle to disable worktree isolation
- `**project_code` config** — Prefix phase directories with project code
- **Project skills discovery** — CLAUDE.md generation now includes project-specific skills section
- **CodeRabbit integration** — Added to cross-AI review workflow
- **GSD SDK enhancements** — Auto `--init` flag, headless prompts, prompt sanitizer

### Changed

- `**/gsd:quick --full` flag** — Now enables all phases (discussion + research + plan-checking + verification). New `--validate` flag covers previous `--full` behavior (plan-checking + verification only)

### Fixed

- **Gemini CLI agent loading** — Removed `permissionMode` that broke agent frontmatter parsing
- **Phase count display** — Clarified misleading N/T banner in autonomous mode
- **Workstream `set` command** — Now requires name arg, added `--clear` flag
- **Infinite self-discuss loop** — Fixed in auto/headless mode with `max_discuss_passes` config
- **Orphan worktree cleanup** — Post-execution cleanup added
- **JSONC settings.json** — Comments no longer cause data loss
- **Incremental checkpoint saves** — Discuss answers preserved on interrupt
- **Stats accuracy** — Verification required for Complete status, added Executed state
- **Three-way merge for reapply-patches** — Never-skip invariant for backed-up files
- **SDK verify gates advance** — Skip advance when verification finds gaps
- **Manager delegates to Skill pipeline** — Instead of raw Task prompts
- **ROADMAP.md Plans column** — cmdPhaseComplete now updates correctly
- **Decimal phase numbers** — Commit regex captures decimal phases
- **Codex path replacement** — Added .claude path replacement
- **Verifier loads all ROADMAP SCs** — Regardless of PLAN must_haves
- **Verifier human_needed status** — Enforced when human verification items exist
- **Hooks shared cache dir** — Correct stale hooks path
- **Plan file naming** — Convention enforced in gsd-planner agent
- **Copilot path replacement** — Fixed ~/.claude to ~/.github
- **Windsurf trailing slash** — Removed from .windsurf/rules path
- **Slug sanitization** — Added --raw flag, capped length to 60 chars

## [1.30.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.30.0) - 2026-03-26

### Added

- **GSD SDK** — Headless TypeScript SDK (`@gsd-build/sdk`) with `gsd-sdk init` and `gsd-sdk auto` CLI commands for autonomous project execution
- `**--sdk` installer flag** — Optionally install the GSD SDK during setup (interactive prompt or `--sdk` flag)

## [1.29.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.29.0) - 2026-03-25

### Added

- **Windsurf runtime support** — Full installation and command conversion for Windsurf
- **Agent skill injection** — Inject project-specific skills into subagents via `agent_skills` config section
- **UI-phase and UI-review steps** in autonomous workflow
- **Security scanning CI** — Prompt injection, base64, and secret scanning workflows
- **Portuguese (pt-BR) documentation**
- **Korean (ko-KR) documentation**
- **Japanese (ja-JP) documentation**

### Changed

- Repository references updated from `glittercowboy` to `gsd-build`
- Korean translations refined from formal -십시오 to natural -세요 style

### Fixed

- Frontmatter `must_haves` parser handles any YAML indentation width
- `findProjectRoot` returns startDir when it already contains `.planning/`
- Agent workflows include `<available_agent_types>` for named agent spawning
- Begin-phase preserves Status/LastActivity/Progress in Current Position
- Missing GSD agents detected with warning when `subagent_type` falls back to general-purpose
- Codex re-install repairs trapped non-boolean keys under `[features]`
- Invalid `\Z` regex anchor replaced and redundant pattern removed
- Hook field validation prevents silent `settings.json` rejection
- Codex preserves top-level config keys and uses absolute agent paths (≥0.116)
- Windows shell robustness, `project_root` detection, and hook stdin safety
- Brownfield project detection expanded to Android, Kotlin, Gradle, and 15+ ecosystems
- Verify-work checkpoint rendering hardened
- Worktree agents get `permissionMode: acceptEdits`
- Security scan self-detection and Windows test compatibility

## [1.28.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.28.0) - 2026-03-22

### Added

- **Workstream namespacing** — Parallel milestone work via `/gsd:workstreams`
- **Multi-project workspace commands** — Manage multiple GSD projects from a single root
- `**/gsd:forensics` command** — Post-mortem workflow investigation
- `**/gsd:milestone-summary` command** — Post-build onboarding for completed milestones
- `**workflow.skip_discuss` setting** — Bypass discuss-phase in autonomous mode
- `**workflow.discuss_mode` assumptions config** — Control discuss-phase behavior
- **UI-phase recommendation** — Automatically surfaced for UI-heavy phases
- **CLAUDE.md compliance** — Added as plan-checker Dimension 10
- **Data-flow tracing, environment audit, and behavioral spot-checks** in verification
- **Multi-runtime selection** in interactive installer
- **Text mode support** for plan-phase workflow
- **"Follow the Indirection" debugging technique** in gsd-debugger
- `**--reviews` flag** for `gsd:plan-phase`
- **Temp file reaper** — Prevents unbounded /tmp accumulation

### Changed

- Test matrix optimized from 9 containers down to 4
- Copilot skill/agent counts computed dynamically from source dirs
- Wave-specific execution support in execute-phase

### Fixed

- Windows 8.3 short path failures in worktree tests
- Worktree isolation enforced for code-writing agents
- Linked worktrees respect `.planning/` before resolving to main repo
- Path traversal prevention via workstream name sanitization
- Strategy branch created before first commit (not at execute-phase)
- `ProviderModelNotFoundError` on non-Claude runtimes
- `$HOME` used instead of `~` in installed shell command paths
- Subdirectory CWD preserved in monorepo worktrees
- Stale hook detection checking wrong directory path
- STATE.md frontmatter status preserved when body Status field missing
- Pipe truncation fix using `fs.writeSync` for stdout
- Verification gate before writing PROJECT.md in new-milestone
- Removed `jq` as undocumented hard dependency
- Discuss-phase no longer ignores workflow instructions
- Gemini CLI uses `BeforeTool` hook event instead of `PreToolUse`

## [1.27.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.27.0) - 2026-03-20

### Added

- **Advisor mode** — Research-backed discussion with parallel agents evaluating gray areas before you decide
- **Multi-repo workspace support** — Auto-detection and project root resolution for monorepos and multi-repo setups
- **Cursor CLI runtime support** — Full installation and command conversion for Cursor
- `**/gsd:fast` command** — Trivial inline tasks that skip planning entirely
- `**/gsd:review` command** — Cross-AI peer review of current phase or branch
- `**/gsd:plant-seed` command** — Backlog parking lot for ideas and persistent context threads
- `**/gsd:pr-branch` command** — Clean PR branches filtering `.planning/` commits
- `**/gsd:audit-uat` command** — Verification debt tracking across phases
- `**--analyze` flag for discuss-phase** — Trade-off analysis during discussion
- `**research_before_questions` config option** — Run research before discussion questions instead of after
- **Ticket-based phase identifiers** — Support for team workflows using ticket IDs
- **Worktree-aware `.planning/` resolution** — File locking for safe parallel access
- **Discussion audit trail** — Auto-generated `DISCUSSION-LOG.md` during discuss-phase
- **Context window size awareness** — Optimized behavior for 1M+ context models
- **Exa and Firecrawl MCP support** — Additional research tools for research agents
- **Runtime State Inventory** — Researcher capability for rename/refactor phases
- **Quick-task branch support** — Isolated branches for quick-mode tasks
- **Decision IDs** — Discuss-to-plan traceability via decision identifiers
- **Stub detection** — Verifier and executor detect incomplete implementations
- **Security hardening** — Centralized `security.cjs` module with path traversal prevention, prompt injection detection/sanitization, safe JSON parsing, field name validation, and shell argument validation. PreToolUse `gsd-prompt-guard` hook scans writes to `.planning/` for injection patterns

### Changed

- CI matrix updated to Node 20, 22, 24 — dropped EOL Node 18
- GitHub Actions upgraded for Node 24 compatibility
- Consolidated `planningPaths()` helper across 4 modules — eliminated 34 inline path constructions
- Deduplicated code, annotated empty catches, consolidated STATE.md field helpers
- Materialize full config on new-project initialization
- Workflow enforcement guidance embedded in generated CLAUDE.md

### Fixed

- Path traversal in `readTextArgOrFile` — arguments validate paths resolve within project directory
- Codex config.toml corruption from non-boolean `[features]` keys
- Stale hooks check filtered to gsd-prefixed files only
- Universal agent name replacement for non-Claude runtimes
- `--no-verify` support for parallel executor commits
- ROADMAP fallback for plan-phase, execute-phase, and verify-work
- Copilot sequential fallback and spot-check completion detection
- `text_mode` config for Claude Code remote session compatibility
- Cursor: preserve slash-prefixed commands and unquoted skill names
- Semver 3+ segment parsing and CRLF frontmatter corruption recovery
- STATE.md parsing fixes (compound Plan field, progress tables, lifecycle extraction)
- Windows HOME sandboxing for tests
- Hook manifest tracking for local patch detection
- Cross-platform code detection and STATE.md file locking
- Auto-detect `commit_docs` from gitignore in `loadConfig`
- Context monitor hook matcher and timeout
- Codex EOL preservation when enabling hooks
- macOS `/var` symlink resolution in path validation

## [1.26.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.26.0) - 2026-03-18

### Added

- **Developer profiling pipeline** — `/gsd:profile-user` analyzes Claude Code session history to build behavioral profiles across 8 dimensions (communication, decisions, debugging, UX, vendor choices, frustrations, learning style, explanation depth). Generates `USER-PROFILE.md`, `/gsd:dev-preferences`, and `CLAUDE.md` profile section. Includes `--questionnaire` fallback and `--refresh` for re-analysis (#1084)
- `**/gsd:ship` command** — PR creation from verified phase work. Auto-generates rich PR body from planning artifacts, pushes branch, creates PR via `gh`, and updates STATE.md (#829)
- `**/gsd:next` command** — Automatic workflow advancement to the next logical step (#927)
- **Cross-phase regression gate** — Execute-phase runs prior phases' test suites after execution, catching regressions before they compound (#945)
- **Requirements coverage gate** — Plan-phase verifies all phase requirements are covered by at least one plan before proceeding (#984)
- **Structured session handoff artifact** — `/gsd:pause-work` writes `.planning/HANDOFF.json` for machine-readable cross-session continuity (#940)
- **WAITING.json signal file** — Machine-readable signal for decision points requiring user input (#1034)
- **Interactive executor mode** — Pair-programming style execution with step-by-step user involvement (#963)
- **MCP tool awareness** — GSD subagents can discover and use MCP server tools (#973)
- **Codex hooks support** — SessionStart hook support for Codex runtime (#1020)
- **Model alias-to-full-ID resolution** — Task API compatibility for model alias strings (#991)
- **Execution hardening** — Pre-wave dependency checks, cross-plan data contracts, and export-level spot checks (#1082)
- **Markdown normalization** — Generated markdown conforms to markdownlint standards (#1112)
- `**/gsd:audit-uat` command** — Cross-phase audit of all outstanding UAT and verification items. Scans every phase for pending, skipped, blocked, and human_needed items. Cross-references against codebase to detect stale documentation. Produces prioritized human test plan grouped by testability
- **Verification debt tracking** — Five structural improvements to prevent silent loss of UAT/verification items when projects advance:
  - Cross-phase health check in `/gsd:progress` (Step 1.6) surfaces outstanding items from ALL prior phases
  - `status: partial` in UAT files distinguishes incomplete testing from completed sessions
  - `result: blocked` with `blocked_by` tag for tests blocked by external dependencies (server, device, build, third-party)
  - `human_needed` verification items now persist as HUMAN-UAT.md files (trackable across sessions)
  - Phase completion and transition warnings surface verification debt non-blockingly
- **Advisor mode for discuss-phase** — Spawns parallel research agents during `/gsd:discuss-phase` to evaluate gray areas before user decides. Returns structured comparison tables calibrated to user's vendor philosophy. Activates only when `USER-PROFILE.md` exists (#1211)

### Changed

- Test suite consolidated: runtime converters deduplicated, helpers standardized (#1169)
- Added test coverage for model-profiles, templates, profile-pipeline, profile-output (#1170)
- Documented `inherit` profile for non-Anthropic providers (#1036)

### Fixed

- Agent suggests non-existent `/gsd:transition` — replaced with real commands (#1081, #1100)
- PROJECT.md drift and phase completion counter accuracy (#956)
- Copilot executor stuck issue — runtime compatibility fallback added (#1128)
- Explicit agent type listings prevent fallback after `/clear` (#949)
- Nested Skill calls breaking AskUserQuestion (#1009)
- Negative-heuristic `stripShippedMilestones` replaced with positive milestone lookup (#1145)
- Hook version tracking, stale hook detection, stdin timeout, session-report command (#1153, #1157, #1161, #1162)
- Hook build script syntax validation (#1165)
- Verification examples use `fetch()` instead of `curl` for Windows compatibility (#899)
- Sequential fallback for `map-codebase` on runtimes without Task tool (#1174)
- Zsh word-splitting fix for RUNTIME_DIRS arrays (#1173)
- CRLF frontmatter parsing, duplicate cwd crash, STATE.md phase transitions (#1105)
- Requirements `mark-complete` made idempotent (#948)
- Profile template paths, field names, and evidence key corrections (#1095)
- Duplicate variable declaration removed (#1101)

## [1.25.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.25.0) - 2026-03-16

### Added

- **Antigravity runtime support** — Full installation support for the Antigravity AI agent runtime (`--antigravity`), alongside Claude Code, OpenCode, Gemini, Codex, and Copilot
- `**/gsd:do` command** — Freeform text router that dispatches natural language to the right GSD command
- `**/gsd:note` command** — Zero-friction idea capture with append, list, and promote-to-todo subcommands
- **Context window warning toggle** — Config option to disable context monitor warnings (`hooks.context_monitor: false`)
- **Comprehensive documentation** — New `docs/` directory with feature, architecture, agent, command, CLI, and configuration guides

### Changed

- `/gsd:discuss-phase` shows remaining discussion areas when asking to continue or move on
- `/gsd:plan-phase` asks user about research instead of silently deciding
- Improved GitHub issue and PR templates with industry best practices
- Settings clarify balanced profile uses Sonnet for research

### Fixed

- Executor checks for untracked files after task commits
- Researcher verifies package versions against npm registry before recommending
- Health check adds CWD guard and strips archived milestones
- `core.cjs` returns `opus` directly instead of mapping to `inherit`
- Stats command corrects git and roadmap reporting
- Init prefers current milestone phase-op targets
- **Antigravity skills** — `processAttribution` was missing from `copyCommandsAsAntigravitySkills`, causing SKILL.md files to be written without commit attribution metadata
- Copilot install tests updated for UI agent count changes

## [1.24.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.24.0) - 2026-03-15

### Added

- `**/gsd:quick --research` flag** — Spawns focused research agent before planning, composable with `--discuss` and `--full` (#317)
- `**inherit` model profile** for OpenCode — agents inherit the user's selected runtime model via `/model`
- **Persistent debug knowledge base** — resolved debug sessions append to `.planning/debug/knowledge-base.md`, eliminating cold-start investigation on recurring issues
- **Programmatic `/gsd:set-profile`** — runs as a script instead of LLM-driven workflow, executes in seconds instead of 30-40s

### Fixed

- ROADMAP.md searches scoped to current milestone — multi-milestone projects no longer match phases from archived milestones
- OpenCode agent frontmatter conversion — agents get correct `name:`, `model: inherit`, `mode: subagent`
- `opencode.jsonc` config files respected during install (previously only `.json` was detected) (#1053)
- Windows installer crash on EPERM/EACCES when scanning protected directories (#964)
- `gsd-tools.cjs` uses absolute paths in all install types (#820)
- Invalid `skills:` frontmatter removed from UI agent files

## [1.23.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.23.0) - 2026-03-15

### Added

- `/gsd:ui-phase` + `/gsd:ui-review` — UI design contract generation and retroactive 6-pillar visual audit for frontend phases (closes #986)
- `/gsd:stats` — project statistics dashboard: phases, plans, requirements, git metrics, and timeline
- **Copilot CLI** runtime support — install with `--copilot`, maps Claude Code tools to GitHub Copilot tools
- `**gsd-autonomous` skill** for Codex runtime — enables autonomous GSD execution
- **Node repair operator** — autonomous recovery when task verification fails: RETRY, DECOMPOSE, or PRUNE before escalating to user. Configurable via `workflow.node_repair_budget` (default: 2 attempts). Disable with `workflow.node_repair: false`
- Mandatory `read_first` and `acceptance_criteria` sections in plans to prevent shallow execution
- Mandatory `canonical_refs` section in CONTEXT.md for traceable decisions
- Quick mode uses `YYMMDD-xxx` timestamp IDs instead of auto-increment numbers

### Changed

- `/gsd:discuss-phase` supports explicit `--batch` mode for grouped question intake

### Fixed

- `/gsd:new-milestone` no longer resets `workflow.research` config during milestone transitions
- `/gsd:update` is runtime-aware and targets the correct runtime directory
- Phase-complete properly updates REQUIREMENTS.md traceability (closes #848)
- Auto-advance no longer triggers without `--auto` flag (closes #1026, #932)
- `--auto` flag correctly skips interactive discussion questions (closes #1025)
- Decimal phase numbers correctly padded in init.cjs (closes #915)
- Empty-answer validation guards added to discuss-phase (closes #912)
- Tilde paths in templates prevent PII leak in `.planning/` files (closes #987)
- Invalid `commit-docs` command replaced with `commit` in workflows (closes #968)
- Uninstall mode indicator shown in banner output (closes #1024)
- WSL + Windows Node.js mismatch detected with user warning (closes #1021)
- Deprecated Codex config keys removed to fix UI instability
- Unsupported Gemini agent `skills` frontmatter stripped for compatibility
- Roadmap `complete` checkbox overrides `disk_status` for phase detection
- Plan-phase Nyquist validation works when research is disabled (closes #1002)
- Valid Codex agent TOML emitted by installer
- Escape characters corrected in grep commands

## [1.22.4](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.4) - 2026-03-03

### Added

- `--discuss` flag for `/gsd:quick` — lightweight pre-planning discussion to gather context before quick tasks

### Fixed

- Windows: `@file:` protocol resolution for large init payloads (>50KB) — all 32 workflow/agent files now resolve temp file paths instead of letting agents hallucinate `/tmp` paths (#841)
- Missing `skills` frontmatter on gsd-nyquist-auditor agent

## [1.22.3](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.3) - 2026-03-03

### Added

- Verify-work auto-injects a cold-start smoke test for phases that modify server, database, seed, or startup files — catches warm-state blind spots

### Changed

- Renamed `depth` setting to `granularity` with values `coarse`/`standard`/`fine` to accurately reflect what it controls (phase count, not investigation depth). Backward-compatible migration auto-renames existing config.

### Fixed

- Installer now replaces `$HOME/.claude/` paths (not just `~/.claude/`) for non-Claude runtimes — fixes broken commands on local installs and Gemini/OpenCode/Codex installs (#905, #909)

## [1.22.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.2) - 2026-03-03

### Fixed

- Codex installer no longer creates duplicate `[features]` and `[agents]` sections on re-install (#902, #882)
- Context monitor hook is advisory instead of blocking non-GSD workflows
- Hooks respect `CLAUDE_CONFIG_DIR` for custom config directories
- Hooks include stdin timeout guard to prevent hanging on pipe errors
- Statusline context scaling matches autocompact buffer thresholds
- Gap closure plans compute wave numbers instead of hardcoding wave 1
- `auto_advance` config flag no longer persists across sessions
- Phase-complete scans ROADMAP.md as fallback for next-phase detection
- `getMilestoneInfo()` prefers in-progress milestone marker instead of always returning first
- State parsing supports both bold and plain field formats
- Phase counting scoped to current milestone
- Total phases derived from ROADMAP when phase directories don't exist yet
- OpenCode detects runtime config directory instead of hardcoding `.claude`
- Gemini hooks use `AfterTool` event instead of `PostToolUse`
- Multi-word commit messages preserved in CLI router
- Regex patterns in milestone/state helpers properly escaped
- `isGitIgnored` uses `--no-index` for tracked file detection
- AskUserQuestion freeform answer loop properly breaks on valid input
- Agent spawn types standardized across all workflows

### Changed

- Anti-heredoc instruction extended to all file-writing agents
- Agent definitions include skills frontmatter and hooks examples

### Chores

- Removed leftover `new-project.md.bak` file
- Deduplicated `extractField` and phase filter helpers into shared modules
- Added 47 agent frontmatter and spawn consistency tests

## [1.22.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.1) - 2026-03-02

### Added

- Discuss phase now loads prior context (PROJECT.md, REQUIREMENTS.md, STATE.md, and all prior CONTEXT.md files) before identifying gray areas — prevents re-asking questions you've already answered in earlier phases

### Fixed

- Shell snippets in workflows use `printf` instead of `echo` to prevent jq parse errors with special characters

## [1.22.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.0) - 2026-02-27

### Added

- Codex multi-agent support: `request_user_input` mapping, multi-agent config, and agent role generation for Codex runtime
- Analysis paralysis guard in agents to prevent over-deliberation during planning
- Exhaustive cross-check and task-level TDD patterns in agent workflows
- Code-aware discuss phase with codebase scouting — `/gsd:discuss-phase` now analyzes relevant source files before asking questions

### Fixed

- Update checker clears both cache paths to prevent stale version notifications
- Statusline migration regex no longer clobbers third-party statuslines
- Subagent paths use `$HOME` instead of `~` to prevent `MODULE_NOT_FOUND` errors
- Skill discovery supports both `.claude/skills/` and `.agents/skills/` paths
- `resolve-model` variable names aligned with template placeholders
- Regex metacharacters properly escaped in `stateExtractField`
- `model_overrides` and `nyquist_validation` correctly loaded from config
- `phase-plan-index` no longer returns null/empty for `files_modified`, `objective`, and `task_count`

## [1.21.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.21.1) - 2026-02-27

### Added

- Comprehensive test suite: 428 tests across 13 test files covering core, commands, config, dispatcher, frontmatter, init, milestone, phase, roadmap, state, and verify modules
- CI pipeline with GitHub Actions: 9-matrix (3 OS × 3 Node versions), c8 coverage enforcement at 70% line threshold
- Cross-platform test runner (`scripts/run-tests.cjs`) for Windows compatibility

### Fixed

- `getMilestoneInfo()` returns wrong version when shipped milestones are collapsed in `<details>` blocks
- Milestone completion stats and archive now scoped to current milestone phases only (previously counted all phases on disk including prior milestones)
- MILESTONES.md entries now insert in reverse chronological order (newest first)
- Cross-platform path separators: all user-facing file paths use forward slashes on Windows
- JSON quoting and dollar sign handling in CLI arguments on Windows
- `model_overrides` loaded from config and `resolveModelInternal` used in CLI

## [1.21.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.21.0) - 2026-02-25

### Added

- YAML frontmatter sync to STATE.md for machine-readable status tracking
- `/gsd:add-tests` command for post-phase test generation
- Codex runtime support with skills-first installation
- Standard `project_context` block in gsd-verifier output
- Codex changelog and usage documentation

### Changed

- Improved onboarding UX: installer now suggests `/gsd:new-project` instead of `/gsd:help`
- Updated Discord invite to vanity URL (discord.gg/gsd)
- Compressed Nyquist validation layer to align with GSD meta-prompt conventions
- Requirements propagation now includes `phase_req_ids` from ROADMAP to workflow agents
- Debug sessions require human verification before resolution

### Fixed

- Multi-level decimal phase handling (e.g., 72.1.1) with proper regex escaping
- `/gsd:update` always installs latest package version
- STATE.md decision corruption and dollar sign handling
- STATE.md frontmatter mapping for requirements-completed status
- Progress bar percent clamping to prevent RangeError crashes
- `--cwd` override support in state-snapshot command

## [1.20.6](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.6) - 2025-02-23

### Added

- Context window monitor hook with WARNING/CRITICAL alerts when agent context usage exceeds thresholds
- Nyquist validation layer in plan-phase pipeline to catch quality issues before execution
- Option highlighting and gray area looping in discuss-phase for clearer preference capture

### Changed

- Refactored installer tools into 11 domain modules for maintainability

### Fixed

- Auto-advance chain no longer breaks when skills fail to resolve inside Task subagents
- Gemini CLI workflows and templates no longer incorrectly convert to TOML format
- Universal phase number parsing handles all formats consistently (decimal phases, plain numbers)

## [1.20.5](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.5) - 2026-02-19

### Fixed

- `/gsd:health --repair` now creates timestamped backup before regenerating STATE.md (#657)

### Changed

- Subagents now discover and load project CLAUDE.md and skills at spawn time for better project context (#671, #672)
- Improved context loading reliability in spawned agents

## [1.20.4](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.4) - 2026-02-17

### Fixed

- Executor agents now update ROADMAP.md and REQUIREMENTS.md after each plan completes — previously both documents stayed unchecked throughout milestone execution
- New `requirements mark-complete` CLI command enables per-plan requirement tracking instead of waiting for phase completion
- Executor final commit includes ROADMAP.md and REQUIREMENTS.md

## [1.20.3](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.3) - 2026-02-16

### Fixed

- Milestone audit now cross-references three independent sources (VERIFICATION.md + SUMMARY frontmatter + REQUIREMENTS.md traceability) instead of single-source phase status checks
- Orphaned requirements (in traceability table but absent from all phase VERIFICATIONs) detected and forced to `unsatisfied`
- Integration checker receives milestone requirement IDs and maps findings to affected requirements
- `complete-milestone` gates on requirements completion before archival — surfaces unchecked requirements with proceed/audit/abort options
- `plan-milestone-gaps` updates REQUIREMENTS.md traceability table (phase assignments, checkbox resets, coverage count) and includes it in commit
- Gemini CLI: escape `${VAR}` shell variables in agent bodies to prevent template validation failures

## [1.20.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.2) - 2026-02-16

### Fixed

- Requirements tracking chain now strips bracket syntax (`[REQ-01, REQ-02]` → `REQ-01, REQ-02`) across all agents
- Verifier cross-references requirement IDs from PLAN frontmatter instead of only grepping REQUIREMENTS.md by phase number
- Orphaned requirements (mapped to phase in REQUIREMENTS.md but unclaimed by any plan) are detected and flagged

### Changed

- All `requirements` references across planner, templates, and workflows enforce MUST/REQUIRED/CRITICAL language — no more passive suggestions
- Plan checker now **fails** (blocking, not warning) when any roadmap requirement is absent from all plans
- Researcher receives phase-specific requirement IDs and must output a `<phase_requirements>` mapping table
- Phase requirement IDs extracted from ROADMAP and passed through full chain: researcher → planner → checker → executor → verifier
- Verification report requirements table expanded with Source Plan, Description, and Evidence columns

## [1.20.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.1) - 2026-02-16

### Fixed

- Auto-mode (`--auto`) now survives context compaction by persisting `workflow.auto_advance` to config.json on disk
- Checkpoints no longer block auto-mode: human-verify auto-approves, decision auto-selects first option (human-action still stops for auth gates)
- Plan-phase now passes `--auto` flag when spawning execute-phase
- Auto-advance clears on milestone complete to prevent runaway chains

## [1.20.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.0) - 2026-02-15

### Added

- `/gsd:health` command — validates `.planning/` directory integrity with `--repair` flag for auto-fixing config.json and STATE.md
- `--full` flag for `/gsd:quick` — enables plan-checking (max 2 iterations) and post-execution verification on quick tasks
- `--auto` flag wired from `/gsd:new-project` through the full phase chain (discuss → plan → execute)
- Auto-advance chains phase execution across full milestones when `workflow.auto_advance` is enabled

### Fixed

- Plans created without user context — `/gsd:plan-phase` warns when no CONTEXT.md exists, `/gsd:discuss-phase` warns when plans already exist (#253)
- OpenCode installer converts `general-purpose` subagent type to OpenCode's `general`
- `/gsd:complete-milestone` respects `commit_docs` setting when merging branches
- Phase directories tracked in git via `.gitkeep` files

## [1.19.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.19.2) - 2026-02-15

### Added

- User-level default settings via `~/.gsd/defaults.json` — set GSD defaults across all projects
- Per-agent model overrides — customize which Claude model each agent uses

### Changed

- Completed milestone phase directories are now archived for cleaner project structure
- Wave execution diagram added to README for clearer parallelization visualization

### Fixed

- OpenCode local installs now write config to `./.opencode/` instead of overwriting global `~/.config/opencode/`
- Large JSON payloads write to temp files to prevent truncation in tool calls
- Phase heading matching now supports `####` depth
- Phase padding normalized in insert command
- ESM conflicts prevented by renaming gsd-tools.js to .cjs
- Config directory paths quoted in hook templates for local installs
- Settings file corruption prevented by using Write tool for file creation
- Plan-phase autocomplete fixed by removing "execution" from description
- Executor now has scope boundary and attempt limit to prevent runaway loops

## [1.19.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.19.1) - 2026-02-15

### Added

- Auto-advance pipeline: `--auto` flag on `discuss-phase` and `plan-phase` chains discuss → plan → execute without stopping. Also available as `workflow.auto_advance` config setting

### Fixed

- Phase transition routing now routes to `discuss-phase` (not `plan-phase`) when no CONTEXT.md exists — consistent across all workflows (#530)
- ROADMAP progress table plan counts are now computed from disk instead of LLM-edited — deterministic "X/Y Complete" values (#537)
- Verifier uses ROADMAP Success Criteria directly instead of deriving verification truths from the Goal field (#538)
- REQUIREMENTS.md traceability updates when a phase completes
- STATE.md updates after discuss-phase completes (#556)
- AskUserQuestion headers enforced to 12-char max to prevent UI truncation (#559)
- Agent model resolution returns `inherit` instead of hardcoded `opus` (#558)

## [1.19.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.19.0) - 2026-02-15

### Added

- Brave Search integration for researchers (requires BRAVE_API_KEY environment variable)
- GitHub issue templates for bug reports and feature requests
- Security policy for responsible disclosure
- Auto-labeling workflow for new issues

### Fixed

- UAT gaps and debug sessions now auto-resolve after gap-closure phase execution (#580)
- Fall back to ROADMAP.md when phase directory missing (#521)
- Template hook paths for OpenCode/Gemini runtimes (#585)
- Accept both `##` and `###` phase headers, detect malformed ROADMAPs (#598, #599)
- Use `{phase_num}` instead of ambiguous `{phase}` for filenames (#601)
- Add package.json to prevent ESM inheritance issues (#602)

## [1.18.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.18.0) - 2026-02-08

### Added

- `--auto` flag for `/gsd:new-project` — runs research → requirements → roadmap automatically after config questions. Expects idea document via @ reference (e.g., `/gsd:new-project --auto @prd.md`)

### Fixed

- Windows: SessionStart hook now spawns detached process correctly
- Windows: Replaced HEREDOC with literal newlines for git commit compatibility
- Research decision from `/gsd:new-milestone` now persists to config.json

## [1.17.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.17.0) - 2026-02-08

### Added

- **gsd-tools verification suite**: `verify plan-structure`, `verify phase-completeness`, `verify references`, `verify commits`, `verify artifacts`, `verify key-links` — deterministic structural checks
- **gsd-tools frontmatter CRUD**: `frontmatter get/set/merge/validate` — safe YAML frontmatter operations with schema validation
- **gsd-tools template fill**: `template fill summary/plan/verification` — pre-filled document skeletons
- **gsd-tools state progression**: `state advance-plan`, `state update-progress`, `state record-metric`, `state add-decision`, `state add-blocker`, `state resolve-blocker`, `state record-session` — automates STATE.md updates
- **Local patch preservation**: Installer now detects locally modified GSD files, backs them up to `gsd-local-patches/`, and creates a manifest for restoration
- `/gsd:reapply-patches` command to merge local modifications back after GSD updates

### Changed

- Agents (executor, planner, plan-checker, verifier) now use gsd-tools for state updates and verification instead of manual markdown parsing
- `/gsd:update` workflow now notifies about backed-up local patches and suggests `/gsd:reapply-patches`

### Fixed

- Added workaround for Claude Code `classifyHandoffIfNeeded` bug that causes false agent failures — execute-phase and quick workflows now spot-check actual output before reporting failure

## [1.16.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.16.0) - 2026-02-08

### Added

- 10 new gsd-tools CLI commands that replace manual AI orchestration of mechanical operations:
  - `phase add <desc>` — append phase to roadmap + create directory
  - `phase insert <after> <desc>` — insert decimal phase
  - `phase remove <N> [--force]` — remove phase with full renumbering
  - `phase complete <N>` — mark done, update state + roadmap, detect milestone end
  - `roadmap analyze` — unified roadmap parser with disk status
  - `milestone complete <ver> [--name]` — archive roadmap/requirements/audit
  - `validate consistency` — check phase numbering and disk/roadmap sync
  - `progress [json|table|bar]` — render progress in various formats
  - `todo complete <file>` — move todo from pending to completed
  - `scaffold [context|uat|verification|phase-dir]` — template generation

### Changed

- Workflows now delegate deterministic operations to gsd-tools CLI, reducing token usage and errors:
  - `remove-phase.md`: 13 manual steps → 1 CLI call + confirm + commit
  - `add-phase.md`: 6 manual steps → 1 CLI call + state update
  - `insert-phase.md`: 7 manual steps → 1 CLI call + state update
  - `complete-milestone.md`: archival delegated to `milestone complete`
  - `progress.md`: roadmap parsing delegated to `roadmap analyze`

### Fixed

- Execute-phase now correctly spawns `gsd-executor` subagents instead of generic task agents
- `commit_docs=false` setting now respected in all `.planning/` commit paths (execute-plan, debugger, reference docs all route through gsd-tools CLI)
- Execute-phase orchestrator no longer bloats context by embedding file content — passes paths instead, letting subagents read in their fresh context
- Windows: Normalized backslash paths in gsd-tools invocations (contributed by @rmindel)

## [1.15.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.15.0) - 2026-02-08

### Changed

- Optimized workflow context loading to eliminate redundant file reads, reducing token usage by ~5,000-10,000 tokens per workflow execution

## [1.14.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.14.0) - 2026-02-08

### Added

- Context-optimizing parsing commands in gsd-tools (`phase-plan-index`, `state-snapshot`, `summary-extract`) — reduces agent context usage by returning structured JSON instead of raw file content

### Fixed

- Installer no longer deletes opencode.json on JSONC parse errors — now handles comments, trailing commas, and BOM correctly (#474)

## [1.13.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.13.0) - 2026-02-08

### Added

- `gsd-tools history-digest` — Compiles phase summaries into structured JSON for faster context loading
- `gsd-tools phases list` — Lists phase directories with filtering (replaces fragile `ls | sort -V` patterns)
- `gsd-tools roadmap get-phase` — Extracts phase sections from ROADMAP.md
- `gsd-tools phase next-decimal` — Calculates next decimal phase number for insert operations
- `gsd-tools state get/patch` — Atomic STATE.md field operations
- `gsd-tools template select` — Chooses summary template based on plan complexity
- Summary template variants: minimal (~~30 lines), standard (~~60 lines), complex (~100 lines)
- Test infrastructure with 22 tests covering new commands

### Changed

- Planner uses two-step context assembly: digest for selection, full SUMMARY for understanding
- Agents migrated from bash patterns to structured gsd-tools commands
- Nested YAML frontmatter parsing now handles `dependency-graph.provides`, `tech-stack.added` correctly

## [1.12.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.12.1) - 2026-02-08

### Changed

- Consolidated workflow initialization into compound `init` commands, reducing token usage and improving startup performance
- Updated 24 workflow and agent files to use single-call context gathering instead of multiple atomic calls

## [1.12.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.12.0) - 2026-02-07

### Changed

- **Architecture: Thin orchestrator pattern** — Commands now delegate to workflows, reducing command file size by ~75% and improving maintainability
- **Centralized utilities** — New `gsd-tools.cjs` (11 functions) replaces repetitive bash patterns across 50+ files
- **Token reduction** — ~22k characters removed from affected command/workflow/agent files
- **Condensed agent prompts** — Same behavior with fewer words (executor, planner, verifier, researcher agents)

### Added

- `gsd-tools.cjs` CLI utility with functions: state load/update, resolve-model, find-phase, commit, verify-summary, generate-slug, current-timestamp, list-todos, verify-path-exists, config-ensure-section

## [1.11.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.11.2) - 2026-02-05

### Added

- Security section in README with Claude Code deny rules for sensitive files

### Changed

- Install respects `attribution.commit` setting for OpenCode compatibility (#286)

### Fixed

- **CRITICAL:** Prevent API keys from being committed via `/gsd:map-codebase` (#429)
- Enforce context fidelity in planning pipeline - agents now honor CONTEXT.md decisions (#326, #216, #206)
- Executor verifies task completion to prevent hallucinated success (#315)
- Auto-create `config.json` when missing during `/gsd:settings` (#264)
- `/gsd:update` respects local vs global install location
- Researcher writes RESEARCH.md regardless of `commit_docs` setting
- Statusline crash handling, color validation, git staging rules
- Statusline.js reference updated during install (#330)
- Parallelization config setting now respected (#379)
- ASCII box-drawing vs text content with diacritics (#289)
- Removed broken gsd-gemini link (404)

## [1.11.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.11.0) - 2026-01-31

### Added

- Git branching strategy configuration with three options:
  - `none` (default): commit to current branch
  - `phase`: create branch per phase (`gsd/phase-{N}-{slug}`)
  - `milestone`: create branch per milestone (`gsd/{version}-{slug}`)
- Squash merge option at milestone completion (recommended) with merge-with-history alternative
- Context compliance verification dimension in plan checker — flags if plans contradict user decisions

### Fixed

- CONTEXT.md from `/gsd:discuss-phase` now properly flows to all downstream agents (researcher, planner, checker, revision loop)

## [1.10.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.10.1) - 2025-01-30

### Fixed

- Gemini CLI agent loading errors that prevented commands from executing

## [1.10.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.10.0) - 2026-01-29

### Added

- Native Gemini CLI support — install with `--gemini` flag or select from interactive menu
- New `--all` flag to install for Claude Code, OpenCode, and Gemini simultaneously

### Fixed

- Context bar now shows 100% at actual 80% limit (was scaling incorrectly)

## [1.9.12](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.12) - 2025-01-23

### Removed

- `/gsd:whats-new` command — use `/gsd:update` instead (shows changelog with cancel option)

### Fixed

- Restored auto-release GitHub Actions workflow

## [1.9.11](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.11) - 2026-01-23

### Changed

- Switched to manual npm publish workflow (removed GitHub Actions CI/CD)

### Fixed

- Discord badge now uses static format for reliable rendering

## [1.9.10](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.10) - 2026-01-23

### Added

- Discord community link shown in installer completion message

## [1.9.9](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.9) - 2026-01-23

### Added

- `/gsd:join-discord` command to quickly access the GSD Discord community invite link

## [1.9.8](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.8) - 2025-01-22

### Added

- Uninstall flag (`--uninstall`) to cleanly remove GSD from global or local installations

### Fixed

- Context file detection now matches filename variants (handles both `CONTEXT.md` and `{phase}-CONTEXT.md` patterns)

## [1.9.7](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.7) - 2026-01-22

### Fixed

- OpenCode installer now uses correct XDG-compliant config path (`~/.config/opencode/`) instead of `~/.opencode/`
- OpenCode commands use flat structure (`command/gsd-help.md`) matching OpenCode's expected format
- OpenCode permissions written to `~/.config/opencode/opencode.json`

## [1.9.6](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.6) - 2026-01-22

### Added

- Interactive runtime selection: installer now prompts to choose Claude Code, OpenCode, or both
- Native OpenCode support: `--opencode` flag converts GSD to OpenCode format automatically
- `--both` flag to install for both Claude Code and OpenCode in one command
- Auto-configures `~/.opencode.json` permissions for seamless GSD doc access

### Changed

- Installation flow now asks for runtime first, then location
- Updated README with new installation options

## [1.9.5](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.5) - 2025-01-22

### Fixed

- Subagents can now access MCP tools (Context7, etc.) - workaround for Claude Code bug #13898
- Installer: Escape/Ctrl+C now cancels instead of installing globally
- Installer: Fixed hook paths on Windows
- Removed stray backticks in `/gsd:new-project` output

### Changed

- Condensed verbose documentation in templates and workflows (-170 lines)
- Added CI/CD automation for releases

## [1.9.4](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.4) - 2026-01-21

### Changed

- Checkpoint automation now enforces automation-first principle: Claude starts servers, handles CLI installs, and fixes setup failures before presenting checkpoints to users
- Added server lifecycle protocol (port conflict handling, background process management)
- Added CLI auto-installation handling with safe-to-install matrix
- Added pre-checkpoint failure recovery (fix broken environment before asking user to verify)
- DRY refactor: checkpoints.md is now single source of truth for automation patterns

## [1.9.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.2) - 2025-01-21

### Removed

- **Codebase Intelligence System** — Removed due to overengineering concerns
  - Deleted `/gsd:analyze-codebase` command
  - Deleted `/gsd:query-intel` command
  - Removed SQLite graph database and sql.js dependency (21MB)
  - Removed intel hooks (gsd-intel-index.js, gsd-intel-session.js, gsd-intel-prune.js)
  - Removed entity file generation and templates

### Fixed

- new-project now properly includes model_profile in config

## [1.9.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.0) - 2025-01-20

### Added

- **Model Profiles** — `/gsd:set-profile` for quality/balanced/budget agent configurations
- **Workflow Settings** — `/gsd:settings` command for toggling workflow behaviors interactively

### Fixed

- Orchestrators now inline file contents in Task prompts (fixes context issues with @ references)
- Tech debt from milestone audit addressed
- All hooks now use `gsd-` prefix for consistency (statusline.js → gsd-statusline.js)

## [1.8.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.8.0) - 2026-01-19

### Added

- Uncommitted planning mode: Keep `.planning/` local-only (not committed to git) via `planning.commit_docs: false` in config.json. Useful for OSS contributions, client work, or privacy preferences.
- `/gsd:new-project` now asks about git tracking during initial setup, letting you opt out of committing planning docs from the start

## [1.7.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.7.1) - 2026-01-19

### Fixed

- Quick task PLAN and SUMMARY files now use numbered prefix (`001-PLAN.md`, `001-SUMMARY.md`) matching regular phase naming convention

## [1.7.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.7.0) - 2026-01-19

### Added

- **Quick Mode** (`/gsd:quick`) — Execute small, ad-hoc tasks with GSD guarantees but skip optional agents (researcher, checker, verifier). Quick tasks live in `.planning/quick/` with their own tracking in STATE.md.

### Changed

- Improved progress bar calculation to clamp values within 0-100 range
- Updated documentation with comprehensive Quick Mode sections in help.md, README.md, and GSD-STYLE.md

### Fixed

- Console window flash on Windows when running hooks
- Empty `--config-dir` value validation
- Consistent `allowed-tools` YAML format across agents
- Corrected agent name in research-phase heading
- Removed hardcoded 2025 year from search query examples
- Removed dead gsd-researcher agent references
- Integrated unused reference files into documentation

### Housekeeping

- Added homepage and bugs fields to package.json

## [1.6.4](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.4) - 2026-01-17

### Fixed

- Installation on WSL2/non-TTY terminals now works correctly - detects non-interactive stdin and falls back to global install automatically
- Installation now verifies files were actually copied before showing success checkmarks
- Orphaned `gsd-notify.sh` hook from previous versions is now automatically removed during install (both file and settings.json registration)

## [1.6.3](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.3) - 2025-01-17

### Added

- `--gaps-only` flag for `/gsd:execute-phase` — executes only gap closure plans after verify-work finds issues, eliminating redundant state discovery

## [1.6.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.2) - 2025-01-17

### Changed

- README restructured with clearer 6-step workflow: init → discuss → plan → execute → verify → complete
- Discuss-phase and verify-work now emphasized as critical steps in core workflow documentation
- "Subagent Execution" section replaced with "Multi-Agent Orchestration" explaining thin orchestrator pattern and 30-40% context efficiency
- Brownfield instructions consolidated into callout at top of "How It Works" instead of separate section
- Phase directories now created at discuss/plan-phase instead of during roadmap creation

## [1.6.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.1) - 2025-01-17

### Changed

- Installer performs clean install of GSD folders, removing orphaned files from previous versions
- `/gsd:update` shows changelog and asks for confirmation before updating, with clear warning about what gets replaced

## [1.6.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.0) - 2026-01-17

### Changed

- **BREAKING:** Unified `/gsd:new-milestone` flow — now mirrors `/gsd:new-project` with questioning → research → requirements → roadmap in a single command
- Roadmapper agent now references templates instead of inline structures for easier maintenance

### Removed

- **BREAKING:** `/gsd:discuss-milestone` — consolidated into `/gsd:new-milestone`
- **BREAKING:** `/gsd:create-roadmap` — integrated into project/milestone flows
- **BREAKING:** `/gsd:define-requirements` — integrated into project/milestone flows
- **BREAKING:** `/gsd:research-project` — integrated into project/milestone flows

### Added

- `/gsd:verify-work` now includes next-step routing after verification completes

## [1.5.30](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.30) - 2026-01-17

### Fixed

- Output templates in `plan-phase`, `execute-phase`, and `audit-milestone` now render markdown correctly instead of showing literal backticks
- Next-step suggestions now consistently recommend `/gsd:discuss-phase` before `/gsd:plan-phase` across all routing paths

## [1.5.29](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.29) - 2025-01-16

### Changed

- Discuss-phase now uses domain-aware questioning with deeper probing for gray areas

### Fixed

- Windows hooks now work via Node.js conversion (statusline, update-check)
- Phase input normalization at command entry points
- Removed blocking notification popups (gsd-notify) on all platforms

## [1.5.28](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.28) - 2026-01-16

### Changed

- Consolidated milestone workflow into single command
- Merged domain expertise skills into agent configurations
- **BREAKING:** Removed `/gsd:execute-plan` command (use `/gsd:execute-phase` instead)

### Fixed

- Phase directory matching now handles both zero-padded (05-*) and unpadded (5-*) folder names
- Map-codebase agent output collection

## [1.5.27](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.27) - 2026-01-16

### Fixed

- Orchestrator corrections between executor completions are now committed (previously left uncommitted when orchestrator made small fixes between waves)

## [1.5.26](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.26) - 2026-01-16

### Fixed

- Revised plans now get committed after checker feedback (previously only initial plans were committed, leaving revisions uncommitted)

## [1.5.25](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.25) - 2026-01-16

### Fixed

- Stop notification hook no longer shows stale project state (now uses session-scoped todos only)
- Researcher agent now reliably loads CONTEXT.md from discuss-phase

## [1.5.24](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.24) - 2026-01-16

### Fixed

- Stop notification hook now correctly parses STATE.md fields (was always showing "Ready for input")
- Planner agent now reliably loads CONTEXT.md and RESEARCH.md files

## [1.5.23](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.23) - 2025-01-16

### Added

- Cross-platform completion notification hook (Mac/Linux/Windows alerts when Claude stops)
- Phase researcher now loads CONTEXT.md from discuss-phase to focus research on user decisions

### Fixed

- Consistent zero-padding for phase directories (01-name, not 1-name)
- Plan file naming: `{phase}-{plan}-PLAN.md` pattern restored across all agents
- Double-path bug in researcher git add command
- Removed `/gsd:research-phase` from next-step suggestions (use `/gsd:plan-phase` instead)

## [1.5.22](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.22) - 2025-01-16

### Added

- Statusline update indicator — shows `⬆ /gsd:update` when a new version is available

### Fixed

- Planner now updates ROADMAP.md placeholders after planning completes

## [1.5.21](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.21) - 2026-01-16

### Added

- GSD brand system for consistent UI (checkpoint boxes, stage banners, status symbols)
- Research synthesizer agent that consolidates parallel research into SUMMARY.md

### Changed

- **Unified `/gsd:new-project` flow** — Single command now handles questions → research → requirements → roadmap (~10 min)
- Simplified README to reflect streamlined workflow: new-project → plan-phase → execute-phase
- Added optional `/gsd:discuss-phase` documentation for UI/UX/behavior decisions before planning

### Fixed

- verify-work now shows clear checkpoint box with action prompt ("Type 'pass' or describe what's wrong")
- Planner uses correct `{phase}-{plan}-PLAN.md` naming convention
- Planner no longer surfaces internal `user_setup` in output
- Research synthesizer commits all research files together (not individually)
- Project researcher agent can no longer commit (orchestrator handles commits)
- Roadmap requires explicit user approval before committing

## [1.5.20](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.20) - 2026-01-16

### Fixed

- Research no longer skipped based on premature "Research: Unlikely" predictions made during roadmap creation. The `--skip-research` flag provides explicit control when needed.

### Removed

- `Research: Likely/Unlikely` fields from roadmap phase template
- `detect_research_needs` step from roadmap creation workflow
- Roadmap-based research skip logic from planner agent

## [1.5.19](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.19) - 2026-01-16

### Changed

- `/gsd:discuss-phase` redesigned with intelligent gray area analysis — analyzes phase to identify discussable areas (UI, UX, Behavior, etc.), presents multi-select for user control, deep-dives each area with focused questioning
- Explicit scope guardrail prevents scope creep during discussion — captures deferred ideas without acting on them
- CONTEXT.md template restructured for decisions (domain boundary, decisions by category, Claude's discretion, deferred ideas)
- Downstream awareness: discuss-phase now explicitly documents that CONTEXT.md feeds researcher and planner agents
- `/gsd:plan-phase` now integrates research — spawns `gsd-phase-researcher` before planning unless research exists or `--skip-research` flag used

## [1.5.18](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.18) - 2026-01-16

### Added

- **Plan verification loop** — Plans are now verified before execution with a planner → checker → revise cycle
  - New `gsd-plan-checker` agent (744 lines) validates plans will achieve phase goals
  - Six verification dimensions: requirement coverage, task completeness, dependency correctness, key links, scope sanity, must_haves derivation
  - Max 3 revision iterations before user escalation
  - `--skip-verify` flag for experienced users who want to bypass verification
- **Dedicated planner agent** — `gsd-planner` (1,319 lines) consolidates all planning expertise
  - Complete methodology: discovery levels, task breakdown, dependency graphs, scope estimation, goal-backward analysis
  - Revision mode for handling checker feedback
  - TDD integration and checkpoint patterns
- **Statusline integration** — Context usage, model, and current task display

### Changed

- `/gsd:plan-phase` refactored to thin orchestrator pattern (310 lines)
  - Spawns `gsd-planner` for planning, `gsd-plan-checker` for verification
  - User sees status between agent spawns (not a black box)
- Planning references deprecated with redirects to `gsd-planner` agent sections
  - `plan-format.md`, `scope-estimation.md`, `goal-backward.md`, `principles.md`
  - `workflows/plan-phase.md`

### Fixed

- Removed zombie `gsd-milestone-auditor` agent (was accidentally re-added after correct deletion)

### Removed

- Phase 99 throwaway test files

## [1.5.17](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.17) - 2026-01-15

### Added

- New `/gsd:update` command — check for updates, install, and display changelog of what changed (better UX than raw `npx get-shit-done-cc`)

## [1.5.16](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.16) - 2026-01-15

### Added

- New `gsd-researcher` agent (915 lines) with comprehensive research methodology, 4 research modes (ecosystem, feasibility, implementation, comparison), source hierarchy, and verification protocols
- New `gsd-debugger` agent (990 lines) with scientific debugging methodology, hypothesis testing, and 7+ investigation techniques
- New `gsd-codebase-mapper` agent for brownfield codebase analysis
- Research subagent prompt template for context-only spawning

### Changed

- `/gsd:research-phase` refactored to thin orchestrator — now injects rich context (key insight framing, downstream consumer info, quality gates) to gsd-researcher agent
- `/gsd:research-project` refactored to spawn 4 parallel gsd-researcher agents with milestone-aware context (greenfield vs v1.1+) and roadmap implications guidance
- `/gsd:debug` refactored to thin orchestrator (149 lines) — spawns gsd-debugger agent with full debugging expertise
- `/gsd:new-milestone` now explicitly references MILESTONE-CONTEXT.md

### Deprecated

- `workflows/research-phase.md` — consolidated into gsd-researcher agent
- `workflows/research-project.md` — consolidated into gsd-researcher agent
- `workflows/debug.md` — consolidated into gsd-debugger agent
- `references/research-pitfalls.md` — consolidated into gsd-researcher agent
- `references/debugging.md` — consolidated into gsd-debugger agent
- `references/debug-investigation.md` — consolidated into gsd-debugger agent

## [1.5.15](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.15) - 2025-01-15

### Fixed

- **Agents now install correctly** — The `agents/` folder (gsd-executor, gsd-verifier, gsd-integration-checker, gsd-milestone-auditor) was missing from npm package, now included

### Changed

- Consolidated `/gsd:plan-fix` into `/gsd:plan-phase --gaps` for simpler workflow
- UAT file writes now batched instead of per-response for better performance

## [1.5.14](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.14) - 2025-01-15

### Fixed

- Plan-phase now always routes to `/gsd:execute-phase` after planning, even for single-plan phases

## [1.5.13](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.13) - 2026-01-15

### Fixed

- `/gsd:new-milestone` now presents research and requirements paths as equal options, matching `/gsd:new-project` format

## [1.5.12](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.12) - 2025-01-15

### Changed

- **Milestone cycle reworked for proper requirements flow:**
  - `complete-milestone` now archives AND deletes ROADMAP.md and REQUIREMENTS.md (fresh for next milestone)
  - `new-milestone` is now a "brownfield new-project" — updates PROJECT.md with new goals, routes to define-requirements
  - `discuss-milestone` is now required before `new-milestone` (creates context file)
  - `research-project` is milestone-aware — focuses on new features, ignores already-validated requirements
  - `create-roadmap` continues phase numbering from previous milestone
  - Flow: complete → discuss → new-milestone → research → requirements → roadmap

### Fixed

- `MILESTONE-AUDIT.md` now versioned as `v{version}-MILESTONE-AUDIT.md` and archived on completion
- `progress` now correctly routes to `/gsd:discuss-milestone` when between milestones (Route F)

## [1.5.11](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.11) - 2025-01-15

### Changed

- Verifier reuses previous must-haves on re-verification instead of re-deriving, focuses deep verification on failed items with quick regression checks on passed items

## [1.5.10](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.10) - 2025-01-15

### Changed

- Milestone audit now reads existing phase VERIFICATION.md files instead of re-verifying each phase, aggregates tech debt and deferred gaps, adds `tech_debt` status for non-blocking accumulated debt

### Fixed

- VERIFICATION.md now included in phase completion commit alongside ROADMAP.md, STATE.md, and REQUIREMENTS.md

## [1.5.9](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.9) - 2025-01-15

### Added

- Milestone audit system (`/gsd:audit-milestone`) for verifying milestone completion with parallel verification agents

### Changed

- Checkpoint display format improved with box headers and unmissable "→ YOUR ACTION:" prompts
- Subagent colors updated (executor: yellow, integration-checker: blue)
- Execute-phase now recommends `/gsd:audit-milestone` when milestone completes

### Fixed

- Research-phase no longer gatekeeps by domain type

### Removed

- Domain expertise feature (`~/.claude/skills/expertise/`) - was personal tooling not available to other users

## [1.5.8](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.8) - 2025-01-15

### Added

- Verification loop: When gaps are found, verifier generates fix plans that execute automatically before re-verifying

### Changed

- `gsd-executor` subagent color changed from red to blue

## [1.5.7](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.7) - 2025-01-15

### Added

- `gsd-executor` subagent: Dedicated agent for plan execution with full workflow logic built-in
- `gsd-verifier` subagent: Goal-backward verification that checks if phase goals are actually achieved (not just tasks completed)
- Phase verification: Automatic verification runs when a phase completes to catch stubs and incomplete implementations
- Goal-backward planning reference: Documentation for deriving must-haves from goals

### Changed

- execute-plan and execute-phase now spawn `gsd-executor` subagent instead of using inline workflow
- Roadmap and planning workflows enhanced with goal-backward analysis

### Removed

- Obsolete templates (`checkpoint-resume.md`, `subagent-task-prompt.md`) — logic now lives in subagents

### Fixed

- Updated remaining `general-purpose` subagent references to use `gsd-executor`

## [1.5.6](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.6) - 2025-01-15

### Changed

- README: Separated flow into distinct steps (1 → 1.5 → 2 → 3 → 4 → 5) making `research-project` clearly optional and `define-requirements` required
- README: Research recommended for quality; skip only for speed

### Fixed

- execute-phase: Phase metadata (timing, wave info) now bundled into single commit instead of separate commits

## [1.5.5](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.5) - 2025-01-15

### Changed

- README now documents the `research-project` → `define-requirements` flow (optional but recommended before `create-roadmap`)
- Commands section reorganized into 7 grouped tables (Setup, Execution, Verification, Milestones, Phase Management, Session, Utilities) for easier scanning
- Context Engineering table now includes `research/` and `REQUIREMENTS.md`

## [1.5.4](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.4) - 2025-01-15

### Changed

- Research phase now loads REQUIREMENTS.md to focus research on concrete requirements (e.g., "email verification") rather than just high-level roadmap descriptions

## [1.5.3](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.3) - 2025-01-15

### Changed

- **execute-phase narration**: Orchestrator now describes what each wave builds before spawning agents, and summarizes what was built after completion. No more staring at opaque status updates.
- **new-project flow**: Now offers two paths — research first (recommended) or define requirements directly (fast path for familiar domains)
- **define-requirements**: Works without prior research. Gathers requirements through conversation when FEATURES.md doesn't exist.

### Removed

- Dead `/gsd:status` command (referenced abandoned background agent model)
- Unused `agent-history.md` template
- `_archive/` directory with old execute-phase version

## [1.5.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.2) - 2026-01-15

### Added

- Requirements traceability: roadmap phases now include `Requirements:` field listing which REQ-IDs they cover
- plan-phase loads REQUIREMENTS.md and shows phase-specific requirements before planning
- Requirements automatically marked Complete when phase finishes

### Changed

- Workflow preferences (mode, depth, parallelization) now asked in single prompt instead of 3 separate questions
- define-requirements shows full requirements list inline before commit (not just counts)
- Research-project and workflow aligned to both point to define-requirements as next step

### Fixed

- Requirements status now updated by orchestrator (commands) instead of subagent workflow, which couldn't determine phase completion

## [1.5.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.1) - 2026-01-14

### Changed

- Research agents write their own files directly (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md) instead of returning results to orchestrator
- Slimmed principles.md and load it dynamically in core commands

## [1.5.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.0) - 2026-01-14

### Added

- New `/gsd:research-project` command for pre-roadmap ecosystem research — spawns parallel agents to investigate stack, features, architecture, and pitfalls before you commit to a roadmap
- New `/gsd:define-requirements` command for scoping v1 requirements from research findings — transforms "what exists in this domain" into "what we're building"
- Requirements traceability: phases now map to specific requirement IDs with 100% coverage validation

### Changed

- **BREAKING:** New project flow is now: `new-project → research-project → define-requirements → create-roadmap`
- Roadmap creation now requires REQUIREMENTS.md and validates all v1 requirements are mapped to phases
- Simplified questioning in new-project to four essentials (vision, core priority, boundaries, constraints)

## [1.4.29](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.29) - 2026-01-14

### Removed

- Deleted obsolete `_archive/execute-phase.md` and `status.md` commands

## [1.4.28](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.28) - 2026-01-14

### Fixed

- Restored comprehensive checkpoint documentation with full examples for verification, decisions, and auth gates
- Fixed execute-plan command to use fresh continuation agents instead of broken resume pattern
- Rich checkpoint presentation formats now documented for all three checkpoint types

### Changed

- Slimmed execute-phase command to properly delegate checkpoint handling to workflow

## [1.4.27](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.27) - 2025-01-14

### Fixed

- Restored "what to do next" commands after plan/phase execution completes — orchestrator pattern conversion had inadvertently removed the copy/paste-ready next-step routing

## [1.4.26](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.26) - 2026-01-14

### Added

- Full changelog history backfilled from git (66 historical versions from 1.0.0 to 1.4.23)

## [1.4.25](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.25) - 2026-01-14

### Added

- New `/gsd:whats-new` command shows changes since your installed version
- VERSION file written during installation for version tracking
- CHANGELOG.md now included in package installation

## [1.4.24](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.24) - 2026-01-14

### Added

- USER-SETUP.md template for external service configuration

### Removed

- **BREAKING:** ISSUES.md system (replaced by phase-scoped UAT issues and TODOs)

## [1.4.23](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.23) - 2026-01-14

### Changed

- Removed dead ISSUES.md system code

## [1.4.22](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.22) - 2026-01-14

### Added

- Subagent isolation for debug investigations with checkpoint support

### Fixed

- DEBUG_DIR path constant to prevent typos in debug workflow

## [1.4.21](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.21) - 2026-01-14

### Fixed

- SlashCommand tool added to plan-fix allowed-tools

## [1.4.20](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.20) - 2026-01-14

### Fixed

- Standardized debug file naming convention
- Debug workflow now invokes execute-plan correctly

## [1.4.19](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.19) - 2026-01-14

### Fixed

- Auto-diagnose issues instead of offering choice in plan-fix

## [1.4.18](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.18) - 2026-01-14

### Added

- Parallel diagnosis before plan-fix execution

## [1.4.17](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.17) - 2026-01-14

### Changed

- Redesigned verify-work as conversational UAT with persistent state

## [1.4.16](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.16) - 2026-01-13

### Added

- Pre-execution summary for interactive mode in execute-plan
- Pre-computed wave numbers at plan time

## [1.4.15](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.15) - 2026-01-13

### Added

- Context rot explanation to README header

## [1.4.14](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.14) - 2026-01-13

### Changed

- YOLO mode is now recommended default in new-project

## [1.4.13](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.13) - 2026-01-13

### Fixed

- Brownfield flow documentation
- Removed deprecated resume-task references

## [1.4.12](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.12) - 2026-01-13

### Changed

- execute-phase is now recommended as primary execution command

## [1.4.11](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.11) - 2026-01-13

### Fixed

- Checkpoints now use fresh continuation agents instead of resume

## [1.4.10](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.10) - 2026-01-13

### Changed

- execute-plan converted to orchestrator pattern for performance

## [1.4.9](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.9) - 2026-01-13

### Changed

- Removed subagent-only context from execute-phase orchestrator

### Fixed

- Removed "what's out of scope" question from discuss-phase

## [1.4.8](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.8) - 2026-01-13

### Added

- TDD reasoning explanation restored to plan-phase docs

## [1.4.7](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.7) - 2026-01-13

### Added

- Project state loading before execution in execute-phase

### Fixed

- Parallel execution marked as recommended, not experimental

## [1.4.6](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.6) - 2026-01-13

### Added

- Checkpoint pause/resume for spawned agents
- Deviation rules, commit rules, and workflow references to execute-phase

## [1.4.5](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.5) - 2026-01-13

### Added

- Parallel-first planning with dependency graphs
- Checkpoint-resume capability for long-running phases
- `.claude/rules/` directory for auto-loaded contribution rules

### Changed

- execute-phase uses wave-based blocking execution

## [1.4.4](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.4) - 2026-01-13

### Fixed

- Inline listing for multiple active debug sessions

## [1.4.3](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.3) - 2026-01-13

### Added

- `/gsd:debug` command for systematic debugging with persistent state

## [1.4.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.2) - 2026-01-13

### Fixed

- Installation verification step clarification

## [1.4.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.1) - 2026-01-13

### Added

- Parallel phase execution via `/gsd:execute-phase`
- Parallel-aware planning in `/gsd:plan-phase`
- `/gsd:status` command for parallel agent monitoring
- Parallelization configuration in config.json
- Wave-based parallel execution with dependency graphs

### Changed

- Renamed `execute-phase.md` workflow to `execute-plan.md` for clarity
- Plan frontmatter now includes `wave`, `depends_on`, `files_modified`, `autonomous`

## [1.4.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.0) - 2026-01-12

### Added

- Full parallel phase execution system
- Parallelization frontmatter in plan templates
- Dependency analysis for parallel task scheduling
- Agent history schema v1.2 with parallel execution support

### Changed

- Plans can now specify wave numbers and dependencies
- execute-phase orchestrates multiple subagents in waves

## [1.3.34](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.34) - 2026-01-11

### Added

- `/gsd:add-todo` and `/gsd:check-todos` for mid-session idea capture

## [1.3.33](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.33) - 2026-01-11

### Fixed

- Consistent zero-padding for decimal phase numbers (e.g., 01.1)

### Changed

- Removed obsolete .claude-plugin directory

## [1.3.32](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.32) - 2026-01-10

### Added

- `/gsd:resume-task` for resuming interrupted subagent executions

## [1.3.31](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.31) - 2026-01-08

### Added

- Planning principles for security, performance, and observability
- Pro patterns section in README

## [1.3.30](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.30) - 2026-01-08

### Added

- verify-work option surfaces after plan execution

## [1.3.29](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.29) - 2026-01-08

### Added

- `/gsd:verify-work` for conversational UAT validation
- `/gsd:plan-fix` for fixing UAT issues
- UAT issues template

## [1.3.28](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.28) - 2026-01-07

### Added

- `--config-dir` CLI argument for multi-account setups
- `/gsd:remove-phase` command

### Fixed

- Validation for --config-dir edge cases

## [1.3.27](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.27) - 2026-01-07

### Added

- Recommended permissions mode documentation

### Fixed

- Mandatory verification enforced before phase/milestone completion routing

## [1.3.26](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.26) - 2026-01-06

### Added

- Claude Code marketplace plugin support

### Fixed

- Phase artifacts now committed when created

## [1.3.25](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.25) - 2026-01-06

### Fixed

- Milestone discussion context persists across /clear

## [1.3.24](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.24) - 2026-01-06

### Added

- `CLAUDE_CONFIG_DIR` environment variable support

## [1.3.23](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.23) - 2026-01-06

### Added

- Non-interactive install flags (`--global`, `--local`) for Docker/CI

## [1.3.22](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.22) - 2026-01-05

### Changed

- Removed unused auto.md command

## [1.3.21](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.21) - 2026-01-05

### Changed

- TDD features use dedicated plans for full context quality

## [1.3.20](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.20) - 2026-01-05

### Added

- Per-task atomic commits for better AI observability

## [1.3.19](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.19) - 2026-01-05

### Fixed

- Clarified create-milestone.md file locations with explicit instructions

## [1.3.18](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.18) - 2026-01-05

### Added

- YAML frontmatter schema with dependency graph metadata
- Intelligent context assembly via frontmatter dependency graph

## [1.3.17](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.17) - 2026-01-04

### Fixed

- Clarified depth controls compression, not inflation in planning

## [1.3.16](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.16) - 2026-01-04

### Added

- Depth parameter for planning thoroughness (`--depth=1-5`)

## [1.3.15](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.15) - 2026-01-01

### Fixed

- TDD reference loaded directly in commands

## [1.3.14](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.14) - 2025-12-31

### Added

- TDD integration with detection, annotation, and execution flow

## [1.3.13](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.13) - 2025-12-29

### Fixed

- Restored deterministic bash commands
- Removed redundant decision_gate

## [1.3.12](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.12) - 2025-12-29

### Fixed

- Restored plan-format.md as output template

## [1.3.11](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.11) - 2025-12-29

### Changed

- 70% context reduction for plan-phase workflow
- Merged CLI automation into checkpoints
- Compressed scope-estimation (74% reduction) and plan-phase.md (66% reduction)

## [1.3.10](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.10) - 2025-12-29

### Fixed

- Explicit plan count check in offer_next step

## [1.3.9](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.9) - 2025-12-27

### Added

- Evolutionary PROJECT.md system with incremental updates

## [1.3.8](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.8) - 2025-12-18

### Added

- Brownfield/existing projects section in README

## [1.3.7](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.7) - 2025-12-18

### Fixed

- Improved incremental codebase map updates

## [1.3.6](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.6) - 2025-12-18

### Added

- File paths included in codebase mapping output

## [1.3.5](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.5) - 2025-12-17

### Fixed

- Removed arbitrary 100-line limit from codebase mapping

## [1.3.4](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.4) - 2025-12-17

### Fixed

- Inline code for Next Up commands (avoids nesting ambiguity)

## [1.3.3](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.3) - 2025-12-17

### Fixed

- Check PROJECT.md not .planning/ directory for existing project detection

## [1.3.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.2) - 2025-12-17

### Added

- Git commit step to map-codebase workflow

## [1.3.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.1) - 2025-12-17

### Added

- `/gsd:map-codebase` documentation in help and README

## [1.3.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.0) - 2025-12-17

### Added

- `/gsd:map-codebase` command for brownfield project analysis
- Codebase map templates (stack, architecture, structure, conventions, testing, integrations, concerns)
- Parallel Explore agent orchestration for codebase analysis
- Brownfield integration into GSD workflows

### Changed

- Improved continuation UI with context and visual hierarchy

### Fixed

- Permission errors for non-DSP users (removed shell context)
- First question is now freeform, not AskUserQuestion

## [1.2.13](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.13) - 2025-12-17

### Added

- Improved continuation UI with context and visual hierarchy

## [1.2.12](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.12) - 2025-12-17

### Fixed

- First question should be freeform, not AskUserQuestion

## [1.2.11](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.11) - 2025-12-17

### Fixed

- Permission errors for non-DSP users (removed shell context)

## [1.2.10](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.10) - 2025-12-16

### Fixed

- Inline command invocation replaced with clear-then-paste pattern

## [1.2.9](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.9) - 2025-12-16

### Fixed

- Git init runs in current directory

## [1.2.8](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.8) - 2025-12-16

### Changed

- Phase count derived from work scope, not arbitrary limits

## [1.2.7](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.7) - 2025-12-16

### Fixed

- AskUserQuestion mandated for all exploration questions

## [1.2.6](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.6) - 2025-12-16

### Changed

- Internal refactoring

## [1.2.5](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.5) - 2025-12-16

### Changed

- `<if mode>` tags for yolo/interactive branching

## [1.2.4](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.4) - 2025-12-16

### Fixed

- Stale CONTEXT.md references updated to new vision structure

## [1.2.3](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.3) - 2025-12-16

### Fixed

- Enterprise language removed from help and discuss-milestone

## [1.2.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.2) - 2025-12-16

### Fixed

- new-project completion presented inline instead of as question

## [1.2.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.1) - 2025-12-16

### Fixed

- AskUserQuestion restored for decision gate in questioning flow

## [1.2.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.0) - 2025-12-15

### Changed

- Research workflow implemented as Claude Code context injection

## [1.1.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.1.2) - 2025-12-15

### Fixed

- YOLO mode now skips confirmation gates in plan-phase

## [1.1.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.1.1) - 2025-12-15

### Added

- README documentation for new research workflow

## [1.1.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.1.0) - 2025-12-15

### Added

- Pre-roadmap research workflow
- `/gsd:research-phase` for niche domain ecosystem discovery
- `/gsd:research-project` command with workflow and templates
- `/gsd:create-roadmap` command with research-aware workflow
- Research subagent prompt templates

### Changed

- new-project split to only create PROJECT.md + config.json
- Questioning rewritten as thinking partner, not interviewer

## [1.0.11](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.11) - 2025-12-15

### Added

- `/gsd:research-phase` for niche domain ecosystem discovery

## [1.0.10](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.10) - 2025-12-15

### Fixed

- Scope creep prevention in discuss-phase command

## [1.0.9](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.9) - 2025-12-15

### Added

- Phase CONTEXT.md loaded in plan-phase command

## [1.0.8](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.8) - 2025-12-15

### Changed

- PLAN.md included in phase completion commits

## [1.0.7](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.7) - 2025-12-15

### Added

- Path replacement for local installs

## [1.0.6](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.6) - 2025-12-15

### Changed

- Internal improvements

## [1.0.5](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.5) - 2025-12-15

### Added

- Global/local install prompt during setup

### Fixed

- Bin path fixed (removed ./)
- .DS_Store ignored

## [1.0.4](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.4) - 2025-12-15

### Fixed

- Bin name and circular dependency removed

## [1.0.3](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.3) - 2025-12-15

### Added

- TDD guidance in planning workflow

## [1.0.2](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.2) - 2025-12-15

### Added

- Issue triage system to prevent deferred issue pile-up

## [1.0.1](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.1) - 2025-12-15

### Added

- Initial npm package release

## [1.0.0](https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.0) - 2025-12-14

### Added

- Initial release of GSD (Get Shit Done) meta-prompting system
- Core slash commands: `/gsd:new-project`, `/gsd:discuss-phase`, `/gsd:plan-phase`, `/gsd:execute-phase`
- PROJECT.md and STATE.md templates
- Phase-based development workflow
- YOLO mode for autonomous execution
- Interactive mode with checkpoints

[Unreleased]: https://github.com/gsd-build/get-shit-done/compare/v1.38.2...HEAD
[1.38.2]: https://github.com/gsd-build/get-shit-done/compare/v1.37.1...v1.38.2
[1.37.1]: https://github.com/gsd-build/get-shit-done/compare/v1.37.0...v1.37.1
[1.37.0]: https://github.com/gsd-build/get-shit-done/compare/v1.36.0...v1.37.0
[1.36.0]: https://github.com/gsd-build/get-shit-done/releases/tag/v1.36.0
[1.35.0]: https://github.com/gsd-build/get-shit-done/releases/tag/v1.35.0
[1.34.2]: https://github.com/gsd-build/get-shit-done/releases/tag/v1.34.2
[1.34.1]: https://github.com/gsd-build/get-shit-done/releases/tag/v1.34.1
[1.34.0]: https://github.com/gsd-build/get-shit-done/releases/tag/v1.34.0
[1.33.0]: https://github.com/gsd-build/get-shit-done/releases/tag/v1.33.0
[1.30.0]: https://github.com/gsd-build/get-shit-done/releases/tag/v1.30.0
[1.29.0]: https://github.com/gsd-build/get-shit-done/releases/tag/v1.29.0
[1.28.0]: https://github.com/gsd-build/get-shit-done/releases/tag/v1.28.0
[1.27.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.27.0
[1.26.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.26.0
[1.25.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.25.0
[1.24.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.24.0
[1.23.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.23.0
[1.22.4]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.4
[1.22.3]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.3
[1.22.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.2
[1.22.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.1
[1.22.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.22.0
[1.21.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.21.1
[1.21.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.21.0
[1.20.6]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.6
[1.20.5]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.5
[1.20.4]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.4
[1.20.3]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.3
[1.20.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.2
[1.20.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.1
[1.20.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.20.0
[1.19.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.19.2
[1.19.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.19.1
[1.19.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.19.0
[1.18.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.18.0
[1.17.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.17.0
[1.16.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.16.0
[1.15.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.15.0
[1.14.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.14.0
[1.13.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.13.0
[1.12.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.12.1
[1.12.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.12.0
[1.11.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.11.2
[1.11.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.11.0
[1.10.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.10.1
[1.10.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.10.0
[1.9.12]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.12
[1.9.11]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.11
[1.9.10]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.10
[1.9.9]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.9
[1.9.8]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.8
[1.9.7]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.7
[1.9.6]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.6
[1.9.5]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.5
[1.9.4]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.4
[1.9.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.2
[1.9.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.9.0
[1.8.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.8.0
[1.7.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.7.1
[1.7.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.7.0
[1.6.4]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.4
[1.6.3]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.3
[1.6.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.2
[1.6.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.1
[1.6.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.6.0
[1.5.30]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.30
[1.5.29]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.29
[1.5.28]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.28
[1.5.27]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.27
[1.5.26]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.26
[1.5.25]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.25
[1.5.24]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.24
[1.5.23]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.23
[1.5.22]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.22
[1.5.21]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.21
[1.5.20]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.20
[1.5.19]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.19
[1.5.18]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.18
[1.5.17]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.17
[1.5.16]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.16
[1.5.15]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.15
[1.5.14]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.14
[1.5.13]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.13
[1.5.12]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.12
[1.5.11]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.11
[1.5.10]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.10
[1.5.9]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.9
[1.5.8]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.8
[1.5.7]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.7
[1.5.6]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.6
[1.5.5]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.5
[1.5.4]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.4
[1.5.3]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.3
[1.5.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.2
[1.5.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.1
[1.5.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.5.0
[1.4.29]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.29
[1.4.28]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.28
[1.4.27]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.27
[1.4.26]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.26
[1.4.25]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.25
[1.4.24]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.24
[1.4.23]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.23
[1.4.22]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.22
[1.4.21]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.21
[1.4.20]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.20
[1.4.19]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.19
[1.4.18]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.18
[1.4.17]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.17
[1.4.16]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.16
[1.4.15]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.15
[1.4.14]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.14
[1.4.13]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.13
[1.4.12]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.12
[1.4.11]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.11
[1.4.10]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.10
[1.4.9]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.9
[1.4.8]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.8
[1.4.7]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.7
[1.4.6]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.6
[1.4.5]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.5
[1.4.4]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.4
[1.4.3]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.3
[1.4.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.2
[1.4.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.1
[1.4.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.0
[1.3.34]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.34
[1.3.33]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.33
[1.3.32]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.32
[1.3.31]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.31
[1.3.30]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.30
[1.3.29]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.29
[1.3.28]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.28
[1.3.27]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.27
[1.3.26]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.26
[1.3.25]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.25
[1.3.24]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.24
[1.3.23]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.23
[1.3.22]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.22
[1.3.21]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.21
[1.3.20]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.20
[1.3.19]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.19
[1.3.18]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.18
[1.3.17]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.17
[1.3.16]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.16
[1.3.15]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.15
[1.3.14]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.14
[1.3.13]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.13
[1.3.12]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.12
[1.3.11]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.11
[1.3.10]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.10
[1.3.9]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.9
[1.3.8]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.8
[1.3.7]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.7
[1.3.6]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.6
[1.3.5]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.5
[1.3.4]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.4
[1.3.3]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.3
[1.3.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.2
[1.3.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.1
[1.3.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.3.0
[1.2.13]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.13
[1.2.12]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.12
[1.2.11]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.11
[1.2.10]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.10
[1.2.9]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.9
[1.2.8]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.8
[1.2.7]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.7
[1.2.6]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.6
[1.2.5]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.5
[1.2.4]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.4
[1.2.3]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.3
[1.2.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.2
[1.2.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.1
[1.2.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.2.0
[1.1.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.1.2
[1.1.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.1.1
[1.1.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.1.0
[1.0.11]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.11
[1.0.10]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.10
[1.0.9]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.9
[1.0.8]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.8
[1.0.7]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.7
[1.0.6]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.6
[1.0.5]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.5
[1.0.4]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.4
[1.0.3]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.3
[1.0.2]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.2
[1.0.1]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.1
[1.0.0]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.0.0
