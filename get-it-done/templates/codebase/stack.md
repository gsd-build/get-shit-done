# Technology Stack Template

Template for `.planning/codebase/STACK.md` - captures the technology foundation.

**Purpose:** Document what technologies run this codebase. Focused on "what executes when you run the code."

---

## File Template

```markdown
# Technology Stack

**Analysis Date:** [YYYY-MM-DD]

## Languages

**Primary:**
- [Language] [Version] - [Where used: e.g., "all application code"]

**Secondary:**
- [Language] [Version] - [Where used: e.g., "build scripts, tooling"]

## Runtime

**Environment:**
- [Runtime] [Version] - [e.g., "Node.js 20.x"]
- [Additional requirements if any]

**Package Manager:**
- [Manager] [Version] - [e.g., "npm 10.x"]
- Lockfile: [e.g., "package-lock.json present"]

## Frameworks

**Core:**
- [Framework] [Version] - [Purpose: e.g., "web server", "UI framework"]

**Testing:**
- [Framework] [Version] - [e.g., "Jest for unit tests"]
- [Framework] [Version] - [e.g., "Playwright for E2E"]

**Build/Dev:**
- [Tool] [Version] - [e.g., "Vite for bundling"]
- [Tool] [Version] - [e.g., "TypeScript compiler"]

## Key Dependencies

[Only include dependencies critical to understanding the stack - limit to 5-10 most important]

**Critical:**
- [Package] [Version] - [Why it matters: e.g., "authentication", "database access"]
- [Package] [Version] - [Why it matters]

**Infrastructure:**
- [Package] [Version] - [e.g., "Express for HTTP routing"]
- [Package] [Version] - [e.g., "PostgreSQL client"]

## Configuration

**Environment:**
- [How configured: e.g., ".env files", "environment variables"]
- [Key configs: e.g., "DATABASE_URL, API_KEY required"]

**Build:**
- [Build config files: e.g., "vite.config.ts, tsconfig.json"]

## Platform Requirements

**Development:**
- [OS requirements or "any platform"]
- [Additional tooling: e.g., "Docker for local DB"]

**Production:**
- [Deployment target: e.g., "Vercel", "AWS Lambda", "Docker container"]
- [Version requirements]

---

*Stack analysis: [date]*
*Update after major dependency changes*
```

<good_examples>
```markdown
# Technology Stack

**Analysis Date:** 2025-01-20

## Languages

**Primary:**
- TypeScript 5.3 - All application code

**Secondary:**
- JavaScript - Build scripts, config files

## Runtime

**Environment:**
- Node.js 20.x (LTS)
- No browser runtime (CLI tool only)

**Package Manager:**
- npm 10.x
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- None (vanilla Node.js CLI)

**Testing:**
- Vitest 1.0 - Unit tests
- tsx - TypeScript execution without build step

**Build/Dev:**
- TypeScript 5.3 - Compilation to JavaScript
- esbuild - Used by Vitest for fast transforms

## Key Dependencies

**Critical:**
- commander 11.x - CLI argument parsing and command structure
- chalk 5.x - Terminal output styling
- fs-extra 11.x - Extended file system operations

**Infrastructure:**
- Node.js built-ins - fs, path, child_process for file operations

## Configuration

**Environment:**
- No environment variables required
- Configuration via CLI flags only

**Build:**
- `tsconfig.json` - TypeScript compiler options
- `vitest.config.ts` - Test runner configuration

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js)
- No external dependencies

**Production:**
- Distributed as npm package
- Installed globally via npm install -g
- Runs on user's Node.js installation

---

*Stack analysis: 2025-01-20*
*Update after major dependency changes*
```
</good_examples>

<guidelines>
**What belongs in STACK.md:**
- Languages and versions
- Runtime requirements (Node, Bun, Deno, browser)
- Package manager and lockfile
- Framework choices
- Critical dependencies (limit to 5-10 most important)
- Build tooling
- Platform/deployment requirements

**What does NOT belong here:**
- File structure (that's STRUCTURE.md)
- Architectural patterns (that's ARCHITECTURE.md)
- Every dependency in package.json (only critical ones)
- Implementation details (defer to code)

**When filling this template:**
- Check package.json for dependencies
- Note runtime version from .nvmrc or package.json engines
- Include only dependencies that affect understanding (not every utility)
- Specify versions only when version matters (breaking changes, compatibility)

**Useful for phase planning when:**
- Adding new dependencies (check compatibility)
- Upgrading frameworks (know what's in use)
- Choosing implementation approach (must work with existing stack)
- Understanding build requirements
</guidelines>
