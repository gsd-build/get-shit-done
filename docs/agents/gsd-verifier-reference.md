# gsd-verifier.md — Deep Reference Documentation

## Metadata
| Attribute | Value |
|-----------|-------|
| **Type** | Agent |
| **Location** | `agents/gsd-verifier.md` |
| **Size** | 778 lines |
| **Documentation Tier** | Deep Reference |
| **Complexity Score** | 3+3+3+3 = **12** |

### Complexity Breakdown
- **Centrality: 3** — Spawned after phase execution; output triggers gap closure or phase completion
- **Complexity: 3** — 4-level verification hierarchy (existence→substantive→wired→functional), truth vs artifact distinction, re-verification mode
- **Failure Impact: 3** — Missed gaps = broken features ship; false positives = unnecessary rework
- **Novelty: 3** — Goal-backward verification is core GSD innovation; programmatic stub detection is unique

---

## Purpose
The GSD Verifier verifies that a phase achieved its GOAL, not just completed its TASKS. It performs goal-backward verification: starting from what the phase SHOULD deliver, it verifies what ACTUALLY exists in the code. This catches the gap between "Claude said it did X" and "X actually works."

**Critical mindset:** Do NOT trust SUMMARY.md claims. SUMMARYs document what Claude SAID it did. The verifier checks what ACTUALLY exists. These often differ.

**Key innovation:** Three-level artifact verification (exists → substantive → wired) catches stubs that file existence checks miss.

---

## Critical Behaviors

### Constraints Enforced
| Constraint | Rule | Consequence if Violated | Source Section |
|------------|------|------------------------|----------------|
| Trust nothing | Verify code, not claims | Ship broken features | `<role>`, `<critical_rules>` |
| Three-level verification | Check existence, substantive, wired | Miss stubs and orphaned code | `<verification_process>` Step 4 |
| Structured gap output | YAML frontmatter for gaps | Planner can't create fix plans | `<verification_process>` Step 10 |
| No commits | Leave committing to orchestrator | Premature state changes | `<critical_rules>` |
| Human verification flagged | Can't verify = say so | Silent false positives | `<verification_process>` Step 8 |

### Numeric Limits
| Limit | Value | Rationale |
|-------|-------|-----------|
| Observable truths | 3-7 per goal | Adequate coverage without over-specification |
| Minimum lines (component) | 15+ | Below = likely stub |
| Minimum lines (API route) | 10+ | Below = likely stub |
| Minimum lines (hook/util) | 10+ | Below = likely stub |
| Minimum lines (schema model) | 5+ | Below = likely stub |

---

## Operational Modes

### Mode 1: Initial Verification
- **Trigger:** No previous VERIFICATION.md exists (or no `gaps:` section)
- **Input:** PLAN.md files, SUMMARY.md files, phase goal from ROADMAP.md
- **Process:**
  1. Load context (plans, summaries, phase goal)
  2. Establish must-haves (from frontmatter or derive)
  3. Verify observable truths
  4. Verify artifacts (3 levels)
  5. Verify key links (wiring)
  6. Check requirements coverage
  7. Scan for anti-patterns
  8. Identify human verification needs
  9. Determine overall status
  10. Structure gap output (if gaps found)
- **Output:** VERIFICATION.md with status (passed/gaps_found/human_needed)
- **Key difference:** Full verification from scratch

### Mode 2: Re-Verification
- **Trigger:** Previous VERIFICATION.md exists with `gaps:` section
- **Input:** Previous VERIFICATION.md, updated code state
- **Process:**
  1. Parse previous VERIFICATION.md frontmatter
  2. Extract must_haves and gaps
  3. Set `is_re_verification = true`
  4. **Skip to Step 3** with optimization:
     - Failed items: Full 3-level verification
     - Passed items: Quick regression check only
  5. Detect regressions (items that passed before but now fail)
  6. Report closed gaps, remaining gaps, regressions
- **Output:** VERIFICATION.md with re_verification metadata
- **Key difference:** Focused verification on previously failed items

---

## Mechanism

