<purpose>
Orchestrate parallel Explore agents to analyze codebase and produce structured documents in .planning/codebase/

Each agent has fresh context and focuses on specific aspects. Output is concise and actionable for planning.
</purpose>

<philosophy>
**Why parallel agents:**
- Fresh context per domain (no token contamination)
- Thorough analysis without context exhaustion
- Each agent optimized for its domain (tech vs organization vs quality vs issues)
- Faster execution (agents run simultaneously)

**Document quality over length:**
Include enough detail to be useful as reference. Prioritize practical examples (especially code patterns) over arbitrary brevity. A 200-line TESTING.md with real patterns is more valuable than a 74-line summary.

**Always include file paths:**
Documents are reference material for Claude when planning/executing. Vague descriptions like "UserService handles users" are not actionable. Always include actual file paths formatted with backticks: `src/services/user.ts`. This allows Claude to navigate directly to relevant code without re-searching. Do NOT include line numbers (they go stale), just file paths.
</philosophy>

<process>

<step name="check_existing" priority="first">
Check if .planning/codebase/ already exists:

```bash
ls -la .planning/codebase/ 2>/dev/null
```

**If exists:**

```
.planning/codebase/ already exists with these documents:
[List files found]

What's next?
1. Refresh - Delete existing and remap codebase
2. Update - Keep existing, only update specific documents
3. Skip - Use existing codebase map as-is
```

Wait for user response.

If "Refresh": Delete .planning/codebase/, continue to create_structure
If "Update": Ask which documents to update, continue to spawn_agents (filtered)
If "Skip": Exit workflow

**If doesn't exist:**
Continue to create_structure.
</step>

<step name="create_structure">
Create .planning/codebase/ directory:

```bash
mkdir -p .planning/codebase
```

**Expected output files:**
- STACK.md (from stack.md template)
- ARCHITECTURE.md (from architecture.md template)
- STRUCTURE.md (from structure.md template)
- CONVENTIONS.md (from conventions.md template)
- TESTING.md (from testing.md template)
- INTEGRATIONS.md (from integrations.md template)
- CONCERNS.md (from concerns.md template)

Continue to spawn_agents.
</step>

<step name="spawn_agents">
Spawn 4 parallel Explore agents to analyze codebase.

Use Task tool with `subagent_type="Explore"` and `run_in_background=true` for parallel execution.

**Agent 1: Stack + Integrations (Technology Focus)**

Task tool parameters:
```
subagent_type: "Explore"
run_in_background: true
task_description: "Analyze codebase technology stack and external integrations"
```

Prompt:
```
Analyze this codebase for technology stack and external integrations.

IMPORTANT: Always include actual file paths in your findings. Use backtick formatting like `src/config/database.ts`. This makes the output actionable for planning.

Focus areas:
1. Languages (check file extensions, package manifests)
2. Runtime environment (Node.js, Python, etc. - check .nvmrc, .python-version, engines field)
3. Package manager and lockfiles
4. Frameworks (web, testing, build tools)
5. Key dependencies (critical packages for functionality)
6. External services (APIs, databases, auth providers)
7. Third-party integrations (payment, analytics, etc.)
8. Configuration approach (.env, config files)

Search for:
- package.json / requirements.txt / Cargo.toml / go.mod
- .env files, .env.example
- Config files (vite.config, webpack.config, tsconfig.json)
- API client code, database connection code
- Import statements for major libraries

Output findings for populating these sections:
- STACK.md: Languages, Runtime, Frameworks, Dependencies, Configuration
- INTEGRATIONS.md: External APIs, Services, Third-party tools

For each finding, include the file path where you found it. Example:
- "TypeScript 5.3 - `package.json`"
- "Supabase client - `src/lib/supabase.ts`"
- "Stripe integration - `src/services/stripe.ts`, `src/webhooks/stripe.ts`"

If something is not found, note "Not detected" for that category.
```

**Agent 2: Architecture + Structure (Organization Focus)**

Task tool parameters:
```
subagent_type: "Explore"
run_in_background: true
task_description: "Analyze codebase architecture patterns and directory structure"
```

