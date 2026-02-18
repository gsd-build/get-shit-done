# Phase 5: Integrity System - Research

**Researched:** 2026-02-16
**Domain:** Milestone truth verification, auto-remediation, and honor protocol
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Commitment scope
- Only milestones are commitments -- actions are tasks, not promises
- Declarations are checked in Phase 6 (alignment), not here

#### Detection and verification
- Verification happens immediately after all actions for a milestone complete
- Two-layer verification: programmatic checks where possible (file exists, test passes) + AI assessment for the rest
- Each milestone's success criteria become structured checkboxes with pass/fail and evidence

#### Auto-remediation flow
- When verification fails: system derives new actions to close the gap
- System shows the remediation plan, then auto-executes immediately (no pause for approval)
- Maximum 2 remediation attempts before escalating to user
- Remediation is inline during execution -- "M-03 failed verification -> remediating..."

#### Escalation (after 2 failed attempts)
- System produces a diagnosis report: what was tried, what failed, specific suggestions for adjustment
- Suggestions always included -- "Consider narrowing this criterion" or "This test needs X"
- User option: adjust the milestone statement or criteria, then system retries verification

#### Honor protocol history
- Each milestone folder gets a VERIFICATION.md (not a system-level INTEGRITY.md)
- Full history: each verification attempt logged with timestamp, what was checked, result, remediation actions taken
- Structured checklist format: success criteria as checkboxes with pass/fail and evidence

#### Output verbosity
- When auto-remediation succeeds: summary (3-5 lines) -- what failed, what remediation did, that it passed
- Surfaced inline during execution, not batched into a post-execution report

### Claude's Discretion
- Milestone state vocabulary (original ACTIVE/KEPT/BROKEN/HONORED/RENEGOTIATED vs simplified vs hybrid)
- VERIFICATION.md exact format and structure
- How to derive remediation actions from verification failures
- Programmatic check implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTG-01 | Commitments are explicitly tracked with state machine (ACTIVE -> KEPT/HONORED/BROKEN/RENEGOTIATED) | Milestone state vocabulary extends existing PENDING/ACTIVE/DONE statuses in engine.js; VERIFICATION.md per milestone folder provides the tracking artifact; status command aggregates for visibility |
| INTG-02 | When commitment breaks, system activates honor protocol: acknowledge, inform affected nodes, clean up consequences, renegotiate | Auto-remediation flow derives new actions from verification failures; DAG traversal via `getUpstream()` identifies affected declarations; escalation report with diagnosis provides renegotiation context |
| INTG-03 | Integrity is presented generatively (restoration-focused), never punitively (no scores, no judgment) | Remediation messaging uses "what needs to happen" framing; escalation includes specific suggestions for adjustment; no pass/fail scoring at project level -- only per-criterion evidence |
</phase_requirements>

## Summary

Phase 5 closes the gap between "all actions completed" and "the milestone is actually true." The existing execution pipeline (Phase 4) already has a two-layer verification step in `/declare:execute` -- automated `verify-wave` checks plus AI review. Phase 5 transforms this from a pass/fail gate into a full integrity system: structured verification against explicit success criteria, auto-remediation when verification fails, per-milestone verification history, and an honor protocol for when remediation cannot resolve the gap.

The core architectural challenge is integrating milestone-level truth verification into the existing execution flow without creating a separate phase or command. Per the locked decision, verification runs inline during execution ("M-03 failed verification -> remediating..."), which means the `/declare:execute` slash command becomes the primary integration point. The CJS layer needs a new `verify-milestone` subcommand that performs structured programmatic checks, and the slash command needs enhanced logic for the remediation loop.

The secondary challenge is the VERIFICATION.md artifact -- a per-milestone file that logs each verification attempt with timestamps, criteria checked, results, and remediation actions. This is a new artifact type that needs a parser/writer module following the established pattern in `src/artifacts/`.

**Primary recommendation:** Build a `verify-milestone` CJS subcommand (structured programmatic checks against success criteria), a `verification.js` artifact module (VERIFICATION.md parser/writer), extend the milestone state vocabulary in engine.js, and enhance `/declare:execute` with the remediation loop and VERIFICATION.md writing. No new slash commands needed -- integrity is woven into execution.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, child_process) | Node 18+ | File I/O, path resolution, test runner invocation | Zero-dependency constraint from INFR-04 |
| DeclareDag (src/graph/engine.js) | Internal | Graph queries, node status updates, upstream traversal | Already proven in phases 1-4; provides `getUpstream()` for affected-node identification |
| buildDagFromDisk (src/commands/build-dag.js) | Internal | Graph reconstruction from disk artifacts | Shared utility used by all graph-consuming commands |
| esbuild | 0.24.2 | CJS bundling | Existing dev dependency; bundles to dist/declare-tools.cjs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| parsePlanFile (src/artifacts/plan.js) | Internal | Read milestone PLAN.md for success criteria extraction | When building verification checklist from plan content |
| findMilestoneFolder (src/artifacts/milestone-folders.js) | Internal | Locate milestone directories for VERIFICATION.md | When reading/writing verification history |
| parseMilestonesFile / writeMilestonesFile (src/artifacts/milestones.js) | Internal | MILESTONES.md status updates | When updating milestone state after verification |
| traceUpward (src/commands/trace.js) | Internal | Why-chain context for remediation | When building remediation actions with declaration awareness |
| looksLikeFilePath (src/commands/verify-wave.js) | Internal | Heuristic for produces field checking | When determining which action outputs can be checked programmatically |
| commitPlanningDocs (src/git/commit.js) | Internal | Atomic git commits | Per verification attempt commit |

