<purpose>
Orchestrate parallel doc-writer agents to generate and update project documentation. Each agent writes one doc type directly. The orchestrator dispatches, collects confirmations, and commits results. Output: Up to 9 documentation files verified against the live codebase.
</purpose>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd-doc-writer — Writes and updates project documentation files
</available_agent_types>

<process>

<step name="init_context" priority="first">
Load docs-update context:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" docs-init)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-doc-writer 2>/dev/null)
```

Extract from init JSON:
- `doc_writer_model` — model string to pass to each spawned agent (never hardcode a model name)
- `commit_docs` — whether to commit generated files when done
- `existing_docs` — array of `{path, has_gsd_marker}` objects for existing Markdown files
- `project_type` — object with boolean signals: `has_package_json`, `has_api_routes`, `has_cli_bin`, `is_open_source`, `has_deploy_config`, `is_monorepo`, `has_tests`
- `doc_tooling` — object with booleans: `docusaurus`, `vitepress`, `mkdocs`, `storybook`
- `monorepo_workspaces` — array of workspace glob patterns (empty if not a monorepo)
- `agents_installed` — boolean; true if gsd-doc-writer agent is installed
- `missing_agents` — array of agent names not found
- `project_root` — absolute path to the project root
</step>

<step name="validate_agents">
Check the `agents_installed` field from the init JSON.

**If `agents_installed` is false:**

```
Warning: gsd-doc-writer agent is not installed. Documentation generation may fail.

Missing agents:
[list items from missing_agents array]

To install agents, run the GSD installer and ensure all agents are set up.
```

Do NOT halt execution — warn only. The agent may be loaded via other means (e.g., in-context agent definitions, custom agent directories). Continue to classify_project.

**If `agents_installed` is true:**
Continue to classify_project.
</step>

<step name="classify_project">
Map the `project_type` boolean signals from the init JSON to a primary type label and collect conditional doc signals.

**Primary type classification (first match wins):**

| Condition | primary_type |
|-----------|-------------|
| `is_monorepo` is true | `"monorepo"` |
| `has_cli_bin` is true AND `has_api_routes` is false | `"cli-tool"` |
| `has_api_routes` is true AND `is_open_source` is false | `"saas"` |
| `is_open_source` is true AND `has_api_routes` is false | `"open-source-library"` |
| (none of the above) | `"generic"` |

**Conditional doc signals (D-02 union rule — check independently after primary classification):**

After determining primary_type, check each signal independently regardless of the primary type. A CLI tool that is also open source with API routes still gets all three conditional docs.

| Signal | Conditional Doc |
|--------|----------------|
| `has_api_routes` is true | Queue API.md |
| `is_open_source` is true | Queue CONTRIBUTING.md |
| `has_deploy_config` is true | Queue DEPLOYMENT.md |

Present the classification result:
```
Project type: {primary_type}
Conditional docs queued: {list or "none"}
```
</step>

<step name="build_doc_queue">
Assemble the complete doc queue from always-on docs plus conditional docs from classify_project.

**Always-on docs (queued for every project, no exceptions):**
1. README
2. ARCHITECTURE
3. GETTING-STARTED
4. DEVELOPMENT
5. TESTING
6. CONFIGURATION

**Conditional docs (add only if signal matched in classify_project):**
- API (if `has_api_routes`)
- CONTRIBUTING (if `is_open_source`)
- DEPLOYMENT (if `has_deploy_config`)

**IMPORTANT: CHANGELOG.md is NEVER queued. The doc queue is built exclusively from the 9 known doc types listed above. Do not derive the queue from `existing_docs` directly — existing_docs is only used in the next step to determine create vs update mode.**

**Doc queue limit:** Maximum 9 docs. Always-on (6) + up to 3 conditional = at most 9.

Present the assembled queue to the user before proceeding:

```
Doc queue assembled ({N} docs):

Always-on:
  - README.md
  - ARCHITECTURE.md
  - GETTING-STARTED.md
  - DEVELOPMENT.md
  - TESTING.md
  - CONFIGURATION.md

Conditional:
  [list conditional docs queued, or "none"]

CHANGELOG.md: excluded (out of scope)

