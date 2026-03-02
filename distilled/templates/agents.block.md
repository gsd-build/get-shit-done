## GSDD Governance (Generated)

This block is managed by `gsdd`. Do not edit inside the block directly.
Edit the source template in the GSDD framework instead.

### What This Project Uses
- Framework: GSDD (Spec-Driven Development)
- Planning dir: `.planning/` (specs, roadmaps, plans, research, templates)
- Lifecycle: `bootstrap (gsdd init) -> new-project -> [plan -> execute -> verify] x N`

### Rules You MUST Follow

1. Never Skip The Workflow
- Every change follows: plan -> execute -> verify
- Before coding: read `.planning/SPEC.md`, `.planning/ROADMAP.md`, and the current phase plan
- After coding: verify against the plan's success criteria before claiming done

2. Read Before You Write
- If `.planning/` exists, read in order:
  - `.planning/SPEC.md`
  - `.planning/ROADMAP.md`
  - `.planning/config.json`
  - Current phase plan in `.planning/phases/`
- If `.planning/` does not exist, the project has not been bootstrapped. Run `gsdd init`, then run the new-project workflow (`.agents/skills/gsdd-new-project/SKILL.md`).

3. Stay In Scope (Zero Deviation)
- Implement ONLY what the current plan/task specifies.
- If you notice unrelated improvements, do not implement them. Record them as a TODO for a future phase.

Priority order when instructions conflict:
- Developer explicit instruction (highest)
- Current task scope in plan file
- `.planning/SPEC.md`
- General best practices (lowest)

4. Version Control Protocol
- Follow `.planning/config.json` -> `gitProtocol` exactly.
- Do not hallucinate branch names or commit conventions.
- Tests must pass before committing.

5. Verify Your Own Work (Exists -> Substantive -> Wired)
Before reporting "done", verify each deliverable:
- Exists: artifact is present where the plan says it should be
- Substantive: real content/code, not placeholders or TODOs
- Wired: connected to the system (imported, called, rendered, tested)

6. Research Before Unfamiliar Domains
If you are not confident about a domain/library/pattern:
- Stop and research first (docs + existing code).
- Do not assume training data is current.
- Cite sources in `.planning/research/` (or `.internal-research/` for framework work).

7. Never Hallucinate Paths Or APIs
- Use only file paths you've confirmed exist.
- Use only APIs verified in docs or source.

8. Adapter Architecture Rule
- Do not pollute core workflows (`distilled/workflows/*.md`) with vendor-specific syntax.
- Tool-specific adapters are generated in `bin/` (generators, not converters).

9. Anti-YOLO
- Do not delete or rewrite code unless explicitly asked.
- If asked for analysis, answer first; propose changes separately.

### Where The Workflows Live
- Primary workflow entrypoints are shipped as skills:
  - `.agents/skills/gsdd-new-project/SKILL.md`
  - `.agents/skills/gsdd-plan/SKILL.md`
  - `.agents/skills/gsdd-execute/SKILL.md`
  - `.agents/skills/gsdd-verify/SKILL.md`

If your tool does not support skills, you can still follow the same content by opening those files directly.
