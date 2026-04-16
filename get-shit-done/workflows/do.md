<purpose>
Analyze freeform text from the user and route to the most appropriate GSD command. This is a dispatcher — it never does the work itself. Match user intent to the best command, confirm the routing with a weight label, and hand off.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="validate">
**Check for input.**


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
If `$ARGUMENTS` is empty, ask via AskUserQuestion:

```
What would you like to do? Describe the task, bug, or idea and I'll route it to the right GSD command.
```

Wait for response before continuing.
</step>

<step name="check_project">
**Check if project exists.**

```bash
INIT=$(gsd-sdk query state.load 2>/dev/null)
```

Track whether `.planning/` exists — some routes require it, others don't.
</step>

<step name="route">
**Match intent to command.**

Evaluate `$ARGUMENTS` against these routing rules. Apply the **first matching** rule:

| If the text describes... | Route to | Weight | Why |
|--------------------------|----------|--------|-----|
| Starting a new project, "set up", "initialize" | `/gsd-new-project` | 🔴 large | Needs full project initialization |
| Mapping or analyzing an existing codebase | `/gsd-map-codebase` | 🟡 medium | Codebase discovery |
| A bug, error, crash, failure, or something broken | `/gsd-debug` | 🟡 medium | Needs systematic investigation |
| Exploring, researching, comparing, or "how does X work" | `/gsd-research-phase` | 🟡 medium | Domain research before planning |
| Discussing vision, "how should X look", brainstorming | `/gsd-discuss-phase` | 🟡 medium | Needs context gathering |
| A complex task: refactoring, migration, multi-file architecture, system redesign | `/gsd-add-phase` | 🔴 large | Needs a full phase with plan/build cycle |
| Planning a specific phase or "plan phase N" | `/gsd-plan-phase` | 🔴 large | Direct planning request |
| Executing a phase or "build phase N", "run phase N" | `/gsd-execute-phase` | 🔴 large | Direct execution request |
| Running all remaining phases automatically | `/gsd-autonomous` | 🔴 large | Full autonomous execution |
| A review or quality concern about existing work | `/gsd-verify-work` | 🟡 medium | Needs verification |
| Checking progress, status, "where am I" | `/gsd-progress` | 🟢 small | Status check |
| Resuming work, "pick up where I left off" | `/gsd-resume-work` | 🟢 small | Session restoration |
| A note, idea, or "remember to..." | `/gsd-add-todo` | 🟢 small | Capture for later |
| Adding tests, "write tests", "test coverage" | `/gsd-add-tests` | 🟡 medium | Test generation |
| Completing a milestone, shipping, releasing | `/gsd-complete-milestone` | 🔴 large | Milestone lifecycle |
| A specific, actionable, small task (add feature, fix typo, update config) | `/gsd-quick` | 🟢 small | Self-contained, single executor |

**Weight definitions:**
- 🟢 **small** — runs inline, no subagents, no planning artifacts, done in one pass
- 🟡 **medium** — may spawn one agent or produce a lightweight artifact, no full plan/build cycle
- 🔴 **large** — triggers a multi-step pipeline (discuss → plan → execute), creates planning artifacts, may take several minutes

**Requires `.planning/` directory:** All routes except `/gsd-new-project`, `/gsd-map-codebase`, `/gsd-help`, and `/gsd-join-discord`. If the project doesn't exist and the route requires it, suggest `/gsd-new-project` first.

**Ambiguity handling:** If the text could reasonably match multiple routes, ask the user via AskUserQuestion with the top 2-3 options. Include the weight label in each option so the user can calibrate. For example:

```
"Refactor the authentication system" could be:
1. /gsd-add-phase 🔴 large — Full planning cycle (discuss → plan → execute)
2. /gsd-quick 🟢 small — Inline execution, no planning artifacts

Which fits the scope of what you need?
```
</step>

<step name="display">
**Show the routing decision with weight.**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ROUTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Input:**  {first 80 chars of $ARGUMENTS}
**Weight:** {🟢 small | 🟡 medium | 🔴 large} — {one-line description of what this weight means for this task}
**Routing to:** {chosen command}
**Reason:** {one-line explanation}
```

The weight line removes ambiguity before anything runs — the user knows whether they're about to trigger a 10-second inline fix or a multi-minute planning pipeline.
</step>

<step name="dispatch">
**Invoke the chosen command.**

Run the selected `/gsd-*` command, passing `$ARGUMENTS` as args.

If the chosen command expects a phase number and one wasn't provided in the text, extract it from context or ask via AskUserQuestion.

After invoking the command, stop. The dispatched command handles everything from here.
</step>

</process>

<success_criteria>
- [ ] Input validated (not empty)
- [ ] Intent matched to exactly one GSD command
- [ ] Weight label (small/medium/large) assigned to chosen command
- [ ] Ambiguity resolved via user question with weight labels included (if needed)
- [ ] Project existence checked for routes that require it
- [ ] Routing decision displayed with weight before dispatch
- [ ] Command invoked with appropriate arguments
- [ ] No work done directly — dispatcher only
</success_criteria>
