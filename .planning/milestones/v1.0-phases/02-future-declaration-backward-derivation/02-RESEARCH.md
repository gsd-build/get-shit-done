# Phase 2: Future Declaration + Backward Derivation - Research

**Researched:** 2026-02-16
**Domain:** Guided conversational flows via Claude Code slash commands, Socratic reframing of user language, backward derivation from declarations to milestones/actions, graph population with milestone merging
**Confidence:** HIGH

## Summary

Phase 2 is primarily an **agent-prompt engineering** phase, not a traditional library/framework phase. The system already has the graph engine (DeclareDag), artifact parsers (future.js, milestones.js), and CLI infrastructure (declare-tools.cjs, slash commands) from Phase 1. Phase 2 builds on top of these to create two new conversational flows -- declaration capture and backward derivation -- plus tooling commands to support them.

The core technical challenges are: (1) designing a slash command that guides a multi-turn conversation to produce declarations meeting quality criteria, (2) implementing language detection patterns that distinguish past-derived, goal-based, and genuinely declared-future language, (3) deriving milestones and actions backward through iterative "what must be true?" questioning, and (4) merging shared milestones across declarations while maintaining the graph's structural integrity. All four are agent-side (prompt/workflow) problems, not library problems. The tooling layer needs modest extensions: new subcommands for adding declarations/milestones/actions to the graph files atomically.

**Primary recommendation:** Build two new slash commands (`/declare:future` for declaration capture, `/declare:derive` for backward derivation) with corresponding workflow files. Extend declare-tools.cjs with `add-declaration`, `add-milestone`, `add-action`, and `load-graph` subcommands. Language detection and NSR validation are agent responsibilities embedded in workflow prompts, not code-level NLP.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Declaration Flow:**
- Guided prompts to draw out declarations (e.g., "What's true when this project succeeds?") -- not blank canvas
- Target 3-5 declarations per session -- focused set, enough to define the future without overwhelm
- Refine inline: each declaration gets refined through dialogue before moving to the next
- Declarations can be added or modified anytime after the initial session -- system re-derives affected milestones

**Socratic Correction:**
- Persistent guide: keep reframing until declaration is future-stated (2-3 attempts before accepting)
- Explain the philosophy: brief explanation of why reframing matters ("Declarations work from the future, not against the past")
- Show before/after comparison only when the change is significant enough to warrant it
- Detect both problem-reactive language ("I want X because Y is broken") AND goal language ("I want to achieve X") -- both are past-derived, not declared futures

**Backward Derivation:**
- Collaborative: system proposes milestones, user confirms/adjusts each one before moving deeper
- Derive until atomic: keep deriving until actions are small enough to execute directly (not fixed at two levels)
- Show the backward logic explicitly: "For X to be true, what must be true?" -- makes the thinking visible, teaches the user
- Merge shared milestones: when milestones from different declarations overlap, merge into single milestones with multiple parent declarations (leveraging the graph structure)

**Declaration Quality:**
- Present tense fact: "Our deployment pipeline delivers zero-downtime releases" -- stated as already true
- Declarations must be fully independent -- relationships emerge through shared milestones, not explicit references
- NSR criteria: every declaration must be Necessary, Sufficient, and Relevant
- Active NSR validation during the flow -- system checks each declaration as it's captured and flags issues
- When NSR fails: explain which criteria failed and help the user rewrite (Socratic approach, not auto-correction)

### Claude's Discretion

- Exact guided prompt questions and sequencing
- How to determine "atomic enough" for action derivation depth
- Internal detection patterns for past-derived and goal language
- Graph merge algorithm for overlapping milestones

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >= 18.0.0 | Runtime | LTS baseline, matches Phase 1 |
| JavaScript (CJS) | ES2022 | Language | Matches Phase 1 -- JSDoc + @ts-check, CJS modules |
| esbuild | ^0.27.0 | Bundler | Existing from Phase 1 -- rebundle declare-tools.cjs after extending |
| node:test | built-in | Test runner | Matches Phase 1 pattern |
| node:assert | built-in | Assertions | Matches Phase 1 pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | built-in | File I/O | Reading/writing FUTURE.md, MILESTONES.md |
| node:path | built-in | Path resolution | Artifact path construction |
| node:child_process | built-in | Git operations | Atomic commits after graph changes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prompt-based language detection | NLP library (compromise, natural) | Overkill -- Claude IS the NLP engine. Detection patterns live in the agent prompt, not in code. Adding an NLP library would duplicate what Claude does natively. |
| Manual graph merge logic | Graph library (graphlib) | The merge operation is specific to the 3-layer DAG model. A general graph library doesn't help. ~30 lines of custom code handles the merge case. |
| Separate declaration store | SQLite/JSON cache | User locked "markdown-only persistence" in Phase 1. No new storage formats. |

