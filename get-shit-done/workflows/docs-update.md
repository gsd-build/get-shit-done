<purpose>
Generate, update, and verify all project documentation — both canonical doc types and existing hand-written docs. The orchestrator detects the project's doc structure, assembles a work manifest tracking every item, dispatches parallel doc-writer and doc-verifier agents across waves, reviews existing docs for accuracy, identifies documentation gaps, and fixes inaccuracies via a bounded fix loop. All state is persisted in a work manifest so no work item is lost between steps. Output: Complete, structure-aware documentation verified against the live codebase.
</purpose>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd-doc-writer — Writes and updates project documentation files
- gsd-doc-verifier — Verifies factual claims in docs against the live codebase
</available_agent_types>

<process>

<step name="init_context" priority="first">
Load docs-update context:

```bash
INIT=$(gsd-sdk query docs-init)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS=$(gsd-sdk query agent-skills gsd-doc-writer 2>/dev/null)
```

Extract from init JSON:
- `doc_writer_model` — model string to pass to each spawned agent (never hardcode a model name)
- `commit_docs` — whether to commit generated files when done
- `existing_docs` — array of `{path, has_gsd_marker}` objects for existing Markdown files
- `project_type` — object with boolean signals: `has_package_json`, `has_api_routes`, `has_cli_bin`, `is_open_source`, `has_deploy_config`, `is_monorepo`, `has_tests`
- `doc_tooling` — object with booleans: `docusaurus`, `vitepress`, `mkdocs`, `storybook`
- `monorepo_workspaces` — array of workspace glob patterns (empty if not a monorepo)
- `project_root` — absolute path to the project root
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

**CONTRIBUTING.md confirmation (new file only):**

If CONTRIBUTING.md is in the conditional queue AND does NOT appear in the `existing_docs` array from init JSON:

1. If `--force` is present in `$ARGUMENTS`: skip this check, include CONTRIBUTING.md in the queue.

**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
2. Otherwise, use AskUserQuestion to confirm:

```
AskUserQuestion([{
  question: "This project appears to be open source (LICENSE file detected). CONTRIBUTING.md does not exist yet. Would you like to create one?",
  header: "Contributing",
  multiSelect: false,
  options: [
    { label: "Yes, create it", description: "Generate CONTRIBUTING.md with project guidelines" },
    { label: "No, skip it", description: "This project does not need a CONTRIBUTING.md" }
  ]
}])
```

If the user selects "No, skip it": remove CONTRIBUTING.md from the doc queue.
If CONTRIBUTING.md already exists in `existing_docs`: skip this prompt entirely, include it for update.

**Existing non-canonical docs (review queue):**

After assembling the canonical doc queue above, scan the `existing_docs` array from init JSON for files that do NOT match any canonical path in the queue (neither primary nor fallback path from the resolve_modes table). These are hand-written docs like `docs/api/endpoint-map.md` or `docs/frontend/pages/not-found.md`.

For each non-canonical existing doc found:
- Add to a separate `review_queue`
- These will be passed to gsd-doc-verifier in the verify_docs step for accuracy checking
- If inaccuracies are found, they will be dispatched to gsd-doc-writer in `fix` mode for surgical corrections

If non-canonical docs are found, display them in the queue presentation:

```
Existing docs queued for accuracy review:
  - docs/api/endpoint-map.md (hand-written)
  - docs/api/README.md (hand-written)
  - docs/frontend/pages/not-found.md (hand-written)
```

If none found, omit this section from the queue presentation.

**Documentation gap detection (missing non-canonical docs):**

After assembling the canonical and review queues, analyze the codebase to identify areas that should have documentation but don't. This ensures the command creates complete project documentation, not just the 9 canonical types.

1. **Scan the codebase for undocumented areas:**
   - Use Glob/Grep to discover significant source directories (e.g., `src/components/`, `src/pages/`, `src/services/`, `src/api/`, `lib/`, `routes/`)
   - Compare against existing docs: for each major source directory, check if corresponding documentation exists in the docs tree
   - Look at the project's existing doc structure for patterns — if the project has `docs/frontend/components/`, `docs/services/`, etc., these indicate the project's documentation conventions

