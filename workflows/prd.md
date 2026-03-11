<purpose>
Mature a raw product concept into a structured PRD through three sequential stages with confidence-driven Q&A. Stores output at `.planning/prds/pending/{slug}.md`.
</purpose>

<input_modes>
The `concept` variable can be:
- **Raw text**: Any string that is not a valid file path or URL (e.g., "Auth system for multi-tenant SaaS")
- **File path**: If the input matches an existing file path on disk, read its content as the concept
- **URL**: If the input starts with `http://` or `https://`, fetch the page content as the concept source

Detection order:
1. Check if input starts with `http://` or `https://` → URL mode (fetch with WebFetch)
2. Check if input is a valid file path that exists → file mode (read with Read tool)
3. Otherwise → raw text mode
</input_modes>

<process>

## Step 0: Initialize

1. Detect input mode and extract concept content (see `<input_modes>` above).

2. Ask user for PRD slug:
   - Display: "What should this PRD be called? (slug format, e.g., auth-system, payment-flow)"
   - Validate: lowercase, hyphens only, no spaces — if invalid, prompt again
   - If `.planning/prds/pending/{slug}.md` already exists, warn user and append `-2` or ask to confirm overwrite

3. Create directory structure:
```bash
mkdir -p .planning/prds/pending
mkdir -p .planning/prds/done
```

4. Create empty PRD draft at `.planning/prds/pending/{slug}.md` from the template at `~/.claude/get-shit-done/templates/prd.md`.
   Replace `{slug}`, `{date}`, and `{concept_summary}` placeholders in the template.

5. Write the stage marker at the top of the PRD file:
```
<!-- stage: initialized -->
```

## Step 1: PM Discovery Stage

Display header:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► Stage 1/3: PM Discovery
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1a. Web Research

Perform competitive landscape research on the concept:

1. Identify 2-3 relevant search angles from the concept (e.g., "competitor products", "market category", "problem domain"):
   - For each angle, construct a search URL or use a known reference site
   - Fetch each URL using WebFetch: `WebFetch(url="{url}", prompt="Summarize key features, target users, and differentiators")`
   - If a fetch fails or returns irrelevant content, skip it and note "Research unavailable for this source"

2. If all fetches fail: print "Research unavailable — proceeding with concept description only" and continue to Q&A without blocking.

3. Synthesize research into a brief market context summary (3-5 bullet points):
   - Key competitor approaches
   - Target user patterns observed
   - Market gaps or opportunities

### 1b. Initial Gap Assessment

Before the Q&A loop, assess initial confidence based on the concept + research:

Set initial gaps list. For PM Discovery, standard blocking gaps are:
- target_user: "Who is the primary user persona?" (blocked if not clearly stated in concept)
- problem_severity: "How acute is this problem — is it a pain or a nice-to-have?" (blocked if unclear)
- market_differentiation: "What makes this different from existing solutions?" (blocked if unclear)
- success_definition: "What does user success look like 6 months after adoption?" (blocked if not stated)
- business_model: "Who pays and how?" (blocked if this is a commercial product concept — skip if internal tool)

Remove gaps that are already clearly answered by the concept or research.

Set initial confidence:
- 0 gaps: confidence = 0.85 (advance immediately)
- 1-2 gaps: confidence = 0.55
- 3+ gaps: confidence = 0.35

### 1c. Q&A Loop

Run the Q&A loop using the `<qa_loop_template>` pattern:
- max_rounds = 3
- max_questions = 4
- confidence_threshold = 0.80

**Round structure:**
```
Stage 1/3: PM Discovery — Round {N}/3
Current confidence: {X}% — blocking gaps: {list of remaining gap names}

[1-4 questions addressing the current gaps, numbered]
```

After each user reply:
- Map answers to gaps
- Mark gaps as resolved if the answer provides a clear, actionable decision
- Update confidence:
  - All gaps resolved → 0.85
  - 1-2 gaps remain → 0.65
  - 3+ gaps remain → 0.45
  - User defers ("you decide") → keep same confidence, do not resolve the gap

