# Feature Discussion Guard

Prevents duplicate feature proposals by checking existing plans before suggesting new work.

---

## When This Applies

The feature discussion guard MUST be applied when:

- User mentions a feature idea in conversation
- User asks "can we add X?" or "what about Y?"
- User discusses functionality that sounds like a feature
- You're about to suggest adding a new feature or phase
- Any conversation that might lead to new work being proposed

## How to Check Existing Plans

Before proposing any new feature, run these checks:

```bash
# Check REQUIREMENTS.md for the feature keywords
grep -i "[feature keywords]" .planning/REQUIREMENTS.md 2>/dev/null

# Check ROADMAP.md for phase descriptions
grep -i "[feature keywords]" .planning/ROADMAP.md 2>/dev/null

# Check existing phase directories for related work
ls .planning/phases/ | grep -i "[feature keywords]" 2>/dev/null
```

**Search for:**
- The exact feature name
- Related synonyms
- Key technology terms
- Domain-specific keywords

## Response Patterns

### If Feature Already Planned

```markdown
That's already planned!

**{REQ-ID}: {Feature Name}**
- Phase: {N} - {Phase Name}
- Status: {Planned/In Progress}
- Description: {from REQUIREMENTS.md}

Would you like to:
1. Review the existing plan for this feature
2. Adjust the scope or priority
3. Move it to an earlier phase
```

### If Feature NOT Planned

```markdown
That's not currently in the roadmap.

To add it:
- `/gsd:add-phase "{feature description}"` — Add as new phase
- `/gsd:add-todo {feature idea}` — Capture for later consideration

Would you like me to help scope this feature?
```

### If Feature Partially Overlaps

```markdown
This overlaps with existing plans:

**{REQ-ID}: {Related Feature}** (Phase {N})
- What's planned: {description}
- What you're suggesting: {new aspect}

Options:
1. Expand the existing requirement to include this
2. Add as a separate enhancement phase
3. Note as future improvement
```

## Examples

### Wrong Behavior (Before Guard)

**User:** "We should add psychological profiling with Jung archetypes"

**Claude (wrong):** "Great idea! Let me create Phase 2.2: Psychological Analysis..."

This is wrong because Claude didn't check if this feature already exists.

### Correct Behavior (With Guard)

**User:** "We should add psychological profiling with Jung archetypes"

**Claude (correct):**
```bash
# First, check existing plans
grep -i "jung\|archetype\|psych\|personality" .planning/REQUIREMENTS.md
```

Finds: `PSY-01: Psychological Profiling - Jung Archetypes, Big Five integration (Phase 4)`

**Claude responds:** "That's already planned! PSY-01 covers Jung Archetypes and Big Five personality integration, scheduled for Phase 4. Would you like to review that phase or adjust its priority?"

## Integration Points

### During Resume (resume-project.md)

REQUIREMENTS.md is loaded during project resume. The feature guard is active for the entire session.

### During Conversations

Any time a user discusses potential features:
1. Parse the feature concept from conversation
2. Search REQUIREMENTS.md and ROADMAP.md
3. Apply appropriate response pattern

### During Planning

When creating new phases or plans:
1. Cross-reference proposed work against REQUIREMENTS.md
2. Link to existing requirements where applicable
3. Flag if proposed work duplicates existing plans

## Quick Reference

| User Says | Check For | If Found | If Not Found |
|-----------|-----------|----------|--------------|
| "Add feature X" | X in REQUIREMENTS.md | Reference existing plan | Offer to add |
| "What about Y?" | Y in ROADMAP.md | Show planned phase | Discuss scoping |
| "Can we do Z?" | Z in any .planning/ file | Explain existing coverage | Help scope new work |

## Why This Matters

1. **Prevents duplicate work** - Don't plan what's already planned
2. **Maintains roadmap integrity** - All features flow through proper process
3. **Saves user time** - No need to correct Claude's suggestions
4. **Builds trust** - Claude demonstrates awareness of project context
