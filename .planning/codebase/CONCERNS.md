# Codebase Concerns

**Analysis Date:** 2026-02-01

## Tech Debt

**Overengineering History (Codebase Intelligence System):**
- Issue: Complete feature implementation (3,065 lines, 21MB dependency) added to codebase, then reverted due to poor design decisions
- Files: Originally in `/gsd:analyze-codebase`, `/gsd:query-intel` commands, intel hooks (gsd-intel-index.js, gsd-intel-session.js, gsd-intel-prune.js)
- Impact: Context bloat, increased installation size, complex state management that didn't justify its existence
- Lesson captured: System now avoids premature feature expansion. Pre-release tagging strategy implemented to prevent future overengineering from landing on main
- Fix approach: Continue vetting large feature additions (>500 lines) with experimental pre-release tags before merging to main

**Deprecated Command References:**
- Issue: Multiple BREAKING changes created legacy references in documentation (e.g., `/gsd:execute-plan` replaced by `/gsd:execute-phase`)
- Files: `agents/gsd-executor.md`, `agents/gsd-planner.md`, various workflow references
- Impact: Confusion if users reference old documentation, requires maintaining compatibility layer or clear deprecation notes
- Current state: Redirects implemented in planning references, zombie agent references removed manually
- Fix approach: Maintain a deprecation.md file mapping old commands to replacements, link from help systems

**Complex Agent Dependencies:**
- Issue: gsd-planner.md (42KB, 1426 lines) is largest agent with tightly coupled task breakdown, discovery, context assembly, and revision logic
- Files: `agents/gsd-planner.md`, referenced by `/gsd:plan-phase` orchestrator
- Impact: Single agent handles multiple concerns (planning, discovery routing, context assembly, revision handling). Changes to one area risk breaking others
- Hidden complexity: Nested step execution, context budget calculations (50% target rule), task wave optimization all in one file
- Fix approach: Consider extracting discovery routing logic to separate agent, but only if planner responsibilities decrease (current size is at practical limit)

**Hardcoded Year Values (Legacy):**
- Issue: Hardcoded 2025 appeared in search query examples and docs
- Files: Removed from CHANGELOG, but verify no other instances in templates
- Impact: Documentation becomes stale, search examples fail if year-dependent
- Current state: Cleaned in v1.9.3, but pattern could recur
- Fix approach: Use dynamic date generation in search queries, avoid hardcoded years in templates

## Known Bugs & Breaking Changes

**Context File Detection Fragility:**
- Issue: Context file detection needed fixing to handle both `CONTEXT.md` and `{phase}-CONTEXT.md` patterns
- Files: gsd-executor.md, referenced in load_project_state step
- Impact: Phase-scoped CONTEXT.md files might not be loaded, causing inconsistent state information
- Current mitigation: Fixed in v1.9.8, pattern now matches filename variants correctly
- Recommendations: Add integration test verifying both filename patterns load correctly

**Path Handling on Windows:**
- Issue: Multiple Windows-specific path bugs have been fixed (UNC paths in v1.9.5, installer in v1.9.7)
- Files: `bin/install.js`, hooks building system
- Impact: GSD installation unreliable on Windows until path fixes applied, user frustration
- Frequency: Intermittent - requires Windows-specific testing that desktop development often skips
- Current mitigation: OpenCode installer now uses XDG-compliant config paths (`~/.config/opencode/`)
- Recommendations: Add Windows path handling tests before release, use CI to validate on Windows

**Package Manager Detection:**
- Issue: Using `npm link` for local development testing requires users to have npm available
- Files: `CONTRIBUTING.md`, installation flow
- Impact: If user's runtime (Gemini CLI, OpenCode) doesn't include npm, local testing fails
- Workaround: Direct path installation, but not documented
- Fix approach: Document alternative local testing methods for non-npm runtimes

**Gemini CLI Integration Instability:**
- Issue: Agent loading errors prevented Gemini CLI commands from executing in v1.10.1
- Files: Affects Gemini runtime specifically, added in v1.10.0
- Impact: Three distinct runtimes (Claude Code, OpenCode, Gemini) means triple the integration surface
- Testing burden: Each new feature must be validated across three separate executables
- Current mitigation: Fixed in v1.10.1, but indicates fragility in multi-runtime support
- Recommendations: Unit test each runtime's command loading before release