**Installation:**
```bash
# No new dependencies. Phase 2 uses Phase 1's stack entirely.
# Only rebuild the bundle after code changes:
npx esbuild src/declare-tools.js --bundle --platform=node --outfile=dist/declare-tools.cjs --format=cjs
```

## Architecture Patterns

### Recommended Project Structure (Phase 2 Additions)

```
declare-cc/
├── src/
│   ├── graph/
│   │   └── engine.js              # EXISTING -- may need nextId() used more
│   ├── artifacts/
│   │   ├── future.js              # EXISTING -- no changes needed
│   │   └── milestones.js          # EXISTING -- no changes needed
│   ├── commands/
│   │   ├── init.js                # EXISTING
│   │   ├── status.js              # EXISTING
│   │   ├── help.js                # EXISTING
│   │   ├── add-declaration.js     # NEW -- add declaration to FUTURE.md + graph
│   │   ├── add-milestone.js       # NEW -- add milestone to MILESTONES.md + graph
│   │   ├── add-action.js          # NEW -- add action to MILESTONES.md + graph
│   │   └── load-graph.js          # NEW -- load full graph as JSON (for agent consumption)
│   ├── git/
│   │   └── commit.js              # EXISTING
│   └── declare-tools.js           # EXTEND -- add new subcommand dispatch
├── commands/
│   └── declare/
│       ├── init.md                # EXISTING
│       ├── status.md              # EXISTING
│       ├── help.md                # EXISTING
│       ├── future.md              # NEW -- declaration capture flow
│       └── derive.md              # NEW -- backward derivation flow
├── workflows/
│   ├── future.md                  # NEW -- guided declaration conversation
│   └── derive.md                  # NEW -- backward derivation conversation
└── dist/
    └── declare-tools.cjs          # REBUILD after changes
```

### Pattern 1: Conversational Guided Flow (Slash Command + Workflow)

**What:** A slash command (.md in commands/declare/) references a workflow file that defines the multi-turn conversation structure. The slash command is a thin wrapper; the workflow contains the full logic.

**When to use:** Both `/declare:future` (declaration capture) and `/declare:derive` (backward derivation).

**Why this pattern:** This is exactly how GSD's `/gsd:discuss-phase` works -- the command file defines the entry point, allowed tools, and context injection; the workflow file defines the conversation steps, decision gates, and output format. The pattern is proven in the existing codebase.

**Example structure for `/declare:future`:**

```yaml
# ~/.claude/commands/declare/future.md
---
description: Declare futures through guided conversation
argument-hint: "[--add]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

Guided future declaration flow.

**Step 1: Load current graph state.**

```bash
node /path/to/dist/declare-tools.cjs load-graph
```

Parse JSON output to understand existing declarations.

**Step 2: Execute the declaration workflow.**

@/path/to/workflows/future.md

Follow the workflow steps to guide the user through declaration capture.

**Step 3: Persist each declaration.**

For each captured declaration:
```bash
node /path/to/dist/declare-tools.cjs add-declaration --title "..." --statement "..." --status PENDING
```
```

### Pattern 2: Agent-Side Language Detection (Prompt Engineering)

**What:** Past-derived and goal-based language detection is implemented as patterns within the agent prompt, not as code-level NLP. Claude's language understanding IS the detection engine.

**When to use:** During declaration capture, when evaluating each user statement.

**Why this pattern:** Claude natively understands the semantic difference between "Our deployment pipeline delivers zero-downtime releases" (declared future) and "I want to fix our broken deployment pipeline" (past-derived) or "We need to achieve zero-downtime deployments" (goal language). Coding regex patterns for this would be both brittle and inferior to Claude's native capability.

**Example detection patterns for the workflow prompt:**

