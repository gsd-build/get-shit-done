<purpose>
Load the target program's full context -- codebase maps, phase summaries, requirements, roadmap, and project state -- then present a structured onboarding summary. After onboarding, enter an interactive Q&A mode where the user can ask about architecture, data flows, design decisions, and what can be built next.

This is a READ-ONLY workflow. It does NOT write files, create plans, or modify any project state. If the user asks to change something, redirect to the appropriate command.

**Two modes:**
1. **Context loading and onboarding** (automatic on launch) -- Inventory all planning artifacts, synthesize architecture/stack/phases overview, highlight complete vs in-progress work, flag missing artifacts
2. **Interactive Q&A** (user-driven, after onboarding) -- Answer questions using loaded context and source code lookups
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="init_context" priority="first">
**Inventory the target project using gsd-tools:**

```bash
INIT=$(node C:/Users/connessn/.claude/get-shit-done/bin/gsd-tools.js init discuss-current --include codebase,requirements,project,roadmap,state)
```

Parse the returned JSON for:
- `project_exists` -- boolean, whether .planning/ directory exists
- `codebase_maps` -- `{ exists, files[], missing[] }` listing which map files are present
- `phase_summaries` -- array of `{ phase, directory, summaries[], verifications[], status }` per phase
- `requirements` -- `{ exists, path }` for REQUIREMENTS.md
- `project_md` -- `{ exists, path }` for PROJECT.md
- `roadmap` -- `{ exists, path }` for ROADMAP.md
- `state` -- `{ exists, path }` for STATE.md
- `stats` -- `{ total_phases, completed_phases, total_plans, total_summaries, codebase_map_count }`

**Content fields (from --include):**
- `codebase_contents` -- object mapping filename to content (e.g., `{ "ARCHITECTURE.md": "...", "STACK.md": "..." }`)
- `requirements_content` -- full text of REQUIREMENTS.md
- `project_content` -- full text of PROJECT.md
- `roadmap_content` -- full text of ROADMAP.md
- `state_content` -- full text of STATE.md

**If `project_exists` is false:**

Present this message and exit the workflow:

```
No GSD project found in current directory.

This command analyzes programs built with GSD.

**To get started:**
- `/gsd:new-project` -- initialize a new GSD project
- `/gsd:map-codebase` -- map an existing codebase first

**Current directory:** {cwd}
```

**If `project_exists` is true:** Continue to load_artifacts.
</step>

<step name="load_artifacts">
**Load detailed content from the inventory.**

All primary artifact contents are already loaded via the `--include` flags in init_context. This step enriches phase summary data.

**For phase summaries:** Use `summary-extract` to get structured data from each summary file.

For each phase in `phase_summaries` that has summary files:

```bash
node C:/Users/connessn/.claude/get-shit-done/bin/gsd-tools.js summary-extract {directory}/{summary-filename} --fields one_liner,completed,key-decisions
```

Collect the results into a structured array:
```
phase_details = [
  {
    phase: "01-foundation",
    status: "complete",
    one_liner: "JWT auth with refresh rotation...",
    decisions: [...],
    completed: "2025-01-15"
  },
  ...
]
```

If a summary-extract call fails (malformed file, missing fields), log the error internally and continue with partial data. Do not stop the workflow.

**For codebase maps:** Content is already in `codebase_contents` from init. Extract key sections from each map:

- From ARCHITECTURE.md: system overview, key architectural patterns, component relationships
- From STACK.md: languages, frameworks, key libraries, runtime versions
- From CONCERNS.md: known issues, technical debt, risk areas
- From CONVENTIONS.md: coding patterns, naming conventions (brief summary only)
- From STRUCTURE.md: directory layout, project organization
- From INTEGRATIONS.md: external services, APIs, third-party dependencies
- From TESTING.md: test approach, frameworks, coverage strategy

If a map file is missing, note it in the availability report (step 3) -- do not fail.

**For requirements, project, roadmap, state:** Content already loaded via `--include`. No additional reads needed.
</step>

<step name="check_availability">
**Build an availability report for all artifact categories.**

Assess what was successfully loaded and what is missing. This feeds into the onboarding presentation (step 5 will show what is available and note what is missing).

Build this structure internally:

```
available = {
  codebase_maps: {
    found: ["ARCHITECTURE.md", "STACK.md", ...],
    missing: ["CONCERNS.md", ...]
  },
  summaries: {
    found: ["01-foundation", "02-api", ...],
    missing_phases: []  // phases with no summaries
  },
  requirements: true/false,
  project: true/false,
  roadmap: true/false,
  state: true/false
}
```

