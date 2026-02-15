---
phase: 02-auto-mode-refinement
plan: 05
subsystem: learning
tags: [pattern-extraction, rule-learning, conflict-resolution, feedback-loop]
completed: 2026-02-15T23:05:27Z
duration: 4min

dependency_graph:
  requires:
    - 02-04 (Feedback collection system)
  provides:
    - Pattern extraction from feedback data
    - Intelligent rule merging with conflict resolution
    - User-editable learned routing rules
  affects:
    - Task router (future integration)
    - Model selection accuracy

tech_stack:
  added:
    - gsd-learning.js (pattern extraction and rule learning)
  patterns:
    - Multi-signal pattern extraction (keywords + complexity)
    - Evidence-based conflict resolution (threshold: 3)
    - Keyword overlap clustering (>50%)
    - User-transparent learned rules (editable markdown)

key_files:
  created:
    - ~/.claude/get-shit-done/bin/gsd-learning.js
    - ~/.claude/skills/gsd-task-router/learned-rules.md
    - .planning/feedback/rule-merge-log.jsonl
  modified:
    - ~/.claude/get-shit-done/bin/gsd-tools.js

decisions:
  - pattern_extraction: "Multi-signal approach: keywords + complexity signals (word count, technical/security terms)"
  - consolidation: "Group patterns by keyword overlap >50% to avoid fragmentation"
  - conflict_resolution: "Evidence threshold of 3 required to override built-in rules"
  - transparency: "Learned rules in human-readable markdown for user inspection and editing"
  - merge_logging: "All conflict resolution decisions logged to rule-merge-log.jsonl"
---

# Phase 02 Plan 05: Pattern Extraction and Rule Learning Summary

**One-liner:** Pattern extraction from feedback with multi-signal complexity detection, evidence-based rule merging (threshold: 3), and user-editable learned-rules.md for transparency.

## What Was Built

### Core Learning Module (gsd-learning.js)

**1. Feedback Processing**
- `readFeedbackLog()`: Loads incorrect feedback entries from human-feedback.jsonl
- Filters to incorrect feedback only (correct: false)
- Returns array with task fingerprints and should_use model

**2. Pattern Extraction**
- `extractPatterns()`: Multi-signal pattern extraction
  - Keyword extraction with stop word filtering
  - Complexity signals: word count, technical terms, security terms
  - Pattern consolidation via keyword overlap (>50%)
  - Returns LearnedPattern objects with evidence count
- `extractKeywords()`: Frequency-based keyword extraction (top 10)
- `calculateComplexitySignals()`: Detects technical/security terms, word count

**3. Rule Management**
- `loadBuiltInRules()`: Parses routing-rules.md markdown table
- `mergeRules()`: Intelligent merge with conflict resolution
  - Evidence threshold: 3+ feedback entries required to override
  - Logs all merge decisions (override/insufficient/new)
  - Returns merged rule set with statistics
- `logRuleMerge()`: Appends decisions to rule-merge-log.jsonl

**4. Document Generation**
- `generateLearnedRulesDoc()`: Creates markdown with:
  - Quick reference table (pattern, model, evidence, date)
  - Pattern details (keywords, complexity signals, examples)
  - How learning works section
- `writeLearnedRules()`: Writes to ~/.claude/skills/gsd-task-router/learned-rules.md

### CLI Integration (gsd-tools.js)

**Learning Commands:**
- `learning extract`: Extract patterns from feedback (debugging)
- `learning merge`: Merge learned rules with built-in, write to learned-rules.md
- `learning rules`: Show current learned rules as JSON
- `learning clear`: Reset learned-rules.md to empty template
- `learning status`: Show feedback count, learned rules, last merge timestamp

### Supporting Artifacts

**1. learned-rules.md**
- Human-readable learned routing rules
- Quick reference table + detailed pattern sections
- User-editable for manual adjustments
- Empty template initialized with "How Learning Works" guide

**2. rule-merge-log.jsonl**
- Conflict resolution decision log
- Fields: timestamp, pattern, conflict_type, old_model, new_model, evidence_count
- Enables audit trail of learning decisions

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

**Pattern Extraction Strategy:**
- Used multi-signal approach combining keywords and complexity signals
- Rationale: Keywords alone miss task complexity; combining signals improves pattern quality

