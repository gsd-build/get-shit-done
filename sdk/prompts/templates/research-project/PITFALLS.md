# Pitfalls Research Template

Template for `.planning/research/PITFALLS.md` — common mistakes to avoid in the project domain.

<template>

```markdown
# Pitfalls Research

**Domain:** [domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

## Critical Pitfalls

### Pitfall 1: [Name]

**What goes wrong:**
[Description of the failure mode]

**Why it happens:**
[Root cause — why developers make this mistake]

**How to avoid:**
[Specific prevention strategy]

**Warning signs:**
[How to detect this early before it becomes a problem]

**Phase to address:**
[Which roadmap phase should prevent this]

---

### Pitfall 2: [Name]

**What goes wrong:**
[Description of the failure mode]

**Why it happens:**
[Root cause — why developers make this mistake]

**How to avoid:**
[Specific prevention strategy]

**Warning signs:**
[How to detect this early before it becomes a problem]

**Phase to address:**
[Which roadmap phase should prevent this]

---

### Pitfall 3: [Name]

**What goes wrong:**
[Description of the failure mode]

**Why it happens:**
[Root cause — why developers make this mistake]

**How to avoid:**
[Specific prevention strategy]

**Warning signs:**
[How to detect this early before it becomes a problem]

**Phase to address:**
[Which roadmap phase should prevent this]

---

[Continue for all critical pitfalls...]

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| [shortcut] | [benefit] | [cost] | [conditions, or "never"] |
| [shortcut] | [benefit] | [cost] | [conditions, or "never"] |
| [shortcut] | [benefit] | [cost] | [conditions, or "never"] |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| [service] | [what people do wrong] | [what to do instead] |
| [service] | [what people do wrong] | [what to do instead] |
| [service] | [what people do wrong] | [what to do instead] |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| [trap] | [how you notice] | [how to avoid] | [scale threshold] |
| [trap] | [how you notice] | [how to avoid] | [scale threshold] |
| [trap] | [how you notice] | [how to avoid] | [scale threshold] |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| [mistake] | [what could happen] | [how to avoid] |
| [mistake] | [what could happen] | [how to avoid] |
| [mistake] | [what could happen] | [how to avoid] |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| [pitfall] | [how users suffer] | [what to do instead] |
| [pitfall] | [how users suffer] | [what to do instead] |
| [pitfall] | [how users suffer] | [what to do instead] |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **[Feature]:** Often missing [thing] — verify [check]
- [ ] **[Feature]:** Often missing [thing] — verify [check]
- [ ] **[Feature]:** Often missing [thing] — verify [check]
- [ ] **[Feature]:** Often missing [thing] — verify [check]

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| [pitfall] | LOW/MEDIUM/HIGH | [what to do] |
| [pitfall] | LOW/MEDIUM/HIGH | [what to do] |
| [pitfall] | LOW/MEDIUM/HIGH | [what to do] |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| [pitfall] | Phase [X] | [how to verify prevention worked] |
| [pitfall] | Phase [X] | [how to verify prevention worked] |
| [pitfall] | Phase [X] | [how to verify prevention worked] |

## Sources

- [Post-mortems referenced]
- [Community discussions]
- [Official "gotchas" documentation]
- [Personal experience / known issues]

---
*Pitfalls research for: [domain]*
*Researched: [date]*
```

</template>

<guidelines>

**Critical Pitfalls:**
- Focus on domain-specific issues, not generic mistakes
- Include warning signs — early detection prevents disasters
- Link to specific phases — makes pitfalls actionable

**Technical Debt:**
- Be realistic — some shortcuts are acceptable
- Note when shortcuts are "never acceptable" vs. "only in MVP"
- Include the long-term cost to inform tradeoff decisions

**Performance Traps:**
- Include scale thresholds ("breaks at 10k users")
- Focus on what's relevant for this project's expected scale
- Don't over-engineer for hypothetical scale

**Security Mistakes:**
- Beyond OWASP basics — domain-specific issues
- Example: Community platforms have different security concerns than e-commerce
- Include risk level to prioritize

**"Looks Done But Isn't":**
- Checklist format for verification during execution
- Common in demos vs. production
- Prevents "it works on my machine" issues

**Pitfall-to-Phase Mapping:**
- Critical for roadmap creation
- Each pitfall should map to a phase that prevents it
- Informs phase ordering and success criteria

</guidelines>
