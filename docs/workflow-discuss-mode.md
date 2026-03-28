# Discuss Mode: Assumptions vs Interview

GSD's discuss-phase has two modes for gathering implementation context before planning.

## Modes

### `discuss` (default)

The original interview-style flow. Claude identifies gray areas in the phase, presents them
for selection, then asks ~4 questions per area. Good for:

- Early phases where the codebase is new
- Phases where the user has strong opinions they want to express proactively
- Users who prefer guided, conversational context gathering

### `assumptions`

A codebase-first flow. Claude deeply analyzes the codebase via a subagent (reading 5-15
relevant files), forms assumptions with evidence, and presents them for confirmation or
correction. Good for:

- Established codebases with clear patterns
- Users who find the interview questions obvious
- Faster context gathering (~2-4 interactions vs ~15-20)

## Configuration

```bash
# Enable assumptions mode
gsd-tools config-set workflow.discuss_mode assumptions

# Switch back to interview mode
gsd-tools config-set workflow.discuss_mode discuss
```

The setting is per-project (stored in `.planning/config.json`).

## How Assumptions Mode Works

1. **Init** — Same as discuss mode (load prior context, scout codebase, check todos)
2. **Deep analysis** — Explore subagent reads 5-15 codebase files related to the phase
3. **Surface assumptions** — Each assumption includes:
   - What Claude would do and why (citing file paths)
   - What goes wrong if the assumption is incorrect
   - Confidence level (Confident / Likely / Unclear)
4. **Confirm or correct** — User reviews assumptions, selects any that need changing
5. **Write CONTEXT.md** — Identical output format to discuss mode

## Flag Compatibility

| Flag | `discuss` mode | `assumptions` mode |
|------|----------------|-------------------|
| `--auto` | Auto-selects recommended answers | Skips confirm gate, auto-resolves Unclear items |
| `--batch` | Groups questions in batches | N/A (corrections already batched) |
| `--text` | Plain-text questions (remote sessions) | Plain-text questions (remote sessions) |
| `--analyze` | Shows trade-off tables per question | N/A (assumptions include evidence) |

## Output

Both modes produce identical CONTEXT.md with the same 6 sections:
- `<domain>` — Phase boundary
- `<decisions>` — Locked implementation decisions
- `<canonical_refs>` — Specs/docs downstream agents must read
- `<code_context>` — Reusable assets, patterns, integration points
- `<specifics>` — User references and preferences
- `<deferred>` — Ideas noted for future phases

Downstream agents (researcher, planner, checker) consume this identically regardless of mode.