**Consolidation Algorithm:**
- Chose keyword overlap >50% threshold for grouping similar feedback
- Rationale: Avoids pattern fragmentation while maintaining distinctiveness

**Evidence Threshold:**
- Set to 3 feedback entries for overriding built-in rules
- Rationale: Balances responsiveness to feedback with stability (avoids noise)

**Transparency Design:**
- Chose markdown format with table + details sections
- Rationale: Easy to read, easy to edit, version-controllable

## Success Criteria

✓ extractPatterns() consolidates similar feedback into LearnedPattern objects
✓ mergeRules() correctly handles conflicts based on evidence count (3+ threshold)
✓ generateLearnedRulesDoc() produces readable markdown with table and details
✓ CLI commands enable pattern extraction, rule merging, and status checking
✓ Users can view and edit learned-rules.md directly (transparency)

## Testing Performed

**1. Module Exports**
- Verified all functions exported correctly
- EVIDENCE_THRESHOLD constant accessible (value: 3)

**2. Pattern Extraction**
- Mock feedback with 2 similar entries → 1 consolidated pattern
- Keywords extracted correctly (stop words filtered)
- Complexity signals calculated (technical/security term counts)

**3. Rule Merging**
- Insufficient evidence (2 < 3): Built-in rule retained
- Sufficient evidence (5 >= 3): Learned rule overrides built-in
- Merge decisions logged to rule-merge-log.jsonl

**4. Document Generation**
- Empty state: "no learned rules yet" placeholder
- With patterns: Table + detailed sections + examples

**5. CLI Commands**
- `learning status`: Returns feedback counts and learning state
- `learning extract`: Returns patterns as JSON
- `learning merge`: Merges rules, writes learned-rules.md
- `learning rules`: Parses and returns learned-rules.md content

## Integration Points

**Inputs:**
- `.planning/feedback/human-feedback.jsonl` (from 02-04)
- `~/.claude/skills/gsd-task-router/routing-rules.md` (from 01-05)

**Outputs:**
- `~/.claude/skills/gsd-task-router/learned-rules.md` (new)
- `.planning/feedback/rule-merge-log.jsonl` (new)

**Future Integration:**
- Task router will load both built-in and learned rules
- Learning merge will be triggered periodically or on-demand
- Learned rules will improve routing accuracy over time

## Files Created

**Global GSD Tools:**
- `~/.claude/get-shit-done/bin/gsd-learning.js` (14KB, 401 lines)
- `~/.claude/skills/gsd-task-router/learned-rules.md` (843B, empty template)

**Project Files:**
- `.planning/feedback/rule-merge-log.jsonl` (99B, header only)

**Modified:**
- `~/.claude/get-shit-done/bin/gsd-tools.js` (+133 lines for learning commands)

## Next Steps

This plan completes the learning foundation. The feedback loop is now closed:

1. ✓ Feedback collection (02-04)
2. ✓ Pattern extraction and rule learning (02-05)
3. TODO: Router integration with learned rules (future phase)

The system can now learn from mistakes, but learned rules are not yet applied to routing decisions. Integration will require:
- Loading learned-rules.md in task router
- Merging with built-in rules at runtime
- Periodic or on-demand `learning merge` execution

## Self-Check

### Files Created

```bash
# Global tools
[ -f ~/.claude/get-shit-done/bin/gsd-learning.js ] → FOUND
[ -f ~/.claude/skills/gsd-task-router/learned-rules.md ] → FOUND

# Project files
[ -f .planning/feedback/rule-merge-log.jsonl ] → FOUND
```

### Functionality Verified

```bash
# Module exports
✓ EVIDENCE_THRESHOLD constant (value: 3)
✓ extractPatterns function
✓ mergeRules function
✓ generateLearnedRulesDoc function
✓ writeLearnedRules function

# CLI commands
✓ learning status returns state
✓ learning extract returns patterns
✓ learning merge processes rules
✓ learning rules shows learned rules
✓ learning clear resets template

# Rule merging logic
✓ Evidence < 3: keeps built-in rule
✓ Evidence >= 3: overrides with learned rule
✓ Conflict decisions logged to rule-merge-log.jsonl

# Document generation
✓ Empty state shows placeholder
✓ With patterns shows table + details
✓ Includes "How Learning Works" section
```

## Self-Check: PASSED

All files exist, all functions work correctly, all verification criteria met.
