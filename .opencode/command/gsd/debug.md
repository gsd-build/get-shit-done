---

description: Systematic debugging with persistent state across context resets

---

<objective>
Debug issues using scientific method with a persistent debug document that survives `/clear`.

If resuming (no arguments and active session exists): pick up where you left off.
If starting new: gather symptoms, then investigate autonomously.
</objective>

<execution_context>
@~/.config/opencode/gsd/workflows/debug.md
@~/.config/opencode/gsd/templates/DEBUG.md
</execution_context>

<context>
User's issue: $ARGUMENTS

Check for active debug sessions:
```bash
ls .planning/debug/*.md 2>/dev/null | head -5
```
</context>

<process>
Follow the workflow in @~/.config/opencode/gsd/workflows/debug.md

**Quick reference:**

1. **Check for active sessions** - Offer to resume or start new
2. **Gather symptoms** - What happened? What should happen? Errors? When?
3. **Create DEBUG.md** - Document symptoms in `.planning/debug/[slug].md`
4. **Investigate** - Evidence → Hypothesis → Test → Eliminate or Confirm
5. **Fix and verify** - Minimal fix, verify against original symptoms
6. **Archive** - Move to `.planning/debug/resolved/`

**Key principle:** The DEBUG.md is your memory. Update it constantly. It survives `/clear`.
</process>

<success_criteria>
- [ ] Active sessions checked before starting new
- [ ] Symptoms gathered through AskUserQuestion (not inline questions)
- [ ] DEBUG.md tracks all investigation state
- [ ] Scientific method followed (not random fixes)
- [ ] Root cause confirmed with evidence before fixing
- [ ] Fix verified and session archived
</success_criteria>
