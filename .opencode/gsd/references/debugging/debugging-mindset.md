<philosophy>
Debugging is applied epistemology. You're investigating a system to discover truth about its behavior. The difference between junior and senior debugging is not knowledge of frameworks - it's the discipline of systematic investigation.
</philosophy>

<meta_debugging>
**Special challenge**: When you're debugging code you wrote or modified, you're fighting your own mental model.

**Why this is harder**:
- You made the design decisions - they feel obviously correct
- You remember your intent, not what you actually implemented
- You see what you meant to write, not what's there
- Familiarity breeds blindness to bugs

**The trap**:
- "I know this works because I implemented it correctly"
- "The bug must be elsewhere - I designed this part"
- "I tested this approach"
- These thoughts are red flags. Code you wrote is guilty until proven innocent.

**The discipline**:

**1. Treat your own code as foreign**
- Read it as if someone else wrote it
- Don't assume it does what you intended
- Verify what it actually does, not what you think it does
- Fresh eyes see bugs; familiar eyes see intent

**2. Question your own design decisions**
- "I chose approach X because..." - Was that reasoning sound?
- "I assumed Y would..." - Have you verified Y actually does that?
- Your implementation decisions are hypotheses, not facts

**3. Admit your mental model might be wrong**
- You built a mental model of how this works
- That model might be incomplete or incorrect
- The code's behavior is truth; your model is just a guess
- Be willing to discover you misunderstood the problem

**4. Prioritize code you touched**
- If you modified 100 lines and something breaks
- Those 100 lines are the prime suspects
- Don't assume the bug is in the framework or existing code
- Start investigating where you made changes

<example>
❌ "I implemented the auth flow correctly, the bug must be in the existing user service"

✅ "I implemented the auth flow. Let me verify each part:
   - Does login actually set the token? [test it]
   - Does the middleware actually validate it? [test it]
   - Does logout actually clear it? [test it]
   - One of these is probably wrong"

The second approach found that logout wasn't clearing the token from localStorage, only from memory.
</example>

**The hardest admission**: "I implemented this wrong."

Not "the requirements were unclear" or "the library is confusing" - YOU made an error. Whether it was 5 minutes ago or 5 days ago doesn't matter. Your code, your responsibility, your bug to find.

This intellectual honesty is the difference between debugging for hours and finding bugs quickly.
</meta_debugging>

<foundation>
When debugging, return to foundational truths:

**What do you know for certain?**
- What have you directly observed (not assumed)?
- What can you prove with a test right now?
- What is speculation vs evidence?

**What are you assuming?**
- "This library should work this way" - Have you verified?
- "The docs say X" - Have you tested that X actually happens?
- "This worked before" - Can you prove when it worked and what changed?

Strip away everything you think you know. Build understanding from observable facts.
</foundation>

<example>
❌ "React state updates should be synchronous here"
✅ "Let me add a console.log to observe when state actually updates"

❌ "The API must be returning bad data"
✅ "Let me log the exact response payload to see what's actually being returned"

❌ "This database query should be fast"
✅ "Let me run EXPLAIN to see the actual execution plan"
</example>

<cognitive_biases>

<bias name="confirmation_bias">
**The problem**: You form a hypothesis and only look for evidence that confirms it.

**The trap**: "I think it's a race condition" → You only look for async code, missing the actual typo in a variable name.

**The antidote**: Actively seek evidence that disproves your hypothesis. Ask "What would prove me wrong?"
</bias>

<bias name="anchoring">
**The problem**: The first explanation you encounter becomes your anchor, and you adjust from there instead of considering alternatives.

**The trap**: Error message mentions "timeout" → You assume it's a network issue, when it's actually a deadlock.

**The antidote**: Generate multiple independent hypotheses before investigating any single one. Force yourself to list 3+ possible causes.
</bias>

<bias name="availability_heuristic">
**The problem**: You remember recent bugs and assume similar symptoms mean the same cause.