### Alternatives Considered

None -- all tooling is internal. Zero new external dependencies.

**Installation:**
No new packages. All work uses existing codebase primitives.

## Architecture Patterns

### Recommended Project Structure

```
src/
  artifacts/
    verification.js          # NEW -- VERIFICATION.md parser/writer
  commands/
    verify-milestone.js      # NEW -- milestone-level truth verification
  declare-tools.js           # UPDATE -- add verify-milestone subcommand
.claude/commands/declare/
  execute.md                 # UPDATE -- add remediation loop, VERIFICATION.md writing
```

### Pattern 1: Milestone State Vocabulary

**What:** Extend the current PENDING/ACTIVE/DONE status set to include integrity-specific states that map to INTG-01's requirement.

**Recommendation: Hybrid vocabulary** that extends the existing set without breaking it.

The existing `VALID_STATUSES` in engine.js is `['PENDING', 'ACTIVE', 'DONE']`. The requirement specifies `ACTIVE -> KEPT/HONORED/BROKEN/RENEGOTIATED`. The key insight: DONE and KEPT/HONORED are semantically different. DONE means "actions completed." KEPT means "verified true." HONORED means "was broken but restored."

Recommended vocabulary:

| Status | Meaning | When Set | Replaces |
|--------|---------|----------|----------|
| PENDING | Not started | Initial state | (existing) |
| ACTIVE | Execution in progress | When `/declare:execute` starts | (existing) |
| DONE | All actions completed, not yet verified | When last action finishes | (existing -- semantics narrowed) |
| KEPT | Verified true -- milestone truth holds | Verification passes | New |
| BROKEN | Verification failed, remediation in progress or exhausted | Verification fails | New |
| HONORED | Was broken, then restored via remediation | Remediation succeeds after initial failure | New |
| RENEGOTIATED | User adjusted the milestone after failed remediation | User modifies milestone criteria during escalation | New |

**Implementation:** Add these to `VALID_STATUSES` in engine.js. The milestone state machine is:
```
PENDING -> ACTIVE -> DONE -> KEPT (happy path)
PENDING -> ACTIVE -> DONE -> BROKEN -> HONORED (remediation succeeds)
PENDING -> ACTIVE -> DONE -> BROKEN -> RENEGOTIATED (user adjusts)
```

This approach:
- Preserves backward compatibility -- PENDING, ACTIVE, DONE still work exactly as before
- Adds semantic richness for Phase 5 without removing anything
- Makes Phase 4's execution flow continue to work (it sets DONE, Phase 5 goes further)
- Maps cleanly to INTG-01 requirement

**Confidence:** HIGH -- directly extends existing engine.js `VALID_STATUSES` set.

### Pattern 2: VERIFICATION.md Format

**What:** Per-milestone structured verification history file.

**Recommendation:**

```markdown
# Verification: M-XX -- [Milestone Title]

**Milestone:** M-XX
**Current State:** KEPT | BROKEN | HONORED | RENEGOTIATED
**Last Verified:** 2026-02-16T14:30:00Z
**Attempts:** 2

## Success Criteria

- [x] **SC-01:** [Criterion text] -- PASS
  Evidence: [what was found]
- [ ] **SC-02:** [Criterion text] -- FAIL
  Evidence: [what was expected vs found]
  Remediation: [what was attempted]

## Verification History

### Attempt 1 -- 2026-02-16T14:25:00Z
**Result:** FAIL (1/3 criteria passed)
**Checks:**
- [x] SC-01: [description] -- PASS (file exists at path/to/file)
- [ ] SC-02: [description] -- FAIL (expected test to pass, got 2 failures)
- [ ] SC-03: [description] -- FAIL (AI assessment: module lacks error handling)
**Remediation triggered:** Yes
**Actions derived:** A-15 (Fix test failures), A-16 (Add error handling)

### Attempt 2 -- 2026-02-16T14:30:00Z
**Result:** PASS (3/3 criteria passed)
**Checks:**
- [x] SC-01: [description] -- PASS
- [x] SC-02: [description] -- PASS (tests now passing)
- [x] SC-03: [description] -- PASS (AI assessment: error handling adequate)
**State transition:** BROKEN -> HONORED
```