```markdown
## Language Detection Guide

When the user proposes a declaration, classify it:

**Declared Future (ACCEPT):**
- Present tense, stated as fact: "Our API handles 10K RPS with <50ms p99"
- No causal reference to problems: stands on its own
- No aspirational language: not "we will" or "we aim to"

**Past-Derived (REFRAME):**
- References a problem: "I want X because Y is broken/slow/bad"
- Reactive framing: "We need to stop/fix/prevent X"
- Complaint-rooted: the energy comes from what's wrong, not what's possible
- Example: "I want to fix our flaky tests" -> Reframe: "Our test suite is deterministic and trustworthy"

**Goal Language (REFRAME):**
- Future aspirational: "I want to achieve X" / "Our goal is X"
- Conditional: "We should be able to X"
- Requirement framing: "The system needs to X"
- Example: "We want to achieve 99.9% uptime" -> Reframe: "Our system maintains 99.9% uptime"

**Reframing approach:**
1. Acknowledge the intent: "I hear what you're pointing at."
2. Explain briefly: "Declarations work from the future, not against the past."
3. Offer reframe: "What if we stated it as: '[reframed version]'?"
4. If user pushes back, try once more with a different angle.
5. After 2-3 attempts, accept their version with a note.
```

**Confidence:** HIGH -- this is how GSD's discuss-phase already handles nuanced conversation guidance through prompt engineering, not code.

### Pattern 3: Tooling Subcommands for Atomic Graph Mutations

**What:** New declare-tools.cjs subcommands (`add-declaration`, `add-milestone`, `add-action`) that read the current graph files, add a node with the next available ID, update edges, write both files atomically, and commit.

**When to use:** When the agent workflow needs to persist a declaration, milestone, or action to disk.

**Why this pattern:** The slash command (running as Claude) cannot directly call JavaScript functions -- it shells out to declare-tools.cjs. Each mutation must be a CLI subcommand that outputs JSON for the agent to parse.

**Example implementation:**

```javascript
// src/commands/add-declaration.js
function runAddDeclaration(cwd, args) {
  const title = parseFlag(args, '--title');
  const statement = parseFlag(args, '--statement');

  // Load existing graph
  const { dag, declarations, milestones, actions } = loadGraph(cwd);

  // Generate next ID
  const id = dag.nextId('declaration');

  // Add to graph
  dag.addNode(id, 'declaration', title, 'PENDING', { statement });

  // Write FUTURE.md with new declaration
  const newDecl = { id, title, statement, status: 'PENDING', milestones: [] };
  const allDecls = [...declarations, newDecl];
  const futureContent = writeFutureFile(allDecls, projectName);
  writeFileSync(futurePath, futureContent, 'utf-8');

  // Atomic commit
  commitPlanningDocs(cwd, `declare: add declaration ${id}`, ['.planning/FUTURE.md']);

  return { id, title, statement, status: 'PENDING' };
}
```

### Pattern 4: Backward Derivation as Iterative Agent Conversation

**What:** The derivation flow is a multi-turn conversation where Claude proposes milestones/actions, the user confirms/adjusts, and the system persists each level before going deeper.

**When to use:** `/declare:derive` command.

**Why this pattern:** Locked decision: "Collaborative: system proposes milestones, user confirms/adjusts each one before moving deeper." This is a conversation, not an automated batch process.

**Derivation algorithm (agent-driven):**

```
For each declaration D:
  1. Ask: "For [D statement] to be true, what must be true?"
  2. Propose 2-4 milestones
  3. User confirms/adjusts each milestone
  4. Persist confirmed milestones (add-milestone + edge to D)

  For each confirmed milestone M:
    5. Ask: "For [M title] to be true, what must be done?"
    6. Propose 2-4 actions (or sub-milestones if not atomic)
    7. User confirms/adjusts each
    8. Check atomicity: "Is this small enough to execute directly?"
       - YES: Persist as action (add-action + edge to M)
       - NO: Persist as milestone, recurse to step 5
    9. Persist confirmed items

After all declarations derived:
  10. Scan for overlapping milestones across declarations
  11. Propose merges: "M-03 and M-07 both describe [X]. Merge into one?"
  12. User confirms/adjusts merges
  13. Execute merges (update edges, remove duplicate node)
```

### Pattern 5: Milestone Merge Algorithm (Claude's Discretion)

**What:** When milestones from different declarations describe the same condition, merge them into a single milestone with multiple parent edges.

**When to use:** After initial derivation pass, before final persistence.

**Recommended algorithm:**

