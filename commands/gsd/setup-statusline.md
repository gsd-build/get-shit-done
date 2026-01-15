---
name: gsd:setup-statusline
description: Integrate GSD project metrics with Claude Code statusline
allowed-tools:
  - Read
  - Write
  - Bash
  - Skill
---

<objective>

Invoke /statusline command with GSD integration instructions to add project metrics to your statusline.

</objective>

<execution_context>

No execution context files to load.

</execution_context>

<context>

Current working directory: $(pwd)

</context>

<process>

<step name="invoke_statusline">

Invoke the /statusline skill with the following prompt:

```
Add GSD (Get Shit Done) project metrics to this statusline.

## Context

GSD projects maintain .planning/metrics.json with current phase and progress.
Available metrics:
- current_phase.number: Phase number (e.g., 3)
- current_phase.name: Phase name (e.g., "Core TUI & Navigation")
- current_phase.plans_complete: Plans completed in current phase (e.g., 2)
- current_phase.plans_total: Total plans in current phase (e.g., 5)
- current_phase.status: "planned", "in_progress", or "complete"
- overall_progress.percentage: Overall project completion percentage (e.g., 22)

## Display Format Options

Mix and match to fit your statusline style:

- `🎯 P2: Auth 📊 3/5` — phase + plans done
- `🚀 Auth System ███░░ 60%` — progress bar vibes  
- `[gsd:2/auth:3/5:45%]` — hacker minimal
- `Phase 2 · Auth · 3 of 5 plans` — clean prose
- `⚡ P2 ▓▓▓░░ 3/5 ✨` — go wild

## Implementation

Add this bash code to read the metrics:

```bash
# GSD Statusline Integration
gsd_info=""
if [ -f ".planning/metrics.json" ]; then
    phase_num=$(jq -r '.current_phase.number // empty' .planning/metrics.json 2>/dev/null)
    phase_name=$(jq -r '.current_phase.name // empty' .planning/metrics.json 2>/dev/null | cut -c1-15)
    plans=$(jq -r '"\(.current_phase.plans_complete // 0)/\(.current_phase.plans_total // 0)"' .planning/metrics.json 2>/dev/null)
    overall_pct=$(jq -r '.overall_progress.percentage // 0' .planning/metrics.json 2>/dev/null)

    if [ -n "$phase_num" ]; then
        # Choose format based on existing statusline style:
        # Compact: gsd_info="🎯 P${phase_num}: ${phase_name} 📊 ${plans} | "
        # Percentage: gsd_info="🎯 P${phase_num}: ${phase_name} ${overall_pct}% | "
        # Visual bar: gsd_info="🎯 P${phase_num}: ${phase_name} 🧠 [BAR] ${overall_pct}% | "
        gsd_info="🎯 P${phase_num}: ${phase_name} 📊 ${plans} | "
    fi
fi
```

**IMPORTANT:** Match the existing statusline format, style, and visual design. If the existing statusline uses specific emoji, colors, spacing patterns, or visual hierarchy, replicate those patterns in the GSD metrics display. The goal is seamless integration, not a disjointed addition.

## Edge Cases

1. If .planning/metrics.json doesn't exist yet (new project or before first GSD command), it will be created automatically on first GSD use
2. If jq is not installed, fall back to grep/awk or skip gracefully
3. Handle missing/null values in metrics.json gracefully

Integrate the GSD metrics into the existing statusline output format, preserving the current style and structure.
```

</step>

<step name="done">

Inform the user that the statusline has been configured:

```
✅ Statusline configured with GSD metrics

Your statusline will now show:
- Current phase number and name
- Plans completed in current phase (X/Y)
- Updates automatically as you work

The metrics will appear once you start your first GSD command.

---

**Tip:** If you want to customize the display format, run this command again or edit your statusline script directly.

---

```

</step>

</process>

<success_criteria>

- [ ] /statusline command invoked with GSD integration prompt
- [ ] User understands metrics.json will be created on first GSD use
- [ ] User knows how to customize display format if needed

</success_criteria>
