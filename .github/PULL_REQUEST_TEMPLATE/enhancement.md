## Enhancement PR

> **Using the wrong template?**
> — Bug fix: use [fix.md](?template=fix.md)
> — New feature: use [feature.md](?template=feature.md)

---

## Linked Issue

> **Required.** This PR will be auto-closed if no valid issue link is found.
> The linked issue **must** have the `approved-enhancement` label. If it does not, this PR will be closed without review.

Closes #

> ⛔ **No `approved-enhancement` label on the issue = immediate close.**
> Do not open this PR if a maintainer has not yet approved the enhancement proposal.

---

## What this enhancement improves

<!-- Name the specific command, workflow, or behavior being improved. -->

## Before / After

**Before:**
<!-- Describe or show the current behavior. Include example output if applicable. -->

**After:**
<!-- Describe or show the behavior after this enhancement. Include example output if applicable. -->

## How it was implemented

<!-- Brief description of the approach. Point to the key files changed. -->

## Testing

### How I verified the enhancement works

<!-- Manual steps or automated tests. -->

### Platforms tested

- [ ] macOS
- [ ] Windows (including backslash path handling)
- [ ] Linux
- [ ] N/A (not platform-specific)

### Runtimes tested

- [ ] Claude Code
- [ ] Gemini CLI
- [ ] OpenCode
- [ ] Other: ___
- [ ] N/A (not runtime-specific)

---

## Scope confirmation

<!-- Confirm the implementation matches the approved proposal. -->

- [ ] The implementation matches the scope approved in the linked issue — no additions or removals
- [ ] If scope changed during implementation, I updated the issue and got re-approval before continuing

---

## Checklist

- [ ] Issue linked above with `Closes #NNN` — **PR will be auto-closed if missing**
- [ ] Linked issue has the `approved-enhancement` label — **PR will be closed if missing**
- [ ] Changes are scoped to the approved enhancement — nothing extra included
- [ ] All existing tests pass (`npm test`)
- [ ] New or updated tests cover the enhanced behavior
- [ ] CHANGELOG.md updated
- [ ] Documentation updated if behavior or output changed
- [ ] No unnecessary dependencies added

## Breaking changes

<!-- Does this enhancement change any existing behavior, output format, or API?
     If yes, describe exactly what changes and confirm backward compatibility.
     Write "None" if not applicable. -->

None