**Key design decisions:**
1. Success criteria IDs (SC-XX) are derived from the milestone's PLAN.md content, not separately defined. The milestone's title and action descriptions define what "true" means.
2. Each attempt is a full log entry with timestamp, individual criterion results, and remediation tracking.
3. Evidence is concrete -- file paths, test output snippets, AI assessment quotes.
4. The file is append-only for history (new attempts added at the bottom of the History section) but the header metadata updates to reflect current state.

**Confidence:** HIGH -- follows established artifact pattern from plan.js and milestones.js.

### Pattern 3: Success Criteria Derivation

**What:** How the system determines what to verify for a milestone.

The locked decision says "each milestone's success criteria become structured checkboxes with pass/fail and evidence." The question is: where do success criteria come from?

**Approach -- three sources, layered:**

1. **Programmatic (automatic):** For each action with a `produces` field that `looksLikeFilePath()`, check if the file exists. This is the existing `verify-wave` pattern, elevated to milestone scope.

2. **Test-based (automatic):** If the project has a test runner and tests exist, run them. Check that tests related to the milestone's scope still pass. Use `child_process.execFileSync` to run `npm test` or similar, capture exit code.

3. **AI assessment (semantic):** The slash command evaluates whether the milestone title ("X is true") actually holds given the completed work. This is the existing AI review from Phase 4's verify-wave, elevated to milestone-level truth assessment.

**Concretely for `verify-milestone` CJS subcommand:**

The CJS layer handles checks 1 and 2 (deterministic, scriptable). It returns structured results. The slash command handles check 3 (AI assessment requiring LLM reasoning).

```javascript
// verify-milestone returns:
{
  milestoneId: "M-01",
  milestoneTitle: "Authentication system works end-to-end",
  criteria: [
    { id: "SC-01", type: "artifact", description: "src/auth.js exists", passed: true, evidence: "File found at src/auth.js (247 lines)" },
    { id: "SC-02", type: "artifact", description: "src/auth.test.js exists", passed: true, evidence: "File found at src/auth.test.js (89 lines)" },
    { id: "SC-03", type: "test", description: "Tests pass", passed: false, evidence: "npm test exited with code 1: 2 failures in auth.test.js" },
    { id: "SC-04", type: "ai", description: "Milestone truth assessment", passed: null, evidence: null }  // deferred to slash command
  ],
  programmaticPassed: false,
  aiAssessmentNeeded: true,
  traceContext: { declarations: [...], whyChain: "..." }
}
```

**Confidence:** HIGH for artifact checks (existing pattern), MEDIUM for test execution (depends on project setup).

### Pattern 4: Remediation Action Derivation

**What:** When verification fails, how the system derives new actions to close the gap.

**This is a Claude's Discretion area.** Recommendation:

The remediation flow runs entirely within the `/declare:execute` slash command (not in CJS). Given the verification failure details, the slash command:

1. **Analyzes failure evidence:** Reads which criteria failed and their evidence strings.
2. **Derives remediation actions:** Uses AI reasoning to determine what needs to be done. Each remediation action gets the same structure as regular PLAN.md actions: ID, title, status, produces, description.
3. **Writes remediation actions to PLAN.md:** Appends new action sections to the milestone's PLAN.md with IDs continuing from the highest existing action ID.
4. **Generates exec plans:** Calls `generate-exec-plan` for each new remediation action.
5. **Executes remediation:** Spawns executor agents for the remediation actions (same as normal execution).
6. **Re-verifies:** Runs `verify-milestone` again after remediation completes.

This means remediation actions are first-class graph nodes -- they appear in the DAG, have trace context, and are tracked in the same way as original actions. The difference is they're derived during execution, not during planning.

**Key design point:** Remediation actions are added to PLAN.md with a marker indicating they're remediation-derived (e.g., `**Derived:** remediation` instead of a date). This makes the audit trail clear.

**Confidence:** MEDIUM -- remediation quality depends on AI reasoning capability and failure evidence quality.

### Pattern 5: Integration with /declare:execute

**What:** How Phase 5 modifies the existing execution flow.

The existing `/declare:execute` flow (from Phase 4):
```
Step 1: Determine milestone scope
Step 2: Load execution data
Step 3: For each wave, execute actions
  3a. Generate exec plans
  3b. Display wave banner
  3c. Spawn executor agents
  3d. Verify wave (verify-wave CJS)
  3e. Update action statuses
Step 4: Check milestone completion -> mark DONE
```

Phase 5 inserts after Step 4:
```
Step 5: Milestone truth verification
  5a. Run verify-milestone CJS for programmatic checks
  5b. AI assessment of milestone truth
  5c. Compile results into VERIFICATION.md
  5d. If all criteria pass -> mark KEPT, write VERIFICATION.md, done
  5e. If criteria fail -> mark BROKEN, enter remediation loop

Step 6: Remediation loop (max 2 attempts)
  6a. Derive remediation actions from failure evidence
  6b. Append to PLAN.md, add to DAG
  6c. Generate exec plans for remediation actions
  6d. Execute remediation actions (spawn agents)
  6e. Re-verify (back to Step 5)
  6f. If pass -> mark HONORED, update VERIFICATION.md
  6g. If still failing after 2 attempts -> escalation

Step 7: Escalation
  7a. Produce diagnosis report
  7b. Present to user with suggestions
  7c. User adjusts milestone or criteria
  7d. System retries verification -> if passes, mark RENEGOTIATED
```

