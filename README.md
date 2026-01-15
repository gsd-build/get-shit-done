<div align="center">

# GET SHIT DONE

**A light-weight and powerful meta-prompting, context engineering and spec-driven development system for Claude Code and OpenCode by TÂCHES.**

**Solves context rot — the quality degradation that happens as Claude fills its context window.**

[![npm version](https://img.shields.io/npm/v/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![npm downloads](https://img.shields.io/npm/dm/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/glittercowboy/get-shit-done?style=for-the-badge&logo=github&color=181717)](https://github.com/glittercowboy/get-shit-done)

<br>

```bash
npx github:evilbuck/get-shit-done
```

**Works on Mac, Windows, and Linux.**

<br>

![GSD Install](assets/terminal.svg)

<br>

*"If you know clearly what you want, this WILL build it for you. No bs."*

*"I've done SpecKit, OpenSpec and Taskmaster — this has produced the best results for me."*

*"By far the most powerful addition to my Claude Code. Nothing over-engineered. Literally just gets shit done."*

<br>

**Trusted by engineers at Amazon, Google, Shopify, and Webflow.**

[Why I Built This](#why-i-built-this) · [How It Works](#how-it-works) · [Commands](#commands) · [Why It Works](#why-it-works)

</div>

---

## Why I Built This

I'm a solo developer. I don't write code — Claude Code does.

Other spec-driven development tools exist; BMAD, Speckit... But they all seem to make things way more complicated than they need to be (sprint ceremonies, story points, stakeholder syncs, retrospectives, Jira workflows) or lack real big picture understanding of what you're building. I'm not a 50-person software company. I don't want to play enterprise theater. I'm just a creative person trying to build great things that work.

So I built GSD. The complexity is in the system, not in your workflow. Behind the scenes: context engineering, XML prompt formatting, subagent orchestration, state management. What you see: a few commands that just work.

The system gives Claude everything it needs to do the work *and* verify it. I trust the workflow. It just does a good job.

That's what this is. No enterprise roleplay bullshit. Just an incredibly effective system for building cool stuff consistently using Claude Code.

— **TÂCHES**

---

Vibecoding has a bad reputation. You describe what you want, AI generates code, and you get inconsistent garbage that falls apart at scale.

GSD fixes that. It's the context engineering layer that makes Claude Code reliable. Describe your idea, let the system extract everything it needs to know, and let Claude Code get to work.

---

## Who This Is For

People who want to describe what they want and have it built correctly — without pretending they're running a 50-person engineering org.

---

## Getting Started

```bash
npx github:evilbuck/get-shit-done
```

The installer will prompt you to choose:
1. **Platform**: Claude Code or OpenCode
2. **Location**: Global (all projects) or Local (current project only)

Verify installation with `/gsd:help` (Claude Code) or `@general` (OpenCode).

<details>
<summary><strong>Install from specific branch or tag</strong></summary>

```bash
# From a specific branch
npx github:evilbuck/get-shit-done#feature-branch

# From a specific tag/release
npx github:evilbuck/get-shit-done#v1.4.27
```

</details>

<details>
<summary><strong>Non-interactive Install (Docker, CI, Scripts)</strong></summary>

```bash
# Claude Code
npx github:evilbuck/get-shit-done --platform claude-code --global   # Install to ~/.claude/
npx github:evilbuck/get-shit-done --platform claude-code --local    # Install to ./.claude/

# OpenCode
npx github:evilbuck/get-shit-done --platform opencode --global      # Install to ~/.config/opencode/
npx github:evilbuck/get-shit-done --platform opencode --local       # Install to .opencode/
```

Use `--platform` to specify target platform and `--global` (`-g`) or `--local` (`-l`) for location.

</details>

<details>
<summary><strong>Development Installation</strong></summary>

Clone the repository and run the installer locally:

```bash
git clone https://github.com/glittercowboy/get-shit-done.git
cd get-shit-done
node bin/install.js --local
```

Installs to `./.claude/` for testing modifications before contributing.

</details>

### Recommended: Skip Permissions Mode

GSD is designed for frictionless automation. Run Claude Code with:

```bash
claude --dangerously-skip-permissions
```

> [!TIP]
> This is how GSD is intended to be used — stopping to approve `date` and `git commit` 50 times defeats the purpose.

<details>
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

## How It Works

### 1. Start with an idea

```
/gsd:new-project
```

The system asks questions. Keeps asking until it has everything — your goals, constraints, tech preferences, edge cases. You go back and forth until the idea is fully captured. Creates **PROJECT.md**.

### 2. Create roadmap

```
/gsd:create-roadmap
```

Produces:
- **ROADMAP.md** — Phases from start to finish
- **STATE.md** — Living memory that persists across sessions

### 3. Plan and execute phases

```
/gsd:plan-phase 1      # System creates atomic task plans
/gsd:execute-phase 1   # Parallel agents execute all plans
```

Each phase breaks into 2-3 task plans. Each plan runs in a fresh subagent context — 200k tokens purely for implementation, zero degradation. Plans without dependencies run in parallel.

**For single-plan or interactive execution:**
```
/gsd:execute-plan      # Run one plan at a time with checkpoints
```

Use `/gsd:execute-phase` for parallel "walk away" automation (recommended). Use `/gsd:execute-plan` when you need interactive single-plan execution with manual checkpoints.

### 4. Ship and iterate

```
/gsd:complete-milestone   # Archive v1, prep for v2
/gsd:add-phase            # Append new work
/gsd:insert-phase 2       # Slip urgent work between phases
```

Ship your MVP in a day. Add features. Insert hotfixes. The system stays modular — you're never stuck.

---

## Existing Projects (Brownfield)

Already have code? Start here instead.

### 1. Map the codebase

```
/gsd:map-codebase
```

Spawns parallel agents to analyze your code. Creates `.planning/codebase/` with 7 documents:

| Document | Purpose |
|----------|---------|
| `STACK.md` | Languages, frameworks, dependencies |
| `ARCHITECTURE.md` | Patterns, layers, data flow |
| `STRUCTURE.md` | Directory layout, where things live |
| `CONVENTIONS.md` | Code style, naming patterns |
| `TESTING.md` | Test framework, patterns |
| `INTEGRATIONS.md` | External services, APIs |
| `CONCERNS.md` | Tech debt, known issues, fragile areas |

### 2. Initialize project

```
/gsd:new-project
```

Same as greenfield, but the system knows your codebase. Questions focus on what you're adding/changing, not starting from scratch.

### 3. Continue as normal

From here, it's the same: `/gsd:create-roadmap` → `/gsd:plan-phase` → `/gsd:execute-phase`

The codebase docs load automatically during planning. Claude knows your patterns, conventions, and where to put things.

---

## Why It Works

### Context Engineering

Claude Code is incredibly powerful *if* you give it the context it needs. Most people don't.

GSD handles it for you:

| File | What it does |
|------|--------------|
| `PROJECT.md` | Project vision, always loaded |
| `ROADMAP.md` | Where you're going, what's done |
| `STATE.md` | Decisions, blockers, position — memory across sessions |
| `PLAN.md` | Atomic task with XML structure, verification steps |
| `SUMMARY.md` | What happened, what changed, committed to history |
| `todos/` | Captured ideas and tasks for later work |

Size limits based on where Claude's quality degrades. Stay under, get consistent excellence.

### XML Prompt Formatting

Every plan is structured XML optimized for Claude:

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

Precise instructions. No guessing. Verification built in.

### Subagent Execution

As Claude fills its context window, quality degrades. You've seen it: *"Due to context limits, I'll be more concise now."* That "concision" is code for cutting corners.

GSD prevents this. Each plan is maximum 3 tasks. Each plan runs in a fresh subagent — 200k tokens purely for implementation, zero accumulated garbage.

| Task | Context | Quality |
|------|---------|---------|
| Task 1 | Fresh | ✅ Full |
| Task 2 | Fresh | ✅ Full |
| Task 3 | Fresh | ✅ Full |

No degradation. Walk away, come back to completed work.

### Atomic Git Commits

Each task gets its own commit immediately after completion:

```bash
abc123f docs(08-02): complete user registration plan
def456g feat(08-02): add email confirmation flow
hij789k feat(08-02): implement password hashing
lmn012o feat(08-02): create registration endpoint
```

> [!NOTE]
> **Benefits:** Git bisect finds exact failing task. Each task independently revertable. Clear history for Claude in future sessions. Better observability in AI-automated workflow.

Every commit is surgical, traceable, and meaningful.

### Modular by Design

- Add phases to current milestone
- Insert urgent work between phases
- Complete milestones and start fresh
- Adjust plans without rebuilding everything

You're never locked in. The system adapts.

---

## Commands

| Command | What it does |
|---------|--------------|
| `/gsd:new-project` | Extract your idea through questions, create PROJECT.md |
| `/gsd:create-roadmap` | Create roadmap and state tracking |
| `/gsd:map-codebase` | Map existing codebase for brownfield projects |
| `/gsd:plan-phase [N]` | Generate task plans for phase |
| `/gsd:execute-plan` | Run single plan via subagent |
| `/gsd:execute-phase <N>` | Execute all plans in phase N with parallel agents |
| `/gsd:status [--wait]` | Check background agent status from parallel execution |
| `/gsd:progress` | Where am I? What's next? |
| `/gsd:verify-work [N]` | User acceptance test of phase or plan ¹ |
| `/gsd:plan-fix [plan]` | Plan fixes for UAT issues from verify-work |
| `/gsd:complete-milestone` | Ship it, prep next version |
| `/gsd:discuss-milestone` | Gather context for next milestone |
| `/gsd:new-milestone [name]` | Create new milestone with phases |
| `/gsd:add-phase` | Append phase to roadmap |
| `/gsd:insert-phase [N]` | Insert urgent work |
| `/gsd:remove-phase [N]` | Remove future phase, renumber subsequent |
| `/gsd:discuss-phase [N]` | Gather context before planning |
| `/gsd:research-phase [N]` | Deep ecosystem research for niche domains |
| `/gsd:list-phase-assumptions [N]` | See what Claude thinks before you correct it |
| `/gsd:pause-work` | Create handoff file when stopping mid-phase |
| `/gsd:resume-work` | Restore from last session |
| `/gsd:add-todo [desc]` | Capture idea or task from conversation for later |
| `/gsd:check-todos [area]` | List pending todos, select one to work on |
| `/gsd:debug [desc]` | Systematic debugging with persistent state across `/clear` |
| `/gsd:help` | Show all commands and usage guide |

<sup>¹ Contributed by reddit user OracleGreyBeard</sup>

---

## Troubleshooting

**Commands not found after install?**
- Restart Claude Code to reload slash commands
- Verify files exist in `~/.claude/commands/gsd/` (global) or `./.claude/commands/gsd/` (local)

**Commands not working as expected?**
- Run `/gsd:help` to verify installation
- Re-run `npx github:evilbuck/get-shit-done` to reinstall

**Updating to the latest version?**
```bash
npx github:evilbuck/get-shit-done#main
```

**Using Docker or containerized environments?**

If file reads fail with tilde paths (`~/.claude/...`), set `CLAUDE_CONFIG_DIR` before installing:
```bash
CLAUDE_CONFIG_DIR=/home/youruser/.claude npx github:evilbuck/get-shit-done --global
```
This ensures absolute paths are used instead of `~` which may not expand correctly in containers.

---

## Star History

<a href="https://star-history.com/#glittercowboy/get-shit-done&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=glittercowboy/get-shit-done&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=glittercowboy/get-shit-done&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=glittercowboy/get-shit-done&type=Date" />
 </picture>
</a>

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Claude Code and OpenCode are powerful. GSD makes them reliable.**

</div>
