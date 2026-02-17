<purpose>
Run advisory skill perspectives against a phase goal to produce structured context for planning. Loads all specified skills into a single agent that produces acceptance criteria, UX flags, and security concerns in one pass.

Inspired by Weaveto.do's "Phase 1: Consensus + Plan" pattern — one agent, multiple perspectives, one output.
</purpose>

<process>

## 1. Initialize

```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs init phase-op "${PHASE}")
```

Parse JSON for phase details. Extract phase goal from ROADMAP.md.

## 2. Parse Arguments

Extract from $ARGUMENTS: phase number, `--skills <list>` flag.

Default skills if none specified: `product-manager,ux-designer`

## 3. Load Skills

For each skill name, look for skill files in order:
1. `.planning/skills/{name}.md` (project-specific skills)
2. `~/.claude/get-shit-done/templates/skills/{name}.md` (built-in skills)

```bash
SKILL_CONTENT=""
for skill in $(echo "$SKILLS" | tr ',' ' '); do
  if [ -f ".planning/skills/${skill}.md" ]; then
    SKILL_CONTENT="$SKILL_CONTENT\n$(cat .planning/skills/${skill}.md)"
  elif [ -f "$HOME/.claude/get-shit-done/templates/skills/${skill}.md" ]; then
    SKILL_CONTENT="$SKILL_CONTENT\n$(cat $HOME/.claude/get-shit-done/templates/skills/${skill}.md)"
  else
    echo "Warning: Skill '${skill}' not found"
  fi
done
```

## 4. Spawn Advisory Agent

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ADVISORY CONSENSUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase {X}: {Name}
Skills: {skill list}

◆ Spawning advisory agent...
```

```
Task(
  prompt="""
You are an advisory agent loaded with multiple skill perspectives. Analyze the phase goal and produce structured advisory output.

<skills>
{skill_content}
</skills>

<phase>
Phase: {phase_number}
Name: {phase_name}
Goal: {phase_goal}
</phase>

<project_context>
{roadmap_content}
{requirements_content}
</project_context>

<instructions>
For each loaded skill perspective, analyze the phase goal and produce:

1. **Acceptance Criteria** (PM perspective): User stories with Gherkin acceptance criteria for this phase
2. **UX Flags** (UX perspective): Flow concerns, accessibility requirements, edge cases
3. **Security Concerns** (Security perspective, if loaded): Vulnerabilities to watch for, auth requirements
4. **Quality Gates** (Production Engineer perspective, if loaded): What must pass before shipping

Produce a unified advisory output that combines all perspectives. Flag any conflicts between perspectives and recommend a resolution.

Write the output to: {phase_dir}/{padded_phase}-CONTEXT.md

Use this structure:
```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning
**Source:** Advisory Consensus ({skill list})

<domain>
## Phase Boundary

[What this phase delivers — derived from phase goal]

</domain>

<decisions>
## Implementation Decisions

### Acceptance Criteria
{Gherkin acceptance criteria from PM perspective}

### UX Requirements
{Flow requirements, accessibility, edge cases from UX perspective}

### Security Requirements
{Security concerns, if security-auditor skill loaded}

### Quality Requirements
{Quality gates, if production-engineer skill loaded}

### Claude's Discretion
[Technical implementation details not specified by any advisory perspective]

</decisions>

<specifics>
## Specific Ideas

[Concrete requirements, specific behaviors, examples from advisory output]

</specifics>

<deferred>
## Deferred Ideas

None — advisory consensus covers phase scope

</deferred>

---

*Phase: XX-name*
*Context gathered: [date] via Advisory Consensus*
```
""",
  subagent_type="general-purpose",
  model="sonnet",
  description="Advisory Consensus Phase {phase}"
)
```

## 5. Commit Context

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs commit "docs(${padded_phase}): advisory consensus context" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

## 6. Present Results

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ADVISORY CONSENSUS COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase {X}: {Name}
Skills consulted: {skill list}
Output: {phase_dir}/{padded_phase}-CONTEXT.md

## ▶ Next Up

**Plan Phase {X}** — create execution plans

/gsd:plan-phase {X}

<sub>/clear first → fresh context window</sub>

---

**Also available:**
- /gsd:discuss-phase {X} — interactive discussion instead
- cat {phase_dir}/{padded_phase}-CONTEXT.md — review advisory output
```

</process>

<success_criteria>
- [ ] Skills loaded from project or built-in templates
- [ ] Single agent spawned with all skill perspectives
- [ ] CONTEXT.md created with advisory-derived decisions
- [ ] Acceptance criteria in Gherkin format (if PM skill loaded)
- [ ] UX flags included (if UX skill loaded)
- [ ] Security concerns included (if security skill loaded)
- [ ] Committed to git
- [ ] User knows next steps
</success_criteria>