2. **Identify gaps based on project conventions:**
   - If the project has a `docs/` directory with grouped subdirectories, each source module area that has a corresponding docs subdirectory but is missing documentation files represents a gap
   - If the project has frontend components/pages but no component docs, flag this
   - If the project has service modules but no service docs, flag this
   - Skip areas that are already covered by canonical docs (e.g., don't flag missing API docs if `docs/API.md` is already in the canonical queue)

3. **Present discovered gaps to the user:**

```
AskUserQuestion([{
  question: "Found {N} documentation gaps in the codebase. Which should be created?",
  header: "Doc gaps",
  multiSelect: true,
  options: [
    { label: "{area}", description: "{why it needs docs — e.g., '5 components in src/components/ with no docs'}" },
    ...up to 4 options (group related gaps if more than 4)
  ]
}])
```

4. For each gap the user selects:
   - Add to the generation queue with mode = `"create"`
   - Set the output path to match the project's existing doc directory structure
   - The gsd-doc-writer will receive a `doc_assignment` with `type: "custom"` and a description of what to document, using the project's source files as content discovery targets

If no gaps are detected, omit this section entirely.

Present the assembled queue to the user before proceeding:

Present the mode resolution table from resolve_modes (shown above), followed by:

```
{If non-canonical docs found, show as a table:}

Existing docs queued for accuracy review:

| Path | Type |
|------|------|
| {path} | hand-written |
| ... | ... |

CHANGELOG.md: excluded (out of scope)
```

The mode resolution table IS the queue presentation — it shows every doc with its resolved path, mode, and source. Do not duplicate the list in a separate format.

Then confirm with AskUserQuestion:

```
AskUserQuestion([{
  question: "Doc queue assembled ({N} docs). Proceed with generation?",
  header: "Doc queue",
  multiSelect: false,
  options: [
    { label: "Proceed", description: "Generate all {N} docs in the queue" },
    { label: "Abort", description: "Cancel doc generation" }
  ]
}])
```

If the user selects "Abort": exit the workflow. Otherwise continue to resolve_modes.
</step>

<step name="resolve_modes">
For each doc in the assembled queue, determine whether to create (new file) or update (existing file).

**Doc type to canonical path mapping (defaults):**

| Type | Default Path | Fallback Path |
|------|-------------|---------------|
| `readme` | `README.md` | — |
| `architecture` | `docs/ARCHITECTURE.md` | `ARCHITECTURE.md` |
| `getting_started` | `docs/GETTING-STARTED.md` | `GETTING-STARTED.md` |
| `development` | `docs/DEVELOPMENT.md` | `DEVELOPMENT.md` |
| `testing` | `docs/TESTING.md` | `TESTING.md` |
| `api` | `docs/API.md` | `API.md` |
| `configuration` | `docs/CONFIGURATION.md` | `CONFIGURATION.md` |
| `deployment` | `docs/DEPLOYMENT.md` | `DEPLOYMENT.md` |
| `contributing` | `CONTRIBUTING.md` | — |

**Structure-aware path resolution:**

Before applying the default path table, inspect the project's existing docs directory structure to detect whether the project uses **grouped subdirectories** or **flat files**. This determines how ALL new docs are placed.

**Step 1: Detect the project's docs organization pattern.**

List subdirectories under `docs/` from the `existing_docs` paths. If the project has 2+ subdirectories (e.g., `docs/architecture/`, `docs/api/`, `docs/guides/`, `docs/frontend/`), the project uses a **grouped structure**. If docs are only flat files directly in `docs/` (e.g., `docs/ARCHITECTURE.md`), it uses a **flat structure**.

**Step 2: Resolve paths based on the detected pattern.**

**If GROUPED structure detected:**

Every doc type MUST be placed in an appropriate subdirectory — no doc should be left flat in `docs/` when the project organizes into groups. Use the following resolution logic:

| Type | Subdirectory resolution (in priority order) |
|------|----------------------------------------------|
| `architecture` | existing `docs/architecture/` → create `docs/architecture/` if not present |
| `getting_started` | existing `docs/guides/` → existing `docs/getting-started/` → create `docs/guides/` |
| `development` | existing `docs/guides/` → existing `docs/development/` → create `docs/guides/` |
| `testing` | existing `docs/testing/` → existing `docs/guides/` → create `docs/testing/` |
| `api` | existing `docs/api/` → create `docs/api/` if not present |
| `configuration` | existing `docs/configuration/` → existing `docs/guides/` → create `docs/configuration/` |
| `deployment` | existing `docs/deployment/` → existing `docs/guides/` → create `docs/deployment/` |

For each type, check the resolution chain left-to-right. Use the first existing subdirectory. If none exist, create the rightmost option.

The filename within the subdirectory should be contextual — e.g., `docs/guides/getting-started.md`, `docs/architecture/overview.md`, `docs/api/reference.md` — rather than `docs/architecture/ARCHITECTURE.md`. Match the naming style of existing files in that subdirectory (lowercase-kebab, UPPERCASE, etc.).

**If FLAT structure detected (or no docs/ directory):**

Use the default path table above as-is (e.g., `docs/ARCHITECTURE.md`, `docs/TESTING.md`).

**Step 3: Store each resolved path and create directories.**

For each doc type, store the resolved path as `resolved_path`. Then create all necessary directories:
```bash
mkdir -p {each unique directory from resolved paths}
```

**Mode resolution logic:**

For each doc type in the queue:
1. Check if the `resolved_path` appears in the `existing_docs` array from the init JSON
2. If not found at resolved path, check the default and fallback paths from the table
3. If found at any path: mode = `"update"` — use the Read tool to load the current file content (will be passed as `existing_content` in the doc_assignment block). Use the found path as the output path (do not move existing docs).
4. If not found: mode = `"create"` — no existing content to load. Use the `resolved_path`.

**Ensure docs/ directory exists:**
Before proceeding to the next step, create the `docs/` directory and any resolved subdirectories if they do not exist:
```bash
mkdir -p docs/
```

**Output a mode resolution table:**

Present a table showing the resolved path, mode, and source for every doc in the queue:

```
Mode resolution:

| Doc | Resolved Path | Mode | Source |
|-----|---------------|------|--------|
| readme | README.md | update | found at README.md |
| architecture | docs/architecture/overview.md | create | new directory |
| getting_started | docs/guides/getting-started.md | update | found, hand-written |
| development | docs/guides/development.md | create | matched docs/guides/ |
| testing | docs/guides/testing.md | create | matched docs/guides/ |
| configuration | docs/guides/configuration.md | create | matched docs/guides/ |
| api | docs/api/reference.md | create | new directory |
| deployment | docs/guides/deployment.md | update | found, hand-written |
```

This table MUST be shown to the user — it is the primary confirmation of where files will be written and whether existing files will be updated. It appears as part of the queue presentation BEFORE the AskUserQuestion confirmation.

Track the resolved mode and file path for each queued doc. For update-mode docs, store the loaded file content — it will be passed to the agent in the next steps.

**CRITICAL: Persist the work manifest.**

After resolve_modes completes, write ALL work items to `.planning/tmp/docs-work-manifest.json`. This is the single source of truth for every subsequent step — the orchestrator MUST read this file at each step instead of relying on memory.

```bash
mkdir -p .planning/tmp
```

Write the manifest using the Write tool:

```json
{
  "canonical_queue": [
    {
      "type": "readme",
      "resolved_path": "README.md",
      "mode": "create|update|supplement",
      "preservation_mode": null,
      "wave": 1,
      "status": "pending"
    }
  ],
  "review_queue": [
    {
      "path": "docs/frontend/components/button.md",
      "type": "hand-written",
      "status": "pending_review"
    }
  ],
  "gap_queue": [
    {
      "description": "Frontend components in src/components/",
      "output_path": "docs/frontend/components/overview.md",
      "status": "pending"
    }
  ],
  "created_at": "{ISO timestamp}"
}
```

Every subsequent step (dispatch, collect, verify, fix_loop, report) MUST begin by reading `.planning/tmp/docs-work-manifest.json` and update the `status` field for items it processes. This prevents the orchestrator from "forgetting" any work item across the multi-step workflow.
</step>

<step name="preservation_check">
Check for hand-written docs in the queue and gather user decisions before dispatch.

**Skip conditions (check in order):**

1. If `--force` is present in `$ARGUMENTS`: treat all docs as mode: regenerate, skip to detect_runtime_capabilities.
2. If `--verify-only` is present in `$ARGUMENTS`: skip to verify_only_report (do not continue to detect_runtime_capabilities).
3. If no docs in the queue have `has_gsd_marker: false` in the `existing_docs` array: skip to detect_runtime_capabilities.

**For each queued doc where `has_gsd_marker` is false (hand-written doc detected):**

Present the following choice using `AskUserQuestion` if available, or inline prompt otherwise:

```
{filename} appears to be hand-written (no GSD marker found).

How should this file be handled?
  [1] preserve    -- Skip entirely. Leave unchanged.
  [2] supplement  -- Append only missing sections. Existing content untouched.
  [3] regenerate  -- Overwrite with a fresh GSD-generated doc.
```

Record each decision. Update the doc queue:
- `preserve` decisions: remove the doc from the queue entirely
- `supplement` decisions: set mode to `supplement` in the doc_assignment block; include `existing_content` (full file content)
- `regenerate` decisions: set mode to `create` (treat as a fresh write)

**Fallback when AskUserQuestion is unavailable:** Default all hand-written docs to `preserve` (safest default). Display message:

```
AskUserQuestion unavailable — hand-written docs preserved by default.
Use --force to regenerate all docs, or re-run in Claude Code to get per-file prompts.
```

After all decisions recorded, continue to detect_runtime_capabilities.
</step>

<!-- If Task tool is unavailable at runtime, skip dispatch/collect waves and use sequential_generation instead. -->

<step name="dispatch_wave_1" condition="Task tool is available">
**Read the work manifest first:** `Read .planning/tmp/docs-work-manifest.json` — use `canonical_queue` items with `wave: 1` for this step.

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
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
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
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
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
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
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
**Read the work manifest first:** `Read .planning/tmp/docs-work-manifest.json` — update `status` to `"completed"` or `"failed"` for each Wave 1 item after collection. Write the updated manifest back to disk.

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

**After collection, verify the Wave 1 files exist on disk** using the `resolved_path` from each manifest entry:
```bash
ls -la {resolved_path_1} {resolved_path_2} {resolved_path_3} 2>/dev/null
```

If any agent failed or its file is missing:
- Note the failure
- Continue with the successful docs (do NOT halt Wave 2 for a single failure)
- The missing doc will be noted in the final report

Continue to dispatch_wave_2.
</step>

<step name="dispatch_wave_2" condition="Task tool is available">
**Read the work manifest first:** `Read .planning/tmp/docs-work-manifest.json` — use `canonical_queue` items with `wave: 2` for this step.

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
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
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
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
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
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
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
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
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
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
note: Apply VERIFY markers to any infrastructure claim not discoverable from the repository.
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
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
mode: {create|update|supplement}
preservation_mode: {preserve|supplement|regenerate|null}
project_context: {INIT JSON}
{existing_content: | (include full file content here if mode is update or supplement, else omit this line)}
wave_1_outputs:
  - README.md
  - docs/ARCHITECTURE.md
  - docs/CONFIGURATION.md
</doc_assignment>

{AGENT_SKILLS}

Write the doc file directly. Return confirmation only — do not return doc content."
)
```

**CRITICAL:** Agent prompts must contain ONLY the `<doc_assignment>` block, the `${AGENT_SKILLS}` variable, and the return instruction. Do not include project planning context, workflow prose, or any internal tooling references in agent prompts.

Continue to collect_wave_2.
</step>

<step name="collect_wave_2">
**Read the work manifest first:** `Read .planning/tmp/docs-work-manifest.json` — update `status` to `"completed"` or `"failed"` for each Wave 2 item after collection. Write the updated manifest back to disk.

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

**After collection, verify all Wave 2 files exist on disk** using the `resolved_path` from each manifest entry:
```bash
ls -la {resolved_path for each wave 2 item} 2>/dev/null
```

If any agent failed or its file is missing, note the failure and continue. Missing docs will be reported in the final report.

Continue to dispatch_monorepo_packages (if monorepo_workspaces is non-empty) or commit_docs.
</step>

<step name="dispatch_monorepo_packages" condition="monorepo_workspaces is non-empty">
After Wave 2 collection, generate per-package READMEs for each monorepo workspace.

**Condition:** Only run this step if `monorepo_workspaces` from the init JSON is non-empty.

**Resolve workspace packages from glob patterns:**

```bash
# Expand workspace globs to actual package directories
for pattern in {monorepo_workspaces}; do
  ls -d $pattern 2>/dev/null
