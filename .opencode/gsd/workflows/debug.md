<purpose>
Systematic debugging with persistent state that survives context resets. The debug file IS the debugging brain - create it immediately and update it continuously.

You are the debugger. The user knows what's wrong (behavior), not why (root cause). Gather symptoms, then investigate autonomously.
</purpose>

<philosophy>
**User = reporter. Claude = investigator.**

The user knows:
- What they expected to happen
- What actually happened
- Any error messages they saw
- When it started / if it ever worked

The user does NOT know (and shouldn't be asked):
- What's causing the bug
- Which file has the problem
- What the fix should be

Ask about experience. Investigate the cause yourself.
</philosophy>

<references>
@~/.config/opencode/gsd/references/debugging/debugging-mindset.md
@~/.config/opencode/gsd/references/debugging/hypothesis-testing.md
@~/.config/opencode/gsd/references/debugging/investigation-techniques.md
@~/.config/opencode/gsd/references/debugging/verification-patterns.md
@~/.config/opencode/gsd/references/debugging/when-to-research.md
</references>

<template>
@~/.config/opencode/gsd/templates/DEBUG.md
</template>

<process>

<step name="check_active_session">
**First: Check for active debug sessions**

```bash
ls .planning/debug/*.md 2>/dev/null | grep -v resolved
```

**If active sessions exist AND no $ARGUMENTS provided:**

Read each file's frontmatter (status, trigger) and Current Focus (hypothesis, next_action).

Display inline:

```
## Active Debug Sessions

| # | Slug | Status | Hypothesis | Next Action |
|---|------|--------|------------|-------------|
| 1 | auth-logout | investigating | Token refresh not called | Check console output |
| 2 | api-timeout | gathering | - | Gather symptoms |
| 3 | cart-bug | fixing | Null reference in context | Apply fix |

Reply with a number to resume, or describe a new issue to start fresh.
```

Wait for user response.

- If user replies with number (1, 2, 3) → Load that file, go to `resume_from_file`
- If user replies with text → Treat as new issue trigger, go to `create_debug_file`

**If active sessions exist AND $ARGUMENTS provided:**

User wants to start a new debug session. Continue to `create_debug_file`.

**If no active sessions AND no $ARGUMENTS:**

```
No active debug sessions.

Describe the issue to start debugging.
```

Wait for user to describe the issue, then use their response as the trigger.

**If no active sessions AND $ARGUMENTS provided:**

Continue to `create_debug_file` with $ARGUMENTS as trigger.
</step>

<step name="create_debug_file">
**Create debug file IMMEDIATELY**

Generate slug from user input (lowercase, hyphens, max 30 chars).

```bash
mkdir -p .planning/debug
```

Create file with initial state:

```markdown
---
status: gathering
trigger: "[verbatim $ARGUMENTS]"
created: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Focus

hypothesis: none yet
test: none
expecting: none
next_action: gather symptoms from user

## Symptoms

expected:
actual:
errors:
reproduction:
started:

## Eliminated

[none yet]

## Evidence

[none yet]

## Resolution

root_cause:
fix:
verification:
files_changed: []
```

Write to `.planning/debug/[slug].md`

Now proceed to `symptom_gathering`.
</step>

<step name="symptom_gathering">
**Gather symptoms through questioning - update file after EACH answer**

CRITICAL: Update the debug file after each piece of information gathered.

**1. Expected behavior:**

Use AskUserQuestion:
- header: "Expected"
- question: "What should happen?"
- options: Contextual interpretations + "Let me describe"

After answer → Update Symptoms.expected in debug file

**2. Actual behavior:**

Use AskUserQuestion:
- header: "Actual"
- question: "What actually happens instead?"
- options: Common failure modes + "Let me describe"

After answer → Update Symptoms.actual in debug file

**3. Error messages:**

Use AskUserQuestion:
- header: "Errors"
- question: "Any error messages?"
- options:
  - "Yes, I'll paste them"
  - "Yes, but I don't have them handy"
  - "No errors - fails silently"
  - "Not sure"

After answer → Update Symptoms.errors in debug file

**4. When it started:**

Use AskUserQuestion:
- header: "Timeline"
- question: "When did this start?"
- options:
  - "Never worked"
  - "After a change"
  - "Intermittent"
  - "Not sure"

After answer → Update Symptoms.started in debug file

**5. Reproduction:**

Use AskUserQuestion:
- header: "Reproduce"
- question: "How do you trigger this?"
- options:
  - "Specific steps" - I can describe them
  - "Random" - Happens unpredictably
  - "Always" - Every time I try
  - "Not sure"

After answer → Update Symptoms.reproduction in debug file

**6. Ready check:**

Use AskUserQuestion:
- header: "Ready?"
- question: "Enough context to investigate?"
- options:
  - "Start investigating"
  - "I have more context"

If "I have more context" → receive it, update relevant field, ask again
If "Start investigating" → Update status to "investigating", proceed to `investigation_loop`
</step>

<step name="investigation_loop">
**Autonomous investigation - update file continuously**

CRITICAL: Before EVERY action, update Current Focus. After EVERY finding, append to Evidence.

**Phase 1: Initial evidence gathering**

Update Current Focus:
```
hypothesis: gathering initial evidence
test: examining error context and relevant code
expecting: clues about failure point
next_action: [specific next action]
```

1. If errors exist in Symptoms → search codebase for error text
2. Identify relevant code area from symptoms
3. Read relevant files COMPLETELY
4. Run app/tests to observe behavior firsthand

After EACH finding → Append to Evidence:
```
- timestamp: [now]
  checked: [what]
  found: [what]
  implication: [what this means]
```

**Phase 2: Form hypothesis**

Based on evidence, form SPECIFIC, FALSIFIABLE hypothesis.

Update Current Focus:
```
hypothesis: [specific theory]
test: [how you'll test it]
expecting: [what proves/disproves it]
next_action: [immediate next step]
```

**Phase 3: Test hypothesis**

Execute the test. ONE hypothesis at a time.

Append result to Evidence.

**Phase 4: Evaluate**

If CONFIRMED:
- Update Resolution.root_cause with evidence
- Update status to "fixing"
- Proceed to `fix_and_verify`

If ELIMINATED:
- Append to Eliminated section:
  ```
  - hypothesis: [what was wrong]
    evidence: [what disproved it]
    timestamp: [now]
  ```
- Form new hypothesis based on evidence
- Return to Phase 2

**Context management:**

After significant investigation (5+ evidence entries), check if context is heavy.
If so, ensure Current Focus is fully updated and suggest:
"Context filling up. Safe to /clear - run /gsd/debug to resume."
</step>

<step name="resume_from_file">
**Resume investigation from debug file**

Read the full debug file.

Announce:
```
Resuming: [slug]
Status: [status]
Current hypothesis: [from Current Focus]
Evidence gathered: [count]
Eliminated: [count] hypotheses

Continuing from: [next_action]
```

Based on status:
- "gathering" → Continue `symptom_gathering` from where left off
- "investigating" → Continue `investigation_loop` from Current Focus
- "fixing" → Continue `fix_and_verify`
- "verifying" → Continue verification

The file tells you exactly where you were.
</step>

<step name="fix_and_verify">
**Apply fix and verify**

Update status to "fixing".

**1. Implement minimal fix**

Update Current Focus:
```
hypothesis: [confirmed root cause]
test: applying fix
expecting: symptoms resolved
next_action: implement fix in [files]
```

Make the SMALLEST change that addresses root cause.

Update Resolution.fix with what was changed and why.
Update Resolution.files_changed with modified files.

**2. Verify**

Update status to "verifying".

Update Current Focus:
```
hypothesis: fix resolves issue
test: reproducing original symptoms
expecting: symptoms no longer occur
next_action: verify fix
```

Test against original Symptoms:
- Does expected behavior now occur?
- Are errors gone?
- Does reproduction no longer trigger issue?

If verification FAILS:
- Append finding to Evidence
- Update status back to "investigating"
- Root cause was wrong or incomplete
- Return to `investigation_loop`

If verification PASSES:
- Update Resolution.verification with how verified
- Proceed to `archive_session`
</step>

<step name="archive_session">
**Archive resolved debug session**

Update status to "resolved".

```bash
mkdir -p .planning/debug/resolved
mv .planning/debug/[slug].md .planning/debug/resolved/
```

Commit:
```bash
git add -A
git commit -m "fix: [brief description from Resolution.fix]

Root cause: [from Resolution.root_cause]
Debug session: .planning/debug/resolved/[slug].md"
```

Report:
```
Debug complete.

Root cause: [root_cause]
Fix: [fix]
Files: [files_changed]

Session archived: .planning/debug/resolved/[slug].md
```

Use AskUserQuestion:
- header: "Next"
- question: "What now?"
- options:
  - "Continue working" - Back to /gsd/progress
  - "Test more" - Verify related functionality
  - "Done" - End session
</step>

</process>

<update_rules>
**Section update rules (from template):**

| Section | Rule | When |
|---------|------|------|
| Frontmatter.status | OVERWRITE | Each phase transition |
| Frontmatter.updated | OVERWRITE | Every file update |
| Current Focus | OVERWRITE | Before every action |
| Symptoms | IMMUTABLE | After gathering complete |
| Eliminated | APPEND | When hypothesis disproved |
| Evidence | APPEND | After each finding |
| Resolution | OVERWRITE | As understanding evolves |

**CRITICAL:** Update the file BEFORE taking action, not after. If context resets mid-action, the file shows what was about to happen.
</update_rules>

<success_criteria>
- [ ] Debug file created IMMEDIATELY on command
- [ ] File updated after EACH piece of information
- [ ] Current Focus always reflects NOW
- [ ] Evidence appended for every finding
- [ ] Eliminated prevents re-investigation
- [ ] Can resume perfectly from any /clear
- [ ] Root cause confirmed with evidence before fixing
- [ ] Fix verified against original symptoms
</success_criteria>