Prompt:
```
Analyze this codebase architecture and directory structure.

IMPORTANT: Always include actual file paths in your findings. Use backtick formatting like `src/index.ts`. This makes the output actionable for planning.

Focus areas:
1. Overall architectural pattern (monolith, microservices, layered, etc.)
2. Conceptual layers (API, service, data, utility)
3. Data flow and request lifecycle
4. Key abstractions and patterns (services, controllers, repositories)
5. Entry points (main files, server files, CLI entry)
6. Directory organization and purposes
7. Module boundaries
8. Naming conventions for directories and files

Search for:
- Entry points: index.ts, main.ts, server.ts, app.ts, cli.ts
- Directory structure patterns (src/, lib/, components/, services/)
- Import patterns (what imports what)
- Recurring code patterns (base classes, interfaces, common abstractions)

Output findings for populating these sections:
- ARCHITECTURE.md: Pattern, Layers, Data Flow, Abstractions, Entry Points
- STRUCTURE.md: Directory layout, Organization, Key locations

For each finding, include the file path. Examples:
- "CLI entry point: `bin/install.js`"
- "Service layer: `src/services/*.ts` (UserService, ProjectService)"
- "API routes: `src/routes/api/*.ts`"

If something is not clear, provide best-guess interpretation based on code structure.
```

**Agent 3: Conventions + Testing (Quality Focus)**

Task tool parameters:
```
subagent_type: "Explore"
run_in_background: true
task_description: "Analyze coding conventions and test patterns"
```

Prompt:
```
Analyze this codebase for coding conventions and testing practices.

IMPORTANT: Always include actual file paths in your findings. Use backtick formatting like `vitest.config.ts`. This makes the output actionable for planning.

Focus areas:
1. Code style (indentation, quotes, semicolons, formatting)
2. File naming conventions (kebab-case, PascalCase, etc.)
3. Function/variable naming patterns
4. Comment and documentation style
5. Test framework and structure
6. Test organization (unit, integration, e2e)
7. Test coverage approach
8. Linting and formatting tools

Search for:
- Config files: .eslintrc, .prettierrc, tsconfig.json
- Test files: *.test.*, *.spec.*, __tests__/
- Test setup: vitest.config, jest.config
- Code patterns across multiple files
- README or CONTRIBUTING docs

Output findings for populating these sections:
- CONVENTIONS.md: Code Style, Naming, Patterns, Documentation
- TESTING.md: Framework, Structure, Coverage, Tools

For each finding, include file paths. Examples:
- "Prettier config: `.prettierrc`"
- "Test pattern: `src/**/*.test.ts` (co-located with source)"
- "Example of naming convention: `src/services/user-service.ts`"

Look at actual code files to infer conventions if config files are missing.
```

**Agent 4: Concerns (Issues Focus)**

Task tool parameters:
```
subagent_type: "Explore"
run_in_background: true
task_description: "Identify technical debt and areas of concern"
```

Prompt:
```
Analyze this codebase for technical debt, known issues, and areas of concern.

CRITICAL: Always include actual file paths in your findings. Use backtick formatting like `src/auth/login.ts`. Concerns without file paths are not actionable. For each issue found, specify exactly where it is.

Focus areas:
1. TODO and FIXME comments
2. Complex or hard-to-understand code
3. Missing error handling (try/catch, error checks)
4. Security patterns (hardcoded secrets, unsafe operations)
5. Outdated dependencies (check versions against current)
6. Missing tests for critical code
7. Duplicate code patterns
8. Performance concerns (N+1 queries, inefficient loops)
9. Documentation gaps (complex code without comments)

Search for:
- TODO, FIXME, HACK, XXX comments
- Large functions or files (>200 lines)
- Repeated code patterns
- Missing .env.example when .env is used
- Dependencies with known vulnerabilities (check versions)
- Error-prone patterns (no validation, no error handling)

Output findings for populating:
- CONCERNS.md: Technical Debt, Issues, Security, Performance, Documentation

For EVERY concern, include file paths. Examples:
- "Direct DB queries in components: `src/pages/Dashboard.tsx`, `src/pages/Profile.tsx`"
- "Missing error handling: `src/api/webhook.ts` (Stripe webhook has no try/catch)"
- "TODO: 'fix race condition' in `src/services/subscription.ts`"

Be constructive - focus on actionable concerns, not nitpicks.
If codebase is clean, note that rather than inventing problems.
```

Continue to collect_results.
</step>

<step name="collect_results">
Wait for all 4 agents to complete.

Use TaskOutput tool to collect results from each agent. Since agents were run with `run_in_background=true`, retrieve their output.

**Collection pattern:**

For each agent, use TaskOutput tool to get the full exploration findings.

**Aggregate findings by document:**

From Agent 1 output, extract:
- STACK.md sections: Languages, Runtime, Frameworks, Dependencies, Configuration, Platform
- INTEGRATIONS.md sections: External APIs, Services, Authentication, Webhooks