done
```

**For each resolved directory that contains a `package.json`:**

Determine mode:
- If `{package_dir}/README.md` exists: mode = `update`, read existing content
- Else: mode = `create`

Spawn a `gsd-doc-writer` agent with `run_in_background=true`:

```
Task(
  subagent_type="gsd-doc-writer",
  model="{doc_writer_model}",
  run_in_background=true,
  description="Generate per-package README for {package_dir}",
  prompt="<doc_assignment>
type: readme
mode: {create|update}
scope: per_package
package_dir: {absolute path to package directory}
project_context: {INIT JSON with project_root set to package directory}
{existing_content: | (include full README.md content here if mode is update, else omit)}
</doc_assignment>

{AGENT_SKILLS}

Write {package_dir}/README.md directly. Return confirmation only — do not return doc content."
)
```

Collect confirmations via TaskOutput for all package agents. Note failures in the final report.

**Fallback when Task tool is unavailable:** Generate per-package READMEs sequentially inline after the `sequential_generation` step. For each package directory with a `package.json`, construct the equivalent `doc_assignment` block and generate the README following gsd-doc-writer instructions.

Continue to commit_docs.
</step>

<step name="sequential_generation" condition="Task tool is NOT available (e.g. Antigravity, Gemini CLI, Codex, Copilot)">
**Read the work manifest first:** `Read .planning/tmp/docs-work-manifest.json` — use `canonical_queue` items for generation order. Update `status` after each doc is generated. Write the updated manifest back to disk after all docs are complete.

When the `Task` tool is unavailable, generate docs sequentially in the current context. This step replaces dispatch_wave_1, collect_wave_1, dispatch_wave_2, and collect_wave_2.

**IMPORTANT:** Do NOT use `browser_subagent`, `Explore`, or any browser-based tool. Use only file system tools (Read, Bash, Write, Grep, Glob, or equivalent tools available in your runtime).

Read `agents/gsd-doc-writer.md` instructions once before beginning. Follow the create_mode or update_mode instructions from that agent for each doc, using the same doc_assignment fields as the parallel path.

**Wave 1 (sequential — complete all three before starting Wave 2):**

For each Wave 1 doc, construct the equivalent doc_assignment block and generate the file inline:

1. **README** — mode from resolve_modes; for update/supplement mode, include existing_content
   - Construct doc_assignment: `type: readme`, `mode: {create|update|supplement}`, `preservation_mode: {value|null}`, `project_context: {INIT JSON}`, `existing_content:` (if update/supplement)
   - Explore the codebase (Read, Grep, Glob, Bash) following gsd-doc-writer create_mode / update_mode instructions
   - Write the file to the resolved path (README.md)

2. **ARCHITECTURE** — mode from resolve_modes; for update/supplement mode, include existing_content
   - Construct doc_assignment: `type: architecture`, `mode: {create|update|supplement}`, `preservation_mode: {value|null}`, `project_context: {INIT JSON}`, `existing_content:` (if update/supplement)
   - Explore the codebase following gsd-doc-writer instructions
   - Write the file to the resolved path (docs/ARCHITECTURE.md, or ARCHITECTURE.md if found at root as fallback)

3. **CONFIGURATION** — mode from resolve_modes; for update/supplement mode, include existing_content
   - Construct doc_assignment: `type: configuration`, `mode: {create|update|supplement}`, `preservation_mode: {value|null}`, `project_context: {INIT JSON}`, `existing_content:` (if update/supplement)
   - Apply VERIFY markers to any infrastructure claim not discoverable from the repository
   - Explore the codebase following gsd-doc-writer instructions
   - Write the file to the resolved path (docs/CONFIGURATION.md, or CONFIGURATION.md if found at root as fallback)

**Wave 2 (sequential — begin only after all Wave 1 docs are written):**

Wave 2 docs can reference Wave 1 outputs since they are already written. Include `wave_1_outputs` in each doc_assignment.

4. **GETTING-STARTED** — mode from resolve_modes; include wave_1_outputs: [README.md, docs/ARCHITECTURE.md, docs/CONFIGURATION.md]
5. **DEVELOPMENT** — mode from resolve_modes; include wave_1_outputs
6. **TESTING** — mode from resolve_modes; include wave_1_outputs
7. **API** (only if queued) — mode from resolve_modes; include wave_1_outputs
8. **DEPLOYMENT** (only if queued) — Apply VERIFY markers to any infrastructure claim not discoverable from the repository; include wave_1_outputs
9. **CONTRIBUTING** (only if queued) — mode from resolve_modes; include wave_1_outputs

**Monorepo per-package READMEs (only if `monorepo_workspaces` is non-empty):**

After all 9 root-level docs are written, generate per-package READMEs sequentially:

For each resolved package directory (from workspace glob expansion) that contains a `package.json`:
- Determine mode: if `{package_dir}/README.md` exists, mode = `update`; else mode = `create`
- Construct doc_assignment: `type: readme`, `mode: {create|update}`, `scope: per_package`, `package_dir: {absolute path}`, `project_context: {INIT JSON with project_root set to package directory}`, `existing_content:` (if update)
- Follow gsd-doc-writer instructions for per_package scope
- Write the file to `{package_dir}/README.md`

Continue to verify_docs.
</step>

<step name="verify_docs">
Verify factual claims in ALL docs — both canonical (generated) and non-canonical (existing hand-written) — against the live codebase.

**CRITICAL: Read the work manifest first.**

```
Read .planning/tmp/docs-work-manifest.json
```

Extract `canonical_queue` (items with `status: "completed"`) and `review_queue` (items with `status: "pending_review"`). Both queues are verified in this step.

**Skip condition:** If `--verify-only` is present in `$ARGUMENTS`, this step was already handled by `verify_only_report` (early exit). Skip.

**Phase 1: Verify canonical docs (generated/updated docs)**

For each doc in `canonical_queue` that was successfully written to disk:

1. Spawn the `gsd-doc-verifier` agent (or invoke sequentially if Task tool is unavailable) with a `<verify_assignment>` block:
   ```xml
   <verify_assignment>
   doc_path: {relative path to the doc file, e.g. README.md}
   project_root: {project_root from init JSON}
   </verify_assignment>
   ```

2. After the verifier completes, read the result JSON from `.planning/tmp/verify-{doc_filename}.json`.

3. Update the manifest: set `status: "verified"` for each canonical doc processed.

**Phase 2: Verify non-canonical docs (existing hand-written docs)**

This is NOT optional. Every doc in `review_queue` MUST be verified.

For each doc in `review_queue` from the manifest:

1. Spawn the `gsd-doc-verifier` agent with the same `<verify_assignment>` block as above.
2. Read the result JSON from `.planning/tmp/verify-{doc_filename}.json`.
3. Update the manifest: set `status: "verified"` for each review_queue doc processed.

Non-canonical docs with failures ARE eligible for the fix_loop. When a non-canonical doc has `claims_failed > 0`, dispatch it to gsd-doc-writer in `fix` mode with the failures array — the writer's fix mode does surgical corrections on specific lines regardless of doc type (no template needed). The writer MUST NOT restructure, rephrase, or reformat any content beyond the failing claims.

**Phase 3: Present combined verification summary**

Collect ALL results (canonical + non-canonical) into a single `verification_results` array:

```
Verification results:

