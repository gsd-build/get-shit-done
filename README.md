<div align="center">

# GET MY SHIT DONE (GMSD)

**A customised fork of [Get Shit Done (GSD)](https://github.com/glittercowboy/get-shit-done) — the meta-prompting, context engineering, and spec-driven development system for Claude Code.**

[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Upstream](https://img.shields.io/badge/upstream-GSD-181717?style=for-the-badge&logo=github)](https://github.com/glittercowboy/get-shit-done)

</div>

---

> **This is a personal fork.** The upstream project [GSD](https://github.com/glittercowboy/get-shit-done) by [@glittercowboy](https://github.com/glittercowboy) is the original — go there for the canonical version, community, and npm package. This fork reshapes GSD to fit a specific workflow: Emacs/Org-mode as the documentation format, Architecture Decision Records baked into the planning process, and a "learn software architecture" lens on top of the existing spec-driven development system.

---

## What Changed From Upstream GSD

| Area | Upstream GSD | This Fork (GMSD) |
|------|-------------|-------------------|
| **Document format** | Markdown (`.md`) with YAML frontmatter | Org-mode (`.org`) with `:PROPERTIES:` drawers |
| **Commands** | `/gsd:*` | `/gmsd:*` |
| **Architecture decisions** | Decisions captured informally in CONTEXT/SUMMARY | Full [MADR 4.0](https://adr.github.io/madr/) ADR workflow (`/gmsd:create-adr`) |
| **Decisions storage** | Inline in phase files | Centralized `.planning/decisions/NNN-slug.org` |
| **Package paths** | `get-shit-done/`, `commands/gsd/` | `get-my-shit-done/`, `commands/gmsd/` |
| **Agent names** | `gsd-planner`, `gsd-executor`, etc. | `gmsd-planner`, `gmsd-executor`, etc. |
| **Branch templates** | `gsd/phase-{N}-{slug}` | `gmsd/phase-{N}-{slug}` |
| **Settings directory** | `~/.gsd/` | `~/.gmsd/` |

### Why Org-mode?

Org-mode is a plain-text markup format native to Emacs. Compared to Markdown:

- **Property drawers** (`:PROPERTIES:` / `:END:`) give structured, machine-readable metadata without a separate YAML parser
- **Heading hierarchy** (`*`, `**`, `***`) with folding makes large planning documents navigable
- **Source blocks** (`#+begin_src` / `#+end_src`) with language-specific evaluation via Babel
- **Native Emacs integration** — agenda views, TODO states, clocking, export to HTML/PDF/LaTeX

If you use Emacs, Org-mode is the natural format for planning documents. If you don't, the upstream GSD with Markdown is probably a better fit.

### Why ADRs?

Architecture Decision Records document the *why* behind technical choices. GSD already captures decisions in CONTEXT and SUMMARY files, but informally — you know *what* was decided, not *why* it was chosen over alternatives, or *what trade-offs* were accepted.

GMSD adds a full MADR 4.0 workflow:
- `/gmsd:create-adr "Use PostgreSQL"` scaffolds a structured decision record
- Each ADR documents: context, decision drivers, considered options with pros/cons, outcome, consequences
- ADRs are auto-numbered and centralized in `.planning/decisions/`
- The discuss-phase workflow suggests ADR creation for architectural choices
- The verifier checks ADR consistency during phase execution

---

## Upstream GSD

Everything below is adapted from the upstream GSD project. For the original documentation, community, and support, visit [github.com/glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done).

---

## Who This Is For

People who want to describe what they want and have it built correctly — without pretending they're running a 50-person engineering org.

---

## Getting Started

```bash
npx get-my-shit-done-cc@latest
```

The installer prompts you to choose:
1. **Runtime** — Claude Code, OpenCode, Gemini, Codex, or all
2. **Location** — Global (all projects) or local (current project only)

Verify with:
- Claude Code / Gemini: `/gmsd:help`
- OpenCode: `/gmsd-help`
- Codex: `$gmsd-help`

> [!NOTE]
> Codex installation uses skills (`skills/gmsd-*/SKILL.md`) rather than custom prompts.

### Staying Updated

GMSD evolves fast. Update periodically:

```bash
npx get-my-shit-done-cc@latest
```

<details>
<summary><strong>Non-interactive Install (Docker, CI, Scripts)</strong></summary>

```bash
# Claude Code
npx get-my-shit-done-cc --claude --global   # Install to ~/.claude/
npx get-my-shit-done-cc --claude --local    # Install to ./.claude/

# OpenCode (open source, free models)
npx get-my-shit-done-cc --opencode --global # Install to ~/.config/opencode/

# Gemini CLI
npx get-my-shit-done-cc --gemini --global   # Install to ~/.gemini/

# Codex (skills-first)
npx get-my-shit-done-cc --codex --global    # Install to ~/.codex/
npx get-my-shit-done-cc --codex --local     # Install to ./.codex/

# All runtimes
npx get-my-shit-done-cc --all --global      # Install to all directories
```

Use `--global` (`-g`) or `--local` (`-l`) to skip the location prompt.
Use `--claude`, `--opencode`, `--gemini`, `--codex`, or `--all` to skip the runtime prompt.

</details>

<details>
<summary><strong>Development Installation</strong></summary>

Clone the repository and run the installer locally:

```bash
git clone https://github.com/glittercowboy/get-my-shit-done.git
cd get-my-shit-done
node bin/install.js --claude --local
```

Installs to `./.claude/` for testing modifications before contributing.

</details>

### Recommended: Skip Permissions Mode

GMSD is designed for frictionless automation. Run Claude Code with:

```bash
claude --dangerously-skip-permissions
```

> [!TIP]
> This is how GMSD is intended to be used — stopping to approve `date` and `git commit` 50 times defeats the purpose.

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

> **Already have code?** Run `/gmsd:map-codebase` first. It spawns parallel agents to analyze your stack, architecture, conventions, and concerns. Then `/gmsd:new-project` knows your codebase — questions focus on what you're adding, and planning automatically loads your patterns.

### 1. Initialize Project

```
/gmsd:new-project
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
/gmsd:discuss-phase 1
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

---

### 3. Plan Phase

```
/gmsd:plan-phase 1
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
/gmsd:execute-phase 1
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
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE EXECUTION                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WAVE 1 (parallel)          WAVE 2 (parallel)          WAVE 3       │
│  ┌─────────┐ ┌─────────┐    ┌─────────┐ ┌─────────┐    ┌─────────┐ │
│  │ Plan 01 │ │ Plan 02 │ →  │ Plan 03 │ │ Plan 04 │ →  │ Plan 05 │ │
│  │         │ │         │    │         │ │         │    │         │ │
│  │ User    │ │ Product │    │ Orders  │ │ Cart    │    │ Checkout│ │
│  │ Model   │ │ Model   │    │ API     │ │ API     │    │ UI      │ │
│  └─────────┘ └─────────┘    └─────────┘ └─────────┘    └─────────┘ │
│       │           │              ↑           ↑              ↑       │
│       └───────────┴──────────────┴───────────┘              │       │
│              Dependencies: Plan 03 needs Plan 01            │       │
│                          Plan 04 needs Plan 02              │       │
│                          Plan 05 needs Plans 03 + 04        │       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
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
/gmsd:verify-work 1
```

**This is where you confirm it actually works.**

Automated verification checks that code exists and tests pass. But does the feature *work* the way you expected? This is your chance to use it.

The system:

1. **Extracts testable deliverables** — What you should be able to do now
2. **Walks you through one at a time** — "Can you log in with email?" Yes/no, or describe what's wrong
3. **Diagnoses failures automatically** — Spawns debug agents to find root causes
4. **Creates verified fix plans** — Ready for immediate re-execution

If everything passes, you move on. If something's broken, you don't manually debug — you just run `/gmsd:execute-phase` again with the fix plans it created.

**Creates:** `{phase_num}-UAT.md`, fix plans if issues found

---

### 6. Repeat → Complete → Next Milestone

```
/gmsd:discuss-phase 2
/gmsd:plan-phase 2
/gmsd:execute-phase 2
/gmsd:verify-work 2
...
/gmsd:complete-milestone
/gmsd:new-milestone
```

Loop **discuss → plan → execute → verify** until milestone complete.

Each phase gets your input (discuss), proper research (plan), clean execution (execute), and human verification (verify). Context stays fresh. Quality stays high.

When all phases are done, `/gmsd:complete-milestone` archives the milestone and tags the release.

Then `/gmsd:new-milestone` starts the next version — same flow as `new-project` but for your existing codebase. You describe what you want to build next, the system researches the domain, you scope requirements, and it creates a fresh roadmap. Each milestone is a clean cycle: define → build → ship.

---

### Quick Mode

```
/gmsd:quick
```

**For ad-hoc tasks that don't need full planning.**

Quick mode gives you GMSD guarantees (atomic commits, state tracking) with a faster path:

- **Same agents** — Planner + executor, same quality
- **Skips optional steps** — No research, no plan checker, no verifier
- **Separate tracking** — Lives in `.planning/quick/`, not phases

Use for: bug fixes, small features, config changes, one-off tasks.

```
/gmsd:quick
> What do you want to do? "Add dark mode toggle to settings"
```

**Creates:** `.planning/quick/001-add-dark-mode-toggle/PLAN.md`, `SUMMARY.md`

---

## Why It Works

### Context Engineering

Claude Code is incredibly powerful *if* you give it the context it needs. Most people don't.

GMSD handles it for you:

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
| `/gmsd:new-project [--auto]` | Full initialization: questions → research → requirements → roadmap |
| `/gmsd:discuss-phase [N] [--auto]` | Capture implementation decisions before planning |
| `/gmsd:plan-phase [N] [--auto]` | Research + plan + verify for a phase |
| `/gmsd:execute-phase <N>` | Execute all plans in parallel waves, verify when complete |
| `/gmsd:verify-work [N]` | Manual user acceptance testing ¹ |
| `/gmsd:audit-milestone` | Verify milestone achieved its definition of done |
| `/gmsd:complete-milestone` | Archive milestone, tag release |
| `/gmsd:new-milestone [name]` | Start next version: questions → research → requirements → roadmap |

### Navigation

| Command | What it does |
|---------|--------------|
| `/gmsd:progress` | Where am I? What's next? |
| `/gmsd:help` | Show all commands and usage guide |
| `/gmsd:update` | Update GMSD with changelog preview |
| `/gmsd:join-discord` | Join the GMSD Discord community |

### Brownfield

| Command | What it does |
|---------|--------------|
| `/gmsd:map-codebase` | Analyze existing codebase before new-project |

### Phase Management

| Command | What it does |
|---------|--------------|
| `/gmsd:add-phase` | Append phase to roadmap |
| `/gmsd:insert-phase [N]` | Insert urgent work between phases |
| `/gmsd:remove-phase [N]` | Remove future phase, renumber |
| `/gmsd:list-phase-assumptions [N]` | See Claude's intended approach before planning |
| `/gmsd:plan-milestone-gaps` | Create phases to close gaps from audit |

### Session

| Command | What it does |
|---------|--------------|
| `/gmsd:pause-work` | Create handoff when stopping mid-phase |
| `/gmsd:resume-work` | Restore from last session |

### Utilities

| Command | What it does |
|---------|--------------|
| `/gmsd:settings` | Configure model profile and workflow agents |
| `/gmsd:set-profile <profile>` | Switch model profile (quality/balanced/budget) |
| `/gmsd:add-todo [desc]` | Capture idea for later |
| `/gmsd:check-todos` | List pending todos |
| `/gmsd:debug [desc]` | Systematic debugging with persistent state |
| `/gmsd:quick [--full]` | Execute ad-hoc task with GMSD guarantees (`--full` adds plan-checking and verification) |
| `/gmsd:health [--repair]` | Validate `.planning/` directory integrity, auto-repair with `--repair` |

<sup>¹ Contributed by reddit user OracleGreyBeard</sup>

---

## Configuration

GMSD stores project settings in `.planning/config.json`. Configure during `/gmsd:new-project` or update later with `/gmsd:settings`. For the full config schema, workflow toggles, git branching options, and per-agent model breakdown, see the [User Guide](docs/USER-GUIDE.md#configuration-reference).

### Core Settings

| Setting | Options | Default | What it controls |
|---------|---------|---------|------------------|
| `mode` | `yolo`, `interactive` | `interactive` | Auto-approve vs confirm at each step |
| `depth` | `quick`, `standard`, `comprehensive` | `standard` | Planning thoroughness (phases × plans) |

### Model Profiles

Control which Claude model each agent uses. Balance quality vs token spend.

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced` (default) | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |

Switch profiles:
```
/gmsd:set-profile budget
```

Or configure via `/gmsd:settings`.

### Workflow Agents

These spawn additional agents during planning/execution. They improve quality but add tokens and time.

| Setting | Default | What it does |
|---------|---------|--------------|
| `workflow.research` | `true` | Researches domain before planning each phase |
| `workflow.plan_check` | `true` | Verifies plans achieve phase goals before execution |
| `workflow.verifier` | `true` | Confirms must-haves were delivered after execution |
| `workflow.auto_advance` | `false` | Auto-chain discuss → plan → execute without stopping |

Use `/gmsd:settings` to toggle these, or override per-invocation:
- `/gmsd:plan-phase --skip-research`
- `/gmsd:plan-phase --skip-verify`

### Execution

| Setting | Default | What it controls |
|---------|---------|------------------|
| `parallelization.enabled` | `true` | Run independent plans simultaneously |
| `planning.commit_docs` | `true` | Track `.planning/` in git |

### Git Branching

Control how GMSD handles branches during execution.

| Setting | Options | Default | What it does |
|---------|---------|---------|--------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | Branch creation strategy |
| `git.phase_branch_template` | string | `gmsd/phase-{phase}-{slug}` | Template for phase branches |
| `git.milestone_branch_template` | string | `gmsd/{milestone}-{slug}` | Template for milestone branches |

**Strategies:**
- **`none`** — Commits to current branch (default GMSD behavior)
- **`phase`** — Creates a branch per phase, merges at phase completion
- **`milestone`** — Creates one branch for entire milestone, merges at completion

At milestone completion, GMSD offers squash merge (recommended) or merge with history.

---

## Security

### Protecting Sensitive Files

GMSD's codebase mapping and analysis commands read files to understand your project. **Protect files containing secrets** by adding them to Claude Code's deny list:

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
> GMSD includes built-in protections against committing secrets, but defense-in-depth is best practice. Deny read access to sensitive files as a first line of defense.

---

## Troubleshooting

**Commands not found after install?**
- Restart your runtime to reload commands/skills
- Verify files exist in `~/.claude/commands/gmsd/` (global) or `./.claude/commands/gmsd/` (local)
- For Codex, verify skills exist in `~/.codex/skills/gmsd-*/SKILL.md` (global) or `./.codex/skills/gmsd-*/SKILL.md` (local)

**Commands not working as expected?**
- Run `/gmsd:help` to verify installation
- Re-run `npx get-my-shit-done-cc` to reinstall

**Updating to the latest version?**
```bash
npx get-my-shit-done-cc@latest
```

**Using Docker or containerized environments?**

If file reads fail with tilde paths (`~/.claude/...`), set `CLAUDE_CONFIG_DIR` before installing:
```bash
CLAUDE_CONFIG_DIR=/home/youruser/.claude npx get-my-shit-done-cc --global
```
This ensures absolute paths are used instead of `~` which may not expand correctly in containers.

### Uninstalling

To remove GMSD completely:

```bash
# Global installs
npx get-my-shit-done-cc --claude --global --uninstall
npx get-my-shit-done-cc --opencode --global --uninstall
npx get-my-shit-done-cc --codex --global --uninstall

# Local installs (current project)
npx get-my-shit-done-cc --claude --local --uninstall
npx get-my-shit-done-cc --opencode --local --uninstall
npx get-my-shit-done-cc --codex --local --uninstall
```

This removes all GMSD commands, agents, hooks, and settings while preserving your other configurations.

---

## Community Ports

OpenCode, Gemini CLI, and Codex are now natively supported via `npx get-my-shit-done-cc`.

These community ports pioneered multi-runtime support:

| Project | Platform | Description |
|---------|----------|-------------|
| [gmsd-opencode](https://github.com/rokicool/gmsd-opencode) | OpenCode | Original OpenCode adaptation |
| gmsd-gemini (archived) | Gemini CLI | Original Gemini adaptation by uberfuzzy |

---

## Star History

<a href="https://star-history.com/#glittercowboy/get-my-shit-done&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=glittercowboy/get-my-shit-done&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=glittercowboy/get-my-shit-done&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=glittercowboy/get-my-shit-done&type=Date" />
 </picture>
</a>

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Claude Code is powerful. GMSD makes it reliable.**

</div>
