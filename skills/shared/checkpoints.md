# Skill: Checkpoints (Shared)

This skill defines checkpoint types used by both planner and executor.

<checkpoint_types>

## Types Overview

| Type | Frequency | Use Case |
|------|-----------|----------|
| `checkpoint:human-verify` | 90% | Confirm automated work |
| `checkpoint:decision` | 9% | Implementation choices |
| `checkpoint:human-action` | 1% | Truly unavoidable manual steps |

## checkpoint:human-verify

Human confirms Claude's automated work works correctly.

**Use for:**
- Visual UI checks (layout, styling, responsiveness)
- Interactive flows (click through wizard, test user flows)
- Functional verification (feature works as expected)
- Animation smoothness, accessibility testing

**XML structure (for planning):**
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What Claude automated]</what-built>
  <how-to-verify>
    [Exact steps to test - URLs, commands, expected behavior]
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
```

## checkpoint:decision

Human makes implementation choice that affects direction.

**Use for:**
- Technology selection (which auth provider, which database)
- Architecture decisions (monorepo vs separate repos)
- Design choices, feature prioritization

**XML structure (for planning):**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>[What's being decided]</decision>
  <context>[Why this matters]</context>
  <options>
    <option id="option-a">
      <name>[Name]</name>
      <pros>[Benefits]</pros>
      <cons>[Tradeoffs]</cons>
    </option>
  </options>
  <resume-signal>Select: option-a, option-b, or ...</resume-signal>
</task>
```

## checkpoint:human-action

Action has NO CLI/API and requires human-only interaction.

**Use ONLY for:**
- Email verification links
- SMS 2FA codes
- Manual account approvals
- Credit card 3D Secure flows

**Do NOT use for:**
- Deploying to Vercel (use `vercel` CLI)
- Creating databases (use provider CLI)
- Running builds/tests (use Bash tool)

</checkpoint_types>

<checkpoint_rules>

## Automation-First Rule

If Claude CAN do it via CLI/API, Claude MUST do it. Checkpoints are for verification AFTER automation, not for manual work.

## Placement Rules

**DO:**
- Place checkpoint AFTER all related automation completes
- Be specific: "Visit https://myapp.vercel.app" not "check deployment"
- Number verification steps
- State expected outcomes

**DON'T:**
- Place checkpoint before automation completes
- Ask human to do work Claude can automate
- Mix multiple unrelated verifications

## Anti-Patterns

**Bad - Too many checkpoints:**
```xml
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API</task>
<task type="checkpoint:human-verify">Check API</task>
```
Why bad: Verification fatigue.

**Good - Single verification checkpoint:**
```xml
<task type="auto">Create schema</task>
<task type="auto">Create API</task>
<task type="auto">Create UI</task>
<task type="checkpoint:human-verify">
  <what-built>Complete auth flow</what-built>
  <how-to-verify>Test full flow: register, login, access protected page</how-to-verify>
</task>
```

</checkpoint_rules>