Canonical docs (generated):

| Doc                    | Claims | Passed | Failed |
|------------------------|--------|--------|--------|
| README.md              | 12     | 10     | 2      |
| docs/architecture/overview.md | 8 | 8   | 0      |

Existing docs (reviewed):

| Doc                    | Claims | Passed | Failed |
|------------------------|--------|--------|--------|
| docs/frontend/components/button.md | 5 | 4 | 1   |
| docs/services/api.md   | 8      | 8      | 0      |

Total: {total_checked} claims checked, {total_failed} failures
```

Write the updated manifest back to disk.

If all docs have `claims_failed === 0`: skip fix_loop, continue to scan_for_secrets.
If any doc (canonical OR non-canonical) has `claims_failed > 0`: continue to fix_loop.
</step>

<step name="fix_loop">
**Read the work manifest first:** `Read .planning/tmp/docs-work-manifest.json` — identify ALL docs (canonical AND non-canonical) with `claims_failed > 0` from the verification results in `.planning/tmp/verify-*.json`. Both queues are eligible for fixes.

Correct flagged inaccuracies by re-sending failing docs to the doc-writer in fix mode. Per D-06, max 2 iterations. Per D-05, halt immediately on regression.

**Skip condition:** If all docs passed verification (no failures), skip this step.

**Iteration tracking:**
- `MAX_FIX_ITERATIONS = 2`
- `iteration = 0`
- `previous_passed_docs` = set of doc_paths where claims_failed === 0 after initial verification

**For each iteration (while iteration < MAX_FIX_ITERATIONS and there are docs with failures):**

1. For each doc with `claims_failed > 0` in the latest verification_results:
   a. Read the current file content from disk.
   b. Spawn `gsd-doc-writer` agent (or invoke sequentially) with a fix assignment:
      ```xml
      <doc_assignment>
      type: {original doc type from the queue, e.g. readme}
      mode: fix
      doc_path: {relative path}
      project_context: {INIT JSON}
      existing_content: {current file content read from disk}
      failures:
        - line: {line}
          claim: "{claim}"
          expected: "{expected}"
          actual: "{actual}"
      </doc_assignment>
      ```
   c. One agent spawn per doc with failures. Do not batch multiple docs into one spawn.

2. After all fix agents complete, re-verify ALL docs (not just the ones that were fixed):
   - Re-run the same verification process as verify_docs step.
   - Read updated result JSONs from `.planning/tmp/verify-{doc_filename}.json`.

3. **Regression detection (D-05):**
   For each doc in the new verification_results:
   - If this doc was in `previous_passed_docs` (passed in the prior round) AND now has `claims_failed > 0`, this is a REGRESSION.
   - If regression detected: HALT the loop immediately. Present:
     ```
     REGRESSION DETECTED -- halting fix loop.

     {doc_path} previously passed verification but now has {claims_failed} failures after fix iteration {iteration + 1}.

     This means the fix introduced new errors. Remaining failures require manual review.
     ```
     Continue to scan_for_secrets (do not attempt further fixes).

4. Update `previous_passed_docs` with docs that now pass.
5. Increment `iteration`.

**After loop exhaustion (iteration === MAX_FIX_ITERATIONS and failures remain):**

Present remaining failures:
```
Fix loop completed ({MAX_FIX_ITERATIONS} iterations). Remaining failures:

| Doc               | Failed Claims |
|-------------------|---------------|
| {doc_path}        | {count}       |

These failures require manual correction. Review the verification output in .planning/tmp/verify-*.json for details.
```

Continue to scan_for_secrets.
</step>

<step name="verify_only_report">
**Reached when `--verify-only` is present in `$ARGUMENTS`.** This is an early-exit step — do not proceed to dispatch, generation, commit, or report steps after this step.

Invoke the gsd-doc-verifier agent in read-only mode for each file in `existing_docs` from the init JSON:

1. For each doc in `existing_docs`:
   a. Spawn `gsd-doc-verifier` (or invoke sequentially if Task tool is unavailable) with:
      ```xml
      <verify_assignment>
      doc_path: {doc.path}
      project_root: {project_root from init JSON}
      </verify_assignment>
      ```
   b. Read the result JSON from `.planning/tmp/verify-{doc_filename}.json`.

2. Also count VERIFY markers in each doc: grep for `<!-- VERIFY:` in the file content.

Present a combined summary table:

```
--verify-only audit:

| File                     | Claims Checked | Passed | Failed | VERIFY Markers |
|--------------------------|----------------|--------|--------|----------------|
| README.md                | 12             | 10     | 2      | 0              |
| docs/ARCHITECTURE.md     | 8              | 8      | 0      | 0              |
| docs/CONFIGURATION.md    | 5              | 3      | 2      | 5              |
| ...                 | ...            | ...    | ...    | ...            |

