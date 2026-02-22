<div align="center">

# GET SHIT DONE — VS Code GitHub Copilot Port

**A VS Code GitHub Copilot compatibility layer for the [Get Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) spec-driven development system.**

[![GitHub stars](https://img.shields.io/github/stars/gsd-build/get-shit-done?style=for-the-badge&logo=github&color=181717)](https://github.com/gsd-build/get-shit-done)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

</div>

---

> **This is a fork, not the upstream project.**
> If you use **Claude Code**, **OpenCode**, or **Gemini CLI**, install GSD directly from upstream: [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done).
> This fork is for **VS Code GitHub Copilot** users only.

---

## What This Fork Is

This repository is a VS Code GitHub Copilot port of the [Get Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) project management system, originally built for Claude Code by TÂCHES / glittercowboy.

It exposes the full GSD command set as VS Code Copilot Chat slash commands (`/gsd.new-project`, `/gsd.execute-phase`, etc.) and adds a sync pipeline that automatically pulls upstream changes and regenerates the Copilot wrapper layer.

**This fork adds:**
- VS Code Copilot prompt layer (`.github/prompts/gsd.*.prompt.md`)
- Tool mapping from GSD XML task format to Copilot tool calls
- PowerShell installer
- Daily upstream sync pipeline with auto-regeneration

**Core GSD methodology, workflow engine, templates, and agents are upstream's work.** See [Credits & Attribution](#credits--attribution).

---

## Who This Fork Is For

VS Code GitHub Copilot users who want to use GSD's spec-driven development workflow through Copilot Chat slash commands.

**Use upstream instead** ([gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)) if you are following Claude Code, OpenCode, or Gemini CLI installation instructions  those runtimes are natively supported upstream and this fork adds nothing for them.

---

## Install

### PowerShell Installer (recommended)

Open a PowerShell terminal in your project root:

```powershell
irm "https://raw.githubusercontent.com/darrylwisner/get-shit-done-github-copilot/main/gsd-copilot-installer/gsd-copilot-install.ps1" | iex
```

For full installer options, arguments, and troubleshooting, see [gsd-copilot-installer/README.md](gsd-copilot-installer/README.md).

---

## Getting Started with VS Code Copilot

1. **Install** using the option above.
2. **Open** VS Code Copilot Chat (`` Ctrl+Shift+I `` or the chat icon).
3. **Verify** the commands are available  type `/gsd` and you should see the command list in the slash command picker.
4. **Initialize your project:**

   ```
   /gsd.new-project
   ```

   The command guides you through questions  research  requirements  roadmap.

5. **Plan and execute:**

   ```
   /gsd.discuss-phase 1
   /gsd.plan-phase 1
   /gsd.execute-phase 1
   /gsd.verify-work 1
   ```

6. **Check progress anytime:**

   ```
   /gsd.progress
   /gsd.help
   ```

> **Already have code?** Run `/gsd.map-codebase` first to analyze your stack, then `/gsd.new-project` knows your codebase.

---

## Credits & Attribution

This fork would not exist without the original **Get Shit Done** project by **TÂCHES / glittercowboy**.

| Resource | Link |
|----------|------|
| Upstream repo | [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) |
| npm package (upstream) | [npmjs.com/package/get-shit-done-cc](https://www.npmjs.com/package/get-shit-done-cc) |
| Discord community | [discord.gg/5JJgD5svVS](https://discord.gg/5JJgD5svVS) |
| Original author | [@glittercowboy](https://github.com/glittercowboy) |

All core GSD functionality  the planning system, workflow engine, templates, agents, and methodology  originates in the upstream project. This fork is a thin compatibility layer that maps those commands to VS Code Copilot Chat and keeps them up to date with upstream via automated sync.

---

## How It Works

> **Already have code?** Run `/gsd.map-codebase` first. It spawns parallel agents to analyze your stack, architecture, conventions, and concerns. Then `/gsd.new-project` knows your codebase  questions focus on what you're adding, and planning automatically loads your patterns.

### 1. Initialize Project

```
/gsd.new-project
```

One command, one flow. The system:

1. **Questions**  Asks until it understands your idea completely (goals, constraints, tech preferences, edge cases)
2. **Research**  Spawns parallel agents to investigate the domain (optional but recommended)
3. **Requirements**  Extracts what's v1, v2, and out of scope
4. **Roadmap**  Creates phases mapped to requirements

You approve the roadmap. Now you're ready to build.

**Creates:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `.planning/research/`

---

### 2. Discuss Phase

```
/gsd.discuss-phase 1
```

**This is where you shape the implementation.**

Your roadmap has a sentence or two per phase. That's not enough context to build something the way *you* imagine it. This step captures your preferences before anything gets researched or planned.

The system analyzes the phase and identifies gray areas based on what's being built:

- **Visual features**  Layout, density, interactions, empty states
- **APIs/CLIs**  Response format, flags, error handling, verbosity
- **Content systems**  Structure, tone, depth, flow
- **Organization tasks**  Grouping criteria, naming, duplicates, exceptions

The output  `CONTEXT.md`  feeds directly into the next two steps:

1. **Researcher reads it**  Knows what patterns to investigate
2. **Planner reads it**  Knows what decisions are locked

**Creates:** `{phase_num}-CONTEXT.md`

---

### 3. Plan Phase

```
/gsd.plan-phase 1
```

The system:

1. **Researches**  Investigates how to implement this phase, guided by your CONTEXT.md decisions
2. **Plans**  Creates 2-3 atomic task plans with XML structure
3. **Verifies**  Checks plans against requirements, loops until they pass

Each plan is small enough to execute in a fresh context window.

**Creates:** `{phase_num}-RESEARCH.md`, `{phase_num}-{N}-PLAN.md`

---

### 4. Execute Phase

```
/gsd.execute-phase 1
```

The system:

1. **Runs plans in waves**  Parallel where possible, sequential when dependent
2. **Fresh context per plan**  Tokens purely for implementation
3. **Commits per task**  Every task gets its own atomic commit
4. **Verifies against goals**  Checks the codebase delivers what the phase promised

**Creates:** `{phase_num}-{N}-SUMMARY.md`, `{phase_num}-VERIFICATION.md`

---

### 5. Verify Work

```
/gsd.verify-work 1
```

**This is where you confirm it actually works.**

The system:

1. **Extracts testable deliverables**  What you should be able to do now
2. **Walks you through one at a time**  Yes/no, or describe what's wrong
3. **Diagnoses failures automatically**  Spawns debug agents to find root causes
4. **Creates verified fix plans**  Ready for immediate re-execution

**Creates:** `{phase_num}-UAT.md`, fix plans if issues found

---

### 6. Repeat  Complete  Next Milestone

```
/gsd.discuss-phase 2
/gsd.plan-phase 2
/gsd.execute-phase 2
/gsd.verify-work 2
...
/gsd.complete-milestone
/gsd.new-milestone
```

Loop **discuss  plan  execute  verify** until milestone complete.

---

### Quick Mode

```
/gsd.quick
```

**For ad-hoc tasks that don't need full planning.**

Quick mode gives you GSD guarantees (atomic commits, state tracking) with a faster path:

- **Same agents**  Planner + executor, same quality
- **Skips optional steps**  No research, no plan checker, no verifier
- **Separate tracking**  Lives in `.planning/quick/`, not phases

Use for: bug fixes, small features, config changes, one-off tasks.

---

## Why It Works

### Context Engineering

GSD handles context for you:

| File | What it does |
|------|--------------|
| `PROJECT.md` | Project vision, always loaded |
| `research/` | Ecosystem knowledge (stack, features, architecture, pitfalls) |
| `REQUIREMENTS.md` | Scoped v1/v2 requirements with phase traceability |
| `ROADMAP.md` | Where you're going, what's done |
| `STATE.md` | Decisions, blockers, position  memory across sessions |
| `PLAN.md` | Atomic task with XML structure, verification steps |
| `SUMMARY.md` | What happened, what changed, committed to history |
| `todos/` | Captured ideas and tasks for later work |

### XML Prompt Formatting

Every plan is structured XML:

```xml
<task type="auto">
  <name>Create login endpoint</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    Use jose for JWT (not jsonwebtoken - CommonJS issues).
    Validate credentials against users table.
    Return httpOnly cookie on success.
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login returns 200 + Set-Cookie</verify>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

### Multi-Agent Orchestration

| Stage | Orchestrator does | Agents do |
|-------|------------------|-----------|
| Research | Coordinates, presents findings | 4 parallel researchers investigate stack, features, architecture, pitfalls |
| Planning | Validates, manages iteration | Planner creates plans, checker verifies, loop until pass |
| Execution | Groups into waves, tracks progress | Executors implement in parallel, each with fresh context |
| Verification | Presents results, routes next | Verifier checks codebase against goals, debuggers diagnose failures |

### Atomic Git Commits

Each task gets its own commit immediately after completion. Git bisect finds the exact failing task. Every commit is surgical, traceable, and meaningful.

---

## Commands

### Core Workflow

| Command | What it does |
|---------|--------------|
| `/gsd.new-project` | Full initialization: questions  research  requirements  roadmap |
| `/gsd.discuss-phase [N]` | Capture implementation decisions before planning |
| `/gsd.plan-phase [N]` | Research + plan + verify for a phase |
| `/gsd.execute-phase <N>` | Execute all plans in parallel waves, verify when complete |
| `/gsd.verify-work [N]` | Manual user acceptance testing |
| `/gsd.audit-milestone` | Verify milestone achieved its definition of done |
| `/gsd.complete-milestone` | Archive milestone, tag release |
| `/gsd.new-milestone [name]` | Start next version: questions  research  requirements  roadmap |

### Navigation

| Command | What it does |
|---------|--------------|
| `/gsd.progress` | Where am I? What's next? |
| `/gsd.help` | Show all commands and usage guide |
| `/gsd.update` | Update GSD with changelog preview |
| `/gsd.join-discord` | Join the GSD Discord community |

### Brownfield

| Command | What it does |
|---------|--------------|
| `/gsd.map-codebase` | Analyze existing codebase before new-project |

### Phase Management

| Command | What it does |
|---------|--------------|
| `/gsd.add-phase` | Append phase to roadmap |
| `/gsd.insert-phase [N]` | Insert urgent work between phases |
| `/gsd.remove-phase [N]` | Remove future phase, renumber |
| `/gsd.list-phase-assumptions [N]` | See intended approach before planning |
| `/gsd.plan-milestone-gaps` | Create phases to close gaps from audit |

### Session

| Command | What it does |
|---------|--------------|
| `/gsd.pause-work` | Create handoff when stopping mid-phase |
| `/gsd.resume-work` | Restore from last session |

### Utilities

| Command | What it does |
|---------|--------------|
| `/gsd.settings` | Configure model profile and workflow agents |
| `/gsd.set-profile <profile>` | Switch model profile (quality/balanced/budget) |
| `/gsd.add-todo [desc]` | Capture idea for later |
| `/gsd.check-todos` | List pending todos |
| `/gsd.debug [desc]` | Systematic debugging with persistent state |
| `/gsd.quick` | Execute ad-hoc task with GSD guarantees |
| `/gsd.health [--repair]` | Validate `.planning/` directory integrity |

---

## Configuration

GSD stores project settings in `.planning/config.json`. Configure during `/gsd.new-project` or update later with `/gsd.settings`.

### Core Settings

| Setting | Options | Default | What it controls |
|---------|---------|---------|------------------|
| `mode` | `yolo`, `interactive` | `interactive` | Auto-approve vs confirm at each step |
| `depth` | `quick`, `standard`, `comprehensive` | `standard` | Planning thoroughness |

### Model Profiles

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced` (default) | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |

Switch profiles:
```
/gsd.set-profile budget
```

### Workflow Agents

| Setting | Default | What it does |
|---------|---------|--------------|
| `workflow.research` | `true` | Researches domain before planning each phase |
| `workflow.plan_check` | `true` | Verifies plans achieve phase goals before execution |
| `workflow.verifier` | `true` | Confirms must-haves were delivered after execution |
| `workflow.auto_advance` | `false` | Auto-chain discuss  plan  execute without stopping |

---

## Troubleshooting

**Commands not found after install?**
- Reload VS Code window (`Ctrl+Shift+P`  "Developer: Reload Window")
- Verify files exist in `.github/prompts/gsd.*.prompt.md`

**Installer blocked by execution policy?**
- Use the `irm ... | iex` one-liner  that form is never blocked by execution policy
- Or run `Unblock-File gsd-copilot-install.ps1` before running the script
- See [gsd-copilot-installer/README.md](gsd-copilot-installer/README.md) for full options

**Want the latest version?**
Run the installer again  it always pulls the latest release.

---

## Sync Policy

This fork **only syncs changes down** from [`gsd-build/get-shit-done`](https://github.com/gsd-build/get-shit-done)  it never pushes back. The CI pipeline (`upstream-sync.yml`) detects upstream changes, merges them, regenerates the Copilot wrapper layer, and opens a pull request on **this fork**. There is no automated path that creates pull requests or pushes commits to `gsd-build/get-shit-done`.

**Contributing to upstream:** If you want to contribute a fix or feature back to the original GSD project, do so manually by opening a PR directly on [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done).

---

## License

MIT License. See [LICENSE](LICENSE) for details.

Core GSD system licensed MIT by TÂCHES / glittercowboy. This compatibility layer is also MIT.

---

<div align="center">

**GSD makes spec-driven development with AI reliable. This fork brings it to VS Code GitHub Copilot.**

</div>
