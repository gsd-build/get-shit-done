<purpose>
Package spike experiment findings into a persistent project skill — an implementation blueprint
for future build conversations. Reads from `.planning/spikes/`, writes skill to
`./.claude/skills/spike-findings-[project]/` (project-local) and summary to
`.planning/spikes/WRAP-UP-SUMMARY.md`. Companion to `/gsd-spike`.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="banner">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SPIKE WRAP-UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="gather">
## Gather Spike Inventory

1. Read `.planning/spikes/MANIFEST.md` for the overall idea context and requirements
2. Glob `.planning/spikes/*/README.md` and parse YAML frontmatter from each
3. Check if `./.claude/skills/spike-findings-*/SKILL.md` exists for this project
   - If yes: read its `processed_spikes` list from the metadata section and filter those out
   - If no: all spikes are candidates

If no unprocessed spikes exist:
```
No unprocessed spikes found in `.planning/spikes/`.
Run `/gsd-spike` first to create experiments.
```
Exit.

Check `commit_docs` config:
```bash
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
```
</step>

<step name="auto_include">
## Auto-Include All Spikes

Include all unprocessed spikes automatically. Present a brief inventory showing what's being processed:

```
Processing N spikes:
  001 — name (VALIDATED)
  002 — name (PARTIAL)
  003 — name (INVALIDATED)
```

Every spike carries forward:
- **VALIDATED** spikes provide proven patterns
- **PARTIAL** spikes provide constrained patterns
- **INVALIDATED** spikes provide landmines and dead ends
</step>

<step name="group">
## Auto-Group by Feature Area

Group spikes by feature area based on tags, names, `related` fields, and content. Proceed directly into synthesis.

Each group becomes one reference file in the generated skill.
</step>

<step name="skill_name">
## Determine Output Skill Name

Derive the skill name from the project directory:

1. Get the project root directory name (e.g., `solana-tracker`)
2. The skill will be created at `./.claude/skills/spike-findings-[project-dir-name]/`

If a skill already exists at that path (append mode), update in place.
</step>

<step name="copy_sources">
## Copy Source Files

For each included spike:

1. Identify the core source files — the actual scripts, main files, and config that make the spike work. Exclude:
   - `node_modules/`, `__pycache__/`, `.venv/`, build artifacts
   - Lock files (`package-lock.json`, `yarn.lock`, etc.)
   - `.git/`, `.DS_Store`
2. Copy the README.md and core source files into `sources/NNN-spike-name/` inside the generated skill directory
</step>

<step name="synthesize">
## Synthesize Reference Files

For each feature-area group, write a reference file at `references/[feature-area-name].md` as an **implementation blueprint** — it should read like a recipe, not a research paper. A future build session should be able to follow this and build the feature correctly without re-spiking anything.

```markdown
# [Feature Area Name]

## Requirements

[Non-negotiable design decisions from MANIFEST.md Requirements section that apply to this feature area. These MUST be honored in the real build. E.g., "Must use streaming JSON output", "Must support reconnection".]

## How to Build It

[Step-by-step: what to install, how to configure, what code pattern to use. Include key code snippets extracted from the spike source. This is the proven approach — not theory, but tested and working code.]

## What to Avoid

[Things that look right but aren't. Gotchas. Anti-patterns discovered during spiking. Dead ends that were tried and failed.]

## Constraints

[Hard facts: rate limits, library limitations, version requirements, incompatibilities]

## Origin

Synthesized from spikes: NNN, NNN, NNN
Source files available in: sources/NNN-spike-name/, sources/NNN-spike-name/
```
</step>

<step name="write_skill">
## Write SKILL.md

Create (or update) the generated skill's SKILL.md:

```markdown
---
name: spike-findings-[project-dir-name]
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building [project-dir-name]. Auto-loaded during implementation work.
---

<context>
## Project: [project-dir-name]

[One paragraph from MANIFEST.md describing the overall idea]

Spike sessions wrapped: [date(s)]
</context>

<requirements>
## Requirements

[Copied directly from MANIFEST.md Requirements section. These are non-negotiable design decisions that emerged from the user's choices during spiking. Every feature area reference must honor these.]

- [requirement 1]
- [requirement 2]
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| [Name] | references/[name].md | [One-line summary] |

## Source Files

Original spike source files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Spikes

[List of spike numbers wrapped up]

- 001-spike-name
- 002-spike-name
</metadata>
```
</step>