## Performance Bottlenecks

**Context Window Pressure (Critical Design Constraint):**
- Problem: Claude's degrading behavior as context approaches 80% limit
- Files: Discussed in `agents/gsd-planner.md` philosophy section, enforced in `agents/gsd-plan-checker.md`
- Root cause: Quality degradation curve: 0-30% (peak), 30-50% (good), 50-70% (degrading), 70%+ (poor)
- Impact: Plans target ~50% context to maintain quality. Violations cause rushed code, skipped verification, incomplete implementations
- Improvement path:
  1. Enforce context budget checking in plan-checker (currently documented but not automated)
  2. Add context usage measurement to executor (track actual context consumed)
  3. Implement per-plan context tracking to catch violations early

**Large Agent Files (Context Load on Modification):**
- Problem: Core agents are 800-1400+ lines (gsd-planner: 1426 lines, gsd-debugger: 1203 lines, gsd-executor: 822 lines)
- Files: `agents/gsd-planner.md`, `agents/gsd-debugger.md`, `agents/gsd-executor.md`
- Impact: Modifying these agents loads full file in context, consuming 50%+ of budget before actual work begins
- Risk: Incremental improvements become expensive context-wise, discourages refactoring
- Improvement path: Consider extracting sub-workflows for large agents (e.g., discovery routing from planner), but only when agent responsibilities decrease

**File I/O in Tight Loops:**
- Problem: gsd-executor reads STATE.md multiple times during plan execution to track position and decisions
- Files: `agents/gsd-executor.md`, state_updates step
- Impact: Multiple bash `cat` calls for decision extraction, context concatenation add latency
- Frequency: Per-task, could be 10-20 times per phase
- Improvement path: Cache STATE.md in memory at start, update once at end (batch I/O)

## Fragile Areas

**Multi-Runtime Support System:**
- Files: `bin/install.js`, `hooks/`, interactive runtime selection flow, command format varies per runtime
- Why fragile: Three distinct executables (Claude Code, OpenCode, Gemini) with different:
  - Config directory conventions (~/.claude/ vs ~/.config/opencode/ vs unknown Gemini path)
  - Command registration mechanisms
  - Permission file formats
  - Tool access patterns (MCP tools work differently across runtimes)
- Safe modification: Any change to installation flow must be tested against all three runtimes before merge
- Test coverage: No automated CI for multi-runtime validation (manual testing required)
- Recommendation: Add integration tests for install workflow targeting all three runtimes

**Orchestrator State Management:**
- Files: `.planning/STATE.md`, `.planning/config.json`, orchestrators read both
- Why fragile: STATE.md manually updated during execution, malformed JSON or missing state sections cause silent failures
- Safe modification: Never assume STATE.md structure exists. Always check for missing sections before reading
- Hidden assumptions: Progress bar calculation assumes consistent phase/plan numbering
- Recommendation: Validate STATE.md schema at start of orchestrators, fail explicitly if malformed

**Task Execution with Checkpoints:**
- Files: `agents/gsd-executor.md`, checkpoint handling logic (lines 82-100)
- Why fragile: Checkpoint protocol requires exact matching: executor pauses at checkpoint, orchestrator resumes with fresh agent
- Failure mode: If checkpoint detection fails, executor continues executing downstream tasks, violating user intent
- Current safeguard: `grep -n "type=\"checkpoint"` parsing (brittle, regex-dependent)
- Safe modification: Never add/remove checkpoint detection logic without integration test
- Recommendation: Add unit tests for checkpoint detection regex against real PLAN.md files

**Discovery Protocol Routing:**
- Files: `agents/gsd-planner.md` discovery_levels section, routes to discovery workflow vs. inline research
- Why fragile: Decision logic (lines 82-117) uses multiple heuristics: "Level 0 if all work follows patterns", "Level 2 if choosing between options"
- Failure mode: Underestimating research needs causes planner to skip essential discovery, resulting in poor decisions
- Safe modification: Test discovery level decisions against actual phase goals before shipping
- Recommendation: Add discovery-level decision examples to CONTRIBUTING.md