```javascript
// After all milestones are derived, detect potential merges
function detectMerges(dag) {
  const milestones = dag.getMilestones();
  const candidates = [];

  for (let i = 0; i < milestones.length; i++) {
    for (let j = i + 1; j < milestones.length; j++) {
      const a = milestones[i];
      const b = milestones[j];

      // Check if they realize different declarations (merge opportunity)
      const aParents = dag.getUpstream(a.id);
      const bParents = dag.getUpstream(b.id);
      const differentParents = !aParents.every(p => bParents.some(bp => bp.id === p.id));

      if (differentParents) {
        // Semantic similarity check is done by Claude, not by code
        candidates.push({ a: a.id, b: b.id, aTitle: a.title, bTitle: b.title });
      }
    }
  }

  return candidates;
}

// Merge: keep milestone A, redirect B's edges to A, remove B
function mergeMilestones(dag, keepId, removeId) {
  // Move all downEdges (children) from removeId to keepId
  const children = dag.getDownstream(removeId);
  for (const child of children) {
    dag.removeEdge(child.id, removeId);
    dag.addEdge(child.id, keepId);
  }

  // Move all upEdges (parents) from removeId to keepId
  const parents = dag.getUpstream(removeId);
  for (const parent of parents) {
    dag.removeEdge(removeId, parent.id);
    // Only add if not already connected
    if (!dag.upEdges.get(keepId).has(parent.id)) {
      dag.addEdge(keepId, parent.id);
    }
  }

  dag.removeNode(removeId);
}
```

**Key insight:** Semantic similarity detection (are these milestones really the same?) is Claude's job via the workflow prompt. The code only handles the structural graph merge once Claude and the user agree.

**Confidence:** HIGH -- the graph engine already supports all needed operations (addEdge, removeEdge, removeNode, getUpstream, getDownstream). The merge is a sequence of existing primitives.

### Pattern 6: NSR Validation (Agent-Side)

**What:** Necessary, Sufficient, and Relevant validation of declarations, performed by Claude during the capture flow.

**When to use:** After each declaration is captured, before persisting.

**Implementation approach (in workflow prompt):**

```markdown
## NSR Validation

After the user provides a declaration, validate against NSR:

**Necessary:** Is this declaration needed? Would the declared future be incomplete without it?
- FAIL signal: Declaration overlaps significantly with another declaration
- FAIL signal: Declaration is a sub-case of another declaration
- Response: "This seems to overlap with [other declaration]. Could we combine them, or is there a distinct aspect I'm missing?"

**Sufficient:** Does this declaration, combined with others, fully describe the future?
- Note: Sufficiency is checked across the SET, not per-declaration
- After 3-5 declarations: "Looking at these together, is there an aspect of the future we haven't declared?"

**Relevant:** Is this declaration about THIS project's future?
- FAIL signal: Declaration is about a different domain or scope
- FAIL signal: Declaration is too generic ("Our code is good")
- Response: "This feels broader than [project scope]. Can we make it more specific to what this project delivers?"
```

**Confidence:** HIGH -- this is pure prompt engineering, leveraging Claude's reasoning about logical criteria.

### Anti-Patterns to Avoid

- **Code-level NLP for language detection:** Do not build regex patterns or keyword lists to detect past-derived language. Claude's language model IS the detector. Put detection guidance in the workflow prompt, not in code.
- **Batch derivation without user confirmation:** Locked decision says "collaborative -- system proposes, user confirms/adjusts each one." Never auto-derive the full tree without stopping for user input at each level.
- **Fixed derivation depth:** Locked decision says "derive until atomic, not fixed at two levels." The derivation loop must check atomicity and recurse if needed, not hardcode declaration->milestone->action as exactly two levels.
- **Separate milestone files per declaration:** Milestones go in a single MILESTONES.md (Phase 1 decision). When milestones are shared across declarations, they appear once in the table with multiple entries in the "Realizes" column.
- **Overwriting FUTURE.md on re-derive:** Locked decision says declarations can be modified anytime and the system re-derives affected milestones. Re-derivation should update, not replace.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Language classification (past/goal/future) | Regex patterns or keyword lists | Claude's native language understanding via prompt | Claude is literally an NLP engine. Prompt-based detection is more accurate than any regex. |
| Semantic similarity for milestone merge | TF-IDF, embeddings, fuzzy matching | Claude's reasoning via workflow prompt | The agent proposes merges based on understanding; the code just executes the structural merge. |
| Conversation state management | Custom state machine in code | Claude Code's conversation context | The slash command conversation IS the state. No need to track "which step are we on" in code. |
| NSR validation logic | Rule engine or decision tree | Claude's reasoning via prompt criteria | The criteria are semantic (Necessary, Sufficient, Relevant), not syntactic. |
| ID generation | UUID or random IDs | DeclareDag.nextId() (existing) | Already built in Phase 1. Scans existing nodes, returns next sequential ID. |

