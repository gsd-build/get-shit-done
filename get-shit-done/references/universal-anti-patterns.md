# Universal Anti-Patterns

Rules that apply to ALL workflows and agents. Individual workflows may have additional specific anti-patterns.

---

## Context Budget Rules

1. **Never** read agent definition files (`agents/*.md`) -- `subagent_type` auto-loads them. Reading agent definitions into the orchestrator wastes context for content automatically injected into subagent sessions.
2. **Never** inline large files into subagent prompts -- tell agents to read files from disk instead. Agents have their own context windows.
3. **Read depth scales with context window** -- check `context_window_tokens` in `.planning/config.json`. At < 500000: read only frontmatter, status fields, or summaries. At >= 500000 (1M model): full body reads permitted when content is needed for inline decisions. See `references/context-budget.md` for the complete table.
4. **Delegate** heavy work to subagents -- the orchestrator routes, it does not build, analyze, research, investigate, or verify.
5. **Proactive pause warning**: If you have already consumed significant context (large file reads, multiple subagent results), warn the user: "Context budget is getting heavy. Consider checkpointing progress."

## File Reading Rules

6. **SUMMARY.md read depth scales with context window** -- at context_window_tokens < 500000: read frontmatter only from prior phase SUMMARYs. At >= 500000: full body reads permitted for direct-dependency phases. Transitive dependencies (2+ phases back) remain frontmatter-only regardless.
7. **Never** read full PLAN.md files from other phases -- only current phase plans.
8. **Never** read `.planning/logs/` files -- only the health workflow reads these.
9. **Do not** re-read full file contents when frontmatter is sufficient -- frontmatter contains status, key_files, commits, and provides fields. Exception: at >= 500000, re-reading full body is acceptable when semantic content is needed.

## Subagent Rules

10. **NEVER** use non-GSD agent types (`general-purpose`, `Explore`, `Plan`, `Bash`, `feature-dev`, etc.) -- ALWAYS use `subagent_type: "gsd-{agent}"` (e.g., `gsd-phase-researcher`, `gsd-executor`, `gsd-planner`). GSD agents have project-aware prompts, audit logging, and workflow context. Generic agents bypass all of this.
11. **Do not** re-litigate decisions that are already locked in CONTEXT.md (or PROJECT.md ## Context section) -- respect locked decisions unconditionally.

## Questioning Anti-Patterns

Reference: `references/questioning.md` for the full anti-pattern list.

12. **Do not** walk through checklists -- checklist walking (asking items one by one from a list) is the #1 anti-pattern. Instead, use progressive depth: start broad, dig where interesting.
13. **Do not** use corporate speak -- avoid jargon like "stakeholder alignment", "synergize", "deliverables". Use plain language.
14. **Do not** apply premature constraints -- don't narrow the solution space before understanding the problem. Ask about the problem first, then constrain.

## State Management Anti-Patterns

15. **No direct Write/Edit to STATE.md or ROADMAP.md for mutations.** Always use `gsd-tools.cjs` CLI commands (`state update`, `state advance-plan`, `roadmap update-status`) for mutations. Direct Write tool usage bypasses safe update logic and is unsafe in multi-session environments. Exception: first-time creation of STATE.md from template is allowed.

## Behavioral Rules

16. **Do not** create artifacts the user did not approve -- always confirm before writing new planning documents.
17. **Do not** modify files outside the workflow's stated scope -- check the plan's files_modified list.
18. **Do not** suggest multiple next actions without clear priority -- one primary suggestion, alternatives listed secondary.
19. **Do not** use `git add .` or `git add -A` -- stage specific files only.
20. **Do not** include sensitive information (API keys, passwords, tokens) in planning documents or commits.

## Error Recovery Rules

21. **Git lock detection**: Before any git operation, if it fails with "Unable to create lock file", check for stale `.git/index.lock` and advise the user to remove it (do not remove automatically).
22. **Config fallback awareness**: Config loading returns `null` silently on invalid JSON. If your workflow depends on config values, check for null and warn the user: "config.json is invalid or missing -- running with defaults."
23. **Partial state recovery**: If STATE.md references a phase directory that doesn't exist, do not proceed silently. Warn the user and suggest diagnosing the mismatch.

## GSD-Specific Rules

24. **Do not** check for `mode === 'auto'` or `mode === 'autonomous'` -- GSD uses `yolo` config flag. Check `yolo: true` for autonomous mode, absence or `false` for interactive mode.
25. **Always use `gsd-tools.cjs`** (not `gsd-tools.js` or any other variant) -- GSD uses CommonJS for Node.js CLI compatibility.
26. **Plan files MUST follow `{padded_phase}-{NN}-PLAN.md` pattern** (e.g., `01-01-PLAN.md`). Never use `PLAN-01.md`, `plan-01.md`, or any other variation -- gsd-tools detection depends on this exact pattern.
27. **Do not start executing the next plan before writing the SUMMARY.md for the current plan** -- downstream plans may reference it via `@` includes.

## iOS / Apple Platform Rules

28. **NEVER use `Package.swift` + `.executableTarget` (or `.target`) as the primary build system for iOS apps.** SPM executable targets produce macOS CLI binaries, not iOS `.app` bundles. They cannot be installed on iOS devices or submitted to the App Store. Use XcodeGen (`project.yml` + `xcodegen generate`) to create a proper `.xcodeproj`. See `references/ios-scaffold.md` for the full pattern.
29. **Verify SwiftUI API availability before use.** Many SwiftUI APIs require a specific minimum iOS version (e.g., `NavigationSplitView` is iOS 16+, `List(selection:)` with multi-select and `@Observable` require iOS 17). If a plan uses an API that exceeds the declared `IPHONEOS_DEPLOYMENT_TARGET`, raise the deployment target or add `#available` guards.
