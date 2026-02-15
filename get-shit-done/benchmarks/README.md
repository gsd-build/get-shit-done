# GSD Benchmark Suite

Static analysis tool that compares GSD vs GSDF context consumption across operations and scenario complexity levels.

## Quick Start

```bash
bash ~/.claude/get-shit-done/benchmarks/run-benchmark.sh
```

Reports are saved to `reports/benchmark-YYYY-MM-DD-HHMMSS.md`.

## CLI Options

| Flag | Description |
|------|-------------|
| `--scenario LEVEL` | Filter to specific scenario (e.g., `level-2`, `level-3-complex`) |
| `--operation OP` | Filter to specific operation (`execute`, `plan`, `quick`, `debug`) |
| `--coverage` | Run feature coverage matrix only |
| `--prompts` | Generate prompt snapshot files for diff comparison |
| `--quality` | Run quality evaluation (costs API tokens via `claude -p`) |

### Examples

```bash
# Full benchmark (context analysis + feature coverage)
bash run-benchmark.sh

# Just execute-phase across all scenarios
bash run-benchmark.sh --operation execute

# Standard scenario only
bash run-benchmark.sh --scenario level-2

# Coverage matrix only (no context analysis)
bash run-benchmark.sh --coverage

# Generate prompt snapshots for manual diff
bash run-benchmark.sh --prompts
diff reports/prompts/gsd-execute-level-2-standard.txt reports/prompts/gsdf-execute-level-2-standard.txt

# Quality evaluation (requires claude CLI, costs tokens)
bash run-benchmark.sh --quality --scenario level-2
```

## What It Measures

### Context Analysis (default)

For each **operation** x **variant** x **scenario**:

- **Orchestrator lines** - Command file + referenced workflows/references
- **Per-subagent lines** - Agent definition + conditional skills
- **Project context lines** - Plan content + STATE + ROADMAP (from scenario config)
- **Total context** - Orchestrator + sum(per-subagent contexts)
- **Est. tokens** - Total lines x 4 (rough approximation)
- **Savings %** - (gsd_total - gsdf_total) / gsd_total x 100

### Feature Coverage Matrix (`--coverage`)

Verifies GSDF covers every feature standard GSD provides:

- **Skill files exist** - Each extracted section has a corresponding skill file
- **Core agent completeness** - Core agents contain all essential sections
- **Skill detection** - GSDF commands detect and load all relevant skills
- **Agent references** - All referenced core agents exist on disk

### Prompt Snapshots (`--prompts`)

Generates the exact prompt text that would be sent to each subagent variant. Saved to `reports/prompts/` for `diff` comparison.

### Quality Evaluation (`--quality`)

Sends prompt snapshots to Claude API and scores outputs against a rubric. Costs API tokens. Run with `--scenario` to limit cost.

## Scenarios

| Scenario | Plans | Features | Represents |
|----------|-------|----------|------------|
| `level-1-simple` | 1 | None | Minimal phase |
| `level-2-standard` | 2 | Checkpoints | Typical phase |
| `level-3-complex` | 3 | Checkpoints, TDD, auth, user-setup, discovery | Feature-rich phase |
| `level-4-extreme` | 5 | ALL features | Stress test |

## Operations Benchmarked

| Operation | GSD Subagents | GSDF Subagents |
|-----------|---------------|---------------------|
| execute-phase | N x gsd-executor | N x general-purpose (core + skills) |
| plan-phase | researcher + planner + checker | researcher + general-purpose (core + skills) + checker |
| quick | gsd-planner + gsd-executor | 2 x general-purpose (cores + skills) |
| debug | gsd-debugger | general-purpose (core + skills) |

## Adding Scenarios

Create a new `.conf` file in `scenarios/`:

```bash
# scenarios/level-5-enterprise.conf
SCENARIO_NAME="Enterprise"
SCENARIO_LEVEL=5

HAS_CHECKPOINTS=true
HAS_TDD=true
HAS_AUTH_GATES=true
HAS_GAP_CLOSURE=true
HAS_CONTINUATION=true
HAS_USER_SETUP=true
HAS_DISCOVERY=true

NUM_PLANS=8
PLAN_LINES=400
STATE_LINES=120
ROADMAP_LINES=100
RESEARCH_LINES=200
CONTEXT_LINES=100
VERIFICATION_LINES=80
```

It will be auto-discovered on next run.

## Adding Operations

1. Add a `calc_<operation>()` function to `run-benchmark.sh`
2. Register it in the `OPERATIONS` array
3. The function must set: `GSD_ORCH`, `GSD_PER_AGENT`, `GSD_AGENT_COUNT`, `GSD_PROJECT_CTX`, `GSDF_ORCH`, `GSDF_PER_AGENT`, `GSDF_AGENT_COUNT`, `GSDF_PROJECT_CTX`, `GSDF_SKILLS_DETAIL`

## Known Issues

- `gsd-debugger-core.md` does not exist (pre-existing). Debug benchmark shows 0 lines for GSDF agent, giving artificially high savings.
- Token estimation uses 4 tokens/line which is approximate. Actual tokenization varies.
