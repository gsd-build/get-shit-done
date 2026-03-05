<purpose>
Execute discovery at the appropriate depth level.
Produces DISCOVERY.md (for Level 2-3) that informs PLAN.md creation.

Called from plan-phase.md's mandatory_discovery step with a depth parameter.

NOTE: For comprehensive ecosystem research ("how do experts build this"), use /gsd:research-phase instead, which produces RESEARCH.md.
</purpose>

<depth_levels>
**This workflow supports three depth levels:**

| Level | Name         | Time      | Output                                       | When                                      |
| ----- | ------------ | --------- | -------------------------------------------- | ----------------------------------------- |
| 1     | Quick Verify | 2-5 min   | No file, proceed with verified knowledge     | Single library, confirming current syntax |
| 2     | Standard     | 15-30 min | DISCOVERY.md                                 | Choosing between options, new integration |
| 3     | Deep Dive    | 1+ hour   | Detailed DISCOVERY.md with validation gates  | Architectural decisions, novel problems   |

**Depth is determined by plan-phase.md before routing here.**
</depth_levels>

<source_hierarchy>
**MANDATORY: MCP Tools BEFORE WebSearch**

Claude's training data is 6-18 months stale. Always verify.

1. **GitMCP** - GitHub repository documentation (unlimited, free)
2. **Docfork** - Library APIs and documentation (9K+ libraries, 1K/month free)
3. **WebFetch** - Official docs not in MCP servers
4. **WebSearch LAST** - For comparisons and trends only

See ~/.claude/get-shit-done/templates/discovery.md `<discovery_protocol>` for full protocol.
</source_hierarchy>

<process>

<step name="determine_depth">
Check the depth parameter passed from plan-phase.md:
- `depth=verify` → Level 1 (Quick Verification)
- `depth=standard` → Level 2 (Standard Discovery)
- `depth=deep` → Level 3 (Deep Dive)

Route to appropriate level workflow below.
</step>

<step name="level_1_quick_verify">
**Level 1: Quick Verification (2-5 minutes)**

For: Single known library, confirming syntax/version still correct.

**Process:**

1. Choose appropriate MCP tool:
   - GitHub repo? Use GitMCP
   - Library API? Use Docfork

2. Fetch relevant docs:

   **GitMCP:**
   ```
   mcp__gitmcp__fetch_documentation (primary docs)
   mcp__gitmcp__search_documentation with query: "[specific concern]"
   ```

   **Docfork:**
   ```
   Query with library name and specific topic
   ```

3. Verify:

   - Current version matches expectations
   - API syntax unchanged
   - No breaking changes in recent versions

4. **If verified:** Return to plan-phase.md with confirmation. No DISCOVERY.md needed.

5. **If concerns found:** Escalate to Level 2.

**Output:** Verbal confirmation to proceed, or escalation to Level 2.
</step>

<step name="level_2_standard">
**Level 2: Standard Discovery (15-30 minutes)**

For: Choosing between options, new external integration.

**Process:**

1. **Identify what to discover:**

   - What options exist?
   - What are the key comparison criteria?
   - What's our specific use case?

2. **MCP tools for each option:**

   **For GitHub projects:**
   ```
   - mcp__gitmcp__fetch_documentation
   - mcp__gitmcp__search_documentation with relevant queries
   - mcp__gitmcp__search_code (for implementation patterns)
   ```

   **For library APIs:**
   ```
   - Docfork: Query with library name and topic
   ```

3. **WebFetch** for official docs not covered by MCPs.

4. **WebSearch** for comparisons:

   - "[option A] vs [option B] {current_year}"
   - "[option] known issues"
   - "[option] with [our stack]"

5. **Cross-verify:** Any WebSearch finding → confirm with GitMCP/Docfork/official docs.

6. **Create DISCOVERY.md** using ~/.claude/get-shit-done/templates/discovery.md structure:

   - Summary with recommendation
   - Key findings per option
   - Code examples from GitMCP/Docfork
   - Confidence level (should be MEDIUM-HIGH for Level 2)

7. Return to plan-phase.md.

**Output:** `.planning/phases/XX-name/DISCOVERY.md`
</step>

<step name="level_3_deep_dive">
**Level 3: Deep Dive (1+ hour)**

For: Architectural decisions, novel problems, high-risk choices.

**Process:**

1. **Scope the discovery** using ~/.claude/get-shit-done/templates/discovery.md:

   - Define clear scope
   - Define include/exclude boundaries
   - List specific questions to answer

