---
layout: default
title: Philosophy
---

# Philosophy

Why GSD exists and how it thinks about AI-assisted development.

---

## The Core Problem

Claude Code is powerful. You can describe what you want and watch it build. But there's a catch.

**Context rot is real.**

As Claude works, its context window fills. Quality degrades predictably:

- 0-30% context: Peak performance
- 30-50%: Still good
- 50-70%: Degrading
- 70%+: Unreliable

Extended sessions produce inconsistent results. Claude forgets what it was doing. It contradicts earlier decisions. It loses track of the architecture.

The solution isn't "better prompting." The solution is **context engineering**.

---

## Context Engineering

GSD is a context engineering layer. It manages what Claude knows and when.

### Plans Complete Fast

Every plan targets completion within 50% context usage. 2-3 tasks max. Get in, build, commit, get out.

### Fresh Contexts for Heavy Work

Research and analysis spawn subagents with full 200k windows. The main context stays lean. Results are synthesized into concise artifacts.

### Structured Artifacts

PROJECT.md, REQUIREMENTS.md, ROADMAP.md—these aren't just documentation. They're **context anchors**. Claude can reference them without loading everything into memory.

### Atomic Commits

Every task produces one commit. If context corrupts mid-plan, you can always bisect back to the last good state.

---

## Plans ARE Prompts

This is the key insight.

PLAN.md files aren't documents for Claude to interpret. They're **executable prompts**:

```xml
<objective>What to build and why</objective>
<execution_context>Files to reference</execution_context>
<task type="auto">
  <name>Task 1: Specific action</name>
  <files>Exact files to touch</files>
  <action>What to do</action>
  <verify>How to check success</verify>
  <done>Acceptance criteria</done>
</task>
```

Claude executes these directly. No interpretation overhead. No ambiguity. No drift.

---

## Spec-Driven Development

GSD follows spec-driven development principles:

1. **Define before building.** Requirements are explicit. Scope is clear. v1/v2/out-of-scope are documented.

2. **Research before planning.** Implementation approaches are analyzed. Trade-offs are understood. Decisions are captured.

3. **Plan before executing.** Tasks are atomic. Files are specified. Verification is defined.

4. **Verify before continuing.** Each phase is tested. Issues are caught early. Fix plans are generated.

This isn't waterfall. It's structured iteration. Each cycle is fast. Feedback loops are tight.

---

## No Enterprise Bullshit

GSD is optimized for **solo developers working with Claude**.

You don't need:
- Story points
- Sprint ceremonies
- RACI matrices
- Jira tickets
- Stand-up meetings

You need:
- Clear requirements
- Executable plans
- Working software

GSD gives you the structure that makes Claude reliable without the overhead that slows you down.

---

## The Meta-Prompting Language

GSD uses a specific syntax for meta-prompting. This isn't arbitrary.

### XML for Semantics

```xml
<objective>
## Goal
Build auth system
</objective>
```

XML tags mark **meaning**, not structure. Markdown handles hierarchy within. This lets Claude understand intent while maintaining readability.

### Imperative Voice

```
Create auth middleware.
Implement token refresh.
Add error handling.
```

Not "Let me create..." or "I'll implement...". Direct commands. Clear expectations.

### No Filler

Every word earns its place:

- No "just" or "simply"
- No "Let me help you with..."
- No "Great question!"
- No hedging or qualification

Brevity with substance: "JWT auth with refresh rotation using jose library."

### @ References for Lazy Loading

```
@PROJECT.md
@src/lib/auth.ts (if exists)
```

Files are referenced, not embedded. Claude loads what it needs when it needs it.

---

## Why Markdown

GSD artifacts are markdown files in a `.planning/` directory.

**Version controlled.** Your project history includes your planning history. You can see how decisions evolved.

**Human readable.** No special tools needed. Any editor works.

**Portable.** Move projects between machines. Share with collaborators. Everything travels together.

**Editable.** Found an error? Fix it directly. No database. No sync issues.

---

## Trust the Process

GSD works because it respects how Claude actually functions.

Claude excels at:
- Understanding context
- Following structured instructions
- Generating code from specs
- Breaking down problems

Claude struggles with:
- Maintaining state across long sessions
- Remembering earlier decisions
- Self-correcting when context degrades
- Knowing when to stop

GSD amplifies the strengths and compensates for the weaknesses.

When you follow the workflow—define, plan, execute, verify—Claude becomes a reliable building partner instead of a talented but forgetful assistant.

---

## Getting Started

Ready to ship?

```bash
npx get-shit-done-cc
/gsd:new-project
```

- [Getting Started Guide](/getting-started)
- [How It Works](/how-it-works)
- [Commands Reference](/commands)