**Integration approach:** Rather than modifying the execute.md file in-place during Phase 5, the cleaner pattern is to create a verification section that the execute slash command invokes after all waves complete. This keeps the wave-execution logic untouched and adds integrity as a post-execution layer.

**Confidence:** HIGH -- directly extends the existing slash command flow.

### Anti-Patterns to Avoid

- **Separate /declare:verify command:** The locked decision is that verification runs inline during execution. Creating a standalone verify command splits the flow and allows users to skip verification.
- **System-level INTEGRITY.md:** The locked decision is per-milestone VERIFICATION.md. A single aggregation file would duplicate data and drift from source-of-truth per-milestone files. Aggregate view comes from `/declare:status`.
- **Punitive language in verification output:** Per INTG-03, never frame failures as judgment. Use "criterion not yet met" not "criterion failed." Use "remediation needed" not "milestone broken." The BROKEN state name is internal; user-facing messaging should be restoration-focused.
- **Remediation without DAG awareness:** Remediation actions must be added to the PLAN.md and DAG, not executed as ad-hoc tasks. This ensures trace context and audit trail.
- **Blocking on AI assessment when programmatic checks fail:** If files don't exist or tests fail, there's no point asking AI to assess truth. Programmatic failures are definitive -- skip AI assessment and go straight to remediation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph traversal for affected nodes | Manual parent/child walks | `dag.getUpstream(milestoneId)` | Already handles multi-edge scenarios |
| File existence checks | Custom file check logic | `existsSync` + `looksLikeFilePath()` | Proven heuristic from verify-wave |
| Milestone folder lookup | Manual path construction | `findMilestoneFolder()` | Handles slug lookup correctly |
| Action ID generation | Manual counter | `dag.nextId('action')` | Handles gaps and maintains format |
| Why-chain for remediation context | Manual path building | `traceUpward()` + `buildWhyChain()` | Proven in exec-plan.js |
| Markdown table I/O for milestones | Regex parsing | `parseMilestonesFile()` / `writeMilestonesFile()` | Aligned-column output, permissive parsing |
| Test execution | Inline exec | `child_process.execFileSync('npm', ['test'])` | Standard Node.js pattern, captures exit code and output |

**Key insight:** Phase 5's new code is primarily verification logic and remediation orchestration. The graph operations, file I/O, plan generation, and agent spawning are all solved by phases 1-4.

## Common Pitfalls

### Pitfall 1: Success Criteria Ambiguity

**What goes wrong:** Milestones like "authentication works" are too vague for programmatic verification. Every milestone fails at AI assessment because there's no concrete definition of "works."

**Why it happens:** Milestone titles are written as truth statements but don't specify measurable criteria.

**How to avoid:** The `verify-milestone` CJS command should extract concrete criteria from action `produces` fields (file existence) and any test files. The AI assessment layer handles the semantic gap but should be conservative -- if all programmatic checks pass and actions completed, the AI should lean toward PASS unless there's clear evidence of a gap.

**Warning signs:** Every milestone requires remediation because AI assessment is too strict.

### Pitfall 2: Remediation Loop Explosion

**What goes wrong:** Each remediation attempt creates more actions, which themselves fail verification, creating an expanding loop that hits the 2-attempt limit with more broken state than when it started.

**Why it happens:** Poorly scoped remediation actions that introduce new failures rather than fixing existing ones.

**How to avoid:** Remediation actions should be narrowly targeted at the specific failing criterion, not broad rewrites. The remediation prompt should explicitly state: "Fix ONLY the failing criterion. Do not modify code that already passes verification."

**Warning signs:** Remediation attempt 2 has more failing criteria than attempt 1.

### Pitfall 3: VERIFICATION.md Write Conflicts

**What goes wrong:** Multiple verification attempts overwrite the history section instead of appending to it.

**Why it happens:** Using `Write` tool to replace entire file content instead of reading first, appending the new attempt, then writing.

**How to avoid:** The verification.js artifact module should have an `appendAttempt()` function that reads existing content, appends a new attempt section, and writes back. The header metadata (current state, last verified, attempt count) is updated in place, but the history section is append-only.

**Warning signs:** VERIFICATION.md has only the latest attempt, missing previous attempts.

### Pitfall 4: Status Update Inconsistency Between Artifacts

**What goes wrong:** MILESTONES.md says KEPT but the milestone folder's VERIFICATION.md says BROKEN, or the DAG in memory has a different state than what's on disk.

**Why it happens:** Updating one artifact but forgetting the other, or not rebuilding the DAG after writes.

**How to avoid:** Status transitions must update both: (1) MILESTONES.md via `parseMilestonesFile()` / `writeMilestonesFile()`, and (2) VERIFICATION.md header. Both writes should happen in a single atomic commit. The CJS layer handles the MILESTONES.md update; the slash command handles VERIFICATION.md writing.