**Force-advance after round 3:** If confidence < 0.80 after round 3, proceed anyway. Add unresolved gaps to the PRD's Open Questions section.

### 1d. Write PM Section to PRD

After the Q&A loop completes, write the PM Discovery section to `.planning/prds/pending/{slug}.md`.

Replace the `{problem_statement}` placeholder with:
```markdown
## Problem Statement

**Target User:** {target_user answer}
**Problem:** {core problem from concept + Q&A}
**Current Solutions:** {from research — how people solve it today}
**Gap:** {what existing solutions don't do well}
```

Replace `{goals_list}` placeholder with:
```markdown
## Goals

- {goal 1 derived from success_definition answer}
- {goal 2}
- {goal 3}
*(Goals are user-facing outcomes, not features)*
```

Add market context as a comment block after the Problem Statement section:
```markdown
<!-- PM Discovery: Market Context
{market context summary from research — 3-5 bullets}
-->
```

### 1e. Update Stage Marker

Update the stage marker at the top of the PRD file:
- Find: `<!-- stage: initialized -->`
- Replace with: `<!-- stage: pm -->`

Then continue to Step 2: PO/BA Scoping Stage.

## Step 2: PO/BA Scoping Stage

Display header:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► Stage 2/3: PO/BA Scoping
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2a. Read Codebase Context

Scan the existing codebase to understand what has already been built:

```bash
ls -la .planning/prds/done/ 2>/dev/null || echo "No done PRDs yet"
```

Read each done PRD file (if any) to understand what user stories and features are already implemented. Summarize in a "Prior context" variable.

Also list existing source directories to understand the tech stack:
```bash
ls -d */ 2>/dev/null | grep -v ".planning\|node_modules\|.git" | head -20
```

Use this to understand: is this a greenfield or brownfield project? If brownfield, what domains are already covered?

### 2b. Initial Scoping Gap Assessment

Set initial scoping gaps for the Q&A:
- user_personas: "Who are the distinct user types that need different features?" (blocked if only one persona named in concept)
- core_actions: "What are the 3-5 core actions each user persona needs to do?" (blocked if not specified)
- mvp_scope: "Which of these actions are essential for MVP vs deferred to Phase 2?" (always blocked — requires explicit user decision)
- priority_story: "Which user story is the most critical to validate first?" (blocked if not clear)
- acceptance_evidence: "How does the user know each story is complete? (concrete behavior, not feature description)" (blocked if vague)

Set initial confidence:
- 0-1 gaps: confidence = 0.75 (close to threshold)
- 2-3 gaps: confidence = 0.50
- 4+ gaps: confidence = 0.30

Note: `mvp_scope` is always marked blocked — the MVP boundary MUST be defined through Q&A, never inferred.

### 2c. Q&A Loop

Run the Q&A loop using the `<qa_loop_template>` pattern:
- max_rounds = 3
- max_questions = 4
- confidence_threshold = 0.80

**Round structure:**
```
Stage 2/3: PO/BA Scoping — Round {N}/3
Current confidence: {X}% — blocking gaps: {list of remaining gap names}
Prior context: {brownfield/greenfield — done PRDs found: N}

[1-4 questions addressing the current gaps, numbered]
```

Focus questions on:
- User stories in "As a [user], I want [action] so that [outcome]" format
- Acceptance criteria: "The story is complete when [concrete testable behavior]"
- MVP line: "For MVP, include X, Y, Z. Defer A, B, C to Phase 2."

### 2d. Write PO Section to PRD

After the Q&A loop completes, write the PO Scoping section to `.planning/prds/pending/{slug}.md`.

Replace `{user_stories}` placeholder with:
```markdown
## User Stories

{For each user story derived from Q&A:}
**US-{N}: {story title}**
As a {persona}, I want to {action} so that {outcome}.

```

Replace `{acceptance_criteria}` placeholder with:
```markdown
## Acceptance Criteria

{For each user story:}
**US-{N} Acceptance Criteria:**
- [ ] {concrete testable condition 1}
- [ ] {concrete testable condition 2}
- [ ] {edge case: what happens when...}

```