**The trap**: "We had a caching issue last week, this must be caching too."

**The antidote**: Treat each bug as novel until evidence suggests otherwise. Recent memory is not evidence.
</bias>

<bias name="sunk_cost_fallacy">
**The problem**: You've spent 2 hours debugging down one path, so you keep going even when evidence suggests it's wrong.

**The trap**: "I've almost figured out this state management issue" - when the actual bug is in the API layer.

**The antidote**: Set checkpoints. Every 30 minutes, ask: "If I started fresh right now, is this still the path I'd take?"
</bias>

</cognitive_biases>

<systematic_investigation>

<discipline name="change_one_variable">
**Why it matters**: If you change multiple things at once, you don't know which one fixed (or broke) it.

**In practice**:
1. Make one change
2. Test
3. Observe result
4. Document
5. Repeat

**The temptation**: "Let me also update this dependency and refactor this function and change this config..."

**The reality**: Now you have no idea what actually mattered.
</discipline>

<discipline name="complete_reading">
**Why it matters**: Skimming code causes you to miss crucial details. You see what you expect to see, not what's there.

**In practice**:
- Read entire functions, not just the "relevant" lines
- Read imports and dependencies
- Read configuration files completely
- Read test files to understand intended behavior

**The shortcut**: "This function is long, I'll just read the part where the error happens"

**The miss**: The bug is actually in how the function is called 50 lines up.
</discipline>

<discipline name="embrace_not_knowing">
**Why it matters**: Premature certainty stops investigation. "I don't know" is a position of strength.

**In practice**:
- "I don't know why this fails" - Good. Now you can investigate.
- "It must be X" - Dangerous. You've stopped thinking.

**The pressure**: Users want answers. Managers want ETAs. Your ego wants to look smart.

**The truth**: "I need to investigate further" is more professional than a wrong fix.
</discipline>

</systematic_investigation>

<when_to_restart>

<restart_signals>
You should consider starting over when:

1. **You've been investigating for 2+ hours with no progress**
   - You're likely tunnel-visioned
   - Take a break, then restart from evidence gathering

2. **You've made 3+ "fixes" that didn't work**
   - Your mental model is wrong
   - Go back to first principles

3. **You can't explain the current behavior**
   - Don't add more changes on top of confusion
   - First understand what's happening, then fix it

4. **You're debugging the debugger**
   - "Is my logging broken? Is the debugger lying?"
   - Step back. Something fundamental is wrong.

5. **The fix works but you don't know why**
   - This isn't fixed. This is luck.
   - Investigate until you understand, or revert the change
</restart_signals>

<restart_protocol>
When restarting:

1. **Close all files and terminals**
2. **Write down what you know for certain** (not what you think)
3. **Write down what you've ruled out**
4. **List new hypotheses** (different from before)
5. **Begin again from Phase 1: Evidence Gathering**

This isn't failure. This is professionalism.
</restart_protocol>

</when_to_restart>

<humility>
The best debuggers have deep humility about their mental models:

**They know**:
- Their understanding of the system is incomplete
- Documentation can be wrong or outdated
- Their memory of "how this works" may be faulty
- The system's behavior is the only truth

**They don't**:
- Trust their first instinct
- Assume anything works as designed
- Skip verification steps
- Declare victory without proof

**They ask**:
- "What am I missing?"
- "What am I wrong about?"
- "What haven't I tested?"
- "What does the evidence actually say?"
</humility>

<craft>
Debugging is a craft that improves with practice:

**Novice debuggers**:
- Try random things hoping something works
- Skip reading code carefully
- Don't test their hypotheses
- Declare success too early

**Expert debuggers**:
- Form hypotheses explicitly
- Test hypotheses systematically
- Read code like literature
- Verify fixes rigorously
- Learn from each investigation

**The difference**: Not intelligence. Not knowledge. Discipline.

Practice the discipline of systematic investigation, and debugging becomes a strength.
</craft>