**Warning signs:** `/declare:status` shows inconsistent states between milestones table and verification files.

### Pitfall 5: Engine.js VALID_STATUSES Breaking Backward Compatibility

**What goes wrong:** Adding new statuses to `VALID_STATUSES` causes `addNode()` to reject nodes loaded from disk that have old statuses, or new statuses that Phase 4 code doesn't understand.

**Why it happens:** Phase 4's execution code uses status comparisons like `a.status === 'DONE'` and `a.status !== 'DONE'` which still work fine with new statuses. But if MILESTONES.md has a KEPT milestone and code filters `m.status === 'PENDING'`, the KEPT milestone is correctly excluded.

**How to avoid:** New statuses are supersets of DONE -- they all mean "actions completed." Any code that checks for "is this done?" should use a set: `['DONE', 'KEPT', 'HONORED', 'RENEGOTIATED'].includes(status)` or a helper function `isCompleted(status)`. Add this helper to engine.js.

**Warning signs:** After adding integrity statuses, milestones with KEPT status don't appear as completed in wave computations.

## Code Examples

### Example 1: verify-milestone CJS Subcommand

```javascript
// src/commands/verify-milestone.js
const { existsSync, statSync, readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');
const { parsePlanFile } = require('../artifacts/plan');
const { traceUpward } = require('./trace');

function looksLikeFilePath(produces) {
  if (!produces || produces.trim() === '') return false;
  return /[/\\]/.test(produces) || /\.\w{1,10}$/.test(produces);
}

function runVerifyMilestone(cwd, args) {
  const milestoneId = parseFlag(args, 'milestone');
  if (!milestoneId) {
    return { error: 'Missing --milestone flag. Usage: verify-milestone --milestone M-XX' };
  }

  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;
  const { dag } = graphResult;

  const milestone = dag.getNode(milestoneId);
  if (!milestone) return { error: `Milestone not found: ${milestoneId}` };

  const planningDir = join(cwd, '.planning');
  const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
  if (!milestoneFolder) return { error: `Milestone folder not found for ${milestoneId}` };

  // Load PLAN.md for action produces fields
  const planPath = join(milestoneFolder, 'PLAN.md');
  const planContent = existsSync(planPath) ? readFileSync(planPath, 'utf-8') : '';
  const { actions } = parsePlanFile(planContent);

  const criteria = [];
  let scCounter = 1;

  // Criterion type: artifact -- check each action's produces
  for (const action of actions) {
    if (looksLikeFilePath(action.produces)) {
      const filePath = resolve(cwd, action.produces);
      const exists = existsSync(filePath);
      let evidence = exists ? `File found at ${action.produces}` : `File not found at ${action.produces}`;
      if (exists) {
        try {
          const stat = statSync(filePath);
          evidence += ` (${stat.size} bytes)`;
        } catch { /* ok */ }
      }
      criteria.push({
        id: `SC-${String(scCounter).padStart(2, '0')}`,
        type: 'artifact',
        source: action.id,
        description: `${action.produces} exists`,
        passed: exists,
        evidence,
      });
      scCounter++;
    }
  }

  // Criterion type: test -- run npm test if package.json exists
  const packageJsonPath = join(cwd, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.scripts && pkg.scripts.test) {
        try {
          const output = execFileSync('npm', ['test'], {
            cwd, encoding: 'utf-8', timeout: 60000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          criteria.push({
            id: `SC-${String(scCounter).padStart(2, '0')}`,
            type: 'test',
            source: 'npm test',
            description: 'All tests pass',
            passed: true,
            evidence: 'npm test exited with code 0',
          });
        } catch (err) {
          criteria.push({
            id: `SC-${String(scCounter).padStart(2, '0')}`,
            type: 'test',
            source: 'npm test',
            description: 'All tests pass',
            passed: false,
            evidence: `npm test exited with code ${err.status}: ${(err.stderr || '').substring(0, 500)}`,
          });
        }
        scCounter++;
      }
    } catch { /* invalid package.json */ }
  }

  // Criterion type: ai -- placeholder for slash command to fill
  criteria.push({
    id: `SC-${String(scCounter).padStart(2, '0')}`,
    type: 'ai',
    source: 'ai-assessment',
    description: `Milestone "${milestone.title}" truth assessment`,
    passed: null,   // deferred to slash command
    evidence: null,  // filled by AI review
  });

  // Build trace context for AI review
  const paths = traceUpward(dag, milestoneId);
  const declMap = new Map();
  for (const path of paths) {
    for (const node of path) {
      if (node.type === 'declaration') declMap.set(node.id, node.title);
    }
  }
  const declarations = [...declMap.entries()].map(([id, title]) => ({ id, title }));

  const programmaticCriteria = criteria.filter(c => c.type !== 'ai');
  const programmaticPassed = programmaticCriteria.every(c => c.passed);

  return {
    milestoneId,
    milestoneTitle: milestone.title,
    milestoneFolder,
    criteria,
    programmaticPassed,
    aiAssessmentNeeded: true,
    traceContext: {
      declarations,
      whyChain: declarations.length > 0
        ? `${milestoneId} ("${milestone.title}") realizes ${declarations.map(d => `${d.id}: ${d.title}`).join(', ')}`
        : `${milestoneId} ("${milestone.title}")`,
    },
  };
}
```

