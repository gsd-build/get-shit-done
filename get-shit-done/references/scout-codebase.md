# Codebase scout — map selection table

> Lazy-loaded reference for the `scout_codebase` step in
> `workflows/discuss-phase.md` (extracted via #2551 progressive-disclosure
> refactor). Read this only when prior `.planning/codebase/*.md` maps exist
> and the workflow needs to pick which 2–3 to load.

## Phase-type → recommended maps

Read 2–3 maps based on inferred phase type. Do NOT read all seven —
that inflates context without improving discussion quality.

| Phase type (infer from title + ROADMAP entry) | Read these maps |
|---|---|
| UI / frontend / styling / design | CONVENTIONS.md, STRUCTURE.md, STACK.md |
| Backend / API / service / data model | STACK.md, ARCHITECTURE.md, INTEGRATIONS.md |
| Integration / third-party / provider | STACK.md, INTEGRATIONS.md, ARCHITECTURE.md |
| Infrastructure / DevOps / CI / deploy | STACK.md, ARCHITECTURE.md, INTEGRATIONS.md |
| Testing / QA / coverage | TESTING.md, CONVENTIONS.md, STRUCTURE.md |
| Documentation / content | CONVENTIONS.md, STRUCTURE.md |
| Mixed / unclear | STACK.md, ARCHITECTURE.md, CONVENTIONS.md |

Read CONCERNS.md only if the phase explicitly addresses known concerns or
security issues.

## Single-read rule

Read each map file in a **single** Read call. Do not read the same file at
two different offsets — split reads break prompt-cache reuse and cost more
than a single full read.

## No-maps fallback

If `.planning/codebase/*.md` does not exist:
1. Extract key terms from the phase goal (e.g., "feed" → "post", "card",
   "list"; "auth" → "login", "session", "token")
2. `grep -rlE "{term1}|{term2}" src/ app/ --include="*.ts" ...` (use `-E`
   for extended regex so the `|` alternation works on both GNU grep and BSD
   grep / macOS), and `ls` the conventional component/hook/util dirs
3. Read the 3–5 most relevant files

## Output (internal `<codebase_context>`)

From the scan, identify:
- **Reusable assets** — components, hooks, utilities usable in this phase
- **Established patterns** — state management, styling, data fetching
- **Integration points** — routes, nav, providers where new code connects
- **Creative options** — approaches the architecture enables or constrains

Used in `analyze_phase` and `present_gray_areas`. NOT written to a file —
session-only.
