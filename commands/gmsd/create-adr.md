---
name: gmsd:create-adr
description: Create an Architecture Decision Record (MADR 4.0)
argument-hint: "<title> [--phase <N>]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Create an Architecture Decision Record documenting a significant technical decision using MADR 4.0 format.

**How it works:**
1. Scaffold an ADR file in `.planning/decisions/NNN-slug.org` (auto-numbered)
2. Walk the user through the decision structure: context, drivers, options, outcome
3. Fill in the ADR with concrete content from the conversation
4. Link to related phase context or other ADRs if applicable

**Output:** `NNN-slug.org` in `.planning/decisions/` — a complete ADR that future developers can reference to understand WHY an architectural choice was made.
</objective>

<execution_context>
@~/.claude/get-my-shit-done/templates/adr.org
</execution_context>

<process>
<step name="initialize" priority="first">
**Parse arguments:**
- Extract the decision title from the first argument
- Extract optional `--phase N` to link ADR to a specific phase
- If no title provided, ask: "What architectural decision do you need to document?"

**Check state:**
- Read `.planning/decisions/` to determine the next ADR number
- If the directory doesn't exist, it will be created by the scaffold
</step>

<step name="scaffold">
**Create the ADR file:**
Run the scaffold command:
```bash
node ~/.claude/get-my-shit-done/bin/gmsd-tools.cjs scaffold adr --name "<title>" [--phase <N>]
```

Read back the created file path from the output.
</step>

<step name="gather_context">
**Walk through MADR sections with the user:**

Ask focused questions to fill in the ADR:

1. **Context and Problem Statement**: "What problem or situation requires this decision? What constraints exist?"

2. **Decision Drivers**: "What are the key forces driving this choice?" (e.g., performance requirements, team expertise, cost, timeline, maintainability)

3. **Considered Options**: "What alternatives did you consider?" — aim for 2-4 realistic options, not strawmen.

4. **For each option**, gather:
   - Brief description
   - Key pros (Good, because...)
   - Key cons (Bad, because...)
   - Any neutral observations

5. **Decision Outcome**: "Which option did you choose, and why?" — tie justification back to the decision drivers.

6. **Consequences**:
   - Positive: What improves as a result?
   - Negative: What trade-offs are you accepting?

7. **Confirmation**: "How will you verify this decision was implemented correctly?" (review, test, fitness function)

Use `AskUserQuestion` for structured choices where possible. For open-ended sections, have a conversation and synthesize.
</step>

<step name="write_adr">
**Write the completed ADR:**

Update the scaffolded file with the gathered content. Ensure:
- Property drawer has correct metadata (status: proposed, date, phase if applicable)
- All MADR sections are filled with concrete, project-specific content
- Pros/cons use the `Good, because...` / `Bad, because...` format
- Decision outcome explicitly references the chosen option and ties to drivers

**Link to related artifacts:**
- If `--phase` was specified, mention the ADR in the phase's CONTEXT file
- If the decision supersedes a previous ADR, update both ADRs' property drawers
</step>

<step name="summary">
**Confirm with user:**
Show a brief summary:
- ADR number and title
- Chosen option
- Key trade-offs accepted
- File location

Ask if any adjustments are needed before finalizing.
</step>
</process>

<guidelines>
**Quality checks:**
- Every ADR must have at least 2 considered options (otherwise it's not really a decision)
- Negative consequences must be acknowledged — every decision has trade-offs
- Decision outcome must reference specific decision drivers
- Avoid vague language: "better performance" → "reduces API latency from 200ms to 50ms"

**When to create an ADR:**
- Choosing between technologies, frameworks, or libraries
- Deciding on data models, API patterns, or system architecture
- Making trade-offs between competing quality attributes (performance vs. maintainability)
- Any decision that a future developer might question: "why did they do it this way?"

**When NOT to create an ADR:**
- Implementation details within a decided architecture
- Obvious choices with no realistic alternatives
- Temporary decisions (use CONTEXT.org instead)
</guidelines>
