<purpose>
Verify that CONTEXT.md captures the full depth of user input from the discussion. Compares what the user said (reasoning, terminology, constraints, philosophy) against what was written to the context file.

This workflow is called at the end of discuss-phase.md, but ONLY when the user provided extended text input during the discussion (not just option selections).

**Core insight:** When users pick from predefined options, the decisions are well-defined and a verifier adds no value. When users type extended explanations (via "Other" option or free-form input), their reasoning depth is the most valuable signal -- and the most likely to be compressed during abstraction.
</purpose>

<trigger_condition>
**Only run this verification when extended user input was detected during the discussion.**

How to detect:
1. The user chose "Other" on any AskUserQuestion and provided custom text
2. The user gave a response longer than ~50 words to any question
3. The user volunteered information beyond what was asked (unprompted elaboration)

**If the user only selected predefined options throughout the entire discussion:** Skip verification, proceed directly to git commit. The context file captures option-based decisions reliably.

**If extended input was detected:** Run verification before git commit.

```
Discussion complete → Extended input detected?
  → No:  Write CONTEXT.md → commit → done
  → Yes: Write CONTEXT.md → VERIFY DEPTH → fix gaps → commit → done
```
</trigger_condition>

<process>

<step name="collect_user_inputs">
**Scan the discussion for substantive user input.**

Identify every instance where the user:

1. **Chose "Other" and typed custom text** — This is explicit depth that must be captured
2. **Gave responses longer than a sentence** — Extended reasoning, not just acknowledgment
3. **Used specific terminology** — Domain words, product names, metaphors that carry intent
4. **Explained WHY** — Reasoning behind preferences, not just the preference itself
5. **Referenced products or anti-patterns** — "I want it like X" or "not like Y"
6. **Expressed constraints** — What should NOT be built and why
7. **Shared philosophy** — Deeper principles beyond the immediate question

For each instance, extract:
- The user's actual words (preserve phrasing)
- The core point they were making
- Which discussion area it relates to
</step>

<step name="audit_context_file">
**Read the CONTEXT.md that was just written.**

For each user input identified in the previous step, check:

| Check | Status | Meaning |
|-------|--------|---------|
| Decision + reasoning present | CAPTURED | Full depth transferred |
| Decision present, reasoning missing | SHALLOW | The WHAT is there but WHY was compressed |
| Not present at all | MISSING | User input was dropped entirely |
| User terminology replaced with generic words | LOST VOICE | Design intent diluted by paraphrasing |
| Constraint in Deferred instead of Decisions | MISPLACED | Reasoning separated from its decision |

**The planner test for each gap:**
Would a planner reading only CONTEXT.md (in a fresh context window, without seeing this discussion) understand the user's full intent? If not, it's a gap.
</step>

<step name="report_and_fix">
**If no gaps found:**

```
Context Depth Verification: PASSED

All extended user input captured with reasoning depth.
[N] substantive inputs verified against CONTEXT.md.
```

Proceed to git commit.

**If gaps found:**

```
Context Depth Verification: [M] gaps found

GAP 1: [SHALLOW | MISSING | LOST VOICE | MISPLACED]
  User said: "[summary of user's point]"
  Context has: "[what's currently in the file]" (or "nothing")
  Missing: [what should be added]

GAP 2: ...
```

**Fix the gaps directly in CONTEXT.md:**

- **SHALLOW:** Add the reasoning after the existing decision
- **MISSING:** Add the point to the appropriate section
- **LOST VOICE:** Replace generic phrasing with user's original terminology
- **MISPLACED:** Move constraint reasoning from Deferred to Decisions

After fixes:

```
Context Depth Verification: PASSED (after [M] fixes)

Fixed:
- [Gap 1]: Added reasoning for [decision]
- [Gap 2]: Restored user terminology "[term]"
- ...

CONTEXT.md updated. Proceeding to commit.
```
</step>

</process>

<integration>
**How this fits into discuss-phase.md:**

This workflow runs as a verification step between `write_context` and `git_commit` in the discuss-phase workflow. The discuss-phase orchestrator should:

1. Complete the discussion (all `discuss_areas` steps)
2. Write CONTEXT.md (`write_context` step)
3. Check if extended user input was detected during the discussion
4. If yes: run this verification workflow
5. Proceed to `git_commit`

**Subagent or inline:**
This can run inline within the discuss-phase (no separate subagent needed). The context is already in the conversation window -- the verifier just re-reads the CONTEXT.md and compares against what was said.
</integration>

<design_principles>
1. **Conditional execution:** Only runs when there's extended input to verify. Option-only discussions skip this entirely -- no overhead for simple discussions.

2. **Fix, don't just report:** The verifier doesn't just list gaps. It fixes them. The user should see the improved CONTEXT.md, not a list of problems to solve.

3. **Preserve user voice:** When the user said "contained units" and the context says "separate cards", that's a gap. The user's phrasing carries design intent that generic synonyms lose.

4. **Reasoning over decisions:** A decision without its WHY is the most common gap. The verifier specifically watches for decisions that lost their reasoning during abstraction.

5. **Non-blocking:** If verification finds no gaps, it adds zero friction to the workflow. The goal is invisible quality assurance, not ceremony.
</design_principles>

<success_criteria>
- Extended user input detected correctly (not triggered on option-only discussions)
- Every substantive user input checked against CONTEXT.md
- Gaps identified with clear before/after
- Gaps fixed directly in CONTEXT.md (not just reported)
- User's original terminology preserved
- Reasoning depth restored where compressed
- Zero overhead when no extended input was given
</success_criteria>
