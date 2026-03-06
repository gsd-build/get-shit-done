---
layout: default
title: Getting Started
---

# Getting Started

Get GSD running in under 5 minutes.

---

## Prerequisites

- [Claude Code](https://claude.ai/code) installed and configured
- Node.js 16.7.0 or higher
- A project idea

---

## Installation

```bash
npx get-shit-done-cc
```

This installs GSD commands and agents into your Claude Code configuration.

### Staying Updated

GSD evolves fast. Check for updates periodically:

```
/gsd:whats-new
```

Update with:

```bash
npx get-shit-done-cc@latest
```

<details markdown="1">
<summary><strong>Non-interactive Install (Docker, CI, Scripts)</strong></summary>

```bash
npx get-shit-done-cc --global   # Install to ~/.claude/
npx get-shit-done-cc --local    # Install to ./.claude/
```

Use `--global` (`-g`) or `--local` (`-l`) to skip the interactive prompt.

</details>

<details markdown="1">
<summary><strong>Development Installation</strong></summary>

Clone the repository and run the installer locally:

```bash
git clone https://github.com/glittercowboy/get-shit-done.git
cd get-shit-done
node bin/install.js --local
```

Installs to `./.claude/` for testing modifications before contributing.

</details>

---

## Recommended: Skip Permissions Mode

GSD is designed for frictionless automation. Run Claude Code with:

```bash
claude --dangerously-skip-permissions
```

This is how GSD is intended to be used — stopping to approve `date` and `git commit` 50 times defeats the purpose.

<details markdown="1">
<summary><strong>Alternative: Granular Permissions</strong></summary>

If you prefer not to use that flag, add this to your project's `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(date:*)",
      "Bash(echo:*)",
      "Bash(cat:*)",
      "Bash(ls:*)",
      "Bash(mkdir:*)",
      "Bash(wc:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(sort:*)",
      "Bash(grep:*)",
      "Bash(tr:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git tag:*)"
    ]
  }
}
```

</details>

---

## Your First Project

### Step 1: Start a new project

```
/gsd:new-project
```

Claude will ask you questions:
- What are you building?
- Who is it for?
- What technology are you using?
- What are your constraints?

Answer honestly. The more context Claude has, the better your project artifacts will be.

### Step 2: Review your artifacts

After the questioning session, check your `.planning/` directory:

```
.planning/
├── PROJECT.md      # Your project vision
├── REQUIREMENTS.md # What's in v1, v2, out of scope
├── ROADMAP.md      # Phase breakdown
└── STATE.md        # Current progress
```

Read through these. Make sure they capture what you want to build.

### Step 3: Plan your first phase

```
/gsd:plan-phase 01
```

GSD will:
1. Research implementation approaches
2. Break the phase into atomic tasks
3. Create an executable plan

Review the generated plan in `.planning/phases/01-{name}/01-PLAN.md`.

### Step 4: Execute

```
/gsd:execute-phase 01
```

Claude builds each task:
- Fresh context for each plan
- Atomic commits per task
- Verification at each step

### Step 5: Verify

```
/gsd:verify-work 01
```

Test what was built:
- Follow the verification steps
- Report any issues
- GSD creates fix plans if needed

### Step 6: Continue

Repeat steps 3-5 for each phase until your milestone is complete.

```
/gsd:complete-milestone
```

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `/gsd:new-project` | Start a new project with questioning |
| `/gsd:discuss-phase N` | Capture decisions before planning |
| `/gsd:plan-phase N` | Research and create executable plan |
| `/gsd:execute-phase N` | Build the plan |
| `/gsd:verify-work N` | Test and verify |
| `/gsd:progress` | Check current status |
| `/gsd:complete-milestone` | Ship and archive |

---

## Common Patterns

### Greenfield Project

Starting fresh? Use the standard flow:

```
/gsd:new-project
/gsd:plan-phase 01
/gsd:execute-phase 01
/gsd:verify-work 01
... repeat for each phase ...
/gsd:complete-milestone
```

### Brownfield Project

Adding GSD to existing code? Map first:

```
/gsd:map-codebase
/gsd:new-project
```

The codebase map gives Claude context about your existing architecture.

### Quick Fixes

Need to debug something specific?

```
/gsd:debug
```

GSD's debugger uses systematic analysis to find root causes.

### Capturing Ideas

Have a thought mid-session?

```
/gsd:add-todo Fix the navbar alignment issue
```

Check them later:

```
/gsd:check-todos
```

---

## Tips

**Let Claude ask questions.** The `/gsd:new-project` questioning phase is where Claude learns your project. Don't rush it.

**Review your artifacts.** PROJECT.md and REQUIREMENTS.md are your source of truth. If they're wrong, everything downstream will be wrong.

**Trust the process.** GSD's atomic task structure exists for a reason. Don't try to cram everything into one plan.

**Verify as you go.** `/gsd:verify-work` catches issues early. Skipping it creates debt.

---

## Next Steps

- [How It Works](/how-it-works) — Understand the architecture
- [Commands Reference](/commands) — Full command documentation
- [Philosophy](/philosophy) — Why GSD exists
- [Troubleshooting](/troubleshooting) — Common issues and fixes