### Execution Flow (10 Steps)
```
Step 0: Check for Previous Verification
├── Look for existing VERIFICATION.md
├── If has gaps: section → RE-VERIFICATION MODE
│   ├── Parse must_haves and gaps
│   └── Skip to Step 3 with optimization
└── If no gaps → INITIAL MODE, proceed with Step 1

Step 1: Load Context [Initial Mode Only]
├── List PLAN.md and SUMMARY.md files in phase directory
├── Extract phase goal from ROADMAP.md
└── Get requirements mapped to this phase

Step 2: Establish Must-Haves [Initial Mode Only]
├── Option A: Extract from PLAN.md frontmatter
└── Option B: Derive using goal-backward process
    ├── State the goal
    ├── Derive truths (3-7, user perspective)
    ├── Derive artifacts (specific files)
    └── Derive key links (critical connections)

Step 3: Verify Observable Truths
├── For each truth, identify supporting artifacts
├── Check artifact status (Step 4)
├── Check wiring status (Step 5)
└── Determine truth status: ✓ VERIFIED | ✗ FAILED | ? UNCERTAIN

Step 4: Verify Artifacts (Three Levels)
├── Level 1: Existence → file exists?
├── Level 2: Substantive → real implementation, not stub?
└── Level 3: Wired → imported and used?

Step 5: Verify Key Links (Wiring)
├── Component → API (fetch/axios call)
├── API → Database (Prisma/query)
├── Form → Handler (onSubmit implementation)
└── State → Render (displayed in JSX)

Step 6: Check Requirements Coverage
├── For each requirement mapped to phase
├── Identify which truths/artifacts support it
└── Status: ✓ SATISFIED | ✗ BLOCKED | ? NEEDS HUMAN

Step 7: Scan for Anti-Patterns
├── Extract files modified in phase (from SUMMARY.md)
├── Run anti-pattern detection (TODO, FIXME, placeholder)
└── Categorize: Blocker | Warning | Info

Step 8: Identify Human Verification Needs
├── Visual appearance, user flows, real-time behavior
├── External service integration, performance feel
└── Format for human verification with steps/expected

Step 9: Determine Overall Status
├── passed: All truths verified, no blockers
├── gaps_found: Failed truths, missing/stub artifacts, broken links
└── human_needed: Automated checks pass, but needs human testing

Step 10: Structure Gap Output [If Gaps Found]
└── YAML frontmatter with structured gaps for planner
```

### 4-Level Verification Hierarchy

| Level | Question | Check Method | Pass Criteria |
|-------|----------|--------------|---------------|
| **1. Existence** | Does file exist? | `[ -f "$path" ]` | File present on disk |
| **2. Substantive** | Is it real implementation? | Line count + stub patterns + exports | Adequate lines, no stubs, has exports |
| **3. Wired** | Is it connected to system? | Import/usage grep | Imported AND used elsewhere |
| **4. Functional** | Does it work correctly? | Human testing | Behavior matches expectation |

### Artifact Verification Matrix

| Exists | Substantive | Wired | Final Status |
|--------|-------------|-------|--------------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |

### Substantive Check Details
```bash
# Line count check
check_length() {
  local lines=$(wc -l < "$path")
  [ "$lines" -ge "$min_lines" ] && echo "SUBSTANTIVE" || echo "THIN"
}

# Stub pattern check
check_stubs() {
  grep -c -E "TODO|FIXME|placeholder|not implemented|coming soon" "$path"
  grep -c -E "return null|return undefined|return \{\}|return \[\]" "$path"
  grep -c -E "will be here|placeholder|lorem ipsum" "$path"
}

# Export check
check_exports() {
  grep -E "^export (default )?(function|const|class)" "$path"
}
```

### Key Link Verification Patterns

| Pattern | Check | Evidence of Wiring |
|---------|-------|-------------------|
| Component → API | `grep "fetch.*api/path\|axios.*api/path"` | API call + response handling |
| API → Database | `grep "prisma\.$model\|db\.$model"` | Query + result returned |
| Form → Handler | `grep "onSubmit=\|handleSubmit"` | Handler has real implementation (not just preventDefault) |
| State → Render | `grep "\{.*$state_var.*\}"` | State variable used in JSX |

### Stub Detection Patterns

