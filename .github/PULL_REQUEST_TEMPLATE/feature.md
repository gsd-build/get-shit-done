## Feature PR

> **Using the wrong template?**
> — Bug fix: use [fix.md](?template=fix.md)
> — Enhancement to existing behavior: use [enhancement.md](?template=enhancement.md)

---

## Linked Issue

> **Required.** This PR will be auto-closed if no valid issue link is found.
> The linked issue **must** have the `approved-feature` label. If it does not, this PR will be closed without review — no exceptions.

Closes #

> ⛔ **No `approved-feature` label on the issue = immediate close.**
> Do not open this PR if a maintainer has not yet approved the feature spec.
> Do not open this PR if you wrote code before the issue was approved.

---

## Feature summary

<!-- One paragraph. What does this feature add? Assume the reviewer has read the issue spec. -->

## What changed

### New files

<!-- List every new file added and its purpose. -->

| File | Purpose |
|------|---------|
| | |

### Modified files

<!-- List every existing file modified and what changed in it. -->

| File | What changed |
|------|-------------|
| | |

## Implementation notes

<!-- Describe any decisions made during implementation that were not specified in the issue.
     If any part of the implementation differs from the approved spec, explain why. -->

## Spec compliance

<!-- For each acceptance criterion in the linked issue, confirm it is met. Copy them here and check them off. -->

- [ ] <!-- Acceptance criterion 1 from issue -->
- [ ] <!-- Acceptance criterion 2 from issue -->
- [ ] <!-- Add all criteria from the issue -->

## Testing

### Test coverage

<!-- Describe what is tested and where. New features require new tests — no exceptions. -->

### Platforms tested

- [ ] macOS
- [ ] Windows (including backslash path handling)
- [ ] Linux

### Runtimes tested

- [ ] Claude Code
- [ ] Gemini CLI
- [ ] OpenCode
- [ ] Codex
- [ ] Copilot
- [ ] Other: ___
- [ ] N/A — specify which runtimes are supported and why others are excluded

---

## Scope confirmation

- [ ] The implementation matches the scope approved in the linked issue exactly
- [ ] No additional features, commands, or behaviors were added beyond what was approved
- [ ] If scope changed during implementation, I updated the issue spec and received re-approval

---

## Checklist

- [ ] Issue linked above with `Closes #NNN` — **PR will be auto-closed if missing**
- [ ] Linked issue has the `approved-feature` label — **PR will be closed if missing**
- [ ] All acceptance criteria from the issue are met (listed above)
- [ ] Implementation scope matches the approved spec exactly
- [ ] All existing tests pass (`npm test`)
- [ ] New tests cover the happy path, error cases, and edge cases
- [ ] CHANGELOG.md updated with a user-facing description of the feature
- [ ] Documentation updated — commands, workflows, references, README if applicable
- [ ] No unnecessary external dependencies added
- [ ] Works on Windows (backslash paths handled)

## Breaking changes

<!-- Describe any behavior, output format, file schema, or API changes that affect existing users.
     For each breaking change, describe the migration path.
     Write "None" only if you are certain. -->

None

## Screenshots / recordings

<!-- If this feature has any visual output or changes the user experience, include before/after screenshots
     or a short recording. Delete this section if not applicable. -->
