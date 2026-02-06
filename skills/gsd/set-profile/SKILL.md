---
name: set-profile
description: Switch model profile for GSD agents (quality/balanced/budget) Profile name: quality, balanced, or budget
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# set-profile Skill

## Objective

Switch the model profile used by GSD agents. This controls which Claude model each agent uses, balancing quality vs token spend.
| Profile | Description |
|---------|-------------|
| **quality** | Opus everywhere except read-only verification |
| **balanced** | Opus for planning, Sonnet for execution/verification (default) |
| **budget** | Sonnet for writing, Haiku for research/verification |

## When to Use



## Process

## 1. Validate argument
```
if $ARGUMENTS.profile not in ["quality", "balanced", "budget"]:
  Error: Invalid profile "$ARGUMENTS.profile"
  Valid profiles: quality, balanced, budget
  STOP
```
## 2. Ensure config exists
```bash
ls .planning/config.json 2>/dev/null
```
If `.planning/config.json` missing, create it with defaults:
```bash
mkdir -p .planning
```
```json
{
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  }
}
```
Write this to `.planning/config.json`, then continue.
## 3. Update config.json
Read current config:
```bash
cat .planning/config.json
```
Update `model_profile` field:
```json
{
  "model_profile": "$ARGUMENTS.profile"
}
```
Write updated config back to `.planning/config.json`.
## 4. Confirm

## Success Criteria



## Examples

### Example Usage
[TBD: Add specific examples of when and how to use this skill]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
