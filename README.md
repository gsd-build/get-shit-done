<div align="center">

# GET SHIT DONE

**English** · [Português](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md)

**A light-weight and powerful meta-prompting, context engineering and spec-driven development system for Claude Code, OpenCode, Gemini CLI, Kilo, Codex, Copilot, Cursor, Windsurf, Antigravity, Augment, Trae, Qwen Code, Cline, and CodeBuddy.**

**Solves context rot — the quality degradation that happens as Claude fills its context window.**

[![npm version](https://img.shields.io/npm/v/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![npm downloads](https://img.shields.io/npm/dm/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![Tests](https://img.shields.io/github/actions/workflow/status/gsd-build/get-shit-done/test.yml?branch=main&style=for-the-badge&logo=github&label=Tests)](https://github.com/gsd-build/get-shit-done/actions/workflows/test.yml)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/mYgfVNfA2r)
[![X (Twitter)](https://img.shields.io/badge/X-@gsd__foundation-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/gsd_foundation)
[![$GSD Token](https://img.shields.io/badge/$GSD-Dexscreener-1C1C1C?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iIzAwRkYwMCIvPjwvc3ZnPg==&logoColor=00FF00)](https://dexscreener.com/solana/dwudwjvan7bzkw9zwlbyv6kspdlvhwzrqy6ebk8xzxkv)
[![GitHub stars](https://img.shields.io/github/stars/gsd-build/get-shit-done?style=for-the-badge&logo=github&color=181717)](https://github.com/gsd-build/get-shit-done)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npx get-shit-done-cc@latest
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

[Why I Built This](#why-i-built-this) · [How It Works](#how-it-works) · [Commands](#commands) · [Why It Works](#why-it-works) · [User Guide](docs/USER-GUIDE.md) · [Walkthrough](docs/USER-GUIDE.md#end-to-end-walkthrough)

</div>

---

> [!IMPORTANT]
> ### Welcome Back to GSD
>
> If you're returning to GSD after the recent Anthropic Terms of Service changes — welcome back. We kept building while you were gone.
>
> **To re-import an existing project into GSD:**
> 1. Run `/gsd-map-codebase` to scan and index your current codebase state
> 2. Run `/gsd-new-project` to initialize a fresh GSD planning structure using the codebase map as context
> 3. Review [docs/USER-GUIDE.md](docs/USER-GUIDE.md) and the [CHANGELOG](CHANGELOG.md) for updates — a lot has changed since you were last here
>
> Your code is fine. GSD just needs its planning context rebuilt. The two commands above handle that.

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

Built-in quality gates catch real problems: schema drift detection flags ORM changes missing migrations, security enforcement anchors verification to threat models, and scope reduction detection prevents the planner from silently dropping your requirements.

### v1.37.0 Highlights

- **Spiking & sketching** — `/gsd-spike` runs 2–5 focused experiments with Given/When/Then verdicts; `/gsd-sketch` produces 2–3 interactive HTML mockup variants per design question — both store artifacts in `.planning/` and pair with wrap-up commands to package findings into project-local skills
- **Agent size-budget enforcement** — Tiered line-count limits (XL: 1 600, Large: 1 000, Default: 500) keep agent prompts lean; violations surface in CI
- **Shared boilerplate extraction** — Mandatory-initial-read and project-skills-discovery logic extracted to reference files, reducing duplication across a dozen agents

---

## Getting Started

```bash
npx get-shit-done-cc@latest
```

The installer prompts you to choose:
1. **Runtime** — Claude Code, OpenCode, Gemini, Kilo, Codex, Copilot, Cursor, Windsurf, Antigravity, Augment, Trae, Qwen Code, CodeBuddy, Cline, or all (interactive multi-select — pick multiple runtimes in a single install session)
2. **Location** — Global (all projects) or local (current project only)

Verify with:
- Claude Code / Gemini / Copilot / Antigravity / Qwen Code: `/gsd-help`
- OpenCode / Kilo / Augment / Trae / CodeBuddy: `/gsd-help`
- Codex: `$gsd-help`
- Cline: GSD installs via `.clinerules` — verify by checking `.clinerules` exists

> [!NOTE]
> Claude Code 2.1.88+, Qwen Code, and Codex install as skills (`.claude/skills/`, `./.codex/skills/`, or the matching global `~/.claude/skills/` / `~/.codex/skills/` roots). Older Claude Code versions use `commands/gsd/`. `~/.claude/get-shit-done/skills/` is import-only for legacy migration. The installer handles all formats automatically.

The canonical discovery contract is documented in [docs/skills/discovery-contract.md](docs/skills/discovery-contract.md).

> [!TIP]
> For source-based installs or environments where npm is unavailable, see **[docs/manual-update.md](docs/manual-update.md)**.

### Staying Updated

GSD evolves fast. Update periodically:

```bash
npx get-shit-done-cc@latest
```

<details>
<summary><strong>Non-interactive Install (Docker, CI, Scripts)</strong></summary>

```bash
# Claude Code
npx get-shit-done-cc --claude --global   # Install to ~/.claude/
npx get-shit-done-cc --claude --local    # Install to ./.claude/

# OpenCode
npx get-shit-done-cc --opencode --global # Install to ~/.config/opencode/

# Gemini CLI
npx get-shit-done-cc --gemini --global   # Install to ~/.gemini/

# Kilo
npx get-shit-done-cc --kilo --global     # Install to ~/.config/kilo/
npx get-shit-done-cc --kilo --local      # Install to ./.kilo/

# Codex
npx get-shit-done-cc --codex --global    # Install to ~/.codex/
npx get-shit-done-cc --codex --local     # Install to ./.codex/

# Copilot
npx get-shit-done-cc --copilot --global  # Install to ~/.github/
npx get-shit-done-cc --copilot --local   # Install to ./.github/

# Cursor CLI
npx get-shit-done-cc --cursor --global      # Install to ~/.cursor/
npx get-shit-done-cc --cursor --local       # Install to ./.cursor/

# Windsurf
npx get-shit-done-cc --windsurf --global    # Install to ~/.codeium/windsurf/
npx get-shit-done-cc --windsurf --local     # Install to ./.windsurf/

# Antigravity
npx get-shit-done-cc --antigravity --global # Install to ~/.gemini/antigravity/
npx get-shit-done-cc --antigravity --local  # Install to ./.agent/

# Augment
npx get-shit-done-cc --augment --global     # Install to ~/.augment/
npx get-shit-done-cc --augment --local      # Install to ./.augment/

# Trae
npx get-shit-done-cc --trae --global        # Install to ~/.trae/
npx get-shit-done-cc --trae --local         # Install to ./.trae/

# Qwen Code
npx get-shit-done-cc --qwen --global        # Install to ~/.qwen/
npx get-shit-done-cc --qwen --local         # Install to ./.qwen/

# CodeBuddy
npx get-shit-done-cc --codebuddy --global   # Install to ~/.codebuddy/
npx get-shit-done-cc --codebuddy --local    # Install to ./.codebuddy/

# Cline
npx get-shit-done-cc --cline --global       # Install to ~/.cline/
npx get-shit-done-cc --cline --local        # Install to ./.clinerules

# All runtimes
npx get-shit-done-cc --all --global      # Install to all directories
```

Use `--global` (`-g`) or `--local` (`-l`) to skip the location prompt.
Use `--claude`, `--opencode`, `--gemini`, `--kilo`, `--codex`, `--copilot`, `--cursor`, `--windsurf`, `--antigravity`, `--augment`, `--trae`, `--qwen`, `--codebuddy`, `--cline`, or `--all` to skip the runtime prompt.
The GSD SDK CLI (`gsd-sdk`) is installed automatically (required by `/gsd-*` commands). Pass `--no-sdk` to skip the SDK install, or `--sdk` to force a reinstall.

</details>

<details>
<summary><strong>Minimal Install (local LLMs and token-billed APIs)</strong></summary>

GSD ships 86 skills and 33 subagents. Every runtime (Claude Code, OpenCode, etc.) eagerly enumerates skill descriptions and subagent descriptions into the system prompt on **every turn** — about **~12k tokens** of fixed overhead before you've typed anything. Frontier models with large context (Sonnet 4.6, Opus 4.7 — 200K to 1M ctx) absorb that without a noticeable hit. **Local LLMs with 32K–128K context, and any model where you're paying per token, will feel it.**

Pass `--minimal` (alias `--core-only`) to install only the **main GSD loop**:

```bash
npx get-shit-done-cc --claude --global --minimal
# or any other runtime — works the same
npx get-shit-done-cc --opencode --global --minimal
```

What you get:

| Surface | Default install | `--minimal` install |
|---|---|---|
| Skills | 86 (`new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, …82 more) | **6** (`new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, `help`, `update`) |
| Subagents | 33 `gsd-*` agents | **0** |
| Cold-start system-prompt overhead | ~12k tokens | **~700 tokens** (≥94% reduction) |
| Manifest mode field | `"full"` | `"minimal"` |

The 6 core skills are exactly the ones you need to drive a project from zero: `new-project` to bootstrap, then the `discuss → plan → execute` loop, plus `help` for discovery and `update` to upgrade later.

**This is a hard floor, not a ceiling.** Each `/gsd-*` command you start using and each subagent it dispatches loads its body content into the conversation for that turn — that's normal token use, not eager overhead. But:

> [!IMPORTANT]
> **The savings disappear the moment you re-install without `--minimal`.** Running `npx get-shit-done-cc@latest` (or `gsd update` from inside a session) without the flag puts the full 86-skill / 33-agent surface back on disk, and every subsequent session pays the full ~12k-token floor again. If you want to stay minimal, **always pass `--minimal` when updating**:
>
> ```bash
> npx get-shit-done-cc@latest --claude --global --minimal
> ```
>
> Need a specific skill that isn't in the core set (e.g., `gsd-autonomous`, `gsd-ship`, `gsd-debug`)? You have two options:
> 1. **Permanent expand:** re-install without `--minimal` to get the full surface (and the full token floor).
> 2. **One-shot:** run the slash command's underlying logic by reading the source from `commands/gsd/<name>.md` in the GSD package and executing it manually — no install change needed.
>
> Tip: `cat ~/.claude/get-shit-done/.gsd-manifest.json | jq .mode` (or `gsd-file-manifest.json` depending on layout) confirms which mode you're in.

When to use `--minimal`:
- Local model with 32K–128K context (Qwen3, Llama, Mistral, etc.)
- Token-metered API where every turn matters
- Throwaway directory or non-GSD project where you want `/gsd-new-project` available without paying for the rest
- CI runners or ephemeral containers where install footprint matters

When **not** to use `--minimal`:
- Active GSD project where you regularly invoke the broader command set (`autonomous`, `ship`, `code-review`, `debug`, etc.) — re-installing each time is friction without payoff.
- Frontier models with 200K–1M context — the savings are noise.

</details>

<details>
<summary><strong>Development Installation</strong></summary>

Clone the repository, build hooks, and run the installer locally:

```bash
git clone https://github.com/gsd-build/get-shit-done.git
cd get-shit-done
npm run build:hooks
node bin/install.js --claude --local
```

The `build:hooks` step is required — it compiles hook sources into `hooks/dist/` which the installer copies from. Without it, hooks won't be installed and you'll get hook errors in Claude Code. (The npm release handles this automatically via `prepublishOnly`.)

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

> **New to GSD?** See the [end-to-end walkthrough](docs/USER-GUIDE.md#end-to-end-walkthrough) in the User Guide — it shows a complete project from `/gsd-new-project` through `/gsd-verify-work` with concrete example outputs.

> **Already have code?** Run `/gsd-map-codebase` first. It spawns parallel agents to analyze your stack, architecture, conventions, and concerns. Then `/gsd-new-project` knows your codebase — questions focus on what you're adding, and planning automatically loads your patterns.

### 1. Initialize Project

```
/gsd-new-project
```

One command, one flow. The system:

1. **Questions** — Asks until it understands your idea completely (goals, constraints, tech preferences, edge cases)
2. **Research** — Spawns parallel agents to investigate the domain (optional but recommended)
3. **Requirements** — Extracts what's v1, v2, and out of scope
4. **Roadmap** — Creates phases mapped to requirements

You approve the roadmap. Now you're ready to build.

**Creates:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `.planning/research/`

---

### 2. Discuss Phase

```
/gsd-discuss-phase 1
```

**This is where you shape the implementation.**

Your roadmap has a sentence or two per phase. That's not enough context to build something the way *you* imagine it. This step captures your preferences before anything gets researched or planned.

The system analyzes the phase and identifies gray areas based on what's being built:

- **Visual features** → Layout, density, interactions, empty states
- **APIs/CLIs** → Response format, flags, error handling, verbosity
- **Content systems** → Structure, tone, depth, flow
- **Organization tasks** → Grouping criteria, naming, duplicates, exceptions

For each area you select, it asks until you're satisfied. The output — `CONTEXT.md` — feeds directly into the next two steps:

1. **Researcher reads it** — Knows what patterns to investigate ("user wants card layout" → research card component libraries)
2. **Planner reads it** — Knows what decisions are locked ("infinite scroll decided" → plan includes scroll handling)

The deeper you go here, the more the system builds what you actually want. Skip it and you get reasonable defaults. Use it and you get *your* vision.

**Creates:** `{phase_num}-CONTEXT.md`

> **Assumptions Mode:** Prefer codebase analysis over questions? Set `workflow.discuss_mode` to `assumptions` in `/gsd-settings`. The system reads your code, surfaces what it would do and why, and only asks you to correct what's wrong. See [Discuss Mode](docs/workflow-discuss-mode.md).

---

### 3. Plan Phase

```
/gsd-plan-phase 1
```

The system:

1. **Researches** — Investigates how to implement this phase, guided by your CONTEXT.md decisions
2. **Plans** — Creates 2-3 atomic task plans with XML structure
3. **Verifies** — Checks plans against requirements, loops until they pass

Each plan is small enough to execute in a fresh context window. No degradation, no "I'll be more concise now."

**Creates:** `{phase_num}-RESEARCH.md`, `{phase_num}-{N}-PLAN.md`

---

### 4. Execute Phase

```
/gsd-execute-phase 1
```

The system:

1. **Runs plans in waves** — Parallel where possible, sequential when dependent
2. **Fresh context per plan** — 200k tokens purely for implementation, zero accumulated garbage
3. **Commits per task** — Every task gets its own atomic commit
4. **Verifies against goals** — Checks the codebase delivers what the phase promised

Walk away, come back to completed work with clean git history.

**How Wave Execution Works:**

Plans are grouped into "waves" based on dependencies. Within each wave, plans run in parallel. Waves run sequentially.

```
┌────────────────────────────────────────────────────────────────────┐
│  PHASE EXECUTION                                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  WAVE 1 (parallel)          WAVE 2 (parallel)          WAVE 3      │
│  ┌─────────┐ ┌─────────┐    ┌─────────┐ ┌─────────┐    ┌─────────┐ │
│  │ Plan 01 │ │ Plan 02 │ →  │ Plan 03 │ │ Plan 04 │ →  │ Plan 05 │ │
│  │         │ │         │    │         │ │         │    │         │ │
│  │ User    │ │ Product │    │ Orders  │ │ Cart    │    │ Checkout│ │
│  │ Model   │ │ Model   │    │ API     │ │ API     │    │ UI      │ │
│  └─────────┘ └─────────┘    └─────────┘ └─────────┘    └─────────┘ │
│       │           │              ↑           ↑              ↑      │
│       └───────────┴──────────────┴───────────┘              │      │
│              Dependencies: Plan 03 needs Plan 01            │      │
│                          Plan 04 needs Plan 02              │      │
│                          Plan 05 needs Plans 03 + 04        │      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Why waves matter:**
- Independent plans → Same wave → Run in parallel
- Dependent plans → Later wave → Wait for dependencies
- File conflicts → Sequential plans or same plan

This is why "vertical slices" (Plan 01: User feature end-to-end) parallelize better than "horizontal layers" (Plan 01: All models, Plan 02: All APIs).

**Creates:** `{phase_num}-{N}-SUMMARY.md`, `{phase_num}-VERIFICATION.md`

---

### 5. Verify Work

```
/gsd-verify-work 1
```

**This is where you confirm it actually works.**

Automated verification checks that code exists and tests pass. But does the feature *work* the way you expected? This is your chance to use it.

The system:

1. **Extracts testable deliverables** — What you should be able to do now
2. **Walks you through one at a time** — "Can you log in with email?" Yes/no, or describe what's wrong
3. **Diagnoses failures automatically** — Spawns debug agents to find root causes
4. **Creates verified fix plans** — Ready for immediate re-execution

If everything passes, you move on. If something's broken, you don't manually debug — you just run `/gsd-execute-phase` again with the fix plans it created.

**Creates:** `{phase_num}-UAT.md`, fix plans if issues found

---

### 6. Repeat → Ship → Complete → Next Milestone

```
/gsd-discuss-phase 2
/gsd-plan-phase 2
/gsd-execute-phase 2
/gsd-verify-work 2
/gsd-ship 2                  # Create PR from verified work
...
/gsd-complete-milestone
/gsd-new-milestone
```

Or let GSD figure out the next step automatically:

```
/gsd-next                    # Auto-detect and run next step
```

Loop **discuss → plan → execute → verify → ship** until milestone complete.

If you want faster intake during discussion, use `/gsd-discuss-phase <n> --batch` to answer a small grouped set of questions at once instead of one-by-one. Use `--chain` to auto-chain discuss into plan+execute without stopping between steps.

Each phase gets your input (discuss), proper research (plan), clean execution (execute), and human verification (verify). Context stays fresh. Quality stays high.

When all phases are done, `/gsd-complete-milestone` archives the milestone and tags the release.

Then `/gsd-new-milestone` starts the next version — same flow as `new-project` but for your existing codebase. You describe what you want to build next, the system researches the domain, you scope requirements, and it creates a fresh roadmap. Each milestone is a clean cycle: define → build → ship.

---

### Quick Mode

```
/gsd-quick
```

**For ad-hoc tasks that don't need full planning.**

Quick mode gives you GSD guarantees (atomic commits, state tracking) with a faster path:

- **Same agents** — Planner + executor, same quality
- **Skips optional steps** — No research, no plan checker, no verifier by default
- **Separate tracking** — Lives in `.planning/quick/`, not phases

**`--discuss` flag:** Lightweight discussion to surface gray areas before planning.

**`--research` flag:** Spawns a focused researcher before planning. Investigates implementation approaches, library options, and pitfalls. Use when you're unsure how to approach a task.

**`--full` flag:** Enables all phases — discussion + research + plan-checking + verification. The full GSD pipeline in quick-task form.

**`--validate` flag:** Enables plan-checking + post-execution verification only (the previous `--full` behavior).

Flags are composable: `--discuss --research --validate` gives discussion + research + plan-checking + verification.

```
/gsd-quick
> What do you want to do? "Add dark mode toggle to settings"
```

**Creates:** `.planning/quick/001-add-dark-mode-toggle/PLAN.md`, `SUMMARY.md`

---

## Why It Works

### Context Engineering

Claude Code is incredibly powerful *if* you give it the context it needs. Most people don't.

GSD handles it for you:

| File | What it does |
|------|--------------|
| `PROJECT.md` | Project vision, always loaded |
| `research/` | Ecosystem knowledge (stack, features, architecture, pitfalls) |
| `REQUIREMENTS.md` | Scoped v1/v2 requirements with phase traceability |
| `ROADMAP.md` | Where you're going, what's done |
| `STATE.md` | Decisions, blockers, position — memory across sessions |
| `PLAN.md` | Atomic task with XML structure, verification steps |
| `SUMMARY.md` | What happened, what changed, committed to history |
| `todos/` | Captured ideas and tasks for later work |
| `threads/` | Persistent context threads for cross-session work |
| `seeds/` | Forward-looking ideas that surface at the right milestone |

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

### Multi-Agent Orchestration

Every stage uses the same pattern: a thin orchestrator spawns specialized agents, collects results, and routes to the next step.

| Stage | Orchestrator does | Agents do |
|-------|------------------|-----------|
| Research | Coordinates, presents findings | 4 parallel researchers investigate stack, features, architecture, pitfalls |
| Planning | Validates, manages iteration | Planner creates plans, checker verifies, loop until pass |
| Execution | Groups into waves, tracks progress | Executors implement in parallel, each with fresh 200k context |
| Verification | Presents results, routes next | Verifier checks codebase against goals, debuggers diagnose failures |

The orchestrator never does heavy lifting. It spawns agents, waits, integrates results.

**The result:** You can run an entire phase — deep research, multiple plans created and verified, thousands of lines of code written across parallel executors, automated verification against goals — and your main context window stays at 30-40%. The work happens in fresh subagent contexts. Your session stays fast and responsive.

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

### Core Workflow

| Command | What it does |
|---------|--------------|
| `/gsd-new-project [--auto]` | Full initialization: questions → research → requirements → roadmap |
| `/gsd-discuss-phase [N] [--auto] [--analyze] [--chain]` | Capture implementation decisions before planning (`--analyze` adds trade-off analysis, `--chain` auto-chains into plan+execute) |
| `/gsd-plan-phase [N] [--auto] [--reviews]` | Research + plan + verify for a phase (`--reviews` loads codebase review findings) |
| `/gsd-execute-phase <N>` | Execute all plans in parallel waves, verify when complete |
| `/gsd-verify-work [N]` | Manual user acceptance testing ¹ |
| `/gsd-ship [N] [--draft]` | Create PR from verified phase work with auto-generated body |
| `/gsd-next` | Automatically advance to the next logical workflow step |
| `/gsd-fast <text>` | Inline trivial tasks — skips planning entirely, executes immediately |
| `/gsd-audit-milestone` | Verify milestone achieved its definition of done |
| `/gsd-complete-milestone` | Archive milestone, tag release |
| `/gsd-new-milestone [name]` | Start next version: questions → research → requirements → roadmap |
| `/gsd-forensics [desc]` | Post-mortem investigation of failed workflow runs (diagnoses stuck loops, missing artifacts, git anomalies) |
| `/gsd-milestone-summary [version]` | Generate comprehensive project summary for team onboarding and review |

### Workstreams

| Command | What it does |
|---------|--------------|
| `/gsd-workstreams list` | Show all workstreams and their status |
| `/gsd-workstreams create <name>` | Create a namespaced workstream for parallel milestone work |
| `/gsd-workstreams switch <name>` | Switch active workstream |
| `/gsd-workstreams complete <name>` | Complete and merge a workstream |

### Multi-Project Workspaces

| Command | What it does |
|---------|--------------|
| `/gsd-new-workspace` | Create isolated workspace with repo copies (worktrees or clones) |
| `/gsd-list-workspaces` | Show all GSD workspaces and their status |
| `/gsd-remove-workspace` | Remove workspace and clean up worktrees |

### Spiking & Sketching

| Command | What it does |
|---------|--------------|
| `/gsd-spike [idea] [--quick]` | Throwaway experiments to validate feasibility before planning — no project init required |
| `/gsd-sketch [idea] [--quick]` | Throwaway HTML mockups with multi-variant exploration — no project init required |
| `/gsd-spike-wrap-up` | Package spike findings into a project-local skill for future build conversations |
| `/gsd-sketch-wrap-up` | Package sketch design findings into a project-local skill for future builds |

### UI Design

| Command | What it does |
|---------|--------------|
| `/gsd-ui-phase [N]` | Generate UI design contract (UI-SPEC.md) for frontend phases |
| `/gsd-ui-review [N]` | Retroactive 6-pillar visual audit of implemented frontend code |

### Navigation

| Command | What it does |
|---------|--------------|
| `/gsd-progress` | Where am I? What's next? |
| `/gsd-next` | Auto-detect state and run the next step |
| `/gsd-help` | Show all commands and usage guide |
| `/gsd-update` | Update GSD with changelog preview |
| `/gsd-join-discord` | Join the GSD Discord community |
| `/gsd-manager` | Interactive command center for managing multiple phases |

### Brownfield

| Command | What it does |
|---------|--------------|
| `/gsd-map-codebase [area]` | Analyze existing codebase before new-project |
| `/gsd-ingest-docs [dir]` | Scan a repo of mixed ADRs, PRDs, SPECs, and DOCs and bootstrap or merge the full `.planning/` setup in one pass — parallel classification, synthesis with precedence rules, and a three-bucket conflicts report |

### Phase Management

| Command | What it does |
|---------|--------------|
| `/gsd-add-phase` | Append phase to roadmap |
| `/gsd-insert-phase [N]` | Insert urgent work between phases |
| `/gsd-remove-phase [N]` | Remove future phase, renumber |
| `/gsd-list-phase-assumptions [N]` | See Claude's intended approach before planning |
| `/gsd-plan-milestone-gaps` | Create phases to close gaps from audit |

### Session

| Command | What it does |
|---------|--------------|
| `/gsd-pause-work` | Create handoff when stopping mid-phase (writes HANDOFF.json) |
| `/gsd-resume-work` | Restore from last session |
| `/gsd-session-report` | Generate session summary with work performed and outcomes |

### Workstreams

| Command | What it does |
|---------|--------------|
| `/gsd-workstreams` | Manage parallel workstreams (list, create, switch, status, progress, complete) |

### Code Quality

| Command | What it does |
|---------|--------------|
| `/gsd-review` | Cross-AI peer review of current phase or branch |
| `/gsd-secure-phase [N]` | Security enforcement with threat-model-anchored verification |
| `/gsd-pr-branch` | Create clean PR branch filtering `.planning/` commits |
| `/gsd-audit-uat` | Audit verification debt — find phases missing UAT |
| `/gsd-docs-update` | Verified documentation generation with doc-writer and doc-verifier agents |

### Backlog & Threads

| Command | What it does |
|---------|--------------|
| `/gsd-plant-seed <idea>` | Capture forward-looking ideas with trigger conditions — surfaces at the right milestone |
| `/gsd-add-backlog <desc>` | Add idea to backlog parking lot (999.x numbering, outside active sequence) |
| `/gsd-review-backlog` | Review and promote backlog items to active milestone or remove stale entries |
| `/gsd-thread [name]` | Persistent context threads — lightweight cross-session knowledge for work spanning multiple sessions |

### Utilities

| Command | What it does |
|---------|--------------|
| `/gsd-settings` | Configure model profile and workflow agents |
| `/gsd-set-profile <profile>` | Switch model profile (quality/balanced/budget/inherit) |
| `/gsd-add-todo [desc]` | Capture idea for later |
| `/gsd-check-todos` | List pending todos |
| `/gsd-debug [desc]` | Systematic debugging with persistent state |
| `/gsd-do <text>` | Route freeform text to the right GSD command automatically |
| `/gsd-note <text>` | Zero-friction idea capture — append, list, or promote notes to todos |
| `/gsd-quick [--full] [--validate] [--discuss] [--research]` | Execute ad-hoc task with GSD guarantees (`--full` enables all phases, `--validate` adds plan-checking and verification, `--discuss` gathers context first, `--research` investigates approaches before planning) |
| `/gsd-health [--repair]` | Validate `.planning/` directory integrity, auto-repair with `--repair` |
| `/gsd-stats` | Display project statistics — phases, plans, requirements, git metrics |
| `/gsd-profile-user [--questionnaire] [--refresh]` | Generate developer behavioral profile from session analysis for personalized responses |

<sup>¹ Contributed by reddit user OracleGreyBeard</sup>

---

## Configuration

GSD stores project settings in `.planning/config.json`. Configure during `/gsd-new-project` or update later with `/gsd-settings`. For the full config schema, workflow toggles, git branching options, and per-agent model breakdown, see the [User Guide](docs/USER-GUIDE.md#configuration-reference).

### Core Settings

| Setting | Options | Default | What it controls |
|---------|---------|---------|------------------|
| `mode` | `yolo`, `interactive` | `interactive` | Auto-approve vs confirm at each step |
| `granularity` | `coarse`, `standard`, `fine` | `standard` | Phase granularity — how finely scope is sliced (phases × plans) |
| `project_code` | string | `""` | Prefix phase directories with a project code |

### Model Profiles

Control which Claude model each agent uses. Balance quality vs token spend.

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced` (default) | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |
| `inherit` | Inherit | Inherit | Inherit |

Switch profiles:
```
/gsd-set-profile budget
```

Use `inherit` when using non-Anthropic providers (OpenRouter, local models) or to follow the current runtime model selection (e.g. OpenCode `/model`).

Or configure via `/gsd-settings`.

### Workflow Agents

These spawn additional agents during planning/execution. They improve quality but add tokens and time.

| Setting | Default | What it does |
|---------|---------|--------------|
| `workflow.research` | `true` | Researches domain before planning each phase |
| `workflow.plan_check` | `true` | Verifies plans achieve phase goals before execution |
| `workflow.verifier` | `true` | Confirms must-haves were delivered after execution |
| `workflow.auto_advance` | `false` | Auto-chain discuss → plan → execute without stopping |
| `workflow.research_before_questions` | `false` | Run research before discussion questions instead of after |
| `workflow.discuss_mode` | `'discuss'` | Discussion mode: `discuss` (interview), `assumptions` (codebase-first) |
| `workflow.skip_discuss` | `false` | Skip discuss-phase in autonomous mode |
| `workflow.text_mode` | `false` | Text-only mode for remote sessions (no TUI menus) |
| `workflow.use_worktrees` | `true` | Toggle worktree isolation for execution |

Use `/gsd-settings` to toggle these, or override per-invocation:
- `/gsd-plan-phase --skip-research`
- `/gsd-plan-phase --skip-verify`

### Execution

| Setting | Default | What it controls |
|---------|---------|------------------|
| `parallelization.enabled` | `true` | Run independent plans simultaneously |
| `planning.commit_docs` | `true` | Track `.planning/` in git |
| `hooks.context_warnings` | `true` | Show context window usage warnings |

### Agent Skills

Inject project-specific skills into subagents during execution.

| Setting | Type | What it does |
|---------|------|--------------|
| `agent_skills.<agent_type>` | `string[]` | Paths to skill directories loaded into that agent type at spawn time |

Skills are injected as `<agent_skills>` blocks in agent prompts, giving subagents access to project-specific knowledge.

### Git Branching

Control how GSD handles branches during execution.

| Setting | Options | Default | What it does |
|---------|---------|---------|--------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | Branch creation strategy |
| `git.phase_branch_template` | string | `gsd/phase-{phase}-{slug}` | Template for phase branches |
| `git.milestone_branch_template` | string | `gsd/{milestone}-{slug}` | Template for milestone branches |

**Strategies:**
- **`none`** — Commits to current branch (default GSD behavior)
- **`phase`** — Creates a branch per phase, merges at phase completion
- **`milestone`** — Creates one branch for entire milestone, merges at completion

At milestone completion, GSD offers squash merge (recommended) or merge with history.

---

## Security

### Built-in Security Hardening

GSD includes defense-in-depth security since v1.27:

- **Path traversal prevention** — All user-supplied file paths (`--text-file`, `--prd`) are validated to resolve within the project directory
- **Prompt injection detection** — Centralized `security.cjs` module scans for injection patterns in user-supplied text before it enters planning artifacts
- **PreToolUse prompt guard hook** — `gsd-prompt-guard` scans writes to `.planning/` for embedded injection vectors (advisory, not blocking)
- **Safe JSON parsing** — Malformed `--fields` arguments are caught before they corrupt state
- **Shell argument validation** — User text is sanitized before shell interpolation
- **CI-ready injection scanner** — `prompt-injection-scan.test.cjs` scans all agent/workflow/command files for embedded injection vectors

> [!NOTE]
> Because GSD generates markdown files that become LLM system prompts, any user-controlled text flowing into planning artifacts is a potential indirect prompt injection vector. These protections are designed to catch such vectors at multiple layers.

### Protecting Sensitive Files

GSD's codebase mapping and analysis commands read files to understand your project. **Protect files containing secrets** by adding them to Claude Code's deny list:

1. Open Claude Code settings (`.claude/settings.json` or global)
2. Add sensitive file patterns to the deny list:

```json
{
  "permissions": {
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/*)",
      "Read(**/*credential*)",
      "Read(**/*.pem)",
      "Read(**/*.key)"
    ]
  }
}
```

This prevents Claude from reading these files entirely, regardless of what commands you run.

> [!IMPORTANT]
> GSD includes built-in protections against committing secrets, but defense-in-depth is best practice. Deny read access to sensitive files as a first line of defense.

---

## Troubleshooting

**Commands not found after install?**
- Restart your runtime to reload commands/skills
- Verify files exist in `~/.claude/skills/gsd-*/SKILL.md` or `~/.codex/skills/gsd-*/SKILL.md` for managed global installs
- For local installs, verify `.claude/skills/gsd-*/SKILL.md` or `./.codex/skills/gsd-*/SKILL.md`
- Legacy Claude Code installs still use `~/.claude/commands/gsd/`

**Commands not working as expected?**
- Run `/gsd-help` to verify installation
- Re-run `npx get-shit-done-cc` to reinstall

**Updating to the latest version?**
```bash
npx get-shit-done-cc@latest
```

**Using Docker or containerized environments?**

If file reads fail with tilde paths (`~/.claude/...`), set `CLAUDE_CONFIG_DIR` before installing:
```bash
CLAUDE_CONFIG_DIR=/home/youruser/.claude npx get-shit-done-cc --global
```
This ensures absolute paths are used instead of `~` which may not expand correctly in containers.

### Uninstalling

To remove GSD completely:

```bash
# Global installs
npx get-shit-done-cc --claude --global --uninstall
npx get-shit-done-cc --opencode --global --uninstall
npx get-shit-done-cc --gemini --global --uninstall
npx get-shit-done-cc --kilo --global --uninstall
npx get-shit-done-cc --codex --global --uninstall
npx get-shit-done-cc --copilot --global --uninstall
npx get-shit-done-cc --cursor --global --uninstall
npx get-shit-done-cc --windsurf --global --uninstall
npx get-shit-done-cc --antigravity --global --uninstall
npx get-shit-done-cc --augment --global --uninstall
npx get-shit-done-cc --trae --global --uninstall
npx get-shit-done-cc --qwen --global --uninstall
npx get-shit-done-cc --codebuddy --global --uninstall
npx get-shit-done-cc --cline --global --uninstall

# Local installs (current project)
npx get-shit-done-cc --claude --local --uninstall
npx get-shit-done-cc --opencode --local --uninstall
npx get-shit-done-cc --gemini --local --uninstall
npx get-shit-done-cc --kilo --local --uninstall
npx get-shit-done-cc --codex --local --uninstall
npx get-shit-done-cc --copilot --local --uninstall
npx get-shit-done-cc --cursor --local --uninstall
npx get-shit-done-cc --windsurf --local --uninstall
npx get-shit-done-cc --antigravity --local --uninstall
npx get-shit-done-cc --augment --local --uninstall
npx get-shit-done-cc --trae --local --uninstall
npx get-shit-done-cc --qwen --local --uninstall
npx get-shit-done-cc --codebuddy --local --uninstall
npx get-shit-done-cc --cline --local --uninstall
```

This removes all GSD commands, agents, hooks, and settings while preserving your other configurations.

---

## Community Ports

OpenCode, Gemini CLI, Kilo, and Codex are now natively supported via `npx get-shit-done-cc`.

These community ports pioneered multi-runtime support:

| Project | Platform | Description |
|---------|----------|-------------|
| [gsd-opencode](https://github.com/rokicool/gsd-opencode) | OpenCode | Original OpenCode adaptation |
| gsd-gemini (archived) | Gemini CLI | Original Gemini adaptation by uberfuzzy |

---

## Star History

<a href="https://star-history.com/#gsd-build/get-shit-done&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
 </picture>
</a>

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Claude Code is powerful. GSD makes it reliable.**

</div>
