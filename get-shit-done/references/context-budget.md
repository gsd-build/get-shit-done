# Context Budget Rules

Standard rules for keeping orchestrator context lean. Reference this in workflows that spawn subagents or read significant content.

See also: `references/universal-anti-patterns.md` for the complete set of universal rules.

---

## Universal Rules

Every workflow that spawns agents or reads significant content must follow these rules:

1. **Never** read agent definition files (`agents/*.md`) -- `subagent_type` auto-loads them
2. **Never** inline large files into subagent prompts -- tell agents to read files from disk instead
3. **Read depth scales with context window** -- check `context_window` in `.planning/config.json`:
   - At < 500000 tokens (default 200k): read only frontmatter, status fields, or summaries. Never read full SUMMARY.md, VERIFICATION.md, or RESEARCH.md bodies.
   - At >= 500000 tokens (1M model): MAY read full subagent output bodies when the content is needed for inline presentation or decision-making. Still avoid unnecessary reads.
4. **Delegate** heavy work to subagents -- the orchestrator routes, it doesn't execute
5. **Proactive warning**: If you've already consumed significant context (large file reads, multiple subagent results), warn the user: "Context budget is getting heavy. Consider checkpointing progress."

## Read Depth by Context Window

| Context Window | Subagent Output Reading | SUMMARY.md | VERIFICATION.md | PLAN.md (other phases) |
|---------------|------------------------|------------|-----------------|------------------------|
| < 500k (200k model) | Frontmatter only | Frontmatter only | Frontmatter only | Current phase only |
| >= 500k (1M model) | Full body permitted | Full body permitted | Full body permitted | Current phase only |

**How to check:** Read `.planning/config.json` and inspect `context_window`. If the field is absent, treat as 200k (conservative default).

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

## MCP Tool Schema Cost (Harness Concern)

Every enabled MCP server injects its tool schema into **every turn**, regardless of whether you call any of its tools. Heavyweight servers can cost 20k+ tokens per turn each — often dwarfing whatever GSD itself can save through `model_profile` tuning. This is a Claude Code harness concern, not a GSD concern: GSD does **not** manage MCP enablement. The toggle lives in `.claude/settings.json` under `enabledMcpjsonServers` and `disabledMcpjsonServers`.

### Why this is the biggest cost lever you don't own

Tool schemas count against the same context budget as model context, prompts, and conversation history. If a project has 5 unused MCP servers averaging 5k tokens of schema each, every turn pays a 25k-token tax before the assistant reads a single project file. Trimming MCPs has a **multiplier effect** that compounds with whichever `model_profile` you've chosen — every-turn overhead drops regardless of which model is in use.

### Pre-Phase MCP Audit

Before starting a long phase (especially `/gsd-execute-phase`, `/gsd-plan-phase`, or anything that fans out across many subagents), run this audit:

- [ ] **Browser / playwright tools enabled?** If this phase has no UI work, disable them. They're among the heaviest per-turn schemas.
- [ ] **Platform-specific tools enabled?** Mac-tools / Windows-tools / OS-specific helpers should be disabled when not actively needed for the phase at hand.
- [ ] **Cross-project / stale MCPs?** Servers added for a different project that are still enabled here. These are often forgotten and pay a per-turn tax for zero benefit.
- [ ] **Duplicate or shadow servers?** Two MCPs offering similar tools (e.g. two different filesystem helpers). Keep one.

Each item disabled removes its schema from every subsequent turn for the rest of the session.

### How to toggle

The keys live in `.claude/settings.json` (project) or `~/.claude/settings.json` (global) — **not** in `.planning/config.json`:

```json
{
  "enabledMcpjsonServers": ["context7"],
  "disabledMcpjsonServers": ["playwright", "mac-tools"]
}
```

Either list works — `enabledMcpjsonServers` is an explicit allow-list, `disabledMcpjsonServers` is a block-list against the default. See the [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp) for the canonical reference; this section just flags it as a context-budget lever GSD users routinely overlook.

### Composition with model_profile

Trimming MCPs and tuning `model_profile` are independent levers that **compound**. Disabling a 25k-token MCP saves 25k per turn whether you're running `quality` (opus everywhere) or `budget` (sonnet/haiku); the savings are additive, not in lieu of model tuning. Don't pick one — do both, and audit MCPs first because the per-turn savings show up immediately and stack across every subagent the orchestrator spawns.