Total: {total_checked} claims checked, {total_failed} failures, {total_markers} VERIFY markers requiring manual review
```

If any failures exist, show details:
```
Failed claims:
  README.md:34 - "src/cli/index.ts" (expected: file exists, actual: file not found)
  docs/CONFIGURATION.md:12 - "npm run deploy" (expected: script in package.json, actual: script not found)
```

Display note:
```
To fix failures automatically: /gsd:docs-update (runs generation + fix loop)
To regenerate all docs from scratch: /gsd:docs-update --force
```

Clean up temp files: remove `.planning/tmp/verify-*.json` files.

End workflow — do not proceed to any dispatch, commit, or report steps.
</step>

<step name="scan_for_secrets">
CRITICAL SECURITY CHECK: Scan all generated/updated doc files for accidentally leaked secrets before committing. Per D-07, this runs once after the fix loop completes, before commit_docs.

Build the file list from the generation queue -- include all docs that were written to disk (created, updated, supplemented, or fixed). Do not hardcode a static list; use the actual list of files that were generated or modified.

Run secret pattern detection:

```bash
# Check for common API key patterns in generated docs
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9_-]+|AKIA[A-Z0-9]{16}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.)' \
  {space-separated list of generated doc files} 2>/dev/null \
  && SECRETS_FOUND=true || SECRETS_FOUND=false
