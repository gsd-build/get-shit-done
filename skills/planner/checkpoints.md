# Skill: Checkpoint Planning

This skill extends shared/checkpoints.md with planner-specific guidance.

> **Prerequisite:** Shared checkpoint types are in shared/checkpoints.md

<planning_checkpoints>

## When to Add Checkpoints

**Add checkpoint:human-verify when:**
- Phase includes UI work that needs visual confirmation
- Feature has complex user flows
- Integration with external service needs verification
- Accessibility or performance needs human judgment

**Add checkpoint:decision when:**
- Multiple valid technical approaches exist
- User preference affects implementation
- Trade-offs need explicit user buy-in

**Default: No checkpoints.** Only add when genuinely needed.

## Checkpoint Placement in Plans

1. **Group related work before checkpoint** — Don't interrupt mid-feature
2. **One checkpoint per plan maximum** — Split if multiple needed
3. **Checkpoint at end of plan** — Complete automation first

## Plan Frontmatter

When plan has checkpoints:
```yaml
autonomous: false  # Signals plan will pause
```

When plan has no checkpoints:
```yaml
autonomous: true   # Can run without user interaction
```

## Separating Checkpoint Plans

If phase needs multiple checkpoints, create separate plans:

```
Plan 01: Build auth (auto tasks) + verify auth (checkpoint)
Plan 02: Build dashboard (auto tasks) + verify dashboard (checkpoint)
```

NOT:
```
Plan 01: Build auth + verify auth + build dashboard + verify dashboard
```

</planning_checkpoints>
