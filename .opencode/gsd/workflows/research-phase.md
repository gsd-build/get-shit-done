<purpose>
Comprehensive research on HOW to implement a phase before planning.

Triggered by /gsd/research-phase command when the domain is niche, complex, or Claude's training is likely stale.

Produces RESEARCH.md with ecosystem knowledge that informs quality planning - not just "which library" but "how do experts build this."
</purpose>

<when_to_use>
**This workflow is for domains where Claude fails without research:**
- 3D graphics (Three.js, Babylon.js, procedural generation, level design)
- Game development (physics engines, collision, AI, ECS patterns)
- Audio/music (Web Audio, DSP, synthesis, MIDI)
- Shaders (GLSL, Metal, ISF, compute shaders)
- ML/AI integration (model serving, inference, vector DBs)
- Real-time systems (WebSockets, WebRTC, CRDT sync)
- Specialized frameworks with active ecosystems Claude may not know

**Skip this for commodity domains:**
- Standard auth (JWT, OAuth)
- CRUD APIs
- Forms and validation
- Well-documented integrations (Stripe, SendGrid)
</when_to_use>

<key_insight>
The current "mandatory discovery" in plan-phase asks: "Which library should I use?"

This workflow asks: "What do I not know that I don't know?"

For niche domains, the question isn't library selection - it's:
- What's the established architecture pattern?
- What libraries form the standard stack?
- What problems do people commonly hit?
- What's SOTA vs what Claude thinks is SOTA?
- What should NOT be hand-rolled?
</key_insight>

<process>

<step name="validate_phase" priority="first">
Phase number: $ARGUMENTS (required)

Validate phase exists in roadmap:

```bash
if [ -f .planning/ROADMAP.md ]; then
  grep -A5 "Phase ${PHASE}:" .planning/ROADMAP.md
fi
```

**If phase not found:**
```
Error: Phase ${PHASE} not found in roadmap.

Use /gsd/progress to see available phases.
```
Exit workflow.

**If phase found:**
Extract:
- Phase number
- Phase name
- Phase description
- Any "Research: Likely" flags

Continue to check_existing.
</step>

<step name="check_existing">
Check if RESEARCH.md already exists for this phase:

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
ls .planning/phases/${PHASE}-*/${PHASE}-RESEARCH.md 2>/dev/null
```

**If exists:**
```
Phase ${PHASE} already has research: [path to RESEARCH.md]

What's next?
1. Update research - Refresh with new findings
2. View existing - Show me the current research
3. Skip - Use existing research as-is
```

Wait for user response.

If "Update research": Load existing RESEARCH.md, proceed to research with update mindset
If "View existing": Read and display RESEARCH.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:**
Continue to load_context.
</step>

<step name="load_context">
Load available context to inform research direction:

**1. Project context:**
```bash
cat .planning/PROJECT.md 2>/dev/null | head -50
```

**2. Phase context (if exists from /gsd/discuss-phase):**
```bash
cat .planning/phases/${PHASE}-*/${PHASE}-CONTEXT.md 2>/dev/null
```

If CONTEXT.md exists, use it to understand:
- User's specific goals for this phase
- Constraints mentioned
- Any preferences stated

**3. Prior phase decisions:**
```bash
cat .planning/STATE.md 2>/dev/null | grep -A20 "## Accumulated Decisions"
```

These may constrain technology choices.

Present what was found:
```
Research context for Phase ${PHASE}: ${PHASE_NAME}

Roadmap description: ${PHASE_DESCRIPTION}

[If CONTEXT.md exists:]
Phase context available - will incorporate user preferences.

[If prior decisions exist:]
Prior decisions to respect: [list relevant ones]

Proceeding with ecosystem research...
```
</step>

<step name="identify_domains">
Analyze the phase description to identify what needs researching.

**Ask: "What knowledge do I need to actually implement this well?"**

Categories to consider:

**1. Core Technology:**
- What's the primary technology/framework?
- What version is current? (Claude's training may be stale)
- What's the standard setup/toolchain?

**2. Ecosystem/Stack:**
- What libraries do experts pair with this?
- What's the "blessed" stack for this problem domain?
- What helper libraries exist that I might not know about?

**3. Architecture Patterns:**
- How do experts structure this type of project?
- What design patterns apply?
- What's the recommended project organization?

**4. Common Pitfalls:**
- What do beginners get wrong?
- What are the "gotchas" in this domain?
- What mistakes lead to rewrites?

**5. What NOT to Hand-Roll:**
- What existing solutions should be used instead of custom code?
- What problems look simple but have nasty edge cases?
- What libraries solve problems I don't know I have?

**6. Current State of the Art:**
- What's changed recently in this ecosystem?
- What approaches are now considered outdated?
- What new tools/patterns have emerged?

Present research scope:
```
Research domains identified:

1. Core: [e.g., "Three.js for 3D web graphics"]
2. Ecosystem: [e.g., "Physics engine, asset loading, controls"]
3. Patterns: [e.g., "Scene graph architecture, game loop patterns"]
4. Pitfalls: [e.g., "Performance, memory, mobile compatibility"]
5. Don't hand-roll: [e.g., "Physics, collision detection, procedural generation"]
6. SOTA check: [e.g., "WebGPU vs WebGL, drei ecosystem"]

Proceeding with comprehensive research...
```
</step>

<step name="execute_research">
Execute research systematically for each domain identified.

**CRITICAL: Source hierarchy - Context7 BEFORE WebSearch**

Claude's training data is 6-18 months stale. Treat pre-existing knowledge as hypothesis, not fact.

<research_protocol>

**For each domain, in order:**

**1. Context7 First (authoritative, current):**
```
For core technology:
- mcp__context7__resolve-library-id with libraryName: "[main technology]"
- mcp__context7__get-library-docs with topic: "getting started"
- mcp__context7__get-library-docs with topic: "[specific concern]"

For ecosystem libraries:
- Resolve and fetch docs for each major library
- Focus on integration patterns, not just API reference
```

**2. Official Documentation:**
- Use WebFetch for official docs not in Context7
- Check for "ecosystem" or "community" pages
- Look for "awesome-{technology}" lists
- Check GitHub trending/stars for the domain

**3. WebSearch for Ecosystem Discovery:**
```
Ecosystem discovery queries (use {current_year}):
- "[technology] best practices {current_year}"
- "[technology] recommended libraries {current_year}"
- "[technology] common mistakes"
- "[technology] vs [alternative] {current_year}"
- "how to build [type of thing] with [technology]"
- "[technology] performance optimization"
- "[technology] project structure"

For niche domains:
- "[technology] tutorials {current_year}"
- "[technology] examples github"
- "[technology] showcase"
```

**4. Cross-Verification (MANDATORY):**
Every WebSearch finding MUST be verified:
- Check Context7 or official docs to confirm
- Mark confidence level (HIGH if verified, MEDIUM if partially verified, LOW if WebSearch only)
- Flag contradictions between sources

</research_protocol>

<research_execution>
Execute research queries and document findings as you go:

**Core Technology Findings:**
- Current version: [from Context7]
- Key changes since [Claude's training]: [from docs/WebSearch]
- Setup approach: [verified pattern]

**Ecosystem Stack:**
- [Library 1]: [what it does, why it's standard, version]
- [Library 2]: [what it does, why it's standard, version]
- [Library 3]: [what it does, why it's standard, version]

**Architecture Patterns:**
- [Pattern 1]: [what it is, when to use]
- [Pattern 2]: [what it is, when to use]
- Project structure: [recommended organization]

**Common Pitfalls:**
- [Pitfall 1]: [what goes wrong, how to avoid]
- [Pitfall 2]: [what goes wrong, how to avoid]
- [Pitfall 3]: [what goes wrong, how to avoid]

**Don't Hand-Roll:**
- [Problem]: Use [library] instead because [reason]
- [Problem]: Use [library] instead because [reason]

**SOTA Updates:**
- [Old approach]: Now superseded by [new approach]
- [New tool]: [what it enables]
</research_execution>

</step>

<step name="quality_check">
Before creating RESEARCH.md, run through research-pitfalls.md checklist:

**From ~/.config/opencode/gsd/references/research-pitfalls.md:**

- [ ] All enumerated items investigated (not just some)
- [ ] Negative claims verified with official docs
- [ ] Multiple sources cross-referenced for critical claims
- [ ] URLs provided for authoritative sources
- [ ] Publication dates checked (prefer recent/current)
- [ ] Tool/environment-specific variations documented
- [ ] Confidence levels assigned honestly
- [ ] Assumptions distinguished from verified facts
- [ ] "What might I have missed?" review completed

**Additional checks for ecosystem research:**
- [ ] Checked for libraries Claude might not know about
- [ ] Verified version numbers are current
- [ ] Confirmed patterns still recommended (not deprecated)
- [ ] Looked for "don't do this" warnings in docs
- [ ] Checked for breaking changes in recent versions
</step>

<step name="write_research">
Create RESEARCH.md using accumulated findings.

**File location:** `.planning/phases/${PHASE}-${SLUG}/${PHASE}-RESEARCH.md`

**If phase directory doesn't exist:**
Create it: `.planning/phases/${PHASE}-${SLUG}/`

Use template from ~/.config/opencode/gsd/templates/research.md

Populate sections with verified findings from research execution.

**Critical content requirements:**

**1. Standard Stack section:**
- List specific libraries with versions
- Explain what each does and why it's standard
- Note any alternatives and when to use them

**2. Architecture Patterns section:**
- Document recommended patterns with code examples if available
- Include project structure recommendations
- Note what patterns to avoid

**3. Don't Hand-Roll section:**
- Be explicit about what problems have existing solutions
- Explain why custom solutions are worse
- List the libraries to use instead

**4. Common Pitfalls section:**
- Specific mistakes with explanations
- How to avoid each
- Warning signs to watch for

**5. Code Examples section:**
- Include verified code patterns from Context7/official docs
- Show the "right way" to do common operations
- Note any gotchas in the examples

Write file.
</step>

<step name="confirm_creation">
Present RESEARCH.md summary to user:

```
Created: .planning/phases/${PHASE}-${SLUG}/${PHASE}-RESEARCH.md

