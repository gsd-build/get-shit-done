# Phase 1: Foundation - Research

**Researched:** 2025-01-18
**Domain:** TypeScript testing and YAML parsing
**Confidence:** HIGH

<research_summary>
## Summary

Researched testing frameworks and YAML parsing for TypeScript MCP server development. Vitest is the clear standard for ESM TypeScript projects. Gray-matter is battle-tested for markdown frontmatter parsing.

**Primary recommendation:** Use Vitest + gray-matter. Follow TDD for all extractors.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 1.0.0 | Test runner | Fast, ESM native, TS support |
| gray-matter | 4.0.3 | Frontmatter parsing | Handles edge cases, widely used |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yaml | 2.3.0 | YAML parsing | Complex YAML beyond frontmatter |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest slower for ESM, more config |
| gray-matter | manual regex | Gray-matter handles edge cases |
</standard_stack>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter | Regex parsing | gray-matter | Multiline, escaping, edge cases |
| Test runner | Custom harness | Vitest | Watch mode, coverage, parallel |

**Key insight:** YAML parsing has many edge cases. Gray-matter handles them all.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Malformed YAML
**What goes wrong:** Parser throws on invalid YAML
**Why it happens:** User-edited files may have syntax errors
**How to avoid:** Wrap parsing in try-catch, return empty object on failure
**Warning signs:** Tests fail with YAML parse errors

### Pitfall 2: Missing Frontmatter
**What goes wrong:** Code assumes frontmatter exists
**Why it happens:** Not all markdown files have frontmatter
**How to avoid:** Always check for empty result
**Warning signs:** Undefined errors on .data access
</common_pitfalls>

<sources>
## Sources

### Primary (HIGH confidence)
- Vitest documentation - test configuration
- gray-matter npm - API reference

### Secondary (MEDIUM confidence)
- None

### Tertiary (LOW confidence - needs validation)
- None
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: TypeScript testing
- Ecosystem: Vitest, gray-matter
- Patterns: TDD, fixture-based testing
- Pitfalls: YAML parsing edge cases

**Confidence breakdown:**
- Standard stack: HIGH - widely used
- Architecture: HIGH - standard patterns
- Pitfalls: HIGH - documented extensively
- Code examples: HIGH - from official docs

**Research date:** 2025-01-18
**Valid until:** 2025-02-18 (30 days - stable tech)
</metadata>

---

*Phase: 01-foundation*
*Research completed: 2025-01-18*
*Ready for planning: yes*