**Key insight:** Phase 2's complexity is in the prompts, not in the code. The tooling extensions are straightforward CRUD operations on the existing graph. The intelligence lives in the workflow markdown files that guide Claude's conversation.

## Common Pitfalls

### Pitfall 1: Workflow Prompt Too Rigid

**What goes wrong:** The guided conversation feels like a form being filled out rather than a natural dialogue. User gets frustrated by inflexible question sequencing.
**Why it happens:** Over-specifying the workflow steps creates a railroad that doesn't adapt to user responses.
**How to avoid:** Design the workflow as a set of goals (capture 3-5 declarations, validate NSR, ensure future-stated) with flexible sequencing. Use GSD's discuss-phase pattern: announce areas, ask questions, check "more or next?" -- but let Claude adapt within each area.
**Warning signs:** Workflow prompt with numbered steps that must execute in exact order.

### Pitfall 2: Reframing That Annoys

**What goes wrong:** The Socratic correction loop feels condescending. User says "I want to fix X" and Claude lectures them about ontological language three times.
**Why it happens:** Over-zealous language detection that triggers on every non-perfect statement.
**How to avoid:** Locked decision says 2-3 attempts, then accept. The first reframe should be gentle and explanatory. The second should be shorter. After that, accept with a note. Never refuse a declaration outright. Make the reframe feel like a gift ("here's a more powerful way to say that"), not a correction.
**Warning signs:** Test conversations where the user gives up or says "just accept it."

### Pitfall 3: Re-Derivation Destroys Manual Edits

**What goes wrong:** User manually edits MILESTONES.md to adjust a milestone title. Then runs `/declare:derive` which re-derives from scratch, losing the manual edit.
**Why it happens:** Re-derivation ignores existing graph state and starts fresh.
**How to avoid:** Locked decision says "re-derives affected milestones" -- not all milestones. The derivation flow must: (1) load the existing graph, (2) identify which declarations changed, (3) only re-derive milestones linked to changed declarations, (4) preserve unchanged milestones and their manual edits.
**Warning signs:** Derive command that doesn't call `load-graph` first.

### Pitfall 4: Graph Desync After Merge

**What goes wrong:** After merging milestones, FUTURE.md still references the old milestone ID in one declaration's "Milestones" field.
**Why it happens:** Merge updates MILESTONES.md edges but forgets to update FUTURE.md's milestone references.
**How to avoid:** Write BOTH files atomically after any merge operation. The merge function must update: (1) the milestone table (remove duplicate), (2) the action table (update "Causes" references), (3) FUTURE.md (update "Milestones" field on affected declarations). Commit both files together.
**Warning signs:** Code that writes MILESTONES.md without checking FUTURE.md cross-references.

### Pitfall 5: Atomicity Judgment Too Strict or Too Loose