2. **Exhaustive MCP research:**

   **GitMCP for GitHub projects:**
   - Fetch complete documentation
   - Search for specific patterns and concepts
   - Review code examples and implementations

   **Docfork for libraries:**
   - All relevant libraries
   - Related patterns and concepts
   - Multiple topics per library if needed

3. **Official documentation deep read via WebFetch:**

   - Architecture guides
   - Best practices sections
   - Migration/upgrade guides
   - Known limitations

4. **WebSearch for ecosystem context:**

   - How others solved similar problems
   - Production experiences
   - Gotchas and anti-patterns
   - Recent changes/announcements

5. **Cross-verify ALL findings:**

   - Every WebSearch claim → verify with GitMCP/Docfork/official docs
   - Mark what's verified vs assumed
   - Flag contradictions

6. **Create comprehensive DISCOVERY.md:**

   - Full structure from ~/.claude/get-shit-done/templates/discovery.md
   - Quality report with source attribution
   - Confidence by finding
   - If LOW confidence on any critical finding → add validation checkpoints

7. **Confidence gate:** If overall confidence is LOW, present options before proceeding.

8. Return to plan-phase.md.

**Output:** `.planning/phases/XX-name/DISCOVERY.md` (comprehensive)
</step>

<step name="identify_unknowns">
**For Level 2-3:** Define what we need to learn.

Ask: What do we need to learn before we can plan this phase?

- Technology choices?
- Best practices?
- API patterns?
- Architecture approach?
  </step>

<step name="create_discovery_scope">
Use ~/.claude/get-shit-done/templates/discovery.md.

Include:

- Clear discovery objective
- Scoped include/exclude lists
- Source preferences (GitMCP, Docfork, official docs, current year)
- Output structure for DISCOVERY.md
  </step>

<step name="execute_discovery">
Run the discovery:
- Use GitMCP for GitHub repository docs
- Use Docfork for library API docs
- Use WebFetch for official documentation
- Use WebSearch for current info and comparisons
- Prefer current year sources
- Structure findings per template
</step>

<step name="create_discovery_output">
Write `.planning/phases/XX-name/DISCOVERY.md`:
- Summary with recommendation
- Key findings with sources
- Code examples if applicable
- Metadata (confidence, dependencies, open questions, assumptions)
</step>

<step name="confidence_gate">
After creating DISCOVERY.md, check confidence level.

If confidence is LOW:
Use AskUserQuestion:

- header: "Low Conf."
- question: "Discovery confidence is LOW: [reason]. How would you like to proceed?"
- options:
  - "Dig deeper" - Do more research before planning
  - "Proceed anyway" - Accept uncertainty, plan with caveats
  - "Pause" - I need to think about this

If confidence is MEDIUM:
Inline: "Discovery complete (medium confidence). [brief reason]. Proceed to planning?"

If confidence is HIGH:
Proceed directly, just note: "Discovery complete (high confidence)."
</step>

<step name="open_questions_gate">
If DISCOVERY.md has open_questions:

Present them inline:
"Open questions from discovery:

- [Question 1]
- [Question 2]

These may affect implementation. Acknowledge and proceed? (yes / address first)"

If "address first": Gather user input on questions, update discovery.
</step>

<step name="offer_next">
```
Discovery complete: .planning/phases/XX-name/DISCOVERY.md
Recommendation: [one-liner]
Confidence: [level]

What's next?

1. Discuss phase context (/gsd:discuss-phase [current-phase])
2. Create phase plan (/gsd:plan-phase [current-phase])
3. Refine discovery (dig deeper)
4. Review discovery

```

NOTE: DISCOVERY.md is NOT committed separately. It will be committed with phase completion.
</step>

</process>

<success_criteria>
**Level 1 (Quick Verify):**
- GitMCP/Docfork consulted for library/topic
- Current state verified or concerns escalated
- Verbal confirmation to proceed (no files)

**Level 2 (Standard):**
- GitMCP/Docfork consulted for all options
- WebSearch findings cross-verified
- DISCOVERY.md created with recommendation
- Confidence level MEDIUM or higher
- Ready to inform PLAN.md creation

**Level 3 (Deep Dive):**
- Discovery scope defined
- GitMCP/Docfork exhaustively consulted
- All WebSearch findings verified against authoritative sources
- DISCOVERY.md created with comprehensive analysis
- Quality report with source attribution
- If LOW confidence findings → validation checkpoints defined
- Confidence gate passed
- Ready to inform PLAN.md creation
</success_criteria>
