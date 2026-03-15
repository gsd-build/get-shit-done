---
name: gsd:workstreams
description: Manage parallel workstreams — list, create, switch, status, progress, complete, and resume
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
  - AskUserQuestion
---

<objective>
Manage parallel workstreams for multi-milestone development. Supports listing, creating,
switching, inspecting, completing, and resuming workstreams.

Usage:
  /gsd:workstreams                — Show all workstreams with progress summary
  /gsd:workstreams list           — List all workstreams
  /gsd:workstreams create <name>  — Create a new workstream
  /gsd:workstreams switch <name>  — Switch active workstream
  /gsd:workstreams status <name>  — Detailed status for one workstream
  /gsd:workstreams progress       — Progress overview across all workstreams
  /gsd:workstreams complete <name>— Archive a completed workstream
  /gsd:workstreams resume [name]  — Resume work on a workstream (switch + route to progress)
</objective>

<process>

## Step 1: Parse Arguments

Check what subcommand (if any) was provided. If no subcommand, default to `progress` overview.

```
SUBCOMMAND = first argument (list | create | switch | status | progress | complete | resume)
If no subcommand → treat as "progress"
```

## Step 2: Route to Subcommand

### progress (default) / list

Run the workstream progress tool to show all workstreams:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs workstream progress --raw --cwd "$(pwd)"
```

Display results as a formatted table showing:
- Workstream name (mark active with →)
- Status
- Current phase
- Phase progress (completed/total)
- Progress percentage

### create <name>

Create a new workstream:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs workstream create <name> --raw --cwd "$(pwd)"
```

After creation, inform the user and offer to:
1. Set up requirements with `/gsd:new-milestone`
2. Switch to the new workstream and start planning

### switch <name>

Set the active workstream:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs workstream set <name> --raw --cwd "$(pwd)"
```

Confirm the switch and show the workstream's current status.

### status <name>

Get detailed status for a specific workstream:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs workstream status <name> --raw --cwd "$(pwd)"
```

Display:
- File inventory (roadmap, state, requirements)
- Phase breakdown with plan/summary counts
- Current status and phase

### complete <name>

Archive a completed workstream:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs workstream complete <name> --raw --cwd "$(pwd)"
```

Confirm archival location and remaining workstreams.

### resume [name]

Resume work on a workstream. If no name given, resume the currently active one.

1. If name provided, switch to it first:
   ```bash
   node ~/.claude/get-shit-done/bin/gsd-tools.cjs workstream set <name> --raw --cwd "$(pwd)"
   ```

2. If no name and no active workstream, list all and ask user to pick.

3. Once active workstream is set, route to `/gsd:progress` to pick up where work left off.

## Step 3: Display Results

Format all output clearly with:
- Active workstream highlighted
- Progress bars or percentages where applicable
- Clear next-action suggestions

If in flat mode (no workstreams), inform the user they can create their first workstream
with `/gsd:workstreams create <name>` which will auto-migrate existing planning files.

</process>
