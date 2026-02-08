# GSD Performance Architecture: The "Hydra" Engine
> **Objective:** Transition GSD from a context-taxed "Prompt-Driven" system to a "Software-Engineered" Agentic Framework.

## 1. The Core Philosophy: "Attention Density"
In LLM systems, **Context is Noise**. Every irrelevant line of TDD instruction loaded during a simple documentation task isn't just a "token cost"—it is **attention dilution**. The "Hydra" architecture ensures that for any given turn, the LLM has **100% relevance density**.

---

## 2. Structural Synthesis: The Three Pillars

### Pillar I: The "Railroad" Spine (Deterministic Logic)
We will move workflow management out of the LLM's head and into `gsd-tools.js`. 
- **The Shift:** Instead of an Agent reading a 300-line `execute-phase.md` to figure out what to do next, it calls `gsd-tools next-step`.
- **The Result:** The LLM's context window is freed from "Process Overhead" and reserved entirely for "Task Logic."

### Pillar II: "Lazy-Load" Context (The JIT Memory)
We will implement **Just-In-Time (JIT)** injection for all instructional content.
- **Tiered Agents:** `gsd-planner-core` (The what) + `gsd-planner-tdd` (The how, loaded only when code changes are detected).
- **Frontmatter Digests:** Instead of reading 10 full summaries (20KB), the Agent reads a single JSON digest (2KB) of dependencies and patterns.
- **Compiled Plans:** Plans are "pre-baked" by `gsd-tools` to strip unused protocols (e.g., removing Checkpoint rules if the plan has no checkpoints).

### Pillar III: Chained Execution (Context Flushing)
We will move away from monolithic sessions.
- **Micro-Agents:** Break `new-project` into: `Interviewer` → `Architect` → `Roadmapper`.
- **Hand-offs:** Each agent performs its task, writes to disk, and **terminates**. The next agent starts with a **clean context window**, reading only the necessary outputs from the previous step. This eliminates "Transcript Bloat."

---

## 3. The Target State Execution Flow
*Example: Running `gsd execute-phase`*

1.  **State Check:** `gsd-tools` reads `.planning/state.json`.
2.  **Context Assembly:** 
    - Loads `gsd-executor-core.md` (Base identity).
    - Detects "TDD" flag in task: Injects `references/tdd.md`.
    - Detects "API" change: Injects `history-digest.json` filtered for "API" tags.
3.  **Execution:** Agent executes the task with **< 15% context usage**.
4.  **Atomic Update:** Agent reports success. `gsd-tools` patches `STATE.md` and `SUMMARY.md` via deterministic code, not LLM rewriting.

---

## 4. Implementation Roadmap (The 4-Phase Sprint)

### Phase 1: The "Low-Hanging" Pruning (Quick Wins)
*   **Action:** Implement `gsd-tools history-digest` and `gsd-tools state patch`.
*   **Impact:** Immediate 40% reduction in history/state overhead.
*   **Timeline:** 1 Day.

### Phase 2: The "Lazy-Load" Restructuring
*   **Action:** Split `gsd-executor` and `gsd-planner` into `-core` and `-ext` modules.
*   **Action:** Update wrapper scripts to dynamically assemble prompts based on task metadata.
*   **Impact:** Massive reduction in "Instructional Noise."
*   **Timeline:** 3 Days.

### Phase 3: The "Railroad" Migration
*   **Action:** Convert `workflows/*.md` logic into a JSON-based state machine in `gsd-tools`.
*   **Action:** Implement the `next-step` pattern.
*   **Impact:** Elimination of "Process Hallucination" and workflow skipping.
*   **Timeline:** 5 Days.

### Phase 4: Semantic Intelligence (The MCP Layer)
*   **Action:** Extend `gsd-memory` MCP to index summaries.
*   **Action:** Replace `grep` searches with semantic queries.
*   **Impact:** Precise, noise-free context retrieval for large codebases.
*   **Timeline:** 7 Days.

---

## 5. Risk Assessment: "The Instruction Guardrail"
You noted that **instructional content is crucial**. 
- **Mitigation:** We do not "slim" the instructions; we **modularize** them. 
- **Example:** The TDD protocol remains exactly as detailed as it is today, but it simply *does not exist* in the LLM's mind when it is renaming a file or updating a README. This actually **improves** TDD fidelity because the LLM isn't distracted by other protocols.