**For summaries:** Cross-reference `phase_summaries` from init. Phases with `status: "pending"` or `status: "in_progress"` where no summaries exist are "missing" (but expected -- they have not been built yet). Phases with `status: "complete"` but no extractable data are noteworthy.

**For codebase maps:** Use the `codebase_maps.files` (found) and `codebase_maps.missing` arrays directly from init.

This availability data is used in step 5 to display a "Missing Artifacts" section at the bottom of the onboarding.
</step>

<step name="synthesize_onboarding">
**From the loaded artifacts, synthesize a structured onboarding brief.**

This is internal processing -- build the content that will be presented in step 5. Synthesize four sections:

**4a. Program Identity** (from PROJECT.md + STACK.md + ARCHITECTURE.md):

Extract from `project_content`:
- What this program IS (look for "What This Is" heading or first substantive paragraph)
- Core value proposition (look for "Core Value" or similar heading)

Extract from `codebase_contents["STACK.md"]` (if available):
- Languages and their versions
- Frameworks (frontend, backend, CLI)
- Key libraries and their purposes
- Runtime/platform details

Extract from `codebase_contents["ARCHITECTURE.md"]` (if available):
- Architecture pattern (monolith, microservice, serverless, CLI tool, pipeline, etc.)
- Key architectural patterns (event-driven, layered, plugin-based, etc.)
- Component relationships and data flow overview

If codebase maps are not available, infer what you can from PROJECT.md and ROADMAP.md. Note the inference in the presentation.

**4b. Build History** (from phase summary extracts + ROADMAP.md):

For each phase (from `roadmap_content` and `phase_details`):
- Phase number and name
- Status: complete / in-progress / pending
- One-liner summary (from summary-extract, or "Not yet built" for pending)
- Verification status (if verification files exist in phase data)

Group by milestone if `roadmap_content` contains multiple milestone sections.

Calculate totals:
- X phases complete
- Y in progress
- Z pending

**4c. Requirements Status** (from `requirements_content`):