**Universal:**
```bash
grep -E "(TODO|FIXME|XXX|HACK|PLACEHOLDER)" "$file"
grep -E "implement|add later|coming soon|will be" "$file" -i
grep -E "placeholder|lorem ipsum|under construction" "$file" -i
grep -E "return null|return undefined|return \{\}|return \[\]" "$file"
```

**React Components:**
```javascript
// RED FLAGS:
return <div>Component</div>
return <div>Placeholder</div>
return null
onClick={() => {}}
onChange={() => console.log('clicked')}
onSubmit={(e) => e.preventDefault()}  // Only prevents default
```

**API Routes:**
```typescript
// RED FLAGS:
export async function POST() {
  return Response.json({ message: "Not implemented" });
}
export async function GET() {
  return Response.json([]);  // Empty with no DB query
}
```

**Wiring Red Flags:**
```typescript
fetch('/api/messages')  // No await, no assignment
await prisma.message.findMany()
return Response.json({ ok: true })  // Returns static, not query result
const [messages, setMessages] = useState([])
return <div>No messages</div>  // Always shows static text
```

---

## Interactions

### Reads
| File | What It Uses | Why |
|------|--------------|-----|
| `.planning/phases/XX-*/*-PLAN.md` | must_haves in frontmatter | What to verify |
| `.planning/phases/XX-*/*-SUMMARY.md` | Claims, files modified | What was claimed |
| `.planning/ROADMAP.md` | Phase goal | Verification target |
| `.planning/REQUIREMENTS.md` | Requirements mapped to phase | Coverage check |
| Previous VERIFICATION.md | Prior gaps (re-verification) | Focus verification |
| Source code files | Actual implementations | Truth verification |
| `get-shit-done/workflows/verify-phase.md` | Verification flow + required reading | Orchestrates verification steps |
| `get-shit-done/templates/verification-report.md` | VERIFICATION.md layout | Required report format |
| `get-shit-done/references/verification-patterns.md` | Stub/wiring patterns | Standardized checks |

### Writes
| File | Content | Format |
|------|---------|--------|
| `.planning/phases/{phase_dir}/{phase}-VERIFICATION.md` | Verification report | YAML frontmatter + Markdown |

### Spawned By
| Command/Agent | Mode | Context Provided |
|---------------|------|------------------|
| `/gsd:execute-phase` | Initial | Phase directory, phase goal |
| `/gsd:execute-phase` (after gap closure) | Re-verification | Phase directory, previous VERIFICATION.md exists |

### Output Consumed By
| Consumer | What They Use | How |
|----------|--------------|-----|
| `gsd-planner` (gap closure mode) | `gaps:` in frontmatter | Creates targeted fix plans |
| `execute-phase` orchestrator | Status, score, and recommended fixes | Determines next action |
| User | Human verification items | Manual testing guidance |

---

## Structured Returns

### Verification Complete (Passed)
```markdown
## Verification Complete

**Status:** passed
**Score:** {N}/{M} must-haves verified
**Report:** .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

All must-haves verified. Phase goal achieved. Ready to proceed.
```

### Verification Complete (Gaps Found)
```markdown
## Verification Complete

**Status:** gaps_found
**Score:** {N}/{M} must-haves verified
**Report:** .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

### Gaps Found

{N} gaps blocking goal achievement:

1. **{Truth 1}** — {reason}
   - Missing: {what needs to be added}
2. **{Truth 2}** — {reason}
   - Missing: {what needs to be added}

Structured gaps in VERIFICATION.md frontmatter for `/gsd:plan-phase --gaps`.

### Recommended Fixes

{N} fix plans recommended:

1. {phase}-{next}-PLAN.md: {name}
2. {phase}-{next+1}-PLAN.md: {name}
```

### Verification Complete (Human Needed)
```markdown
## Verification Complete

**Status:** human_needed
**Score:** {N}/{M} must-haves verified
**Report:** .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

### Human Verification Required

{N} items need human testing:

1. **{Test name}** — {what to do}
   - Expected: {what should happen}
2. **{Test name}** — {what to do}
   - Expected: {what should happen}

Automated checks passed. Awaiting human verification.
```

---

## VERIFICATION.md Schema