```

**If SECRETS_FOUND=true:**

```
SECURITY ALERT: Potential secrets detected in generated documentation!

Found patterns that look like API keys or tokens in:
{show grep output}

This would expose credentials if committed.

Action required:
1. Review the flagged lines above
2. Remove any real secrets from the doc files
3. Re-run /gsd:docs-update to regenerate clean docs
```

Then confirm with AskUserQuestion:

```
AskUserQuestion([{
  question: "Potential secrets detected in generated docs. How would you like to proceed?",
  header: "Security",
  multiSelect: false,
  options: [
    { label: "Safe to proceed", description: "I've reviewed the flagged lines — no real secrets, commit the docs" },
    { label: "Abort commit", description: "Skip committing — I'll clean up the docs first" }
  ]
}])
```

If the user selects "Abort commit": skip commit_docs and continue to report. If "Safe to proceed": continue to commit_docs.

**If SECRETS_FOUND=false:**

Continue to commit_docs.
</step>

<step name="commit_docs">
Only run this step if `commit_docs` is `true` from the init JSON. If `commit_docs` is false, skip to report.

Assemble the list of files that were actually generated (do not include files that failed or were skipped):

```bash
gsd-sdk query commit "docs: generate project documentation" \
  --files README.md docs/ARCHITECTURE.md docs/CONFIGURATION.md docs/GETTING-STARTED.md docs/DEVELOPMENT.md docs/TESTING.md
