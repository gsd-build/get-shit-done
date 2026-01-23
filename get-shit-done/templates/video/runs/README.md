# RUNS/

Every generation attempt gets a run log. Keep it deterministic and resumable.

## Run log naming
- `run_YYYYMMDD_HHMMSS.md`

## Suggested log template
```markdown
# Run [timestamp]

## Inputs
- bible: bible_v001.yaml
- shotlist: shotlist_v001.yaml
- locks: [list of lock frames]

## Prompts used
- [prompt file paths]

## Outputs
- [generated files, links, or IDs]

## Notes
- what worked
- what drifted
- follow-ups
```
