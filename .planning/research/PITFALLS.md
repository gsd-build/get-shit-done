# Domain Pitfalls

**Domain:** Future-driven declarative planning engine (ontological methodology + DAG planning + AI orchestration)
**Researched:** 2026-02-15
**Confidence:** MEDIUM (domain synthesis from training data; no live verification available)

---

## Critical Pitfalls

Mistakes that cause rewrites, user abandonment, or fundamental design failures.

---

### Pitfall 1: The Ontology Becomes the Product Instead of a Lens

**What goes wrong:** The system surfaces Erhard/Vanto terminology ("racket," "already always listening," "clearing," "integrity") as UI concepts users must learn before they can do anything. The tool becomes a philosophy course, not a productivity tool. Users who don't already know the ontology bounce. Users who DO know it feel patronized by simplified versions.

**Why it happens:** Developers who are excited about the ontology build features around the *concepts* rather than building features that *embody* the concepts. The ontology should shape how the system works, not what the user has to name or categorize. Erhard's work is phenomenological -- it works through direct experience, not through labeling.

**Consequences:** The product becomes inaccessible to newcomers and annoying to practitioners. You end up with 5 users who are ontology nerds, not 5000 users who get more done.

**Warning signs:**
- Onboarding flow asks users to "declare their future" before they've done anything
- UI has fields labeled with ontological jargon (e.g., "racket," "winning formula")
- More than 2 concepts require explanation before first productive use
- User testing shows people pausing to understand terminology instead of flowing

