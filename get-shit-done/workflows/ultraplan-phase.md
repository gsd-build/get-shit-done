# Ultraplan Phase Workflow [BETA]

Offload GSD's plan phase to Claude Code's ultraplan cloud infrastructure.

⚠ **BETA feature.** Ultraplan is in research preview and may change. This workflow is
intentionally isolated from /gsd-plan-phase so upstream changes to ultraplan cannot
affect the core planning pipeline.

---

<step name="banner">

Display the stage banner:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ULTRAPLAN PHASE  ⚠ BETA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ultraplan is in research preview (Claude Code v2.1.91+).
Use /gsd-plan-phase for stable local planning.
```

</step>

---

<step name="runtime_gate">

Check that the session is running inside Claude Code:

```bash
echo "$CLAUDE_CODE_VERSION"
```

If the output is empty or unset, display the following error and exit:

```text
╔══════════════════════════════════════════════════════════════╗
║  RUNTIME ERROR                                               ║
╚══════════════════════════════════════════════════════════════╝

/gsd-ultraplan-phase requires Claude Code.
ultraplan is not available in this runtime.

Use /gsd-plan-phase for local planning instead.
```

</step>

---

<step name="initialize">

Parse phase number from `$ARGUMENTS`. If no phase number is provided, detect the next
unplanned phase from the roadmap (same logic as /gsd-plan-phase).

Load GSD phase context:

```bash
INIT=$(gsd-sdk query init.plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `phase_found`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`,
`phase_dir`, `roadmap_path`, `requirements_path`, `research_path`, `planning_exists`.

**If `planning_exists` is false:** Error and exit:

```text
No .planning directory found. Initialize the project first:

/gsd-new-project
```

**If `phase_found` is false:** Error with the phase number provided and exit.

Display detected phase:

```text
Phase {N}: {phase name}
```

</step>

---

<step name="build_prompt">

Build the ultraplan prompt from GSD context.

1. Read the phase scope from ROADMAP.md — extract the goal, deliverables, and scope for
   the target phase.

2. Read REQUIREMENTS.md if it exists (`requirements_path` is not null) — extract a
   concise summary (key requirements relevant to this phase, not the full document).

3. Read RESEARCH.md if it exists (`research_path` is not null) — extract a concise
   summary of technical findings. Including this reduces redundant cloud research.

Construct the prompt:

```text
Plan phase {phase_number}: {phase_name}

## Phase Scope (from ROADMAP.md)

{phase scope block extracted from ROADMAP.md}

## Requirements Context

{requirements summary, or "No REQUIREMENTS.md found — infer from phase scope."}

## Existing Research

{research summary, or "No RESEARCH.md found — research from scratch."}

## Output Format

Produce a GSD PLAN.md with the following YAML frontmatter:

---
phase: "{padded_phase}-{phase_slug}"
plan: "{padded_phase}-01"
type: "feature"
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: []
  artifacts: []
---

Then a ## Plan section with numbered tasks. Each task should have:
- A clear imperative title
- Files to create or modify
- Specific implementation steps

Keep the plan focused and executable.
```

</step>

---

<step name="return_path_card">

Display the return-path instructions **before** triggering ultraplan so they are visible
in the terminal scroll-back after ultraplan launches:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WHEN THE PLAN IS READY — WHAT TO DO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When ◆ ultraplan ready appears in your terminal:

  1. Open the session link in your browser
  2. Review the plan — use inline comments and emoji reactions to give feedback
  3. Ask Claude to revise until you're satisfied
  4. Click "Approve plan and teleport back to terminal"
  5. At the terminal dialog, choose Cancel  ← saves the plan to a file
  6. Note the file path Claude prints
  7. Run: /gsd-import --from <the file path>

/gsd-import will run conflict detection, convert to GSD format,
validate via plan-checker, update ROADMAP.md, and commit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Launching ultraplan for Phase {N}: {phase_name}...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</step>

---

<step name="trigger">

Trigger ultraplan with the constructed prompt:

```text
/ultraplan {constructed prompt from build_prompt step}
```

Your terminal will show a `◇ ultraplan` status indicator while the remote session works.
Use `/tasks` to open the detail view with the session link, agent activity, and a stop action.

</step>
