---
name: gsd:spike
description: Translate design uncertainty into a structured experiment with testable hypotheses (v1.16.0+dev)
argument-hint: "[question] [--phase N]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
  - Grep
---

# /gsd:spike

Translate design uncertainty into a structured experiment with testable hypotheses.

## Usage

```
/gsd:spike "Which OCR library performs best on handwritten text?"
/gsd:spike                    # Interactive: prompts for question
/gsd:spike --phase 3          # Links spike to specific phase
```

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| question | string | no | The question to investigate. If omitted, prompts interactively. |
| --phase | number | no | Link spike to a specific phase (for RESEARCH.md integration) |

## Behavior

1. **Route to workflow:** Invoke `get-shit-done/workflows/run-spike.md` with arguments
2. **No command-level logic:** All spike logic lives in the workflow

## Examples

**Standalone spike (project-level):**
```
/gsd:spike "Should we use Prisma or Drizzle for the database layer?"
```

**Phase-linked spike:**
```
/gsd:spike --phase 3 "Is server-side rendering feasible for the dashboard?"
```

**Interactive mode:**
```
/gsd:spike
> What question would you like to investigate?
```

## Workflow Reference

See: `get-shit-done/workflows/run-spike.md`

## Related

- `/gsd:collect-signals` -- Post-execution signal collection
- `/gsd:signal` -- Manual signal logging
- `/gsd:reflect` -- Pattern analysis and lesson distillation