Proceed with generation? (y/n)
```

Wait for user confirmation before continuing to resolve_modes.
</step>

<step name="resolve_modes">
For each doc in the assembled queue, determine whether to create (new file) or update (existing file).

**Doc type to canonical path mapping:**

| Type | Primary Path | Fallback Path |
|------|-------------|---------------|
| `readme` | `README.md` | — |
| `architecture` | `ARCHITECTURE.md` | `docs/ARCHITECTURE.md` |
| `getting_started` | `GETTING-STARTED.md` | `docs/GETTING-STARTED.md` |
| `development` | `DEVELOPMENT.md` | `docs/DEVELOPMENT.md` |
| `testing` | `TESTING.md` | `docs/TESTING.md` |
| `api` | `API.md` | `docs/API.md` |
| `configuration` | `CONFIGURATION.md` | `docs/CONFIGURATION.md` |
| `deployment` | `DEPLOYMENT.md` | `docs/DEPLOYMENT.md` |
| `contributing` | `CONTRIBUTING.md` | — |

**Mode resolution logic:**

For each doc type in the queue:
1. Check if the primary path appears in the `existing_docs` array from the init JSON
2. If not found at primary path, check the fallback path
3. If found at either path: mode = `"update"` — use the Read tool to load the current file content (will be passed as `existing_content` in the doc_assignment block)
4. If not found: mode = `"create"` — no existing content to load

**Output a mode resolution table:**
```
Mode resolution:
  README.md          — create (not found)
  ARCHITECTURE.md    — update (found at ARCHITECTURE.md)
  GETTING-STARTED.md — create (not found)
  ...
```

Track the resolved mode and file path (primary or fallback) for each queued doc. For update-mode docs, store the loaded file content — it will be passed to the agent in the next steps.
</step>

<step name="detect_runtime_capabilities">
Before spawning agents, detect whether the current runtime supports the `Task` tool for subagent delegation.

**How to detect:** Check if you have access to a `Task` tool (may be capitalized as `Task` or lowercase as `task` depending on runtime). If you do NOT have a `Task`/`task` tool (or only have tools like `browser_subagent` which is for web browsing, NOT code analysis):

→ **Skip `dispatch_wave_1`, `collect_wave_1`, `dispatch_wave_2`, and `collect_wave_2`** — go directly to `sequential_generation` instead.

**CRITICAL:** Never use `browser_subagent` or `Explore` as a substitute for `Task`. The `browser_subagent` tool is exclusively for web page interaction and will produce incorrect results for documentation generation. If `Task` is unavailable, generate docs sequentially in-context.

<!-- Steps 7-13 follow below -->
</step>

<step name="dispatch_wave_1" condition="Task tool is available">
Spawn 3 parallel gsd-doc-writer agents for Wave 1 docs: README, ARCHITECTURE, CONFIGURATION.

These are foundational docs with no cross-references needed, making them ideal for parallel generation.

Use `run_in_background=true` for all three to enable parallel execution.

**Agent 1: README**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate README.md for target project",
  prompt="<doc_assignment>
type: readme
mode: {create|update}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update, else omit this line)}
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Agent 2: ARCHITECTURE**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate ARCHITECTURE.md for target project",
  prompt="<doc_assignment>
type: architecture
mode: {create|update}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update, else omit this line)}
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Agent 3: CONFIGURATION**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate CONFIGURATION.md for target project",
  prompt="<doc_assignment>
type: configuration
mode: {create|update}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update, else omit this line)}
note: Apply VERIFY markers to any infrastructure claim not discoverable from the repository.
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**CRITICAL:** Agent prompts must contain ONLY the `<doc_assignment>` block, the `${AGENT_SKILLS}` variable, and the return instruction. Do not include project planning context, workflow prose, or any internal tooling references in agent prompts.

Continue to collect_wave_1.
</step>

<step name="collect_wave_1">
Wait for all 3 Wave 1 agents to complete using the TaskOutput tool.

Call TaskOutput for all 3 agents in parallel (single message with 3 TaskOutput calls):

```
TaskOutput tool:
  task_id: "{task_id from README agent result}"
  block: true
  timeout: 300000

TaskOutput tool:
  task_id: "{task_id from ARCHITECTURE agent result}"
  block: true
  timeout: 300000

TaskOutput tool:
  task_id: "{task_id from CONFIGURATION agent result}"
  block: true
  timeout: 300000
```

**Expected confirmation format from each agent:**
```
## Doc Generation Complete
**Type:** {type}
**Mode:** {mode}
**File written:** `{path}` ({N} lines)
Ready for orchestrator summary.
```

**After collection, verify the 3 Wave 1 files exist on disk:**
```bash
ls -la README.md ARCHITECTURE.md CONFIGURATION.md 2>/dev/null || \
  ls -la docs/ARCHITECTURE.md docs/CONFIGURATION.md 2>/dev/null
