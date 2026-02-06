---
name: gsdf:debug
description: Token-optimized debugging with conditional skill loading
argument-hint: "[issue description]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - WebSearch
  - AskUserQuestion
---

<objective>
Token-optimized version of /gsd:debug.

**Key difference:** Loads debugger skills only when investigation requires them.
</objective>

<context>
Issue description: $ARGUMENTS
</context>

<process>

## 0. Resolve GSDF Model Profile

```bash
# GSDF uses model_profile_gsdf (falls back to model_profile, then "balanced")
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**GSDF debugger model lookup:**

| Profile | gsd-debugger-core |
|---------|-------------------|
| quality | sonnet |
| balanced | sonnet |
| budget | haiku |

## 1. Check for Active Sessions

```bash
ls .planning/debug/*.md 2>/dev/null | grep -v resolved
```

If sessions exist and no $ARGUMENTS, present session list for selection.

## 2. Gather Symptoms (if new issue)

Use AskUserQuestion for structured symptom gathering:

1. **Expected behavior** - What should happen?
2. **Actual behavior** - What happens instead?
3. **Error messages** - Any errors? (paste or describe)
4. **Timeline** - When did this start? Ever worked?
5. **Reproduction** - How do you trigger it?

After all gathered, confirm ready to investigate.

## 3. Determine Skill Requirements

Based on issue description and complexity:

```bash
# Check if issue mentions verification/fix
NEEDS_VERIFICATION=false
echo "$ARGUMENTS" | grep -qiE "fix|verify|confirm|test" && NEEDS_VERIFICATION=true

# Complex investigation keywords
NEEDS_INVESTIGATION_TECHNIQUES=false
echo "$ARGUMENTS" | grep -qiE "intermittent|sometimes|random|race|timing|complex" && NEEDS_INVESTIGATION_TECHNIQUES=true
```

## 4. Build Skill Includes

```markdown
SKILL_INCLUDES=""

# Always load shared research methodology for external lookups
SKILL_INCLUDES+="
--- RESEARCH METHODOLOGY ---
$(cat ~/.claude/skills/shared/research-methodology.md)
"

if $NEEDS_VERIFICATION; then
  SKILL_INCLUDES+="
--- VERIFICATION PATTERNS ---
$(cat ~/.claude/skills/debugger/verification-patterns.md)
"
fi

if $NEEDS_INVESTIGATION_TECHNIQUES; then
  SKILL_INCLUDES+="
--- INVESTIGATION TECHNIQUES ---
$(cat ~/.claude/skills/debugger/investigation-techniques.md)
"
fi
```

## 5. Spawn Debugger

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► DEBUG SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Issue: {brief}
◆ Skills loaded: {list}
```

Pre-read agent core (inline into prompt, no wasted turn):
```bash
DEBUGGER_CORE=$(cat ~/.claude/agents/gsd-debugger-core.md)
```

```markdown
Task(
  prompt="${DEBUGGER_CORE}\n\n{skill_includes}\n\n<issue>\n{arguments}\n</issue>\n\n<symptoms>\nexpected: {expected}\nactual: {actual}\nerrors: {errors}\nreproduction: {reproduction}\ntimeline: {timeline}\n</symptoms>\n\n<mode>\nsymptoms_prefilled: true\ngoal: find_and_fix\n</mode>\n\n<debug_file>\nCreate: .planning/debug/{slug}.md\n</debug_file>",
  subagent_type="general-purpose",
  model="{debugger_model}",
  description="Debug: {brief}"
)
```

## 6. Handle Returns

**If `## ROOT CAUSE FOUND`:**
- Display root cause and evidence summary
- Offer options:
  - "Fix now" — spawn fix subagent
  - "Plan fix" — suggest /gsdf:plan-phase --gaps
  - "Manual fix" — done

**If `## CHECKPOINT REACHED`:**
- Present checkpoint details to user
- Get user response
- Spawn continuation agent (see step 7)

**If `## INVESTIGATION INCONCLUSIVE`:**
- Show what was checked and eliminated
- Offer options:
  - "Continue investigating" — spawn new agent with additional context
  - "Manual investigation" — done
  - "Add more context" — gather more symptoms, spawn again

## 7. Spawn Continuation Agent (After Checkpoint)

```markdown
<objective>
Continue debugging {slug}. Evidence is in the debug file.
</objective>

<prior_state>
Debug file: @.planning/debug/{slug}.md
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
goal: find_and_fix
</mode>
```

```
Task(
  prompt="${DEBUGGER_CORE}\n\n{skill_includes}\n\n" + continuation_prompt,
  subagent_type="general-purpose",
  model="{debugger_model}",
  description="Continue debug {slug}"
)
```

## 8. Skill Escalation

If debugger returns without resolution and hasn't loaded all skills:

```markdown
Skills not yet loaded:
- investigation-techniques (for systematic search)
- verification-patterns (for fix validation)

Would you like to continue with additional investigation tools?
```

If yes, respawn with additional skills.

</process>

<offer_next>
Based on debug result, offer appropriate next action.
</offer_next>

<success_criteria>
- [ ] Active sessions checked
- [ ] Symptoms gathered (5 structured questions)
- [ ] Skills loaded based on issue complexity
- [ ] Debugger spawned with lean core + relevant skills
- [ ] Debug file created/maintained
- [ ] Root cause options presented (Fix now / Plan fix / Manual)
- [ ] Investigation inconclusive handled with options
- [ ] Continuation template used for checkpoints
- [ ] Result handled appropriately
</success_criteria>