**Goal-Backward Verification (Plan Checker):**
- Files: `agents/gsd-plan-checker.md`, core verification dimensions (requirement coverage, task completeness, dependency analysis)
- Why fragile: Verification requires human interpretation of "task addresses requirement". Regex-based task parsing can miss implicit requirements
- Failure mode: Plan passes checker but misses actual goal (e.g., "create auth" covers login but not logout)
- Safe modification: Test plan-checker against phase with intentionally incomplete plans, verify it catches gaps
- Test coverage: No automated test suite for plan-checker logic

**Dependency Graph Analysis (Planner):**
- Files: `agents/gsd-planner.md`, task_breakdown section, wave optimization (lines 240-285)
- Why fragile: File dependency detection uses simple pattern matching on frontmatter `depends_on` field
- Failure mode: Circular dependencies undetected if depends_on syntax varies, or cross-file dependencies implicit
- Current safeguard: Plan-checker validates "No circular dependencies" but depends on accurate depends_on field
- Recommendation: Add explicit circular dependency detection with proof (topological sort)

## Scaling Limits

**Phase/Milestone Count Capacity:**
- Current state: GSD successfully manages ~20 phases per milestone (largest project in v1.11.0 has 23 phases)
- Limit: State management (STATE.md progress bar) becomes unwieldy at 100+ phases
- Progress bar calculation: `(completed / total) × 100%` works at scale, but manual phase tracking becomes error-prone
- Scaling path: Implement hierarchical phase grouping (sub-milestones), automate phase count from ROADMAP.md

**Plan File Size:**
- Current state: Individual PLAN.md files target 2-3 tasks, ~50% context budget
- Limit: Complex features requiring deep requirements may need >3 tasks, violating the rule
- Risk: Breaking the 50% context rule degrades quality during execution
- Scaling path: Enforce 2-3 task limit in plan-checker with explicit alerts if violated

**Command Count:**
- Current state: ~40 slash commands exist across phases, roadmapping, planning, execution, verification
- Limit: Help system and discoverability become unwieldy at 60+ commands
- Impact: Users unfamiliar with full workflow get lost
- Scaling path: Group commands into logical subcommands (gsd:phase:*, gsd:verify:*), implement hierarchical help

**Dependencies at Runtime:**
- Current state: Zero npm dependencies in production (only esbuild dev dependency)
- Advantage: Minimal installation footprint, no supply chain risk from transitive dependencies
- Limit: Can't add rich features requiring external libraries (e.g., rich markdown parsing, SQL graph database)
- Scaling path: Carefully evaluate if new features justify dependency cost; pre-release tag and audit before merging

## Dependencies at Risk

**Node Version Requirement:**
- Risk: Minimum Node.js >=16.7.0 (in package.json) is from 2021
- Impact: By 2026, Node 16 receives minimal updates; users on older LTS may have missing features
- Migration plan: Bump to Node >=18.0.0 in next major version, drop v16 support, document in MIGRATION.md

**esbuild DevDependency:**
- Risk: Single build tool dependency for hook compilation
- Impact: If esbuild breaks or is compromised, hook build system fails
- Frequency: Hooks rebuilt on `npm publish`, changes rarely
- Mitigation: Hooks are pre-built and committed as .dist files, reducing runtime dependency
- Recommendation: Pin esbuild to specific version, add checksum verification

## Test Coverage Gaps

**Multi-Runtime Validation:**
- What's not tested: Actual installation and command execution on OpenCode and Gemini CLI
- Files: `bin/install.js`, command registration logic, runtime-specific hooks
- Risk: New features may work on Claude Code but fail on Gemini (e.g., MCP tool access issues fixed in v1.9.5)
- Priority: HIGH - Three runtimes means each release requires triple validation

**Windows Path Handling Integration:**
- What's not tested: Full install → command → execution cycle on Windows with UNC paths, backslashes, spaces in paths
- Files: `bin/install.js`, hook build system, bash command generation
- Risk: Windows users experience intermittent failures on edge cases
- Priority: HIGH - 25%+ of developers use Windows

