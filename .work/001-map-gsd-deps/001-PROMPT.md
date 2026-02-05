# 001: Map dependencies for @commands/gsd/new-project.md

## Objective
List **all** files that are loaded/referenced when running the command `@commands/gsd/new-project.md` in this repo. The output must be exhaustive and user-facing.

## Context
Repo: `claude-code-resources/get-shit-done`.
We need a dependency map for the `@commands/gsd/new-project.md` command. This includes any files it directly references and any files referenced transitively by workflows/templates it invokes. The final list should be presented in the SUMMARY.

Constraints:
- Do not guess. Trace actual references.
- Include paths for every file referenced/loaded.
- If a file is included conditionally, still list it and note the condition.
- If the command invokes a workflow that in turn references templates or other files, include those as well.

## Process
1. Open `commands/gsd/new-project.md` and identify explicit references (workflows, templates, other commands, include directives).
   - Validation: list all direct references with file paths.

2. Follow each referenced file and enumerate any additional files it loads/references (e.g., workflows → templates → references).
   - Validation: for each file, list its outbound references.

3. Produce a complete, de-duplicated list of all files involved in the execution path.
   - Validation: no referenced file omitted; no paths outside repo unless explicitly referenced.

4. Write `001-SUMMARY.md` with the full list and a short explanation of how you derived it.

## Verification
- Re-open each referenced file to ensure no dependencies missed.

## Success Criteria
- [ ] SUMMARY includes a complete list of every file loaded/referenced by `@commands/gsd/new-project.md`.
- [ ] Conditional references are noted.
- [ ] No guesses; each item is traceable to a reference in files.