```

If any agent failed or its file is missing:
- Note the failure
- Continue with the successful docs (do NOT halt Wave 2 for a single failure)
- The missing doc will be noted in the final report

Continue to dispatch_wave_2.
</step>

<step name="dispatch_wave_2" condition="Task tool is available">
Spawn agents for all queued Wave 2 docs: GETTING-STARTED, DEVELOPMENT, TESTING, and any conditional docs (API, DEPLOYMENT, CONTRIBUTING) that were queued in build_doc_queue.

Wave 2 agents can reference Wave 1 outputs for cross-referencing — include the `wave_1_outputs` field in each doc_assignment block.

Use `run_in_background=true` for all Wave 2 agents to enable parallel execution within the wave.

**Agent: GETTING-STARTED**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate GETTING-STARTED.md for target project",
  prompt="<doc_assignment>
type: getting_started
mode: {create|update}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update, else omit this line)}
wave_1_outputs:
  - README.md
  - ARCHITECTURE.md
  - CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Agent: DEVELOPMENT**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate DEVELOPMENT.md for target project",
  prompt="<doc_assignment>
type: development
mode: {create|update}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update, else omit this line)}
wave_1_outputs:
  - README.md
  - ARCHITECTURE.md
  - CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Agent: TESTING**

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate TESTING.md for target project",
  prompt="<doc_assignment>
type: testing
mode: {create|update}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update, else omit this line)}
wave_1_outputs:
  - README.md
  - ARCHITECTURE.md
  - CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Conditional Agent: API** (only if `has_api_routes` was true — spawn only if API.md was queued)

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate API.md for target project",
  prompt="<doc_assignment>
type: api
mode: {create|update}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update, else omit this line)}
wave_1_outputs:
  - README.md
  - ARCHITECTURE.md
  - CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Conditional Agent: DEPLOYMENT** (only if `has_deploy_config` was true — spawn only if DEPLOYMENT.md was queued)

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate DEPLOYMENT.md for target project",
  prompt="<doc_assignment>
type: deployment
mode: {create|update}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update, else omit this line)}
note: Apply VERIFY markers to any infrastructure claim not discoverable from the repository.
wave_1_outputs:
  - README.md
  - ARCHITECTURE.md
  - CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**Conditional Agent: CONTRIBUTING** (only if `is_open_source` was true — spawn only if CONTRIBUTING.md was queued)

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate CONTRIBUTING.md for target project",
  prompt="<doc_assignment>
type: contributing
mode: {create|update}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update, else omit this line)}
wave_1_outputs:
  - README.md
  - ARCHITECTURE.md
  - CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**CRITICAL:** Agent prompts must contain ONLY the `<doc_assignment>` block, the `${AGENT_SKILLS}` variable, and the return instruction. Do not include project planning context, workflow prose, or any internal tooling references in agent prompts.

Continue to collect_wave_2.
</step>

<step name="collect_wave_2">
Wait for all Wave 2 agents to complete using the TaskOutput tool.

Call TaskOutput for all Wave 2 agents in parallel (single message with N TaskOutput calls — one per spawned Wave 2 agent):

```
TaskOutput tool:
  task_id: "{task_id from GETTING-STARTED agent result}"
  block: true
  timeout: 300000

TaskOutput tool:
  task_id: "{task_id from DEVELOPMENT agent result}"
  block: true
  timeout: 300000

TaskOutput tool:
  task_id: "{task_id from TESTING agent result}"
  block: true
  timeout: 300000

