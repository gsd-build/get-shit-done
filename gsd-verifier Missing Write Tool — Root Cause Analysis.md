Research: gsd-verifier Missing Write Tool — Root Cause Analysis
                                                          
 Finding: Day-One Bug, NOT a v1.17.0 → v1.18.0 Regression

The Write tool was never present in gsd-verifier.md. The diff between v1.17.0 and v1.18.0 shows zero changes to this file. Both versions have identical frontmatter:

tools: Read, Bash, Grep, Glob  # Write missing since initial creation

Timeline
Date: Jan 15, 2026
Commit: f3f6707
What Happened: gsd-verifier.md created — tools: Read, Bash, Grep, Glob, model: sonnet. Write was never included.
────────────────────────────────────────
Date: Jan 15, 2026
Commit: 8e6ad96→a7986bc→f9edfcf
What Happened: Formatting, re-verification loop, color changes. Tools line unchanged.
────────────────────────────────────────
Date: Jan 30, 2026
Commit: 5660b6f
What Happened: Gemini CLI compatibility fix. Tools line unchanged.
────────────────────────────────────────
Date: Feb 7-8, 2026
Commit: d44c7dc→1b317de→6a2d1f1
What Happened: gsd-tools integration refactor. model: sonnet removed from frontmatter, but tools line still unchanged.
The bug has existed through every release since the verifier was introduced.

Contradiction in the Agent Definition

The frontmatter says tools: Read, Bash, Grep, Glob (no Write), but:
- The description says: "Creates VERIFICATION.md report"
- The output section instructs: "Create .planning/phases/{phase_dir}/{phase}-VERIFICATION.md"

Without Write, the agent falls back to Bash with heredoc (cat > file << 'EOF'), which works functionally but causes the permission corruption we saw.

Comparison with Other Agents (v1.18.0)
┌─────────────────────────┬────────────────────────────────────────────────┬──────────────────────────────┬──────────────┐
│          Agent          │                     Tools                      │        Writes Files?         │  Has Write?  │
├─────────────────────────┼────────────────────────────────────────────────┼──────────────────────────────┼──────────────┤
│ gsd-executor            │ Read, Write, Edit, Bash, Grep, Glob            │ Yes (code, summaries)        │ Yes          │
├─────────────────────────┼────────────────────────────────────────────────┼──────────────────────────────┼──────────────┤
│ gsd-planner             │ Read, Write, Bash, Glob, Grep, WebFetch        │ Yes (PLAN.md)                │ Yes          │
├─────────────────────────┼────────────────────────────────────────────────┼──────────────────────────────┼──────────────┤
│ gsd-roadmapper          │ Read, Write, Bash, Glob, Grep                  │ Yes (ROADMAP.md)             │ Yes          │
├─────────────────────────┼────────────────────────────────────────────────┼──────────────────────────────┼──────────────┤
│ gsd-debugger            │ Read, Write, Edit, Bash, Grep, Glob, WebSearch │ Yes (debug reports)          │ Yes          │
├─────────────────────────┼────────────────────────────────────────────────┼──────────────────────────────┼──────────────┤
│ gsd-codebase-mapper     │ Read, Bash, Grep, Glob, Write                  │ Yes (analysis docs)          │ Yes          │
├─────────────────────────┼────────────────────────────────────────────────┼──────────────────────────────┼──────────────┤
│ gsd-verifier            │ Read, Bash, Grep, Glob                         │ Yes (VERIFICATION.md)        │ NO           │
├─────────────────────────┼────────────────────────────────────────────────┼──────────────────────────────┼──────────────┤
│ gsd-plan-checker        │ Read, Bash, Glob, Grep                         │ No (returns to orchestrator) │ No (correct) │
├─────────────────────────┼────────────────────────────────────────────────┼──────────────────────────────┼──────────────┤
│ gsd-integration-checker │ Read, Bash, Grep, Glob                         │ Borderline (returns report)  │ No           │
└─────────────────────────┴────────────────────────────────────────────────┴──────────────────────────────┴──────────────┘
Every agent that creates files has Write — except gsd-verifier. This is clearly an oversight.

Recommended Action

File an issue at https://github.com/gsd-build/get-shit-done with:

Title: gsd-verifier agent missing Write tool — falls back to Bash heredoc, corrupts settings.local.json

Body:
- gsd-verifier.md frontmatter has tools: Read, Bash, Grep, Glob but its instructions tell it to create VERIFICATION.md files
- Without Write, it uses Bash(cat > path << 'EOF' ... EOF) which, when user approves, saves the entire 200+ line markdown report as a permission entry in settings.local.json
- This corrupts settings.local.json and causes a "Settings Error" on every Claude Code startup
- Every other file-creating agent (executor, planner, roadmapper, debugger, codebase-mapper) includes Write
- Fix: change line 4 to tools: Read, Write, Bash, Grep, Glob
- Bug exists since initial creation (commit f3f6707, Jan 15, 2026), not a regression

Our local patch (~/.claude/agents/gsd-verifier.md line 4) adds Write but will be overwritten by /gsd:update.