### Frontmatter
The verification report template includes the core fields below. The verifier may extend the frontmatter with `re_verification`, `gaps`, and `human_verification` when needed.
```yaml
---
phase: XX-name
verified: YYYY-MM-DDTHH:MM:SSZ
status: passed | gaps_found | human_needed
score: N/M must-haves verified

re_verification:  # Only if previous VERIFICATION.md existed
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "Truth that was fixed"
  gaps_remaining: []
  regressions: []

gaps:  # Only if status: gaps_found
  - truth: "Observable truth that failed"
    status: failed
    reason: "Why it failed"
    artifacts:
      - path: "src/path/to/file.tsx"
        issue: "What's wrong with this file"
    missing:
      - "Specific thing to add/fix"
      - "Another specific thing"

human_verification:  # Only if status: human_needed
  - test: "What to do"
    expected: "What should happen"
    why_human: "Why can't verify programmatically"
---
```

### Body Structure
```markdown
# Phase {X}: {Name} Verification Report

**Phase Goal:** {goal from ROADMAP.md}
**Verified:** {timestamp}
**Status:** {status}
**Re-verification:** {Yes — after gap closure | No — initial verification}

## Goal Achievement

### Observable Truths
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | {truth} | ✓ VERIFIED | {evidence} |
| 2 | {truth} | ✗ FAILED | {what's wrong} |

**Score:** {N}/{M} truths verified

### Required Artifacts
| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|

### Key Link Verification
| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|

### Requirements Coverage
| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|

### Anti-Patterns Found
| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|

### Human Verification Required
{Items needing human testing}

### Gaps Summary
{Narrative summary}

### Recommended Fix Plans
{Only if gaps_found}

## Verification Metadata
{Approach, must-have source, automated/human check counts, timing}
```

---

## Anti-Patterns

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| Trust SUMMARY.md claims | "Implemented" doesn't mean "works" | Verify code directly |
| File existence = implementation | Stubs exist as files | Check substantive + wired |
| Skip key link verification | 80% of stubs hide in wiring | Verify all connections |
| Run the application | Slow, not programmatic | Use grep/file checks |
| Commit VERIFICATION.md | Orchestrator handles commits | Write file, don't commit |
| Accept "UNCERTAIN" silently | May hide real gaps | Flag for human verification |

---

## Change Impact Analysis

### If gsd-verifier Changes:

**Upstream Impact (who calls this):**
- `execute-phase` command — May need to handle new status types
- Verification workflow — May need to present new human verification formats

**Downstream Impact (who consumes output):**
- `gsd-planner` (gap closure) — Expects `gaps:` structure in frontmatter
- `execute-phase` orchestrator — Expects status/score and fix plan recommendations when gaps are found
- User — Expects human_verification items in specific format

**Breaking Changes to Watch:**
- Changing gaps YAML structure → breaks planner gap parsing
- Changing status values → breaks orchestrator decision logic
- Changing verification levels → affects what's caught/missed
- Removing re_verification tracking → loses audit trail

---

## Section Index

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| `<role>` | 1-14 | Identity and critical mindset |
| `<core_principle>` | 16-28 | Task completion ≠ goal achievement |
| `<verification_process>` | 30-533 | 10-step verification process |
| `<output>` | 535-666 | VERIFICATION.md creation and return format |
| `<critical_rules>` | 668-685 | Non-negotiable constraints |
| `<stub_detection_patterns>` | 687-759 | Universal and language-specific patterns |
| `<success_criteria>` | 761-778 | Completion checklist |

---

## Quick Reference

```
WHAT:     Goal-backward verification of phase goal achievement
MODES:    Initial, Re-verification
OUTPUT:   .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

CORE RULES:
• Don't trust SUMMARY claims — verify code
• 3 levels: existence → substantive → wired
• Structure gaps in YAML for planner consumption
• Flag human verification needs explicitly
• DO NOT commit — orchestrator handles that

VERIFICATION LEVELS:
1. EXISTS: File on disk
2. SUBSTANTIVE: Real code, not stub (lines + patterns + exports)
3. WIRED: Imported AND used
4. FUNCTIONAL: Works correctly (human testing)

SPAWNED BY: /gsd:execute-phase (verify-phase workflow)
CONSUMED BY: gsd-planner (gap closure), execute-phase orchestrator, user
```