# Add one TaskOutput call per conditional agent spawned (API, DEPLOYMENT, CONTRIBUTING)
```

**After collection, verify all Wave 2 files exist on disk:**
```bash
ls -la GETTING-STARTED.md DEVELOPMENT.md TESTING.md 2>/dev/null
# Also check conditional docs if they were queued:
# ls -la API.md DEPLOYMENT.md CONTRIBUTING.md 2>/dev/null
```

If any agent failed or its file is missing, note the failure and continue. Missing docs will be reported in the final report.

Continue to commit_docs.
</step>

<step name="sequential_generation" condition="Task tool is NOT available (e.g. Antigravity, Gemini CLI, Codex, Copilot)">
When the `Task` tool is unavailable, generate docs sequentially in the current context. This step replaces dispatch_wave_1, collect_wave_1, dispatch_wave_2, and collect_wave_2.

**IMPORTANT:** Do NOT use `browser_subagent`, `Explore`, or any browser-based tool. Use only file system tools (Read, Bash, Write, Grep, Glob, or equivalent tools available in your runtime).

Read `agents/gsd-doc-writer.md` instructions once before beginning. Follow the create_mode or update_mode instructions from that agent for each doc, using the same doc_assignment fields as the parallel path.

**Wave 1 (sequential — complete all three before starting Wave 2):**

For each Wave 1 doc, construct the equivalent doc_assignment block and generate the file inline:

1. **README** — mode from resolve_modes; for update mode, include existing_content
   - Construct doc_assignment: `type: readme`, `mode: {create|update}`, `project_context: {INIT JSON}`, `existing_content:` (if update)
   - Explore the codebase (Read, Grep, Glob, Bash) following gsd-doc-writer create_mode / update_mode instructions
   - Write the file to the resolved path (README.md)

2. **ARCHITECTURE** — mode from resolve_modes; for update mode, include existing_content
   - Construct doc_assignment: `type: architecture`, `mode: {create|update}`, `project_context: {INIT JSON}`, `existing_content:` (if update)
   - Explore the codebase following gsd-doc-writer instructions
   - Write the file to the resolved path (ARCHITECTURE.md or docs/ARCHITECTURE.md)

3. **CONFIGURATION** — mode from resolve_modes; for update mode, include existing_content
   - Construct doc_assignment: `type: configuration`, `mode: {create|update}`, `project_context: {INIT JSON}`, `existing_content:` (if update)
   - Apply VERIFY markers to any infrastructure claim not discoverable from the repository
   - Explore the codebase following gsd-doc-writer instructions
   - Write the file to the resolved path (CONFIGURATION.md or docs/CONFIGURATION.md)

**Wave 2 (sequential — begin only after all Wave 1 docs are written):**

Wave 2 docs can reference Wave 1 outputs since they are already written. Include `wave_1_outputs` in each doc_assignment.

4. **GETTING-STARTED** — mode from resolve_modes; include wave_1_outputs: [README.md, ARCHITECTURE.md, CONFIGURATION.md]
5. **DEVELOPMENT** — mode from resolve_modes; include wave_1_outputs
6. **TESTING** — mode from resolve_modes; include wave_1_outputs
7. **API** (only if queued) — mode from resolve_modes; include wave_1_outputs
8. **DEPLOYMENT** (only if queued) — Apply VERIFY markers to any infrastructure claim not discoverable from the repository; include wave_1_outputs
9. **CONTRIBUTING** (only if queued) — mode from resolve_modes; include wave_1_outputs

Continue to commit_docs.
</step>

<step name="commit_docs">
Only run this step if `commit_docs` is `true` from the init JSON. If `commit_docs` is false, skip to report.

Assemble the list of files that were actually generated (do not include files that failed or were skipped):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: generate project documentation" \
  --files README.md ARCHITECTURE.md CONFIGURATION.md GETTING-STARTED.md DEVELOPMENT.md TESTING.md
# Append any conditional docs that were generated:
# --files ... API.md DEPLOYMENT.md CONTRIBUTING.md
```

Only include files that were successfully written to disk. Do not include failed or skipped docs.

Continue to report.
</step>

<step name="report">
Present a completion summary to the user.

**Summary format:**

```
Documentation generation complete.

Project type: {primary_type}

Generated docs:
| File                | Mode   | Lines |
|---------------------|--------|-------|
| README.md           | create | 87    |
| ARCHITECTURE.md     | update | 124   |
| GETTING-STARTED.md  | create | 63    |
| DEVELOPMENT.md      | create | 71    |
| TESTING.md          | create | 58    |
| CONFIGURATION.md    | create | 45    |
[conditional docs if generated]

{If any docs failed or were skipped:}
Skipped / failed:
  - API.md: agent did not complete

{If DEPLOYMENT.md or CONFIGURATION.md were generated:}
VERIFY markers: {N} markers placed in DEPLOYMENT.md and/or CONFIGURATION.md for infrastructure claims that require manual verification.

{If commit_docs was true:}
All generated files committed.
```

Remind the user they can fact-check generated docs:

```
Run `/gsd:docs-update --verify-only` to fact-check generated docs against the codebase.
```

End workflow.
</step>

</process>

<success_criteria>
- [ ] docs-init JSON loaded and all fields extracted
- [ ] Project type correctly classified from project_type signals
- [ ] Doc queue contains all always-on docs plus only the conditional docs matching project signals
- [ ] CHANGELOG.md was NOT generated or queued
- [ ] Each doc was generated in correct mode (create for new, update for existing)
- [ ] Wave 1 docs (README, ARCHITECTURE, CONFIGURATION) completed before Wave 2 started
- [ ] Generated docs contain zero GSD methodology content
- [ ] DEPLOYMENT.md and CONFIGURATION.md use VERIFY markers for undiscoverable claims (if generated)
- [ ] All generated files committed (if commit_docs is true)
</success_criteria>
