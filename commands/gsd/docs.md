---
name: gsd:docs
description: Generate Docusaurus documentation site from .planning/ artifacts
argument-hint: "[optional: --force to regenerate all files]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Generate a browsable Docusaurus documentation site from .planning/ artifacts.

Transforms markdown files to MDX-safe content with hash-based incremental regeneration, installs Docusaurus dependencies if needed, and offers next steps (dev server or production build).

Output: docs/ directory with Docusaurus site ready to start or build.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/generate-docs.md
</execution_context>

<context>
Arguments: $ARGUMENTS (optional --force flag to regenerate all files)

**Load project state if exists:**
Check for .planning/STATE.md - loads context if project already initialized

**This command:**
- Runs scripts/generate-docs.js with incremental hash detection
- Installs Docusaurus dependencies if node_modules missing
- Verifies output files created
- Offers to start dev server or build for production
</context>

<when_to_use>
**Use /gsd:docs for:**
- Initial documentation generation after completing phases
- Refreshing docs after plan/phase updates
- Building documentation for deployment
- Viewing project artifacts in navigable format

**Prerequisites:**
- .planning/ directory exists (run /gsd:new-project first if greenfield)
- Node.js 20+ installed (required by Docusaurus)
</when_to_use>

<process>
1. Check .planning/ exists (error if missing)
2. Parse --force flag from arguments
3. Run: node scripts/generate-docs.js [--force]
4. If docs/node_modules doesn't exist: pnpm install --dir docs
5. Verify output files created
6. Offer next steps: dev server (pnpm --dir docs start) or build (pnpm --dir docs build)
</process>

<success_criteria>
- [ ] .planning/ directory exists
- [ ] scripts/generate-docs.js executed successfully
- [ ] Docusaurus dependencies installed (if needed)
- [ ] docs/docs/ contains transformed markdown files
- [ ] Hash cache updated (.planning/.doc-hashes.json)
- [ ] User offered clear next steps
</success_criteria>