**What goes wrong:** Derivation either stops too early (milestones that are still too vague to execute) or goes too deep (actions that are trivially small, creating graph bloat).
**Why it happens:** No clear heuristic for "atomic enough."
**How to avoid:** Recommended heuristic (Claude's Discretion): An action is atomic when it can be completed in a single focused session (a few hours) by a single agent/person, produces a verifiable artifact, and doesn't require decomposition to understand what "done" means. If the user says "that's too big" or "that's too small," adjust.
**Warning signs:** Actions like "Build the whole frontend" (too big) or "Create variable named X" (too small).

## Code Examples

### Adding a Declaration via CLI Tool

```javascript
// src/commands/add-declaration.js
// Agent calls: node declare-tools.cjs add-declaration --title "..." --statement "..."

function runAddDeclaration(cwd, args) {
  const title = parseFlag(args, '--title');
  const statement = parseFlag(args, '--statement');
  if (!title || !statement) {
    return { error: 'Both --title and --statement are required' };
  }

  const planningDir = join(cwd, '.planning');
  const futurePath = join(planningDir, 'FUTURE.md');
  const projectName = basename(cwd);

  // Load existing declarations
  const content = existsSync(futurePath) ? readFileSync(futurePath, 'utf-8') : '';
  const declarations = parseFutureFile(content);

  // Generate next ID using graph engine
  const dag = new DeclareDag();
  for (const d of declarations) {
    dag.addNode(d.id, 'declaration', d.title, d.status);
  }
  const id = dag.nextId('declaration');

  // Append new declaration
  declarations.push({ id, title, statement, status: 'PENDING', milestones: [] });
  const newContent = writeFutureFile(declarations, projectName);
  writeFileSync(futurePath, newContent, 'utf-8');

  // Atomic commit
  const commitResult = commitPlanningDocs(cwd, `declare: add ${id} "${title}"`, ['.planning/FUTURE.md']);

  return { id, title, statement, status: 'PENDING', committed: commitResult.committed, hash: commitResult.hash };
}
```

### Adding a Milestone with Edges

```javascript
// src/commands/add-milestone.js
// Agent calls: node declare-tools.cjs add-milestone --title "..." --realizes "D-01,D-02"

function runAddMilestone(cwd, args) {
  const title = parseFlag(args, '--title');
  const realizesRaw = parseFlag(args, '--realizes');
  const realizes = realizesRaw ? realizesRaw.split(',').map(s => s.trim()) : [];
  if (!title || realizes.length === 0) {
    return { error: '--title and --realizes (comma-separated declaration IDs) are required' };
  }

  // Load full graph
  const { declarations, milestones, actions } = loadGraphFromDisk(cwd);

  // Build DAG to get next ID
  const dag = buildDag(declarations, milestones, actions);
  const id = dag.nextId('milestone');

  // Add milestone to list
  const newMilestone = { id, title, status: 'PENDING', realizes, causedBy: [] };
  milestones.push(newMilestone);

  // Update FUTURE.md: add milestone ID to each realized declaration
  for (const declId of realizes) {
    const decl = declarations.find(d => d.id === declId);
    if (decl && !decl.milestones.includes(id)) {
      decl.milestones.push(id);
    }
  }

  // Write both files atomically
  writeFileSync(futurePath, writeFutureFile(declarations, projectName), 'utf-8');
  writeFileSync(msPath, writeMilestonesFile(milestones, actions, projectName), 'utf-8');

  // Atomic commit of both files
  commitPlanningDocs(cwd, `declare: add ${id} "${title}"`, [
    '.planning/FUTURE.md', '.planning/MILESTONES.md'
  ]);

  return { id, title, realizes, status: 'PENDING' };
}
```

### Loading the Full Graph (for Agent Consumption)

```javascript
// src/commands/load-graph.js
// Agent calls: node declare-tools.cjs load-graph
// Returns JSON with full graph state for agent to reason about

function runLoadGraph(cwd) {
  const planningDir = join(cwd, '.planning');

  if (!existsSync(planningDir)) {
    return { error: 'No Declare project found. Run /declare:init first.' };
  }

  const futureContent = safeRead(join(planningDir, 'FUTURE.md'));
  const msContent = safeRead(join(planningDir, 'MILESTONES.md'));

  const declarations = parseFutureFile(futureContent);
  const { milestones, actions } = parseMilestonesFile(msContent);

  // Build graph for validation and stats
  const dag = buildDag(declarations, milestones, actions);
  const stats = dag.stats();
  const validation = dag.validate();

  return {
    declarations: declarations.map(d => ({
      ...d,
      milestoneCount: d.milestones.length,
    })),
    milestones,
    actions,
    stats,
    validation,
  };
}
```

### Workflow Prompt: Declaration Capture (Key Sections)

```markdown
## Declaration Capture Flow

### Opening
"Let's declare the future for [project name].

When this project fully succeeds, what's true? Not what you want to achieve --
what IS true, as if you're looking back from that future.

I'll help you capture 3-5 declarations."

### Per-Declaration Loop
1. Ask a guided prompt (vary the angle):
   - "What's true about [domain] when this project succeeds?"
   - "If we fast-forward to the future where this is done, what do you see?"
   - "What's the reality you're creating here?"

2. Receive user's statement.

3. Classify language:
   - Declared future -> Proceed to NSR check
   - Past-derived -> Socratic reframe (max 2-3 attempts)
   - Goal language -> Socratic reframe (max 2-3 attempts)

4. NSR check:
   - Necessary: Does this add something the other declarations don't cover?
   - Sufficient: (checked across the set after 3+ declarations)
   - Relevant: Is this about THIS project?

5. If passes: Persist via add-declaration command.
6. If fails: Explain which criterion failed, help rewrite.

### After 3-5 Declarations
"Here's the future we've declared:
[list declarations]

Does this feel complete? Is there an aspect of the future we haven't captured?"

If user wants more: continue loop.
If user is satisfied: transition to derivation (or end session).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agents write files directly | Agents call CLI tools that write files | Phase 1 (declare-tools.cjs) | Atomic operations, consistent formatting, git integration |
| Fixed 2-level derivation (goal->task) | Recursive derivation until atomic | This phase design | More flexible graph depth, avoids premature concreteness |
| Requirements as input | Declarations as input | Core Declare philosophy | The fundamental ontological shift -- future-stated truths, not past-derived needs |

**Deprecated/outdated:**
- None relevant. Phase 2 builds directly on Phase 1's infrastructure with no stale dependencies.

## Open Questions

1. **How to handle mid-session interruption during derivation**
   - What we know: Derivation can be long (3-5 declarations x 2-4 milestones x 2-4 actions = potentially 40+ conversation turns). User may need to stop mid-flow.
   - What's unclear: Should the system persist partial derivations? Or require completing a full declaration's tree before saving?
   - Recommendation: Persist after each confirmed item (declaration, milestone, or action). The graph is always in a valid state because orphan milestones/actions are acceptable during WIP. Validation warnings (from `/declare:status`) distinguish WIP orphans from broken orphans. This follows Phase 1's "validation on command" principle.

2. **Re-derivation scope after declaration modification**
   - What we know: User locked "re-derives affected milestones" when declarations change.
   - What's unclear: If a declaration's statement changes significantly, should the system propose entirely new milestones, or try to match existing ones?
   - Recommendation: Load existing milestones linked to the changed declaration. Present them: "These milestones were derived from the previous version. Which still apply?" Let the user keep, modify, or replace each one. This preserves manual work while allowing fresh derivation where needed.

3. **Declaration ordering and grouping in FUTURE.md**
   - What we know: Target 3-5 declarations per session. Declarations must be independent.
   - What's unclear: Should declarations be ordered? Numbered strictly sequentially? Grouped by domain?
   - Recommendation: Strictly sequential IDs (D-01, D-02, ...) in creation order. No grouping or reordering -- independence means order doesn't matter. If the user wants to see them grouped, that's a Phase 3 visualization concern.

## Sources

### Primary (HIGH confidence)
- **Existing codebase analysis:** Direct reading of `src/graph/engine.js` (DeclareDag class, 461 lines), `src/artifacts/future.js` (parseFutureFile/writeFutureFile), `src/artifacts/milestones.js` (parseMilestonesFile/writeMilestonesFile), `src/declare-tools.js` (CLI entry point), `src/commands/init.js`, `src/commands/status.js`
- **Phase 1 Research:** `.planning/phases/01-foundation/01-RESEARCH.md` -- stack decisions, architecture patterns, anti-patterns
- **Phase 1 Slash Commands:** `~/.claude/commands/declare/init.md`, `status.md`, `help.md` -- command structure, tool invocation pattern
- **GSD discuss-phase pattern:** `~/.claude/commands/gsd/discuss-phase.md` and `workflows/discuss-phase.md` -- proven pattern for multi-turn guided conversation via slash commands
- **Architecture research:** `.planning/research/ARCHITECTURE.md` -- backward derivation data flow, agent pool design, DAG storage patterns

### Secondary (MEDIUM confidence)
- **GSD new-project pattern:** `~/.claude/commands/gsd/new-project.md` -- workflow reference pattern for complex multi-step flows
- **Phase 2 CONTEXT.md:** `.planning/phases/02-future-declaration-backward-derivation/02-CONTEXT.md` -- user decisions (primary source for locked constraints)

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase and Phase 1 artifacts.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, extends Phase 1's proven stack
- Architecture patterns: HIGH -- directly modeled on existing GSD patterns (discuss-phase, new-project) and Phase 1 infrastructure
- Tooling extensions: HIGH -- straightforward CRUD subcommands following existing init.js/status.js patterns
- Prompt engineering (language detection, NSR, derivation): HIGH for the pattern, MEDIUM for exact prompt wording -- the approach is sound (Claude as NLP engine), but exact prompts need iteration during implementation
- Milestone merge algorithm: HIGH -- uses existing DeclareDag primitives (addEdge, removeEdge, removeNode)
- Pitfalls: HIGH -- derived from Phase 1 experience and CONTEXT.md constraints

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, no rapidly changing dependencies)
