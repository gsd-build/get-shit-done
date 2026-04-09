# Context Budget Rules

Standard rules for keeping orchestrator context lean. Reference this in workflows that spawn subagents or read significant content.

See also: `references/universal-anti-patterns.md` for the complete set of universal rules.

---

## Universal Rules

Every workflow that spawns agents or reads significant content must follow these rules:

1. **Never** read agent definition files (`agents/*.md`) -- `subagent_type` auto-loads them
2. **Never** inline large files into subagent prompts -- tell agents to read files from disk instead
3. **Read depth scales with context window** -- check `context_window_tokens` in `.planning/config.json`:
   - At < 500000 tokens (default 200k): read only frontmatter, status fields, or summaries. Never read full SUMMARY.md, VERIFICATION.md, or RESEARCH.md bodies.
   - At >= 500000 tokens (1M model): MAY read full subagent output bodies when the content is needed for inline presentation or decision-making. Still avoid unnecessary reads.
4. **Delegate** heavy work to subagents -- the orchestrator routes, it doesn't execute
5. **Proactive warning**: If you've already consumed significant context (large file reads, multiple subagent results), warn the user: "Context budget is getting heavy. Consider checkpointing progress."

## Read Depth by Context Window

| Context Window | Subagent Output Reading | SUMMARY.md | VERIFICATION.md | PLAN.md (other phases) |
|---------------|------------------------|------------|-----------------|------------------------|
| < 500k (200k model) | Frontmatter only | Frontmatter only | Frontmatter only | Current phase only |
| >= 500k (1M model) | Full body permitted | Full body permitted | Full body permitted | Current phase only |

**How to check:** Read `.planning/config.json` and inspect `context_window_tokens`. If the field is absent, treat as 200k (conservative default).

## Context Degradation Tiers

Monitor context usage and adjust behavior accordingly:

| Tier | Usage | Behavior |
|------|-------|----------|
| PEAK | 0-30% | Full operations. Read bodies, spawn multiple agents, inline results. |
| GOOD | 30-50% | Normal operations. Prefer frontmatter reads, delegate aggressively. |
| DEGRADING | 50-70% | Economize. Frontmatter-only reads, minimal inlining, warn user about budget. |
| POOR | 70%+ | Emergency mode. Checkpoint progress immediately. No new reads unless critical. |

## Context Degradation Warning Signs

Quality degrades gradually before panic thresholds fire. Watch for these early signals:

- **Silent partial completion** -- agent claims task is done but implementation is incomplete. Self-check catches file existence but not semantic completeness. Always verify agent output meets the plan's must_haves, not just that files exist.
- **Increasing vagueness** -- agent starts using phrases like "appropriate handling" or "standard patterns" instead of specific code. This indicates context pressure even before budget warnings fire.
- **Skipped steps** -- agent omits protocol steps it would normally follow. If an agent's success criteria has 8 items but it only reports 5, suspect context pressure.

When delegating to agents, the orchestrator cannot verify semantic correctness of agent output -- only structural completeness. This is a fundamental limitation. Mitigate with must_haves.truths and spot-check verification.
