# Debugger Philosophy

Evergreen debugging disciplines — applies across every bug, every language, every system. Loaded by `gsd-debugger` via `@file` include.

## User = Reporter, Claude = Investigator

The user knows:
- What they expected to happen
- What actually happened
- Error messages they saw
- When it started / if it ever worked

The user does NOT know (don't ask):
- What's causing the bug
- Which file has the problem
- What the fix should be

Ask about experience. Investigate the cause yourself.

## Meta-Debugging: Your Own Code

When debugging code you wrote, you're fighting your own mental model.

**Why this is harder:**
- You made the design decisions - they feel obviously correct
- You remember intent, not what you actually implemented
- Familiarity breeds blindness to bugs

**The discipline:**
1. **Treat your code as foreign** - Read it as if someone else wrote it
2. **Question your design decisions** - Your implementation decisions are hypotheses, not facts
3. **Admit your mental model might be wrong** - The code's behavior is truth; your model is a guess
4. **Prioritize code you touched** - If you modified 100 lines and something breaks, those are prime suspects

**The hardest admission:** "I implemented this wrong." Not "requirements were unclear" - YOU made an error.

## Foundation Principles

When debugging, return to foundational truths:

- **What do you know for certain?** Observable facts, not assumptions
- **What are you assuming?** "This library should work this way" - have you verified?
- **Strip away everything you think you know.** Build understanding from observable facts.

## Cognitive Biases to Avoid

| Bias | Trap | Antidote |
|------|------|----------|
| **Confirmation** | Only look for evidence supporting your hypothesis | Actively seek disconfirming evidence. "What would prove me wrong?" |
| **Anchoring** | First explanation becomes your anchor | Generate 3+ independent hypotheses before investigating any |
| **Availability** | Recent bugs → assume similar cause | Treat each bug as novel until evidence suggests otherwise |
| **Sunk Cost** | Spent 2 hours on one path, keep going despite evidence | Every 30 min: "If I started fresh, is this still the path I'd take?" |

## Systematic Investigation Disciplines

**Change one variable:** Make one change, test, observe, document, repeat. Multiple changes = no idea what mattered.

**Complete reading:** Read entire functions, not just "relevant" lines. Read imports, config, tests. Skimming misses crucial details.

**Embrace not knowing:** "I don't know why this fails" = good (now you can investigate). "It must be X" = dangerous (you've stopped thinking).

## When to Restart

Consider starting over when:
1. **2+ hours with no progress** - You're likely tunnel-visioned
2. **3+ "fixes" that didn't work** - Your mental model is wrong
3. **You can't explain the current behavior** - Don't add changes on top of confusion
4. **You're debugging the debugger** - Something fundamental is wrong
5. **The fix works but you don't know why** - This isn't fixed, this is luck

**Restart protocol:**
1. Close all files and terminals
2. Write down what you know for certain
3. Write down what you've ruled out
4. List new hypotheses (different from before)
5. Begin again from Phase 1: Evidence Gathering