Parse the requirements content for checked and unchecked items:
- Lines matching `- [x]` or `- [X]` are delivered
- Lines matching `- [ ]` are pending
- Group items by their section headings (##, ###)

Calculate: X/Y requirements delivered, Z pending.

If requirements file does not exist, note: "No REQUIREMENTS.md found. Use `/gsd:new-project` to define requirements."

**4d. Terminology** (generated dynamically -- ONBD-01):

Generate a terminology section that helps the user distinguish between:

**Target program concepts** -- terms from the program's domain. Extract these dynamically by scanning:
- `project_content`: Look for capitalized terms, product names, domain entities
- `codebase_contents["ARCHITECTURE.md"]`: Look for component names, service names, model/entity names
- `codebase_contents["CONVENTIONS.md"]`: Look for naming patterns, key abstractions
- `roadmap_content`: Look for feature names, capability names

Select 5-10 terms that are specific to THIS program (not generic programming terms).

**GSD pipeline concepts** -- terms from the build process. Include these standard entries:
- Phase: A major unit of work in the build pipeline
- Plan: A set of tasks within a phase, executed atomically
- Summary: Post-execution record of what a plan built
- Verification: User acceptance testing of phase deliverables
- Requirement: A testable behavior the program must satisfy
- Codebase map: Auto-generated documentation of architecture, stack, and patterns
- Milestone: A collection of phases toward a versioned release

Format as a reference table with Term, Domain (Program/GSD), and Meaning columns.

Do NOT hardcode target program terms. Extract them dynamically from the loaded artifacts.
</step>

<step name="present_onboarding">
**Present the synthesized onboarding to the user.**

Use this format:

```markdown
# {Program Name}

**{Core value proposition from PROJECT.md}**

## Architecture & Stack

{Tech stack summary: languages, frameworks, key libraries}
{Architecture pattern: monolith/microservice/CLI/pipeline/etc.}
{Key architectural patterns if available}
{Key concerns if CONCERNS.md exists and has notable items}

## What Was Built

| Phase | Status | Summary |
|-------|--------|---------|
| 1. {name} | Complete | {one-liner from summary} |
| 2. {name} | Complete | {one-liner from summary} |
| 3. {name} | In Progress | {one-liner or "Currently building"} |
| 4. {name} | Pending | Not yet built |

**{X} phases complete, {Y} in progress, {Z} pending**

## Requirements

### Delivered
- [x] {REQ-ID}: {description}
- [x] {REQ-ID}: {description}

### Pending
- [ ] {REQ-ID}: {description}
- [ ] {REQ-ID}: {description}

**{delivered}/{total} requirements shipped**

## Vocabulary

| Term | Domain | Meaning |
|------|--------|---------|
| {term} | Program | {what it means in this program} |
| {term} | Program | {what it means in this program} |
| {term} | GSD | {what it means in the build pipeline} |
| {term} | GSD | {what it means in the build pipeline} |

{If any artifacts were missing:}

---

**Note:** The following artifacts are not available:
- {missing item} -- {suggestion for how to generate it}
```

**Suggestions for missing artifacts:**
- Missing codebase maps: "Run `/gsd:map-codebase` to generate architecture, stack, and convention documentation"
- Missing requirements: "Define requirements with `/gsd:new-project` or create `.planning/REQUIREMENTS.md` manually"
- Missing roadmap: "Create a roadmap with `/gsd:new-milestone`"
- Missing phase summaries (for complete phases): "Phase appears complete but has no summary -- run `/gsd:execute-phase` to regenerate"

**After presenting onboarding, transition to interactive mode:**

```markdown
---

You now have full context on {Program Name}.

Ask me anything:
- "How does {feature from a completed phase} work?"
- "What's the data flow for {operation from architecture}?"
- "What requirements are still pending?"
- "Explain the {component} architecture"
- "What can I build from here?"

Type your question, or `/clear` to exit.
```
</step>

<step name="interactive_loop">
**After presenting the onboarding, the workflow enters an interactive Q&A mode.**

When the user asks a question, follow this process:

**1. Classify the question:**

Identify which category the user's question falls into:

- `how_it_works` -- "How does X work?", "What does X do?", "Explain the X system"
  Signals: questions about behavior, mechanism, implementation of a specific feature or component
- `data_flow` -- "How does data flow from X to Y?", "What calls what?", "Trace the X pipeline"
  Signals: questions about data movement, call chains, request/response lifecycle, pipeline stages
- `architecture` -- "What patterns does X use?", "Why is X structured this way?"
  Signals: questions about design patterns, structural decisions, component relationships, layering
- `status` -- "What requirements are done?", "What phase is X?"
  Signals: questions about progress, completion state, roadmap position
- `what_can_i_build` -- "What can I build from here?", "What are the extension points?"
  Signals: open-ended exploration questions about future possibilities, capabilities, growth directions
- `feature_impact` -- "If I add X, what would change?", "How would X affect the codebase?"
  Signals: user names a SPECIFIC feature and asks about its impact, scope, or feasibility
- `out_of_scope` -- mutation requests ("change X", "add Y"), GSD-about-GSD questions
  Signals: requests to modify code or questions about the GSD pipeline itself rather than the target program

**Distinguishing similar categories:**
- `how_it_works` vs `data_flow`: "How does auth work?" is `how_it_works`; "How does the auth token flow from login to API call?" is `data_flow`
- `what_can_i_build` vs `feature_impact`: "What can I build?" is open-ended (`what_can_i_build`); "If I add dark mode, what changes?" names a specific feature (`feature_impact`)
- `architecture` vs `how_it_works`: "What patterns does the API use?" is `architecture`; "How does the API handle a request?" is `how_it_works`

**2. Apply the analysis strategy for the classified question type:**

After classification, follow the specific strategy below. For `status` questions, use the loaded `state_content`, `roadmap_content`, and `requirements_content` directly. For `out_of_scope`, use the edge case handling in section 4. For all other types, follow the corresponding strategy.

---

**Strategy 1: `how_it_works` (DEEP-01 -- "How does X work?")**

Follow this protocol step by step:

**Step A -- Locate the entry point.** Use Grep to find where the feature/concept is defined or entered. Search for function definitions, class definitions, export statements, route handlers, or CLI command handlers matching the user's topic.

Example search patterns (replace `{topic}` with the user's subject):
```
Grep pattern="(function|class|export|def)\s+{topic}" glob="**/*.{ts,js,py}"
Grep pattern="{topic}" glob="**/index.*"
Grep pattern="(route|handler|command).*{topic}" glob="**/*.{ts,js,py}" -i=true
```

If the topic maps to a known file from ARCHITECTURE.md or STRUCTURE.md, start there instead of searching.

**Step B -- Read the implementation.** Once the entry point is located, Read the file(s) containing the core logic. Focus on:
- The main function/class body
- Its parameters and return values
- Internal logic flow: conditionals, loops, data transformations
- Comments that explain intent or edge cases

**Step C -- Trace dependencies.** From the implementation, identify imports and requires. For each significant import:
- If it is a LOCAL module: Read it to understand the dependency chain
- If it is an EXTERNAL library: Note version from package.json or pyproject.toml and briefly describe its role
- If it is a TYPE/INTERFACE: Note the contract it defines (fields, methods, constraints)

Use Grep to find the dependency:
```
Grep pattern="(import|require|from)\s+.*{dependency_name}" glob="**/*.{ts,js,py}"
```

**Step D -- Construct the answer.** The response MUST include:
- Entry point: file path and function/class name with line numbers
- Step-by-step explanation of what the code does (not just what it is)
- Key dependencies and what each provides
- Code snippets for the most important logic (not the entire file -- highlight the essential parts)
- If the topic spans multiple files, show the call chain: `A.ts:fn1() -> B.ts:fn2() -> C.ts:fn3()`

---

**Strategy 2: `data_flow` (DEEP-02 -- "How does data flow through X?")**

Follow this protocol step by step:

**Step A -- Identify the data boundaries.** Determine where data enters the system and where it exits. Use Grep to find entry and exit patterns.

Entry patterns (inputs):
```
Grep pattern="(req\.|request\.|argv|stdin|readFile|getenv|input\()" glob="**/*.{ts,js,py}"
Grep pattern="(params|query|body|payload)" glob="**/*.{ts,js,py}"
```

Exit patterns (outputs):
```
Grep pattern="(res\.|response\.|stdout|writeFile|render|return|print\()" glob="**/*.{ts,js,py}"
Grep pattern="(json\(|send\(|write\(|emit\()" glob="**/*.{ts,js,py}"
```

Narrow the search to files relevant to the user's topic using the loaded ARCHITECTURE.md or STRUCTURE.md for guidance.

**Step B -- Trace the transformation chain.** Between entry and exit, identify each transformation step. For each step, determine:
- What function transforms the data
- What it adds, removes, or reshapes
- What the data shape is BEFORE and AFTER the transformation

Read each file in the chain to verify the actual transformations. Do not guess from function names alone.

**Step C -- Map module boundaries.** For each handoff between files or modules, note:
- The import statement connecting them
- The function call that transfers control
- The data type or shape passed at the boundary

Use Grep to find all callers of key functions:
```
Grep pattern="{functionName}\(" glob="**/*.{ts,js,py}"
```

This reveals whether the data flow is linear (one caller) or branching (multiple callers).

**Step D -- Construct the answer.** The response MUST include:
- Data flow diagram as text: `[Input] -> Module A (transform) -> Module B (validate) -> [Output]`
- For each step in the flow: file path, function name, what it does to the data
- Data shape at key boundaries (TypeScript types, Python dataclasses, or informal description of fields)
- Branches: if there are conditional paths (error handling, feature flags, type switches), note them
- Edge cases: null/undefined handling, error propagation paths

---

**Strategy 3: `architecture` (DEEP-02/DEEP-03 -- "What patterns does X use?")**

Follow this protocol step by step:

**Step A -- Check codebase maps first.** If ARCHITECTURE.md content is loaded, reference it for high-level patterns. But ALWAYS supplement with actual source code verification -- never answer purely from documentation.

**Step B -- Verify patterns in source code.** For each architectural claim from the docs or from initial analysis, find the code that implements it:
- If "layered architecture" is claimed: find the actual layer boundaries in source files (e.g., routes vs services vs repositories)
- If "event-driven" is claimed: find event emitters and handlers
  ```
  Grep pattern="(emit|on|addEventListener|subscribe|publish)" glob="**/*.{ts,js,py}"
  ```
- If "plugin-based" is claimed: find the plugin loader, registration mechanism, and plugin interface
  ```
  Grep pattern="(register|plugin|use|middleware|hook)" glob="**/*.{ts,js,py}"
  ```
- If "configuration-driven" is claimed: find where configuration is read and how it affects behavior
  ```
  Grep pattern="(config|options|settings)\." glob="**/*.{ts,js,py}"
  ```

**Step C -- Show concrete examples.** For each pattern identified, show at least ONE concrete code snippet demonstrating the pattern in action. Include the file path and line numbers. Do not describe patterns abstractly without showing real code.

**Step D -- Construct the answer.** The response MUST include:
- Pattern name and brief description of what it achieves
- Where in the codebase it is implemented: specific files and line ranges
- A code snippet showing the pattern in practice (actual code from the project, not generic examples)
- Why this pattern was chosen: from phase summaries or key decisions if available, otherwise infer from code structure and note the inference

---

**Strategy 4: `what_can_i_build` (DSGN-01, DSGN-02 -- "What can I build from here?")**

Follow this protocol step by step:

**Step A -- Survey pending requirements.** Check `requirements_content` for unchecked items (`- [ ]`). These are explicitly planned but unbuilt capabilities. List them as "planned next steps" with their requirement IDs and descriptions.

Also check `roadmap_content` for phases with status "pending" or "in_progress" -- these represent planned work that has not yet shipped.

**Step B -- Identify extension points in source code.** Search for patterns that indicate the codebase was designed for extension:

Plugin/hook registrations:
```
Grep pattern="(register|plugin|hook|middleware|use)\(" glob="**/*.{ts,js,py}"
```

Configuration-driven behavior:
```
Grep pattern="(config|options|settings)\[" glob="**/*.{ts,js,py}"
```

Abstract classes/interfaces with few implementations:
```
Grep pattern="(abstract class|interface|Protocol|ABC)" glob="**/*.{ts,js,py}"
```

Switch/match statements on type fields:
```
Grep pattern="(switch|match|case).*type" glob="**/*.{ts,js,py}"
```

Event systems:
```
Grep pattern="(emit|on|addEventListener|subscribe)" glob="**/*.{ts,js,py}"
```

For each pattern found, Read the file to understand what the extension point allows and how new implementations would plug in.

**Step C -- Analyze integration patterns.** Look for how the program connects to external systems, which reveals where new integrations could be added:

API clients:
```
Grep pattern="(fetch|axios|requests|httpx)" glob="**/*.{ts,js,py}"
```

Database adapters:
```
Grep pattern="(prisma|sequelize|sqlalchemy|knex)" glob="**/*.{ts,js,py}"
```

File I/O:
```
Grep pattern="(readFile|writeFile|open\(|Path\()" glob="**/*.{ts,js,py}"
```

CLI subcommand routers:
```
Grep pattern="(switch|if).*command" glob="**/*.{ts,js,py}"
```

**Step D -- Synthesize suggestions.** For each identified extension point or integration pattern, formulate a concrete suggestion:
- What could be built (the feature or capability)
- Where it would plug in (the specific file, function, or pattern)
- How complex it would be (small/medium/large based on files affected)
- Whether it is already partially supported (e.g., "the config already accepts a `theme` field but nothing reads it")

**Step E -- Construct the answer.** The response MUST include:
- Section 1: "Planned next" -- pending requirements from REQUIREMENTS.md and pending phases from ROADMAP.md
- Section 2: "Extension points" -- places the code is designed to grow, each with file path and code snippet showing the extension mechanism
- Section 3: "Integration opportunities" -- external systems the program could connect to, based on existing patterns in the codebase
- Each suggestion MUST reference a specific file and code location -- no abstract suggestions without grounding

---

**Strategy 5: `feature_impact` (DSGN-03 -- "If I add X, what would change?")**

Follow this protocol step by step:

**Step A -- Identify the insertion point.** Based on the feature described by the user, determine where in the codebase the new code would live. Use the existing codebase structure (from STRUCTURE.md content if loaded, or use Glob to explore the directory layout) to find the most appropriate location.

```
Glob pattern="**/*" path="{likely_directory}"
```

If ARCHITECTURE.md describes component boundaries, use those to determine which component the feature belongs to.

**Step B -- Map the blast radius.** From the insertion point, trace outward to find all files that would be affected:

Files that import/require the module being modified:
```
Grep pattern="(import|require).*{module_name}" glob="**/*.{ts,js,py}"
```

Files that call functions in the module:
```
Grep pattern="{function_name}\(" glob="**/*.{ts,js,py}"
```

Configuration files that reference the module:
```
Grep pattern="{module_name}" glob="**/*.{json,yaml,toml}"
```

Test files that test the module:
```
Grep pattern="{module_name}" glob="**/test*/**"
```

Read each affected file to understand the nature of the dependency (direct call, type reference, configuration, etc.).

**Step C -- Identify type/contract changes.** Determine if the feature would require changes to:
- Data models or schemas (database tables, TypeScript types, Python dataclasses)
- API contracts (request/response shapes, endpoint signatures)
- Configuration schemas (new config fields, environment variables)
- Test fixtures or mocks (mock data that would need updating)

Search for type definitions related to the affected area:
```
Grep pattern="(type|interface|class|schema).*{entity_name}" glob="**/*.{ts,js,py}"
```

**Step D -- Estimate scope.** Categorize each affected file by change type:
- **NEW**: File does not exist yet and would need to be created
- **MODIFY**: File exists and would need changes (note which functions or sections)
- **TEST**: Test file that would need new test cases or updated fixtures

**Step E -- Construct the answer.** The response MUST include:
- "Insertion point" -- the primary file and function where the feature would be added, with current code snippet showing what exists there now
- "Files affected" -- table with columns: File, Change Type (NEW/MODIFY/TEST), What Would Change
- "Dependencies" -- any new libraries or integrations the feature would need
- "Risk areas" -- parts of the change that could break existing behavior (from CONCERNS.md if available, or from code analysis of tightly coupled areas)
- Code snippets showing the current state of key files that would change, so the user can see what they are working with

**3. Construct the answer:**
- Ground every answer in actual artifacts or source code
- Include file paths where relevant (e.g., "See `src/lib/auth.ts` for the JWT implementation")
- Include code snippets for implementation questions
- Be specific about what is documented vs what is inferred
- If information is not available in loaded artifacts, say so explicitly

**4. Handle edge cases:**

If the question is about something not covered by loaded artifacts:
```
The loaded artifacts don't cover {topic}.

{If codebase maps are missing:}
Running `/gsd:map-codebase` would generate documentation that might cover this.

{If the topic seems to be in source code:}
Let me search the source code directly...
[Then use Grep/Glob/Read to find relevant code]
```

If the user asks to modify something:
```
This is a read-only analysis session. I can explain how things work, but I don't make changes here.

To make changes:
- `/gsd:execute-phase` -- execute existing plans
- `/gsd:plan-phase` -- create new plans
- `/gsd:new-milestone` -- plan new work
```

If the user asks about GSD pipeline itself (not the target program):
```
That's a question about the GSD build pipeline, not about {Program Name}.

{Answer briefly using GSD knowledge, then redirect:}
For more on GSD commands, see the GSD documentation or run `/gsd:progress`.
```

**5. After each answer, remain in the loop:**

Do not exit the workflow after answering. Wait for the next question. The user exits by running `/clear` or switching to another command.

**Important constraints for the interactive loop:**
- NEVER use the Write tool -- this workflow is read-only
- NEVER modify any files in .planning/ or the source tree
- NEVER create plans, summaries, or any planning artifacts
- NEVER spawn subagents or reference other workflows for execution
- DO use Read, Grep, Glob, and Bash (for read-only commands like `git log`) to find information
- DO use WebFetch if the user asks about external APIs or documentation referenced in the codebase
</step>

</process>

<success_criteria>
- [ ] Target program artifacts inventoried via `gsd-tools.js init discuss-current`
- [ ] Codebase maps loaded and synthesized (CTXL-01) or noted as missing
- [ ] Phase summaries loaded with status and one-liners (CTXL-02)
- [ ] Requirements parsed with delivered vs pending counts (CTXL-03)
- [ ] Program state summary presented from roadmap and state (CTXL-04)
- [ ] Terminology section generated distinguishing program vs GSD terms (ONBD-01)
- [ ] Missing artifacts reported with actionable suggestions (not silent failures)
- [ ] Onboarding summary presented in structured format
- [ ] Interactive Q&A loop entered after onboarding
- [ ] All answers grounded in actual artifacts and source code
- [ ] Deep-dive questions answered with specific file paths, function names, and code snippets (DEEP-01)
- [ ] Data flow questions answered with module-boundary traces and data shape descriptions (DEEP-02)
- [ ] Code-path tracing uses actual Grep/Read lookups, not just documentation summaries (DEEP-03)
- [ ] "What can I build" answered with extension points and integration patterns from source code (DSGN-01, DSGN-02)
- [ ] Feature impact questions answered with blast radius, affected files, and risk areas (DSGN-03)
- [ ] Workflow is strictly read-only -- no file writes, no state mutation
</success_criteria>
