<purpose>
Reusable complexity evaluation for adaptive model selection. Other workflows consult this when they need to determine plan complexity for model resolution.
</purpose>

<evaluation_algorithm>

## Input Context

The evaluation function accepts a context object with:

| Field | Type | Description |
|-------|------|-------------|
| `files_modified` | string[] | List of files the plan modifies |
| `task_count` | number | Number of tasks in the plan |
| `objective` | string | Plan objective text |
| `plan_type` | string | Plan type (e.g., `'tdd'`, `'execute'`) |
| `depends_on` | string[] | Plan IDs this plan depends on |

## Scoring

| Factor | Points | Condition |
|--------|--------|-----------|
| Files modified | 1pt each (max 5) | Count of files_modified |
| Task count | 1pt | 3-5 tasks |
| Task count | 2pts | 6+ tasks |
| Architecture keywords | 3pts | objective matches: architect, system design, data model |
| Integration keywords | 2pts | objective matches: integrat*, external api, third party, webhook |
| Cross-cutting keywords | 2pts | objective matches: cross cutting, multiple modules, refactor across |
| Novel pattern keywords | 3pts | objective matches: new library, unfamiliar, prototype |
| Refactoring keywords | 1pt | objective matches: refactor, restructure, migrate |
| TDD plan type | 2pts | plan_type === 'tdd' |
| Dependencies | 1pt | depends_on has 1+ entries |
| Test files | 1pt | files_modified contains test/spec files |

## Tier Mapping

| Score | Tier |
|-------|------|
| 0-3 | simple |
| 4-7 | medium |
| 8+ | complex |

## Default

When no context is provided, returns `{ score: 5, tier: 'medium' }` as a safe fallback.

</evaluation_algorithm>

<usage>

### From CLI

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-adaptive-model <agent-type> --context '<json>'
```

### From Code

```javascript
const { evaluateComplexity } = require('./core.cjs');
const result = evaluateComplexity({
  files_modified: ['src/api.ts', 'src/db.ts'],
  task_count: 5,
  objective: 'integrate external webhook API'
});
// result: { score: 9, tier: 'complex', factors: [...] }
```

### In Workflows

When `model_profile === 'adaptive'` in execute-phase:

1. Read plan metadata from `phase-plan-index`
2. Build context: `{ files_modified, task_count, objective }`
3. Call `resolve-adaptive-model` to get per-plan model
4. Use resolved model for agent spawn

</usage>
