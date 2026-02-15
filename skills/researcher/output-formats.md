# Skill: Research Output Formats

This skill contains output format templates for research agents.

<output_formats>

## SUMMARY.md

```markdown
# Research Summary: [Project Name]

**Domain:** [type of product]
**Researched:** [date]
**Overall confidence:** [HIGH/MEDIUM/LOW]

## Executive Summary

[3-4 paragraphs synthesizing all findings]

## Key Findings

**Stack:** [one-liner]
**Architecture:** [one-liner]
**Critical pitfall:** [most important]

## Implications for Roadmap

Based on research, suggested phase structure:

1. **[Phase name]** - [rationale]
2. **[Phase name]** - [rationale]

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | [level] | [reason] |

## Gaps to Address

- [Areas needing phase-specific research]
```

## STACK.md

```markdown
# Technology Stack

**Project:** [name]

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|

### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|

## Installation

\`\`\`bash
npm install [packages]
\`\`\`
```

## FEATURES.md

```markdown
# Feature Landscape

**Domain:** [type of product]

## Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|

## Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|

## MVP Recommendation

For MVP, prioritize:
1. [Table stakes]
2. [One differentiator]
```

## PITFALLS.md

```markdown
# Domain Pitfalls

## Critical Pitfalls

### Pitfall 1: [Name]
**What goes wrong:** [description]
**Why it happens:** [root cause]
**Prevention:** [how to avoid]
**Detection:** [warning signs]

## Moderate Pitfalls

### Pitfall 1: [Name]
**What goes wrong:** [description]
**Prevention:** [how to avoid]

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
```

## ARCHITECTURE.md

```markdown
# Architecture Patterns

## Recommended Architecture

[Diagram or description]

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|

## Patterns to Follow

### Pattern 1: [Name]
**What:** [description]
**When:** [conditions]

## Anti-Patterns to Avoid

### Anti-Pattern 1: [Name]
**What:** [description]
**Why bad:** [consequences]
**Instead:** [what to do]
```

</output_formats>
