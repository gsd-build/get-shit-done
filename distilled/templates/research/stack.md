# Stack Research Template

Use when researching the technology stack for a project or phase.

Write to: `.planning/research/STACK.md`

---

```markdown
# Stack Research

**Domain**: [what we're building]
**Researched**: [date]

## Recommended Stack

| Library/Tool | Version | Purpose | Why This One |
|-------------|---------|---------|--------------|
| [name] | [ver] | [what it does] | [why it's the right choice] |
| [name] | [ver] | [what it does] | [why it's the right choice] |

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|------------|---------|
| [choice] | [option] | [tradeoff] |

## Don't Hand-Roll

Problems that look simple but have battle-tested solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| [problem] | [custom solution] | [library] | [edge cases you'd miss] |

---
*Confidence: [HIGH/MEDIUM/LOW]*
```

## Guidelines

- **Specific versions** — not "latest", give actual numbers
- **"Why This One"** matters more than "What It Does"
- **Don't Hand-Roll** is the highest-value section — prevents wasted effort on solved problems
- Keep to ~30-40 lines when filled out