From Agent 2 output, extract:
- ARCHITECTURE.md sections: Pattern Overview, Layers, Data Flow, Key Abstractions, Entry Points
- STRUCTURE.md sections: Directory Layout, Key Locations, Organization

From Agent 3 output, extract:
- CONVENTIONS.md sections: Code Style, Naming Conventions, Common Patterns, Documentation Style
- TESTING.md sections: Framework, Structure, Coverage, Tools

From Agent 4 output, extract:
- CONCERNS.md sections: Technical Debt, Known Issues, Security, Performance, Missing

**Handling missing findings:**

If an agent didn't find information for a section, use placeholder:
- "Not detected" (for infrastructure/tools that may not exist)
- "Not applicable" (for patterns that don't apply to this codebase)
- "No significant concerns" (for CONCERNS.md if codebase is clean)

Continue to write_documents.
</step>

<step name="write_documents">
Write all 7 codebase documents using templates and agent findings.

**Template filling process:**

For each document:

1. **Read template file** from `~/.config/opencode/gsd/templates/codebase/{name}.md`
2. **Extract the "File Template" section** - this is the markdown code block containing the actual document structure
3. **Fill template placeholders** with agent findings:
   - Replace `[YYYY-MM-DD]` with current date
   - Replace `[Placeholder text]` with specific findings from agents
   - If agent found nothing for a section, use appropriate placeholder:
     - "Not detected" for optional infrastructure
     - "Not applicable" for patterns that don't fit this codebase
     - "No significant concerns" for clean codebase areas
4. **Write to .planning/codebase/{NAME}.md** (uppercase filename)

**Example filling pattern:**

Template placeholder:
```
**Primary:**
- [Language] [Version] - [Where used: e.g., "all application code"]
```

Agent finding:
```
Found: TypeScript 5.3 used in all .ts files throughout src/
```

Filled result:
```
**Primary:**
- TypeScript 5.3 - All application code
```

**Document writing order:**

1. **STACK.md** (from stack.md template + Agent 1 findings)
2. **INTEGRATIONS.md** (from integrations.md template + Agent 1 findings)
3. **ARCHITECTURE.md** (from architecture.md template + Agent 2 findings)
4. **STRUCTURE.md** (from structure.md template + Agent 2 findings)
5. **CONVENTIONS.md** (from conventions.md template + Agent 3 findings)
6. **TESTING.md** (from testing.md template + Agent 3 findings)
7. **CONCERNS.md** (from concerns.md template + Agent 4 findings)

After all documents written, continue to verify_output.
</step>

<step name="verify_output">
Verify all documents created successfully:

```bash
ls -la .planning/codebase/
wc -l .planning/codebase/*.md
```

**Verification checklist:**
- All 7 documents exist
- No empty documents
- Templates populated with findings

If any checks fail, report issues to user.

Continue to commit_codebase_map.
</step>

<step name="commit_codebase_map">
Commit the codebase map:

```bash
git add .planning/codebase/*.md
git commit -m "$(cat <<'EOF'
docs: map existing codebase

- STACK.md - Technologies and dependencies
- ARCHITECTURE.md - System design and patterns
- STRUCTURE.md - Directory layout
- CONVENTIONS.md - Code style and patterns
- TESTING.md - Test structure
- INTEGRATIONS.md - External services
- CONCERNS.md - Technical debt and issues
EOF
)"
```

Continue to offer_next.
</step>

<step name="offer_next">
Present completion summary and next steps.

**Output format:**

```
Codebase mapping complete.

Created .planning/codebase/:
- STACK.md ([N] lines) - Technologies and dependencies
- ARCHITECTURE.md ([N] lines) - System design and patterns
- STRUCTURE.md ([N] lines) - Directory layout and organization
- CONVENTIONS.md ([N] lines) - Code style and patterns
- TESTING.md ([N] lines) - Test structure and practices
- INTEGRATIONS.md ([N] lines) - External services and APIs
- CONCERNS.md ([N] lines) - Technical debt and issues


---

## ▶ Next Up

**Initialize project** — use codebase context for planning

`/gsd/new-project`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- Re-run mapping: `/gsd/map-codebase`
- Review specific file: `cat .planning/codebase/STACK.md`
- Edit any document before proceeding

---
```

End workflow.
</step>

</process>

<success_criteria>
- .planning/codebase/ directory created
- 4 parallel Explore agents spawned with run_in_background=true
- Agent prompts are specific and actionable
- TaskOutput used to collect all agent results
- All 7 codebase documents written using template filling
- Documents follow template structure with actual findings
- Clear completion summary with line counts
- User offered clear next steps in GSD style
</success_criteria>
