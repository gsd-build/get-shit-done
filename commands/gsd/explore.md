---
name: gsd:explore
description: Explore codebase structure and discover patterns for planning
argument-hint: "[area] [--depth shallow|deep]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Quick codebase exploration to understand structure, patterns, and dependencies before planning.

Scans a specific area (directory, feature, or pattern) and produces a structured report of findings. Useful for understanding unfamiliar code, verifying assumptions, or gathering context before creating plans.

Unlike `/gsd:map-codebase` which produces full documentation, explore is lightweight and conversational -- it reports findings directly without writing files.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/explore.md
</execution_context>

<context>
Target area: $ARGUMENTS (directory path, feature name, or pattern to search for)

**Depth modes:**
- `shallow` (default) -- top-level structure, key files, tech stack detection
- `deep` -- full recursive scan, dependency tracing, pattern analysis

**This command can run anytime:**
- Before planning to understand what exists
- During execution to investigate unfamiliar code
- After changes to verify structural impact
</context>

<when_to_use>
**Use explore for:**
- Quick understanding of a directory or subsystem
- Checking what patterns a codebase uses before planning
- Investigating dependencies between modules
- Answering "what does this area of the codebase do?"
- Pre-planning reconnaissance on a specific feature area

**Use map-codebase instead for:**
- Full codebase documentation (7 structured documents)
- Initial project onboarding (comprehensive analysis)
- Producing persistent reference material
</when_to_use>

<process>
1. Determine scope from arguments (directory, feature keyword, or file pattern)
2. Scan structure -- list files, directories, identify tech stack
3. Identify patterns -- find architectural patterns, conventions, key abstractions
4. Report findings -- structured output of discoveries with file paths and observations
</process>

<success_criteria>
- [ ] Target area identified and scoped
- [ ] File structure enumerated with key files highlighted
- [ ] Tech stack and patterns detected
- [ ] Findings reported in structured, actionable format
- [ ] User has enough context to proceed with planning or execution
</success_criteria>
