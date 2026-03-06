# Debug Template

Template for `.planning/debug/[slug].md` — active debug session tracking.

---

## File Template

```markdown
---
status: gathering | investigating | fixing | verifying | awaiting_human_verify | resolved
trigger: "[verbatim user input]"
created: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis: [current theory being tested]
test: [how testing it]
expecting: [what result means if true/false]
next_action: [immediate next step]

## Symptoms
<!-- Written during gathering, then immutable -->

expected: [what should happen]
actual: [what actually happens]
errors: [error messages if any]
reproduction: [how to trigger]
started: [when it broke / always broken]

## Eliminated
<!-- APPEND only - prevents re-investigating after /clear -->

- hypothesis: [theory that was wrong]
  evidence: [what disproved it]
  timestamp: [when eliminated]

## Evidence
<!-- APPEND only - facts discovered during investigation -->

- timestamp: [when found]
  checked: [what was examined]
  found: [what was observed]
  implication: [what this means]

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: [empty until found]
fix: [empty until applied]
verification: [empty until verified]
files_changed: []
```

---

<section_rules>

**Frontmatter (status, trigger, timestamps):**
- `status`: OVERWRITE - reflects current phase
- `trigger`: IMMUTABLE - verbatim user input, never changes
- `created`: IMMUTABLE - set once
- `updated`: OVERWRITE - update on every change

**Current Focus:**
- OVERWRITE entirely on each update
- Always reflects what Claude is doing RIGHT NOW
- If Claude reads this after /clear, it knows exactly where to resume
- Fields: hypothesis, test, expecting, next_action

**Symptoms:**
- Written during initial gathering phase
- IMMUTABLE after gathering complete
- Reference point for what we're trying to fix
- Fields: expected, actual, errors, reproduction, started

**Eliminated:**
- APPEND only - never remove entries
- Prevents re-investigating dead ends after context reset
- Each entry: hypothesis, evidence that disproved it, timestamp
- Critical for efficiency across /clear boundaries

**Evidence:**
- APPEND only - never remove entries
- Facts discovered during investigation
- Each entry: timestamp, what checked, what found, implication
- Builds the case for root cause

**Resolution:**
- OVERWRITE as understanding evolves
- May update multiple times as fixes are tried
- Final state shows confirmed root cause and verified fix
- Fields: root_cause, fix, verification, files_changed

</section_rules>

<lifecycle>

**Creation:** Immediately when /gsd:debug is called
- Create file with trigger from user input
- Set status to "gathering"
- Current Focus: next_action = "gather symptoms"
- Symptoms: empty, to be filled

**During symptom gathering:**
- Update Symptoms section as user answers questions
- Update Current Focus with each question
- When complete: status → "investigating"

**During investigation:**
- OVERWRITE Current Focus with each hypothesis
- APPEND to Evidence with each finding
- APPEND to Eliminated when hypothesis disproved
- Update timestamp in frontmatter

**During fixing:**
- status → "fixing"
- Update Resolution.root_cause when confirmed
- Update Resolution.fix when applied
- Update Resolution.files_changed

**During verification:**
- status → "verifying"
- Update Resolution.verification with results
- If verification fails: status → "investigating", try again

**After self-verification passes:**
- status -> "awaiting_human_verify"
- Request explicit user confirmation in a checkpoint
- Do NOT move file to resolved yet

**On resolution:**
- status → "resolved"
- Move file to .planning/debug/resolved/ (only after user confirms fix)

</lifecycle>

<resume_behavior>

When Claude reads this file after /clear:

1. Parse frontmatter → know status
2. Read Current Focus → know exactly what was happening
3. Read Eliminated → know what NOT to retry
4. Read Evidence → know what's been learned
5. Continue from next_action

The file IS the debugging brain. Claude should be able to resume perfectly from any interruption point.

</resume_behavior>

<size_constraint>

Keep debug files focused:
- Evidence entries: 1-2 lines each, just the facts
- Eliminated: brief - hypothesis + why it failed
- No narrative prose - structured data only

If evidence grows very large (10+ entries), consider whether you're going in circles. Check Eliminated to ensure you're not re-treading.

</size_constraint>
