Map the technology stack of this codebase. Read package manifests, lockfiles, and entry points.

Write STACK.md to `.planning/codebase/` using the template at `.planning/templates/codebase/stack.md`.

Include:
- Languages and runtimes (with versions)
- Frameworks and key libraries (10-20 most important, not the full lockfile)
- Infrastructure and deployment tooling
- For each package: why it matters to this project (not just what it is)

**Anti-staleness:** Do NOT dump the full lockfile or dependency tree. Include only packages with architectural significance and note why they matter.

<quality_gate>
- [ ] 10-20 packages listed with version + rationale (not a lockfile dump)
- [ ] Build/deploy tooling included
- [ ] Any deprecated or risky dependencies flagged
</quality_gate>

Write to: `.planning/codebase/STACK.md`
Return: 3-5 sentence summary to the Orchestrator when done.
Guardrails: Max Agent Hops = 3. No static dependency dumps.