## Research Summary

**Domain:** [what was researched]

**Standard Stack:**
- [Library 1] - [brief what/why]
- [Library 2] - [brief what/why]
- [Library 3] - [brief what/why]

**Key Patterns:**
- [Pattern 1]
- [Pattern 2]

**Don't Hand-Roll:**
- [Thing 1] - use [library] instead
- [Thing 2] - use [library] instead

**Top Pitfalls:**
- [Pitfall 1]
- [Pitfall 2]

**Confidence:** [HIGH/MEDIUM/LOW] - [brief reason]

What's next?
1. Plan this phase (/gsd/plan-phase ${PHASE}) - RESEARCH.md will be loaded automatically
2. Dig deeper - Research specific areas more thoroughly
3. Review full RESEARCH.md
4. Done for now
```
</step>

<step name="git_commit">
Commit phase research:

```bash
git add .planning/phases/${PHASE}-${SLUG}/${PHASE}-RESEARCH.md
git commit -m "$(cat <<'EOF'
docs(${PHASE}): complete phase research

Phase ${PHASE}: ${PHASE_NAME}
- Standard stack identified
- Architecture patterns documented
- Common pitfalls catalogued
EOF
)"
```

Confirm: "Committed: docs(${PHASE}): complete phase research"
</step>

</process>

<success_criteria>
- [ ] Phase validated against roadmap
- [ ] Research domains identified from phase description
- [ ] Context7 consulted for all relevant libraries
- [ ] Official docs consulted where Context7 lacks coverage
- [ ] WebSearch used for ecosystem discovery
- [ ] All WebSearch findings cross-verified
- [ ] Quality checklist completed
- [ ] RESEARCH.md created with comprehensive ecosystem knowledge
- [ ] Standard stack documented with versions
- [ ] Architecture patterns documented
- [ ] "Don't hand-roll" list is clear and actionable
- [ ] Common pitfalls catalogued
- [ ] Confidence levels assigned honestly
- [ ] RESEARCH.md committed to git
- [ ] User knows next steps (plan phase)
</success_criteria>

<integration_with_planning>
When /gsd/plan-phase runs after research:

1. plan-phase detects RESEARCH.md exists in phase directory
2. RESEARCH.md loaded as @context reference
3. "Standard stack" informs library choices in tasks
4. "Don't hand-roll" prevents custom solutions where libraries exist
5. "Common pitfalls" inform verification criteria
6. "Architecture patterns" inform task structure
7. "Code examples" can be referenced in task actions

This produces higher quality plans because Claude knows:
- What tools experts use
- What patterns to follow
- What mistakes to avoid
- What NOT to build from scratch
</integration_with_planning>
