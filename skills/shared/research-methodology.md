# Skill: Research Methodology (Shared)

This skill is shared by gsd-phase-researcher and gsd-project-researcher.

<philosophy>

## Claude's Training as Hypothesis

Claude's training data is 6-18 months stale. Treat pre-existing knowledge as hypothesis, not fact.

**The discipline:**
1. **Verify before asserting** - Don't state library capabilities without checking Context7 or official docs
2. **Date your knowledge** - "As of my training" is a warning flag
3. **Prefer current sources** - Context7 and official docs trump training data
4. **Flag uncertainty** - LOW confidence when only training data supports a claim

## Honest Reporting

Research value comes from accuracy, not completeness theater.

**Report honestly:**
- "I couldn't find X" is valuable
- "This is LOW confidence" is valuable
- "Sources contradict" is valuable
- "I don't know" is valuable

</philosophy>

<tool_strategy>

## Context7: First for Libraries

**When to use:** Any question about a library's API, framework feature, version capabilities.

**How to use:**
```
1. Resolve library ID:
   mcp__context7__resolve-library-id with libraryName: "[library name]"

2. Query documentation:
   mcp__context7__query-docs with:
   - libraryId: [resolved ID]
   - query: "[specific question]"
```

## Official Docs via WebFetch

**When to use:** Library not in Context7, changelog/releases, official blog posts.

**Best practices:**
- Use exact URLs, not search results pages
- Check publication dates
- Prefer /docs/ paths over marketing pages

## WebSearch: Ecosystem Discovery

**When to use:** Finding what exists, community patterns, real-world usage.

**Query templates:**
```
Ecosystem discovery:
- "[technology] best practices [current year]"
- "[technology] recommended libraries [current year]"

Pattern discovery:
- "how to build [type of thing] with [technology]"
- "[technology] architecture patterns"

Problem discovery:
- "[technology] common mistakes"
- "[technology] gotchas"
```

**Best practices:**
- Always include the current year for freshness
- Cross-verify findings with authoritative sources
- Mark WebSearch-only findings as LOW confidence

</tool_strategy>

<source_hierarchy>

## Confidence Levels

| Level | Sources | Use |
|-------|---------|-----|
| HIGH | Context7, official documentation | State as fact |
| MEDIUM | WebSearch verified with official source | State with attribution |
| LOW | WebSearch only, single source | Flag as needing validation |

## Verification Protocol

```
For each WebSearch finding:

1. Can I verify with Context7?
   YES → Query Context7, upgrade to HIGH confidence
   NO → Continue to step 2

2. Can I verify with official docs?
   YES → WebFetch official source, upgrade to MEDIUM confidence
   NO → Remains LOW confidence

3. Do multiple sources agree?
   YES → Increase confidence one level
   NO → Note contradiction, investigate further
```

## Known Pitfalls

- **Configuration Scope Blindness:** Verify ALL configuration scopes
- **Deprecated Features:** Check current docs, not old ones
- **Negative Claims Without Evidence:** Don't confuse "didn't find it" with "doesn't exist"
- **Single Source Reliance:** Require multiple sources for critical claims

</source_hierarchy>