**Prevention:**
- **Rule: The ontology is invisible until it's useful.** The system should feel like a planning tool that happens to work differently. Concepts surface only when the user's own experience creates the opening (e.g., when they're stuck, THEN surface the distinction between past-derived and future-declared)
- Design the UX around verbs, not nouns: "What are you creating?" not "Declare your future ontological commitment"
- Test with people who have never read Erhard. If they can't be productive in 5 minutes, the ontology is leaking
- Keep a "jargon budget" of max 3 introduced terms for the entire product

**Phase to address:** Phase 1 (core data model). The ontology must be embedded in structure, not surface. If Phase 1 gets this wrong, everything built on top inherits the problem.

---

### Pitfall 2: Declarative Planning Collapses Into Imperative Planning With Extra Steps

**What goes wrong:** "Declare a future, then plan toward it" degrades into "write a goal statement, then make a task list." The system adds ceremony (future declaration, alignment checks, integrity scoring) but the actual planning engine produces the same linear task lists that any TODO app produces. Users do extra work for no extra insight.

**Why it happens:** The hard part of declarative planning is the *engine* that derives actions from declared states -- not the declaration itself. Building "declare a future" is trivial (it's a text field). Building a system that actually reasons backward from declared futures to surface non-obvious actions, missing commitments, and structural breakdowns is genuinely hard. Teams build the easy part first and never crack the hard part.

**Consequences:** Users experience the tool as a regular task manager with philosophical pretension. They leave for simpler tools. The "future-driven" label becomes marketing, not mechanism.

**Warning signs:**
- The "plan from future" command produces the same output as "plan from requirements"
- Removing the future declaration doesn't change what the system generates
- The DAG structure is identical to what a standard project planner would create
- No user ever says "I wouldn't have thought of that" about generated plans

**Prevention:**
- **Define concretely what "future-derived" means in computation.** A future-derived plan must differ from a past-derived plan in at least one structural way: different task ordering, different dependency graph, different scope, or surfacing commitments/actions the user didn't explicitly state
- Build a "derivation diff" test: given the same project, does the future-declared path produce materially different plans than a standard requirements-driven path? If not, the engine isn't doing its job
- The backward-reasoning engine is the core IP. Invest 60%+ of architecture effort here, not on the declaration UX
- Study constraint-based/declarative programming (Prolog, Answer Set Programming, SAT solvers) for actual backward-reasoning patterns rather than imperative code that pretends to reason backward

**Phase to address:** Phase 2 (planning engine). But the *design* must be settled in Phase 1 architecture. If the data model doesn't support genuine backward derivation, no amount of Phase 2 work fixes it.

---

### Pitfall 3: DAG Complexity Overwhelms the User

**What goes wrong:** The system builds a rich dependency graph to model commitments, futures, actions, breakdowns, and integrity relationships. The graph becomes too complex for users to understand, modify, or debug. Users can't answer "why is this task here?" or "what happens if I remove this?" The DAG becomes a black box.

**Why it happens:** DAGs are addictive for developers. Every relationship feels important. "Futures depend on commitments which depend on actions which have integrity constraints which reference breakdowns which..." Before you know it, you have 6 node types and 12 edge types. The graph is technically correct but practically unusable.

**Consequences:** Users either ignore the graph entirely (making it dead weight) or spend more time managing the graph than doing work. Power users build unmanageable structures. The system's own complexity becomes the biggest productivity drain.

**Warning signs:**
- Nodes have more than 3 relationship types
- Users need to understand the graph to do basic operations
- "Graph visualization" becomes a requested feature (meaning the text representation is already too complex)
- Simple projects produce graphs with 50+ nodes

**Prevention:**
- **Hard cap: 3 node types maximum in v1.** Futures, commitments, and actions. That's it. Resist every urge to add "breakdowns," "concerns," "reflections," "alignment scores" as separate node types. They can be properties on the 3 core types
- The DAG should be implicit, not explicit. Users create futures and commitments; the system infers and manages the graph. Users never "edit the DAG" -- they edit their declarations and the graph updates
- Implement aggressive graph pruning: completed paths collapse, irrelevant branches hide, the user only sees their current horizon
- Test: if a user has 5 active projects, can they context-switch in under 30 seconds? If the DAG state takes longer to reload mentally, it's too complex

**Phase to address:** Phase 1 (data model) and Phase 3 (UX). The data model must be minimal; the UX must hide complexity aggressively.

---

### Pitfall 4: Integrity Tracking Becomes Punitive

**What goes wrong:** The system tracks whether users honor their commitments (core to Erhard's integrity model) but presents this as a scorecard, judgment, or guilt mechanism. "Your integrity score is 43%. You broke 12 commitments this week." The tool becomes something users avoid because it makes them feel bad.

**Why it happens:** Integrity is easy to quantify (commitment made vs. commitment kept) and developers default to metrics. But Erhard's concept of integrity is generative, not moral. Integrity isn't about being "good" -- it's about workability. A broken commitment isn't bad; it's something to be honored (acknowledged, cleaned up, and restored). The distinction is subtle and easy to lose in code.

**Consequences:** Users stop declaring commitments to avoid "failing." The tool incentivizes under-committing and sandbagging -- exactly the opposite of its purpose. Users who need the tool most (those struggling with integrity) are the ones most likely to abandon it.

**Warning signs:**
- Any feature that calculates a "score" or "percentage" for integrity
- Language like "failed," "broken," "missed" without corresponding "honored," "restored," "renegotiated"
- Users declaring fewer commitments over time (they're gaming the system)
- No mechanism for renegotiating or restoring integrity after a breakdown

**Prevention:**
- **Never display integrity as a score.** Integrity is a state (in or out) and a practice (restoring when out), not a grade
- The system's response to broken commitments should be: "You said X. That didn't happen. What do you want to do about it?" Not: "You failed to complete X. Your reliability is down 5%"
- Build first-class support for the full Erhard integrity cycle: declare --> breakdown --> acknowledge --> clean up --> restore --> new declaration. Breakdowns aren't failures; they're the mechanism through which integrity operates
- The tone throughout must be that of a trusted sparring partner, not a disappointed parent or a corporate performance review

**Phase to address:** Phase 2 (integrity model) and Phase 4 (language/prompting). Get the data model right early, but the language tuning is an ongoing refinement.

---

### Pitfall 5: Fork Drift Makes GSD Patterns Unreachable

**What goes wrong:** Declare forks GSD and immediately begins changing core patterns: file structure, agent communication protocols, state management, plan format. Within weeks, the fork has diverged so far that GSD improvements can't be merged back, and GSD's proven patterns (atomic commits, plan-as-prompt, goal-backward verification) are lost or broken.

**Why it happens:** Forking feels liberating. "We don't need this constraint anymore" is the siren call. Each individual change seems justified, but the cumulative effect is a codebase that shares ancestry with GSD but none of its hard-won reliability. The Declare team ends up re-learning lessons GSD already solved.

**Consequences:** Maintaining two divergent codebases. Losing GSD's battle-tested execution model. Re-encountering bugs GSD already fixed. Eventually, Declare becomes a ground-up rewrite wearing a fork's disguise.

**Warning signs:**
- Renaming GSD file structures within the first month
- Changing the plan format before building anything on top of it
- Breaking the executor's atomic commit model
- Unable to cherry-pick GSD patches after 3 months

**Prevention:**
- **Define the fork boundary explicitly.** List exactly which GSD modules Declare will: (a) keep as-is, (b) extend, (c) replace. Write this down in a FORK-BOUNDARY.md and enforce it in code review
- Keep GSD as an upstream remote. Periodically attempt merges to test divergence
- Extend, don't replace. GSD's plan-phase, execute-phase, and verify-work commands should be *wrapped* or *extended* by Declare, not rewritten. Declare adds the ontological layer; GSD provides the execution engine
- Set a "divergence budget" per phase: Phase 1 can change max 3 GSD files, Phase 2 max 5, etc.

**Phase to address:** Phase 0 (fork setup). This must be the very first decision. If you don't draw the boundary before writing code, you won't draw it at all.

---

### Pitfall 6: "Future Detection" Becomes an AI Hallucination Factory

**What goes wrong:** The system tries to use AI to distinguish "past-derived thinking" from "genuine future declarations." The AI confidently classifies user input as one or the other, but this classification is unreliable, inconsistent, and often wrong. Users learn they can game the detector with different phrasing.

**Why it happens:** The distinction between past-derived and future-declared is phenomenological -- it exists in the speaker's relationship to what they're saying, not in the words themselves. "I want to build a billion-dollar company" could be past-derived (compensating for childhood poverty) or future-declared (creating something from nothing). No NLP model can reliably tell the difference from text alone.

**Consequences:** Users lose trust when the system misclassifies their genuine declarations as "past-derived." The feature becomes noise that users dismiss or resent. Worse, it could reinforce existing patterns by labeling genuine breakthroughs as "just more of the same."

**Warning signs:**
- Building a classifier for "past-derived vs. future-declared" language
- Any feature that tells users "this seems past-derived" based on text analysis
- Confidence scores on future/past classification
- Users arguing with the system about their own intentions

**Prevention:**
- **Do not build a future detector.** This is the single most important "don't" in the entire project. The distinction lives in the person, not the text
- Instead, build *prompts that create the experience of distinguishing*. Ask questions like: "Is this something you're reacting to, or something you're creating?" Let the user make the distinction. The system's job is to occasion the inquiry, not render the verdict
- The AI's role is Socratic, not diagnostic. It asks questions that help users see their own patterns. It never labels or classifies the user's relationship to their future
- If you must have any detection, make it opt-in and frame it as "reflection prompts" not "analysis results"

**Phase to address:** Phase 2 (planning engine) and Phase 3 (AI prompting). Critical that the architecture in Phase 1 does NOT include a classification field for "future type."

---

## Moderate Pitfalls

---

### Pitfall 7: Over-Engineering the Meta-Prompting Layer

**What goes wrong:** Declare builds a sophisticated meta-prompting system where prompts generate prompts that configure agents that generate plans. The system becomes so recursive that debugging a bad plan requires tracing through 4 layers of prompt generation. Nobody can understand why the system produced a particular output.

**Why it happens:** Meta-prompting is intellectually seductive. "The AI writes its own prompts!" feels like leverage. But each layer of indirection multiplies opacity and halves debuggability. GSD already has a well-tuned agent layer (planner, executor, verifier). Adding an ontological meta-layer on top creates a stack that's too deep.

**Prevention:**
- Maximum 2 prompt layers: orchestrator prompt --> agent prompt. No prompt-generates-prompt-generates-prompt
- Every generated plan must be human-readable and editable. If the user can't modify a PLAN.md by hand, the meta-layer has gone too far
- Steal GSD's "plans are prompts" pattern. Don't wrap it in another layer; extend the plan format itself to include ontological context

**Phase to address:** Phase 2 (agent architecture). Design the agent boundary before building any meta-prompting.

---

### Pitfall 8: Building Commitment Tracking Before the Planning Engine Works

**What goes wrong:** The team builds the integrity/commitment tracking system before the core future-to-plan derivation engine works. They end up with a system that tracks commitments to plans that aren't actually derived from futures -- just regular task lists wearing ontological language.

**Why it happens:** Commitment tracking is more concrete to build (CRUD operations on commitments, status tracking, date management). The planning engine is harder and more uncertain. Teams default to building what's clear over what's crucial.

**Prevention:**
- **Sequence iron rule: the backward-derivation engine must work before integrity tracking exists.** If you can't derive novel plans from declared futures, tracking integrity to those plans is meaningless
- Build a manual-mode planning engine first (user declares future, system helps derive, user validates). THEN add tracking. THEN automate

**Phase to address:** Phase ordering. Planning engine in Phase 2, integrity tracking no earlier than Phase 3.

---

### Pitfall 9: Ignoring the CLI-First Constraint

**What goes wrong:** The system builds rich DAG visualization, interactive graph editing, and commitment dashboards that require a GUI. But the tool is CLI-first (forking GSD, which is Claude Code-native). The CLI becomes a thin wrapper that's always worse than the "real" experience.

**Why it happens:** DAGs and integrity tracking feel inherently visual. The temptation to build a web dashboard is strong. But the users who want this tool are already in their terminal running Claude Code. Context-switching to a browser breaks flow.

**Prevention:**
- **Every feature must work fully in the terminal.** A web view can exist as a bonus, but the CLI must be complete
- Study how git (another DAG tool) works CLI-first: `git log --graph`, `git status`, `git diff`. The DAG is navigable through text commands, not visual editors
- Use structured text output (like GSD's STATE.md and ROADMAP.md) as the "view" layer. Markdown files ARE the UI

**Phase to address:** Phase 1 (architecture). If the data model requires visual interaction, it's wrong for this context.

---

### Pitfall 10: Treating the Vanto Methodology as a Feature List

**What goes wrong:** The team reads Erhard/Jensen/Zaffron papers, extracts concepts (integrity, authenticity, being a leader, rackets, winning formulas, the four ways of being), and builds a feature for each one. The result is a grab-bag of philosophical tools with no coherent user journey.

**Why it happens:** The academic papers present the ontology as a set of distinctions. It's natural to map distinctions to features. But the methodology works as a *practice*, not a toolkit. The distinctions build on each other in a specific pedagogical sequence designed for human coaching over months.

**Prevention:**
- **Pick exactly 3 distinctions for v1.** Recommended: (1) declared future vs. default future, (2) integrity as workability, (3) commitment as speech act. Everything else is v2+
- These 3 must form a coherent loop: declare --> commit --> track integrity --> re-declare. The user experiences them as a workflow, not as separate features
- Do NOT attempt to implement "rackets" or "winning formulas" computationally. These are deep coaching distinctions that require human facilitators. The tool can prompt reflection but cannot automate the insight

**Phase to address:** Phase 1 (scope definition). Kill the feature list impulse before it metastasizes.

---

### Pitfall 11: The "Alignment Check" That Always Passes

**What goes wrong:** The system includes an "alignment check" that verifies whether current work aligns with the declared future. But the check is either too loose (everything passes) or too strict (nothing passes). There's no useful middle ground because "alignment" is inherently fuzzy.

**Why it happens:** Alignment is a human judgment, not a computable property. The AI can check "does this task reference the declared future?" (too loose) or "does this task directly advance the declared future?" (too strict and often wrong). Neither is useful.

**Prevention:**
- Replace binary alignment checks with *alignment prompts*: "You declared X. You're currently working on Y. Is this moving you toward X, and if so, how?" Let the human answer
- Build alignment as a periodic reflection, not a gate. Weekly: "Here's what you declared. Here's what you did. What do you notice?" NOT: "Task blocked: alignment score below threshold"
- If automated alignment is needed, use it as a soft signal (flag for review) never a hard gate (blocked)

**Phase to address:** Phase 3 (AI prompting layer). After the planning engine exists, add reflective prompts.

---

## Minor Pitfalls

---

### Pitfall 12: Naming Collision With "Declare" as a Keyword

**What goes wrong:** The project is named "Declare" and the core action is "declaring" futures. Every command, variable, function, and concept uses "declare." Code becomes ambiguous: does `declare()` mean the JavaScript keyword, the system command, or the ontological act?

**Prevention:**
- Establish a naming convention early: the ontological act is "declare," the CLI command is something else (e.g., `dc future create`, `dc commit make`). Never overlap programming keywords with domain concepts
- Avoid `declare` as a function name in any codebase that uses TypeScript (where `declare` is a keyword)

**Phase to address:** Phase 0 (naming conventions).

---

### Pitfall 13: Premature Abstraction of the "Future" Data Type

**What goes wrong:** The team builds an elaborate "Future" data model with fields for timeframe, domain, stakeholders, sub-futures, alignment scores, integrity states, etc. before they know which fields users actually need. The data model becomes a theory of everything that maps to nothing in practice.

**Prevention:**
- A Future in v1 is: `{ id, text, created_at, status }`. That's it. Add fields when users ask for them, not when the ontology suggests them
- Use markdown files (like GSD) not a database schema. Markdown is cheap to extend and refactor

**Phase to address:** Phase 1 (data model).

---

### Pitfall 14: Underestimating the "Restoration" UX

**What goes wrong:** The system handles the happy path (declare future, make commitments, track progress) well but has no UX for what happens when things fall apart. Missed commitments pile up, the declared future feels stale, and users don't know how to "start over" or "restore integrity" within the system.

**Prevention:**
- Build the "restoration" flow before the "declaration" flow. The system's value is most apparent when things break down, not when they go well
- Include explicit commands: `dc restore` (acknowledge breakdown, clean up, re-declare), `dc renegotiate` (modify commitment without pretending it didn't change), `dc complete` (honor a commitment as done)
- Breakdowns should feel like a natural part of the workflow, not an error state

**Phase to address:** Phase 3 (user flows). But the data model in Phase 1 must support state transitions (active -> broken down -> restored -> completed).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 0: Fork Setup | Drift from GSD immediately (Pitfall 5) | Write FORK-BOUNDARY.md before any code changes |
| Phase 1: Data Model | Over-abstracting the ontology into the schema (Pitfalls 1, 3, 13) | 3 node types max, markdown-first, no jargon in field names |
| Phase 1: Architecture | Building for GUI when the context is CLI (Pitfall 9) | Every operation must work as a text command producing text output |
| Phase 2: Planning Engine | Declarative collapse into imperative (Pitfall 2) | Build derivation-diff tests that prove the engine produces novel output |
| Phase 2: Planning Engine | Building a future-type classifier (Pitfall 6) | Socratic prompts, never diagnostic classification |
| Phase 2: Agent Layer | Meta-prompting depth explosion (Pitfall 7) | Max 2 prompt layers, plans remain human-editable |
| Phase 3: Integrity | Punitive tracking (Pitfall 4) | No scores, full breakdown-restore cycle, sparring partner tone |
| Phase 3: Integrity | Building tracking before engine works (Pitfall 8) | Iron rule: derivation engine first, tracking second |
| Phase 3: Alignment | Useless alignment checks (Pitfall 11) | Reflective prompts, not gates; soft signals, not hard blocks |
| Phase 4: Methodology | Feature-listing the ontology (Pitfall 10) | 3 distinctions max in v1, coherent loop, no deep coaching concepts |

---

## The Meta-Pitfall: Building a Tool for Yourself

This project has an unusually high risk of the builder being the only user who understands it. The Vanto ontology is niche. DAG-based planning is technical. The combination is a product for an audience of maybe 100 people on Earth. That's fine IF you know that going in and build accordingly (tool for practitioners, not mass market). But if you're building for mass market, the ontology must be so deeply embedded that users never encounter it directly -- they just notice the tool works differently than others, and they can't quite explain why.

**The test:** Can someone who has never heard of Werner Erhard use this tool productively on day one? If yes, you've succeeded. If no, you've built a philosophy simulator, not a planning tool.

---

## Sources

- Erhard, W., Jensen, M.C., & Zaffron, S. (2010). "Integrity: A Positive Model that Incorporates the Normative Phenomena of Morality, Ethics, and Legality." Harvard Business School NOM Working Paper No. 06-11 -- foundational integrity model
- Erhard, W. & Jensen, M.C. (2017). "Putting Integrity Into Finance: A Purely Positive Approach" -- integrity as workability, not morality
- GSD codebase (get-shit-done) -- fork baseline patterns, agent architecture, plan-as-prompt model
- Training data synthesis on DAG complexity management, CLI tool design patterns, AI agent orchestration pitfalls (MEDIUM confidence -- not live-verified)