# Append any conditional docs that were generated:
# --files ... docs/API.md docs/DEPLOYMENT.md CONTRIBUTING.md
# Append per-package READMEs if monorepo dispatch ran:
# --files ... packages/core/README.md packages/cli/README.md
```

Only include files that were successfully written to disk. Do not include failed or skipped docs.

Continue to report.
</step>

<step name="report">
**Read the work manifest first:** `Read .planning/tmp/docs-work-manifest.json` — use the manifest to compile the complete report covering all canonical docs, review_queue results, and gap_queue results. The manifest is the source of truth for what was processed.

Present a completion summary to the user.

**Summary format:**

```
Documentation generation complete.

Project type: {primary_type}

Generated docs:
| File                     | Mode   | Lines |
|--------------------------|--------|-------|
| README.md                | create | 87    |
| docs/ARCHITECTURE.md     | update | 124   |
| docs/GETTING-STARTED.md  | create | 63    |
| docs/DEVELOPMENT.md      | create | 71    |
| docs/TESTING.md          | create | 58    |
| docs/CONFIGURATION.md    | create | 45    |
[conditional docs if generated]

{If monorepo per-package READMEs were generated:}
Per-package READMEs:
| Package             | Mode   | Lines |
|---------------------|--------|-------|
| packages/core       | create | 42    |
| packages/cli        | create | 38    |

{If any docs failed or were skipped:}
Skipped / failed:
  - docs/API.md: agent did not complete

{If preservation_check ran:}
Preservation decisions:
  - {filename}: {preserve|supplement|regenerate}

{If docs/DEPLOYMENT.md or docs/CONFIGURATION.md were generated:}
VERIFY markers: {N} markers placed in docs/DEPLOYMENT.md and/or docs/CONFIGURATION.md for infrastructure claims that require manual verification.

{If review_queue was non-empty:}

Existing doc accuracy review:

| Doc | Claims Checked | Passed | Failed | Fixed |
|-----|----------------|--------|--------|-------|
| docs/api/endpoint-map.md | 5 | 4 | 1 | 1 |

{For any remaining unfixed failures after fix_loop:}
Remaining inaccuracies could not be auto-corrected — manual review recommended for flagged items above.

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
- [ ] docs/DEPLOYMENT.md and docs/CONFIGURATION.md use VERIFY markers for undiscoverable claims (if generated)
- [ ] All generated files committed (if commit_docs is true)
- [ ] Hand-written docs (no GSD marker) prompted for preserve/supplement/regenerate before dispatch (unless --force)
- [ ] --force flag skipped preservation prompts and regenerated all docs
- [ ] --verify-only flag reported doc status without generating files
- [ ] Per-package READMEs generated for monorepo workspaces (if applicable)
- [ ] verify_docs step checked all generated docs against the live codebase
- [ ] fix_loop ran at most 2 iterations and halted on regression
- [ ] scan_for_secrets ran before commit and blocked on detected patterns
- [ ] --verify-only invokes gsd-doc-verifier for full fact-checking (not just VERIFY marker count)
</success_criteria>
