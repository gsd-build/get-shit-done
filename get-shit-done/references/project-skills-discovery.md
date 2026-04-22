# Project Skills Discovery

Before execution, check for project-defined skills and apply their rules.

**Discovery steps (shared across all GSD agents):**
1. Check `.claude/skills/` or `.agents/skills/` directory — if neither exists, skip.
2. List available skills (subdirectories).
3. Read `SKILL.md` for each skill (lightweight index, typically ~130 lines).
4. Load specific `rules/*.md` files only as needed during the current task.
5. Do NOT load full `AGENTS.md` files — they are large (100KB+) and cost significant context.

**Application** — how to apply the loaded rules depends on the calling agent:
- Planners account for project skill patterns and conventions in the plan.
- Executors follow skill rules relevant to the task being implemented.
- Researchers ensure research output accounts for project skill patterns.
- Verifiers apply skill rules when scanning for anti-patterns and verifying quality.
- Debuggers follow skill rules relevant to the bug being investigated and the fix being applied.

The caller's agent file should specify which application applies.