Source: Pattern derived from existing `runVerifyWave()` in `/Users/guilherme/Projects/get-shit-done/src/commands/verify-wave.js`.

### Example 2: VERIFICATION.md Artifact Module

```javascript
// src/artifacts/verification.js
'use strict';

/**
 * Parse a VERIFICATION.md file.
 * @param {string} content
 * @returns {{ milestoneId: string|null, state: string, lastVerified: string, attempts: number, criteria: Array, history: Array }}
 */
function parseVerificationFile(content) {
  if (!content || !content.trim()) {
    return { milestoneId: null, state: 'PENDING', lastVerified: '', attempts: 0, criteria: [], history: [] };
  }

  // Extract header fields
  const milestoneMatch = content.match(/^\*\*Milestone:\*\*\s*(M-\d+)/m);
  const stateMatch = content.match(/^\*\*Current State:\*\*\s*(\w+)/m);
  const lastVerifiedMatch = content.match(/^\*\*Last Verified:\*\*\s*(.+)/m);
  const attemptsMatch = content.match(/^\*\*Attempts:\*\*\s*(\d+)/m);

  // Extract criteria checkboxes
  const criteriaSection = content.match(/## Success Criteria\n([\s\S]*?)(?=## |$)/);
  const criteria = [];
  if (criteriaSection) {
    const checkboxPattern = /- \[([ x])\] \*\*(SC-\d+):\*\* (.+?) -- (PASS|FAIL)\n\s+Evidence: (.+)/g;
    let match;
    while ((match = checkboxPattern.exec(criteriaSection[1])) !== null) {
      criteria.push({
        id: match[2],
        passed: match[1] === 'x',
        description: match[3],
        result: match[4],
        evidence: match[5].trim(),
      });
    }
  }

  return {
    milestoneId: milestoneMatch ? milestoneMatch[1] : null,
    state: stateMatch ? stateMatch[1] : 'PENDING',
    lastVerified: lastVerifiedMatch ? lastVerifiedMatch[1].trim() : '',
    attempts: attemptsMatch ? parseInt(attemptsMatch[1], 10) : 0,
    criteria,
    history: [],  // history parsing can be added if needed
  };
}

/**
 * Write a VERIFICATION.md file.
 * @param {string} milestoneId
 * @param {string} milestoneTitle
 * @param {string} state
 * @param {Array} criteria
 * @param {Array} history
 * @returns {string}
 */
function writeVerificationFile(milestoneId, milestoneTitle, state, criteria, history) {
  const now = new Date().toISOString();
  const lines = [
    `# Verification: ${milestoneId} -- ${milestoneTitle}`,
    '',
    `**Milestone:** ${milestoneId}`,
    `**Current State:** ${state}`,
    `**Last Verified:** ${now}`,
    `**Attempts:** ${history.length}`,
    '',
    '## Success Criteria',
    '',
  ];

  for (const c of criteria) {
    const checkbox = c.passed ? 'x' : ' ';
    const result = c.passed ? 'PASS' : 'FAIL';
    lines.push(`- [${checkbox}] **${c.id}:** ${c.description} -- ${result}`);
    lines.push(`  Evidence: ${c.evidence || 'No evidence collected'}`);
    if (c.remediation) {
      lines.push(`  Remediation: ${c.remediation}`);
    }
  }

  lines.push('', '## Verification History', '');

  for (const attempt of history) {
    const passedCount = attempt.checks.filter(c => c.passed).length;
    const totalCount = attempt.checks.length;
    lines.push(`### Attempt ${attempt.number} -- ${attempt.timestamp}`);
    lines.push(`**Result:** ${attempt.passed ? 'PASS' : 'FAIL'} (${passedCount}/${totalCount} criteria passed)`);
    lines.push('**Checks:**');
    for (const check of attempt.checks) {
      const cb = check.passed ? 'x' : ' ';
      lines.push(`- [${cb}] ${check.id}: ${check.description} -- ${check.passed ? 'PASS' : 'FAIL'} (${check.evidence})`);
    }
    if (attempt.remediationTriggered) {
      lines.push(`**Remediation triggered:** Yes`);
      lines.push(`**Actions derived:** ${attempt.remediationActions.join(', ')}`);
    }
    if (attempt.stateTransition) {
      lines.push(`**State transition:** ${attempt.stateTransition}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { parseVerificationFile, writeVerificationFile };
```

Source: Pattern derived from existing `parsePlanFile()` / `writePlanFile()` in `/Users/guilherme/Projects/get-shit-done/src/artifacts/plan.js`.

### Example 3: isCompleted Helper for Engine.js

```javascript
// Addition to src/graph/engine.js

const COMPLETED_STATUSES = new Set(['DONE', 'KEPT', 'HONORED', 'RENEGOTIATED']);

/**
 * Check if a status represents a completed milestone.
 * @param {string} status
 * @returns {boolean}
 */
function isCompleted(status) {
  return COMPLETED_STATUSES.has(status);
}
```

This helper must be used in every place that currently checks `status === 'DONE'`:
- `compute-waves.js` line 45: `n.status !== 'DONE'` -> `!isCompleted(n.status)`
- `execute.js` line 73: `a.status !== 'DONE'` -> `!isCompleted(a.status)`
- `verify-wave.js` line 114: `a.status === 'DONE'` -> `isCompleted(a.status)`
- `status.js` line 61: `a.status === 'DONE'` -> `isCompleted(a.status)`
- `status.js` line 64: `m.status === 'DONE'` -> `isCompleted(m.status)`

### Example 4: Remediation Loop in Slash Command (pseudo-flow)

```
After Step 4 of existing /declare:execute (milestone marked DONE):

Step 5: Verify milestone truth.

Run: node dist/declare-tools.cjs verify-milestone --milestone M-XX

If programmaticPassed is false OR AI assessment determines truth doesn't hold:
  - Update MILESTONES.md status to BROKEN
  - Write initial VERIFICATION.md with attempt 1

  Remediation loop (max 2):
    - Analyze failing criteria
    - Derive remediation actions (AI reasoning):
      "Given these failures: [evidence], derive 1-3 targeted actions to fix them.
       Each action should fix exactly one failing criterion.
       Do not modify code that already passes verification."
    - Append remediation actions to PLAN.md
    - Run: node dist/declare-tools.cjs add-action for each
    - Generate exec plans for remediation actions
    - Execute remediation actions (same agent spawning pattern)
    - Re-run verify-milestone
    - If passes: mark HONORED, update VERIFICATION.md
    - If fails: try again (or escalate after 2 attempts)

  Escalation:
    Display diagnosis report:
    "## Verification Failed for M-XX after 2 remediation attempts

    What was tried:
    - Attempt 1: [actions] -> [still failing criteria]
    - Attempt 2: [actions] -> [still failing criteria]

    Suggestions:
    - Consider narrowing criterion SC-02 to [specific scope]
    - This test may need [specific setup]

    Would you like to:
    1. Adjust the milestone statement or criteria, then retry
    2. Accept current state and continue"

    If user adjusts and retries pass: mark RENEGOTIATED

If all criteria pass on first attempt:
  - Mark KEPT
  - Write VERIFICATION.md with single successful attempt
  - Display: "Milestone M-XX verified as KEPT -- [title] is true"
```

## Discretion Recommendations

### Milestone State Vocabulary: Hybrid (Recommended)

As detailed in Pattern 1 above. Extends existing PENDING/ACTIVE/DONE with KEPT/BROKEN/HONORED/RENEGOTIATED. Preserves backward compatibility, maps to INTG-01 cleanly.

### VERIFICATION.md Format: Structured Checklist (Recommended)

As detailed in Pattern 2 above. Checkbox format with evidence strings, append-only history. Human-readable, git-diffable, parseable.

### Remediation Action Derivation: AI-Driven with Guardrails (Recommended)

The slash command uses AI reasoning to derive remediation actions, but with explicit guardrails:
1. Maximum 3 remediation actions per attempt (prevents scope creep)
2. Each action must target a specific failing criterion
3. Actions must not modify already-passing code
4. Actions get the same structure as regular PLAN.md actions

### Programmatic Check Implementation: Conservative (Recommended)

Only check what can be checked deterministically:
1. File existence for `produces` fields that look like file paths (existing heuristic)
2. Test suite execution if `npm test` script exists
3. Everything else deferred to AI assessment

Don't try to parse file contents for correctness, don't try to evaluate code quality programmatically. Those are AI assessment tasks.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 4 two-layer verify-wave | Phase 5 verify-milestone with success criteria checklist | Phase 5 | Verification elevated from "did actions complete?" to "is the milestone true?" |
| MILESTONES.md status DONE as terminal | DONE as intermediate, KEPT/HONORED/RENEGOTIATED as terminal | Phase 5 | Milestone lifecycle continues past action completion into truth verification |
| No remediation on failure | Auto-remediation with 2-attempt limit | Phase 5 | System actively works to make milestones true, not just report failures |
| No verification history | Per-milestone VERIFICATION.md with attempt log | Phase 5 | Full audit trail of what was checked, what failed, what was tried |

## Open Questions

1. **How does verify-milestone relate to verify-wave?**
   - What we know: Phase 4's `verify-wave` checks per-wave action completion. Phase 5's `verify-milestone` checks whether the milestone truth holds after all actions complete.
   - What's unclear: Should `verify-milestone` replace `verify-wave`, or do both coexist? They check different things at different scopes.
   - Recommendation: Both coexist. `verify-wave` continues to check action-level artifact existence per wave (quick sanity check during execution). `verify-milestone` runs once after all waves complete and checks milestone-level truth (the integrity check). Different purposes, different timing.

2. **Should the DAG enforce the new state machine transitions?**
   - What we know: Currently `updateNodeStatus()` in engine.js accepts any valid status. It doesn't enforce transitions (e.g., can go from PENDING directly to KEPT).
   - What's unclear: Should the engine validate state transitions (e.g., BROKEN can only transition to HONORED or RENEGOTIATED)?
   - Recommendation: Don't enforce in engine.js. The state machine is a convention, not a constraint. The orchestration logic (slash command) follows the transitions. Enforcing in the engine would make testing harder and couple the engine to business logic. Document the valid transitions in comments.

3. **How to handle milestones with no produces fields?**
   - What we know: Some actions have descriptive `produces` fields (not file paths). These auto-pass the artifact existence check.
   - What's unclear: If all actions have descriptive produces, the only programmatic check is the test suite. If there's no test suite either, verification relies entirely on AI assessment.
   - Recommendation: This is acceptable. AI assessment is the backstop. The system should note in VERIFICATION.md when verification was "AI-only" (no programmatic checks applicable). This makes it transparent.

4. **Should status command show integrity summary?**
   - What we know: `/declare:status` currently shows graph stats, validation, staleness, coverage. Phase 5 adds VERIFICATION.md files.
   - What's unclear: Should status aggregate integrity across all milestones?
   - Recommendation: Yes. Add an integrity summary to status output: how many milestones are KEPT vs BROKEN vs HONORED. This satisfies INTG-01's "visible state" requirement without a system-level INTEGRITY.md file. The locked decision says "aggregate view handled by /declare:status."

5. **How does `add-action` CJS command interact with remediation?**
   - What we know: Remediation derives new actions and appends them to PLAN.md. The existing `add-action` command modifies the PLAN.md in the milestone folder.
   - What's unclear: Should remediation use `add-action` or directly write to PLAN.md?
   - Recommendation: Use the existing `add-action` CJS command for remediation actions. This keeps them as first-class graph nodes, maintains consistent IDs, and ensures `load-graph` picks them up. The slash command calls `node dist/declare-tools.cjs add-action --title "..." --causes M-XX --produces "..."` for each remediation action.

## Sources

### Primary (HIGH confidence)

- `/Users/guilherme/Projects/get-shit-done/src/graph/engine.js` -- DeclareDag class, VALID_STATUSES set, updateNodeStatus(), getUpstream(), getDownstream()
- `/Users/guilherme/Projects/get-shit-done/src/commands/verify-wave.js` -- Existing two-layer verification pattern, looksLikeFilePath() heuristic
- `/Users/guilherme/Projects/get-shit-done/src/commands/execute.js` -- Current execution data provider, milestone picker, wave structure
- `/Users/guilherme/Projects/get-shit-done/src/commands/build-dag.js` -- Graph loading from disk, loadActionsFromFolders()
- `/Users/guilherme/Projects/get-shit-done/src/artifacts/plan.js` -- parsePlanFile(), writePlanFile() patterns for new artifact module
- `/Users/guilherme/Projects/get-shit-done/src/artifacts/milestones.js` -- parseMilestonesFile(), writeMilestonesFile() for status updates
- `/Users/guilherme/Projects/get-shit-done/src/artifacts/milestone-folders.js` -- findMilestoneFolder() for VERIFICATION.md placement
- `/Users/guilherme/Projects/get-shit-done/src/declare-tools.js` -- CLI dispatch pattern for new verify-milestone subcommand
- `/Users/guilherme/Projects/get-shit-done/.claude/commands/declare/execute.md` -- Current execution slash command flow to extend
- `/Users/guilherme/Projects/get-shit-done/.planning/phases/04-execution-pipeline/04-RESEARCH.md` -- Phase 4 research establishing verify-wave pattern
- `/Users/guilherme/Projects/get-shit-done/.planning/phases/05-integrity-system/05-CONTEXT.md` -- User decisions and discretion areas

### Secondary (MEDIUM confidence)

- `/Users/guilherme/Projects/get-shit-done/.planning/REQUIREMENTS.md` -- INTG-01 through INTG-03 requirement definitions
- `/Users/guilherme/Projects/get-shit-done/.planning/ROADMAP.md` -- Phase 5 description and success criteria
- `/Users/guilherme/Projects/get-shit-done/src/commands/status.js` -- detectStaleness() pattern for integrity aggregation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all internal, zero external dependencies, verified against existing codebase
- Architecture: HIGH -- patterns directly extend Phase 4's verification with clearly defined insertion points
- State vocabulary: HIGH -- clean extension of existing VALID_STATUSES, backward compatible
- VERIFICATION.md format: HIGH -- follows established artifact module patterns (plan.js, milestones.js)
- Remediation flow: MEDIUM -- AI-driven derivation quality depends on failure evidence and prompt engineering
- Pitfalls: HIGH -- identified from concrete code analysis of status check sites and write patterns

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- internal codebase, no external dependency churn)
