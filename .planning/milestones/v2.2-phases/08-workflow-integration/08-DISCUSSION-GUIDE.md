# Phase 8: Workflow Integration - Discussion Guide

**Researched:** 2026-02-17
**Domain:** Multi-agent workflow checkpoints with review and feedback synthesis

## Domain Analysis

Phase 8 integrates external co-planner agents (from Phase 6 and 7) into the core workflow checkpoints where Claude makes significant decisions. The existing system has:

- **Four checkpoint types in workflows:** Requirements checkpoint (after REQUIREMENTS.md), Roadmap checkpoint (after ROADMAP.md), Plan checkpoint (after PLAN.md), and Verification checkpoint (after VERIFICATION.md)
- **Existing adversary agent pattern:** The gsd-adversary.md agent already challenges artifacts with severity-classified feedback (BLOCKING, MAJOR, MINOR)
- **External agent detection:** Phase 6 built adapters for codex, gemini, and opencode with normalized invocation
- **Checkpoint-specific config:** Phase 7 built per-checkpoint agent assignment in config.json
- **Current executor flow:** The executor pauses at checkpoints and returns structured messages

**What's missing:** The draft-review-synthesize loop where Claude sends the artifact to configured external agents, receives their feedback, displays it with attribution, and visibly acts (or doesn't act) on it.

## Key Decision Areas

### 1. Feedback Delivery and Display Format

**Why it matters:** How feedback is presented affects user understanding of which agent said what and whether Claude actually used the feedback.

**Key questions:**
- Should external agent feedback be shown in a single block per agent, or merged by feedback type (challenges/suggestions/endorsements)?
- Should the display show which agent originated each piece of feedback inline, or as a header for the entire agent's response?
- When Claude doesn't follow a suggestion, should the display show that visibly or just accept it silently?
- How should the feedback block be visually distinguished from Claude's own thoughts?

### 2. Feedback Synthesis Approach

**Why it matters:** How Claude incorporates feedback shapes the workflow outcome and determines whether external input actually influences decisions or is performative.

**Key questions:**
- Should Claude automatically act on BLOCKING feedback (stop and require changes) or treat all feedback as advisory?
- When multiple agents disagree, who has tiebreaking authority?
- Should Claude modify the artifact based on feedback, or only acknowledge and explain?
- For conflicting feedback, how should Claude decide?

### 3. Checkpoint Placement in Workflows

**Why it matters:** Different checkpoints have different purposes, and the review-synthesize pattern may not make sense at every checkpoint type.

**Key questions:**
- Should external agents review ALL four checkpoint types or only specific ones?
- What should external agents focus on at each checkpoint type?

### 4. Failure Handling and Graceful Degradation

**Why it matters:** External agents may fail, time out, or be unavailable, and the workflow must recover sensibly.

**Key questions:**
- If a configured external agent fails, should the workflow pause or continue with just Claude's review?
- Should there be a circuit breaker that disables failing agents for the session?

### 5. Implementation of Synthesis Logic

**Why it matters:** How synthesis actually works determines whether feedback improves or just delays decisions.

**Key questions:**
- Should synthesis be in-context (Claude reads and responds) or a separate step?
- Should Claude's synthesis include specific citations to which agents provided which feedback?
- Should the final artifact show a change log based on feedback?

---

*Phase: 08-workflow-integration*
*Domain: Multi-agent checkpoint integration with feedback synthesis*
*Guide generated: 2026-02-17*