Replace `{mvp_items}` and `{phase2_items}` placeholders with:
```markdown
## MVP Boundary

**MVP (Phase 1):**
- {user story or feature included in MVP}
- {user story or feature included in MVP}

**Phase 2 (deferred):**
- {user story or feature deferred}
- {user story or feature deferred}

```

### 2e. Write Assumptions Section (PRD-06)

Replace the `{assumptions}` placeholder with:
```markdown
## Assumptions

The following are assumed but not confirmed — GSD's research phase should validate these:

- {assumption 1 derived from Q&A gaps and brownfield/greenfield context}
- {assumption 2}
- {assumption 3}

*(Assumptions are things we've taken as given without proof. Each one is a risk that could change scope if invalidated.)*
```

Include in assumptions:
- Technology assumptions (e.g., "assumed to run on existing Node.js stack")
- User behavior assumptions (e.g., "assumed users have email verified before using this feature")
- Integration assumptions (e.g., "assumed Stripe is already integrated for payment features")
- Any gaps deferred from the Q&A (unresolved items become explicit assumptions)

### 2f. Update Stage Marker

Update the stage marker at the top of the PRD file:
- Find: `<!-- stage: pm -->`
- Replace with: `<!-- stage: po -->`

Then continue to Step 3: HL Tech Discovery Stage.

## Step 3: HL Tech Discovery Stage

Display header:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► Stage 3/3: HL Tech Discovery
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT — Scope guardrail for this stage:
Tech Discovery identifies WHAT technologies to consider and WHY.
It does NOT define HOW to implement. No schemas, API routes, or code.
```

### 3a. Technology Research

Research technology candidates for the product concept:

1. Identify 2-3 technology domains relevant to the concept (e.g., "real-time communication", "payment processing", "ML inference"):
   - For each domain, fetch 1-2 technology comparison pages via WebFetch
   - If fetches fail: proceed with Claude's existing knowledge of technology candidates

2. Review the User Stories and MVP Boundary from the PRD draft (already written by Stage 2) to understand what capabilities are needed:
   - Read `.planning/prds/pending/{slug}.md` to extract user stories and MVP scope
   - Map each MVP user story to the technology domains it requires

3. For each technology domain, identify:
   - **Primary candidate**: The leading technology for this domain in 2025-2026
   - **Alternative candidate**: A notable alternative with different tradeoffs
   - **Rationale**: Why the primary candidate is appropriate for this concept's scale and constraints

### 3b. Tech Q&A (optional)

If technology direction is clear from research and the concept, skip Q&A and proceed to 3c.

If unclear (e.g., multiple viable tech stacks with very different implications), run one Q&A round:
- max_rounds = 1
- max_questions = 4
- Questions focus on: scale requirements, team expertise, existing infrastructure constraints, cost sensitivity

### 3c. Write Tech Candidates Section

**CRITICAL INSTRUCTIONS for tech section content:**
- Write technology NAMES and RATIONALE only
- Acceptable: "PostgreSQL — relational database suitable for structured user data with complex queries"
- Acceptable: "WebSockets — enables real-time bidirectional communication for the live collaboration feature"
- NOT acceptable: SQL schema definitions, CREATE TABLE statements, API endpoint paths, TypeScript interfaces, class definitions, function signatures, deployment YAML configs, docker-compose files

Replace `{tech_candidates}` placeholder in `.planning/prds/pending/{slug}.md` with:

```markdown
## Tech Candidates

> This section lists WHAT technologies to consider and WHY. HOW to implement is determined by GSD's research phase.

