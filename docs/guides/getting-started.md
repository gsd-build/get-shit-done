# Getting Started with GSD

This guide walks you through your first GSD project from initialization to completion.

## Prerequisites

GSD is installed via npm:

```bash
npx get-shit-done-together
```

This installs GSD commands into your Claude Code environment.

## Quick Start

### 1. Initialize Your Project

Start by creating a new project:

```
/gsd:new-project
```

GSD will ask you questions about:
- What you're building
- Who it's for
- What success looks like
- Technical constraints

**Tip:** Be specific. "A task management app" is less helpful than "A task management app for small teams that tracks tasks with deadlines and assignments."

### 2. Plan Your First Phase

After project initialization, you'll have a ROADMAP.md with phases. Plan the first phase:

```
/gsd:plan-phase 1
```

This creates executable plans with:
- Specific tasks (2-3 per plan)
- Verification criteria
- Dependency ordering

### 3. Execute the Phase

Run the plans:

```
/gsd:execute-phase 1
```

GSD will:
- Execute plans in parallel where possible
- Commit each task atomically
- Verify goals were achieved

### 4. Check Progress

See where you are and what's next:

```
/gsd:progress
```

This shows your current position and routes you to the next action.

### 5. Continue Through Phases

Repeat for each phase:

```
/gsd:plan-phase 2
/gsd:execute-phase 2
/gsd:progress
...
```

### 6. Complete the Milestone

When all phases are done:

```
/gsd:audit-milestone
/gsd:complete-milestone
```

This archives the milestone and creates a git tag.

## Typical Session

A typical GSD session looks like:

```
# Start of session
/gsd:progress              # See where you left off

# Plan next phase
/gsd:plan-phase 3          # Create plans

# Execute
/gsd:execute-phase 3       # Run plans

# Optional: Verify with user testing
/gsd:verify-work 3         # Manual acceptance testing

# Check status
/gsd:progress              # Route to next action

# End of session (if needed)
/gsd:pause-work            # Save context for later
```

## Key Concepts to Understand

### The Hierarchy

```
Project → Milestone → Phase → Plan → Task
```

- **Project:** What you're building (lives forever)
- **Milestone:** A version release (v1.0, v1.1)
- **Phase:** A coherent unit of work
- **Plan:** Executable prompt (2-3 tasks)
- **Task:** Single code change

### Wave-Based Execution

Plans run in waves for parallelization:
- Wave 1 plans have no dependencies → run in parallel
- Wave 2 depends on Wave 1 → runs after
- This speeds up execution significantly

### Goal-Backward Verification

GSD checks that **goals were achieved**, not just tasks completed:
- "User can log in" vs "Login endpoint exists"
- Catches stub implementations and unwired components

### State Persistence

Your progress survives:
- Context resets (`/clear`)
- Session changes
- Computer restarts

Everything is tracked in `.planning/STATE.md`.

## Configuration

Customize GSD behavior:

```
/gsd:settings
```

Options include:
- **Model profile:** quality (Opus), balanced (default), budget (Haiku)
- **Research toggle:** Enable/disable domain research
- **Plan checker:** Verify plans before execution
- **Verifier:** Verify goals after execution

## Common Workflows

### Starting a New Feature

```
/gsd:new-milestone "v1.1 Notifications"
/gsd:plan-phase 5
/gsd:execute-phase 5
```

### Handling Bugs During Development

GSD auto-handles most deviations:
- Bugs → Auto-fixed
- Missing dependencies → Auto-added
- Architectural changes → Pauses for your input

### Pausing Mid-Work

```
/gsd:pause-work    # Saves full context
# Later...
/gsd:resume-work   # Restores everything
```

### Quick Ad-Hoc Tasks

For small tasks that don't need full workflow:

```
/gsd:quick "Add loading spinner to dashboard"
```

### Debugging Issues

For systematic investigation:

```
/gsd:debug "Login sometimes fails silently"
```

## File Structure

After initialization, you'll have:

```
.planning/
├── PROJECT.md        # Your project vision
├── ROADMAP.md        # Phase structure
├── STATE.md          # Current position
├── config.json       # Settings
└── phases/
    └── 01-foundation/
        ├── 01-01-PLAN.md
        └── 01-01-SUMMARY.md
```

## Tips for Success

1. **Be specific in project definition** — Vague goals lead to vague plans
2. **Trust the phases** — Don't skip ahead; each phase builds on the last
3. **Use `/gsd:progress` often** — It knows what to do next
4. **Pause before context fills** — Save work before hitting limits
5. **Let GSD handle deviations** — It auto-fixes most issues

## Next Steps

- [Concepts Deep Dive](../concepts/projects.md) — Understand the full hierarchy
- [Command Reference](../reference/commands.md) — All available commands
- [Workflows Guide](workflows.md) — Common patterns and recipes