<step name="write_summary">
## Write Planning Summary

Write `.planning/spikes/WRAP-UP-SUMMARY.md` for project history:

```markdown
# Spike Wrap-Up Summary

**Date:** [date]
**Spikes processed:** [count]
**Feature areas:** [list]
**Skill output:** `./.claude/skills/spike-findings-[project]/`

## Processed Spikes
| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|

## Key Findings
[consolidated findings summary]
```
</step>

<step name="update_claude_md">
## Update Project CLAUDE.md

Add an auto-load routing line to the project's CLAUDE.md (create the file if it doesn't exist):

```
- **Spike findings for [project]** (implementation patterns, constraints, gotchas) → `Skill("spike-findings-[project-dir-name]")`
```

If this routing line already exists (append mode), leave it as-is.
</step>

<step name="generate_conventions">
## Generate or Update CONVENTIONS.md

Analyze all processed spikes for recurring patterns and write `.planning/spikes/CONVENTIONS.md`. This file tells future spike sessions *how we spike* — the stack, structure, and patterns that have been established.

1. Read all spike source code and READMEs looking for:
   - **Stack choices** — What language/framework/runtime appears across multiple spikes?
   - **Structure patterns** — Common file layouts, port numbers, naming schemes
   - **Recurring approaches** — How auth is handled, how styling is done, how data is served
   - **Tools & libraries** — Packages that showed up repeatedly with versions that worked

2. Write or update `.planning/spikes/CONVENTIONS.md`:

```markdown
# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the question requires otherwise.

## Stack
[What we use for frontend, backend, scripts, and why — derived from what repeated across spikes]

## Structure
[Common file layouts, port assignments, naming patterns]

## Patterns
[Recurring approaches: how we handle auth, how we style, how we serve, etc.]

## Tools & Libraries
[Preferred packages with versions that worked, and any to avoid]
```

3. Only include patterns that appeared in 2+ spikes or were explicitly chosen by the user.

4. If `CONVENTIONS.md` already exists (append mode), update sections with new patterns. Remove entries contradicted by newer spikes.
</step>

<step name="commit">
Commit all artifacts (if `COMMIT_DOCS` is true):

```bash
gsd-sdk query commit "docs(spike-wrap-up): package [N] spike findings into project skill" .planning/spikes/WRAP-UP-SUMMARY.md .planning/spikes/CONVENTIONS.md
```
</step>

<step name="report">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SPIKE WRAP-UP COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Processed:** {N} spikes
**Feature areas:** {list}
**Skill:** `./.claude/skills/spike-findings-[project]/`
**Conventions:** `.planning/spikes/CONVENTIONS.md`
**Summary:** `.planning/spikes/WRAP-UP-SUMMARY.md`
**CLAUDE.md:** routing line added

The spike-findings skill will auto-load in future build conversations.
```
</step>

<step name="whats_next">
## What's Next

After the summary, present next-step options:

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Explore frontier spikes** — see what else is worth spiking based on what we've learned

`/gsd-spike` (run with no argument — its frontier mode analyzes the spike landscape and proposes integration and frontier spikes)

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd-plan-phase` — start planning the real implementation
- `/gsd-spike [idea]` — spike a specific new idea
- `/gsd-explore` — continue exploring
- Other

───────────────────────────────────────────────────────────────
</step>

</process>

<success_criteria>
- [ ] All unprocessed spikes auto-included and processed
- [ ] Spikes grouped by feature area
- [ ] Spike-findings skill exists at `./.claude/skills/` with SKILL.md (including requirements), references/, sources/
- [ ] Reference files are implementation blueprints with Requirements, How to Build It, What to Avoid, Constraints
- [ ] `.planning/spikes/CONVENTIONS.md` created or updated with recurring stack/structure/pattern choices
- [ ] `.planning/spikes/WRAP-UP-SUMMARY.md` written for project history
- [ ] Project CLAUDE.md has auto-load routing line
- [ ] Summary presented
- [ ] Next-step options presented (including frontier spike exploration via `/gsd-spike`)
</success_criteria>
