# Verification Overrides

When a verification check repeatedly flags something that's intentionally different from the plan, you can add an override to accept it.

## Override Format

Add to VERIFICATION.md frontmatter:
```yaml
---
phase: "03"
plan: "01"
overrides:
  - must_have: "Unit tests for auth module"
    reason: "Auth uses external OAuth provider, tested via integration tests"
    accepted_by: "user"
    accepted_at: "2026-02-12T10:00:00Z"
---
```

## How Overrides Work

1. Verifier checks each `must_have` item from the plan
2. Before marking as FAIL, checks if an override exists for that item
3. If override found: marks as `PASSED (override)` with the reason
4. Overrides persist across verification cycles

## Managing Overrides

```bash
# Add an override via gsd-tools
node gsd-tools.js override add --must-have "Unit tests for auth" --reason "Tested via integration" --raw

# List current overrides
node gsd-tools.js override list --raw

# Remove an override
node gsd-tools.js override remove --must-have "Unit tests for auth" --raw
```