{For each technology domain:}
### {Domain Name}
**Primary candidate:** {tech name} — {rationale: why it fits this concept's scale, requirements, and constraints}
**Alternative:** {tech name} — {when this alternative makes more sense}

{Repeat for each domain}

### Architectural Constraints
- {constraint 1 — e.g., "Must integrate with existing authentication layer"}
- {constraint 2 — e.g., "Must support mobile clients (not desktop-only tech)"}
```

### 3d. No-HOW Guard

After writing the tech section, run a content check on the PRD file to detect prohibited content:

Read the Tech Candidates section from `.planning/prds/pending/{slug}.md`.

Check for prohibited pattern indicators:
- SQL patterns: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `INSERT INTO`, `SELECT *`
- Schema patterns: `schema:`, `fields:`, `type:`, `interface `, `class `, `model:`
- Route patterns: `/api/`, `/v1/`, `endpoint`, `POST /`, `GET /`, `PUT /`, `DELETE /`
- Code patterns: `function `, `def `, `const `, `=>`, `return `, backtick code blocks with more than 2 lines

If ANY prohibited pattern is found:
```
No-HOW Guard: Prohibited content detected in Tech Candidates section.

Found: {list of prohibited patterns found}

Options:
1. Auto-clean — remove the prohibited content and keep only technology names + rationale
2. Rewrite — I'll rewrite the tech section with correct scope
3. Continue — keep as-is (not recommended)
```

Wait for user response. If auto-clean selected: remove lines containing prohibited patterns.
If rewrite selected: regenerate the tech section from scratch following the correct format.
If continue selected: add a warning comment to the PRD.

If NO prohibited patterns found:
```
No-HOW Guard: Tech section is clean — no schemas, routes, or code detected.
```

### 3e. Update Stage Marker

Update the stage marker at the top of the PRD file:
- Find: `<!-- stage: po -->`
- Replace with: `<!-- stage: complete -->`

Then continue to Step 4: Finalize.

## Step 4: Finalize

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PRD Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRD stored at: .planning/prds/pending/{slug}.md

Sections complete:
  - Problem Statement
  - Goals
  - User Stories ({N} stories)
  - Acceptance Criteria
  - MVP Boundary
  - Tech Candidates
  - Open Questions ({N} questions — from unresolved Q&A gaps)
  - Assumptions

Next step:
  /gsd:new-milestone --prd .planning/prds/pending/{slug}.md
```

</process>

<resume_support>
## Resume Support

If `.planning/prds/pending/{slug}.md` already exists with a stage marker, resume from the appropriate stage:
- `<!-- stage: initialized -->` → resume from Step 1 (PM Discovery)
- `<!-- stage: pm -->` → resume from Step 2 (PO/BA Scoping)
- `<!-- stage: po -->` → resume from Step 3 (HL Tech Discovery)
- `<!-- stage: complete -->` → PRD is done, display finalize message

To check for existing PRD: ask user for slug first, then check if file exists.
</resume_support>

<qa_loop_template>
## Confidence-Driven Q&A Loop (reusable pattern for all stages)

```
function qa_loop(stage_name, topic_context, max_rounds=3, max_questions=4, confidence_threshold=0.80):
  round = 1
  confidence = 0.0
  gaps = [initial blocking gaps for this stage]

  while confidence < confidence_threshold AND round <= max_rounds:
    print header: "Stage X/3: {stage_name} — Round {round}/{max_rounds}"
    print confidence: "Current confidence: {confidence*100:.0f}% — blocking gaps: {gaps}"

    questions = derive up to max_questions concrete questions that address the gaps
    Ask all questions in one turn (numbered list)

    Receive user answers.

    Update confidence based on answers:
      - All blocking gaps answered with clear decisions → confidence = 0.85 (sufficient)
      - Most gaps answered but 1-2 remain vague → confidence = 0.65 (needs more)
      - User answers are non-committal or defer to Claude → confidence = 0.50 (not sufficient)

    Update gaps list: remove resolved gaps, keep unresolved
    round += 1

  if confidence < confidence_threshold:
    // Force advance — log unresolved gaps to Open Questions section
    Append unresolved gaps to the PRD's Open Questions section
    Print: "Advancing to next stage — {len(gaps)} gap(s) added to Open Questions"

  return answers accumulated across all rounds
```

This template is used by all three stages. Each stage defines its own initial gaps.
</qa_loop_template>
