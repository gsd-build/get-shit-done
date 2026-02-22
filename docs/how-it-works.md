---
layout: default
title: How It Works
---

# How GSD Works

GSD is a **context engineering layer** for Claude Code. It solves the fundamental problem of context rot—the quality degradation that happens as Claude fills its context window during extended sessions.

---

## The Context Quality Curve

Claude's output quality degrades predictably with context usage:

| Context Used | Quality |
|-------------|---------|
| 0-30% | Peak quality |
| 30-50% | Good quality |
| 50-70% | Degrading |
| 70%+ | Poor quality |

**GSD's rule:** Plans complete within ~50% context. Heavy lifting uses subagents with fresh 200k windows.

---

## Core Architecture

### Plans ARE Prompts

PLAN.md files aren't documents to transform—they're **executable prompts**:

```xml
<objective>
## Primary Goal
Build authentication system with JWT

## Success Criteria
- Users can register and login
- Sessions persist across browser restarts
- Tokens refresh automatically
</objective>

<execution_context>
@PROJECT.md
@src/lib/auth.ts
@prisma/schema.prisma
</execution_context>

<task type="auto">
  <name>Task 1: Create auth middleware</name>
  <files>src/middleware/auth.ts</files>
  <action>Create JWT verification middleware using jose library</action>
  <verify>npm run typecheck passes</verify>
  <done>Middleware exports verifyToken function</done>
</task>
```

Claude executes these directly. No interpretation overhead.

---

## The Artifact System

GSD maintains structured context through markdown artifacts:

| File | Purpose | When Created |
|------|---------|--------------|
| `PROJECT.md` | Vision, goals, constraints | `/gsd:new-project` |
| `REQUIREMENTS.md` | v1/v2/out-of-scope features | `/gsd:new-project` |
| `ROADMAP.md` | Phase breakdown | `/gsd:new-project` |
| `STATE.md` | Current position, decisions, blockers | Ongoing |
| `{phase}-CONTEXT.md` | Phase-specific choices | `/gsd:discuss-phase` |
| `{phase}-PLAN.md` | Executable task list | `/gsd:plan-phase` |
| `{phase}-SUMMARY.md` | What happened | `/gsd:execute-phase` |

These files form a **knowledge graph** that Claude can reference without loading everything into context.

---

## Multi-Agent Orchestration

For heavy operations, GSD spawns **specialized subagents**:

```
Main Context (stays at 30-40%)
    │
    ├── Research Agent 1 (fresh 200k) → ecosystem analysis
    ├── Research Agent 2 (fresh 200k) → implementation patterns
    ├── Research Agent 3 (fresh 200k) → security considerations
    └── Research Agent 4 (fresh 200k) → performance approaches
    │
    └── Results collected and integrated
```

Each agent works with a full context window. Results are synthesized back into concise artifacts.

---

## The Workflow

### 1. New Project (`/gsd:new-project`)

Deep questioning session:
- What are you building?
- Who is it for?
- What technology constraints exist?
- What does success look like?

Creates foundational artifacts: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md.

### 2. Discuss Phase (`/gsd:discuss-phase`)

Captures implementation decisions before planning:
- Visual design choices
- API design preferences
- Organizational patterns

Creates {phase}-CONTEXT.md with locked decisions.

### 3. Plan Phase (`/gsd:plan-phase`)

Research-driven planning:
1. Spawns research agents for comprehensive analysis
2. Synthesizes findings into actionable plan
3. Breaks work into 2-3 atomic tasks
4. Each task has clear files, actions, and verification

Creates {phase}-RESEARCH.md and {phase}-PLAN.md.

### 4. Execute Phase (`/gsd:execute-phase`)

Builds with fresh context:
- Loads only necessary artifacts
- Executes each task atomically
- Commits after each task
- Verifies success criteria

Creates {phase}-SUMMARY.md with what was built.

### 5. Verify Work (`/gsd:verify-work`)

User acceptance testing:
- Presents what was built
- Guides manual verification
- Runs automated checks
- Creates fix plans if issues found

### 6. Complete Milestone (`/gsd:complete-milestone`)

Ships the work:
- Tags release
- Archives phase artifacts
- Updates STATE.md
- Prepares for next cycle

---

## Task Types

GSD supports three task execution modes:

### Auto Tasks
```xml
<task type="auto">
  <!-- Claude executes without stopping -->
</task>
```

### Human Verification Checkpoints
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Description of deliverable</what-built>
  <how-to-verify>
    1. Open browser to localhost:3000
    2. Click login button
    3. Enter credentials
  </how-to-verify>
  <resume-signal>Type 'continue' when verified</resume-signal>
</task>
```

### Decision Checkpoints
```xml
<task type="checkpoint:decision">
  <question>Which auth provider should we use?</question>
  <options>
    - NextAuth (simpler, less flexible)
    - Custom JWT (more control, more work)
  </options>
</task>
```

---

## Git Integration

Every task produces an atomic commit:

```
{type}({phase}-{plan}): {description}
```

Examples:
- `feat(03-01): add user registration flow`
- `test(03-01): add auth middleware tests`
- `fix(03-02): handle expired token refresh`

This gives you **bisectable history**—you can always find exactly when something changed.

---

## Next Steps

- [Getting Started](/getting-started) — Install and run your first project
- [Commands Reference](/commands) — Full list of GSD commands
- [Philosophy](/philosophy) — Why GSD works this way