**Checkpoint Recovery:**
- What's not tested: Resume behavior after user pauses at checkpoint, fresh agent loads continuation context
- Files: `agents/gsd-executor.md`, orchestrator state handoff
- Risk: State confusion if checkpoint resume loses context from previous phase
- Priority: MEDIUM - Rare failure path, but critical when it occurs

**Plan-Checker Against Real Failures:**
- What's not tested: Plan-checker tested against intentionally incomplete/incorrect plans to verify detection
- Files: `agents/gsd-plan-checker.md`
- Risk: Plan-checker might approve plans with subtle goal misses (e.g., auth endpoint created but session management missing)
- Priority: MEDIUM - Affects reliability of phase execution

**Discovery Routing Accuracy:**
- What's not tested: Discovery level decisions (0-3) against actual planner outcomes, validation that skip/quick/standard/deep choices match difficulty
- Files: `agents/gsd-planner.md` discovery_levels section
- Risk: Undershooting discovery level causes poor planner decisions; overshooting wastes context
- Priority: MEDIUM - Affects plan quality indirectly

## Security Considerations

**No Input Validation on User Decisions:**
- Risk: CONTEXT.md user inputs (decisions, deferred ideas) used directly in plan generation without validation
- Files: `agents/gsd-planner.md` (gather_phase_context step), plan-checker (CONTEXT.md compliance check)
- Scenario: Malicious or malformed decision text could influence plan generation in unexpected ways
- Current mitigation: GSD designed for solo developer; trusted user input assumed
- Recommendations:
  1. If ever used in collaborative settings, add decision validation
  2. Sanitize any user input used in shell commands (bash variable expansion)
  3. Document trust assumptions in SECURITY.md

**Shell Command Generation (Executor):**
- Risk: Bash commands generated during task execution include file paths and user inputs
- Files: `agents/gsd-executor.md`, task execution step
- Scenario: File path with special characters (backticks, $(), semicolons) could inject arbitrary commands
- Current mitigation: Modern bash prevents some injection via quoted expansion, but not all edge cases
- Recommendations:
  1. Always quote bash variables: `"$VAR"` not `$VAR`
  2. Use `printf %q` to escape shell-unsafe strings
  3. Document safe command generation patterns in CONVENTIONS.md

**External API Access via WebFetch:**
- Risk: Some agents use WebFetch to query Context7, GitHub, etc.; responses not validated
- Files: `agents/gsd-phase-researcher.md`, `agents/gsd-planner.md` (WebFetch, mcp__context7__* tools)
- Scenario: Man-in-the-middle attack, malicious API response, or API returning unexpected data structure
- Current mitigation: Context7 is Anthropic-controlled (trusted), GitHub is public (low sensitivity)
- Recommendations:
  1. Validate API response schema before use
  2. Log external API calls for audit
  3. Document API sources in INTEGRATIONS.md

**No Authentication for Local State Files:**
- Risk: .planning/ directory contains all project context, decisions, state; unencrypted in repo or filesystem
- Files: `.planning/STATE.md`, `.planning/config.json`, `.planning/phases/*/` contents
- Scenario: If repo leaks, all architectural decisions and project state exposed
- Current mitigation: GSD designed for solo developers; projects typically in private repos
- Recommendations:
  1. Add `.planning/` to default .gitignore for monorepos
  2. Document that .planning should be private
  3. No high-sensitivity data should go in CONTEXT.md (use .env instead)

## Technical Debt Summary

| Area | Severity | Status | Notes |
|------|----------|--------|-------|
| Large agent file sizes (1400+ lines) | MEDIUM | Acknowledged | Refactoring expensive context-wise, not blocking |
| Context budget enforcement | MEDIUM | Partial | Documented rule, not automated detection |
| Multi-runtime test coverage | HIGH | Missing | No CI validation across Claude Code/OpenCode/Gemini |
| Windows path handling | HIGH | Patched | Multiple fixes applied, needs comprehensive test |
| Overengineering history | LOW | Resolved | Lesson learned, pre-release tags implemented |
| Shell command injection risk | MEDIUM | Mitigated | Trust assumption (solo developer) documented |

---

*Concerns audit: 2026-02-01*
