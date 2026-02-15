<purpose>
Quick codebase exploration to understand structure, patterns, and dependencies in a specific area.

Unlike map-codebase (which produces full documentation), explore is lightweight and conversational. It reports findings directly without writing persistent files.

Output: Structured findings reported inline -- no files created.
</purpose>

<philosophy>
**Speed over completeness:**
Explore is a quick reconnaissance tool. Get the user enough context to make decisions, not an exhaustive analysis.

**Always include file paths:**
Every observation should reference specific files with backtick formatting: `src/services/user.ts`.

**Actionable output:**
End with concrete observations the user can act on -- patterns to follow, concerns to address, dependencies to consider.
</philosophy>

<process>

<step name="determine_scope">
Parse the user's request to determine what to explore.

**Input patterns:**
- Directory path: `src/api` -- explore that directory tree
- Feature keyword: `auth` -- search for authentication-related code
- File pattern: `*.test.js` -- find and analyze matching files
- No argument: explore project root structure

**Determine depth:**
- Check for `--depth shallow` or `--depth deep` flag
- Default: `shallow`

**Shallow scope:**
- Top-level files and directories
- Package/config file analysis
- Key file identification (entry points, configs, main modules)

**Deep scope:**
- Full recursive file listing
- Import/dependency tracing
- Pattern frequency analysis
- Cross-reference between modules
</step>

<step name="scan_structure">
List files and directories in the target area.

**For directory targets:**
```bash
# List top-level structure
ls -la {target}/

# Count files by type
find {target} -type f -name "*.ts" | wc -l
find {target} -type f -name "*.js" | wc -l
find {target} -type f -name "*.py" | wc -l
```

**Identify tech stack from config files:**
- `package.json` -- Node.js dependencies, scripts
- `requirements.txt` / `pyproject.toml` -- Python dependencies
- `CMakeLists.txt` -- C++ build config
- `tsconfig.json` -- TypeScript configuration
- `Dockerfile` / `docker-compose.yml` -- Container setup

**For feature keyword targets:**
```bash
# Search for the keyword across the codebase
grep -rl "{keyword}" --include="*.ts" --include="*.js" --include="*.py"
```

**Report:**
- Total file count by extension
- Directory tree (depth 2-3)
- Key configuration files found
- Entry points identified
</step>

<step name="identify_patterns">
Analyze code for architectural patterns and conventions.

**Pattern detection:**
- Look for common directory patterns: `src/`, `lib/`, `services/`, `models/`, `routes/`
- Check for test structure: `__tests__/`, `*.test.*`, `*.spec.*`
- Identify framework patterns: MVC, repository, service layer, middleware chain
- Check for dependency injection, factory patterns, singleton usage

**Convention detection:**
- File naming: camelCase, kebab-case, PascalCase
- Export style: named exports, default exports, barrel files (index.ts)
- Error handling: try/catch patterns, custom error classes
- Configuration: environment variables, config files, constants

**Dependency analysis (deep mode only):**
- Trace imports from entry point
- Identify circular dependencies
- Map module dependency graph
- Flag external vs internal dependencies
</step>

<step name="report_findings">
Present findings in a structured format.

**Report structure:**

```
## Exploration: {target}

### Structure
{file tree with annotations}

### Tech Stack
- **Runtime:** {detected runtime}
- **Framework:** {detected framework}
- **Key dependencies:** {list}

### Patterns Found
- {pattern}: observed in `{file paths}`
- {pattern}: observed in `{file paths}`

### Key Files
| File | Role |
|------|------|
| `{path}` | {description} |
| `{path}` | {description} |

### Observations
- {actionable observation}
- {actionable observation}

### For Planning
- {relevant context for plan creation}
- {dependencies to consider}
- {patterns to follow}
```

End with a suggestion for next steps based on what was found.
</step>

</process>

<success_criteria>
- Target area scoped correctly from user input
- File structure enumerated with key files highlighted
- Tech stack and patterns detected and reported
- Findings are structured, specific (with file paths), and actionable
- Report helps user make planning decisions
</success_criteria>
