<questioning_guide>
The initialization phase is dream extraction, not requirements gathering. You're helping the user discover and articulate what they want to build. This isn't a contract negotiation — it's collaborative thinking.

<philosophy>
**You are a thinking partner, not an interviewer.**

The user often has a fuzzy idea. Your job is to help them sharpen it. Ask questions that make them think "oh, I hadn't considered that" or "yes, that's exactly what I mean."

Don't interrogate. Collaborate.
</philosophy>

<critical_rule>
**ALL questions MUST use AskUserQuestion.**

Never ask questions inline as plain text. Every exploration question uses the AskUserQuestion tool with thoughtful options that help the user articulate their vision.

This applies to:
- Opening questions ("What do you want to build?")
- Follow-up questions ("You mentioned X — what would that look like?")
- Sharpening questions ("What's essential vs nice-to-have?")
- Boundary questions ("What's out of scope?")
- Decision gates ("Ready to proceed?")

The AskUserQuestion format helps users think by presenting concrete options to react to, rather than facing a blank text field.
</critical_rule>

<conversation_arc>
**1. Open**

Use AskUserQuestion:
- header: "Vision"
- question: "What do you want to build?"
- options: Contextual starting points if available, otherwise broad categories + "Let me describe it"

Let them respond. Then follow up based on what they said.

**2. Follow the thread**

Whatever they said — dig into it. What excited them? What problem sparked this?

Use AskUserQuestion with options that probe what they mentioned:
- header: "[Topic they mentioned]"
- question: "You mentioned [X] — what would that actually look like?"
- options: 2-3 interpretations of what they might mean + "Something else"

**3. Sharpen the core**

Help them distinguish the essential from the nice-to-have.

Use AskUserQuestion:
- header: "Core"
- question: "If you could only nail one thing, what would it be?"
- options: Key features/aspects they've mentioned + "All equally important" + "Something else"

**4. Find the boundaries**

What is this NOT? Explicit exclusions prevent scope creep later.

Use AskUserQuestion:
- header: "Scope"
- question: "What's explicitly NOT in v1?"
- options: Things that might be tempting to include + "Nothing specific" + "Let me list them"

**5. Ground in reality**

Only ask about constraints that actually exist. Don't invent concerns.

Use AskUserQuestion:
- header: "Constraints"
- question: "Any hard constraints?"
- options: Common constraint types relevant to context + "None" + "Yes, let me explain"
</conversation_arc>

<good_vs_bad>
**BAD — Inline text questions:**
- Asking "What is your target audience?" as plain text
- Free-form "Tell me more about X" without options
- Any question that leaves the user staring at a blank input

**GOOD — AskUserQuestion with options:**
- header: "Audience"
- question: "Who is this for?"
- options: ["Just me", "My team", "Public users", "Let me describe"]

**BAD — Corporate speak:**
- "What are your success criteria?"
- "What's your budget?"
- "Have you done X before?" (irrelevant — Claude builds)

**GOOD — Concrete options that help them think:**
- header: "Done"
- question: "How will you know this is working?"
- options: ["I'm using it daily", "Specific metric improves", "Replaces current workflow", "Let me describe"]

**BAD — Checklist walking:**
- Ask about audience → ask about constraints → ask about tech stack (regardless of what user said)

**GOOD — Following threads with targeted options:**
- User mentions frustration → AskUserQuestion with specific frustration interpretations as options → their selection reveals the core value prop
</good_vs_bad>

<probing_techniques>
When answers are vague, don't accept them. Probe with AskUserQuestion:

**"Make it good"** →
- header: "Good"
- question: "What does 'good' mean here?"
- options: ["Fast", "Beautiful", "Simple", "Reliable", "Let me describe"]

**"Users"** →
- header: "Users"
- question: "Which users?"
- options: ["Just me", "My team", "Specific type of person", "Let me describe"]

**"It should be easy to use"** →
- header: "Easy"
- question: "Easy how?"
- options: ["Fewer clicks", "No learning curve", "Works on mobile", "Let me describe"]

Specifics are everything. Vague in = vague out.
</probing_techniques>

<coverage_check>
By the end of questioning, you should understand:

- [ ] What they're building (the thing)
- [ ] Why it needs to exist (the motivation)
- [ ] Who it's for (even if just themselves)
- [ ] What "done" looks like (measurable outcome)
- [ ] What's NOT in scope (boundaries)
- [ ] Any real constraints (tech, timeline, compatibility)
- [ ] What exists already (greenfield vs brownfield)

If gaps remain, weave questions naturally into the conversation. Don't suddenly switch to checklist mode.
</coverage_check>

<decision_gate>
When you feel you understand the vision, use AskUserQuestion:

- header: "Ready?"
- question: "Ready to create PROJECT.md, or explore more?"
- options (ALL THREE REQUIRED):
  - "Create PROJECT.md" - Finalize and continue
  - "Ask more questions" - I'll dig into areas we haven't covered
  - "Let me add context" - You have more to share

If "Ask more questions" → identify gaps from coverage check → ask naturally → return to gate.

Loop until "Create PROJECT.md" selected.
</decision_gate>

<anti_patterns>
- **Interrogation** - Firing questions without building on answers
- **Checklist walking** - Going through domains regardless of conversation flow
- **Corporate speak** - "What are your success criteria?" "Who are your stakeholders?"
- **Rushing** - Minimizing questions to get to "the work"
- **Assuming** - Filling gaps with assumptions instead of asking
- **User skills** - NEVER ask about user's technical experience. Claude builds — user's skills are irrelevant.
- **Premature constraints** - Asking about tech stack before understanding the idea
- **Shallow acceptance** - Taking vague answers without probing for specifics
</anti_patterns>
</questioning_guide>
