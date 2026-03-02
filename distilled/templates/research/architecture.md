# Architecture Research Template

Use when researching system structure and patterns for a project or phase.

Write to: `.planning/research/ARCHITECTURE.md`

---

```markdown
# Architecture Research

**Domain**: [what we're building]
**Researched**: [date]

## Recommended Structure

```
src/
├── [folder]/        # [purpose]
├── [folder]/        # [purpose]
└── [folder]/        # [purpose]
```

## Key Patterns

### [Pattern Name]
**What**: [description]
**When**: [when to use it]
**Example**:
```
[brief code or pseudo-code snippet]
```

### [Pattern Name]
**What**: [description]
**When**: [when to use it]

## Anti-Patterns

- **[Don't do this]**: [why it's bad] → [do this instead]
- **[Don't do this]**: [why it's bad] → [do this instead]

## Component Boundaries

[Which components talk to which, data flow direction, build order implications]

---
*Confidence: [HIGH/MEDIUM/LOW]*
```

## Guidelines

- **Structure** should reflect the actual folder layout you'd create
- **Patterns** should include real examples, not just names
- **Anti-patterns** are as valuable as patterns — they prevent common mistakes
- **Component boundaries** inform phase ordering in the roadmap
- Keep to ~40-50 lines when filled out
