<overview>
Plans execute autonomously. Checkpoints formalize interaction points where human verification or decisions are needed.

**Core principle:** Claude automates everything with CLI/API. Checkpoints are for verification and decisions, not manual work.
</overview>

<checkpoint_types>

## checkpoint:human-verify (90% of checkpoints)

**When:** Claude completed automated work, human confirms it works correctly.

**Use for:** Visual UI checks, interactive flows, functional verification, audio/video quality, animation smoothness, accessibility testing.

**Structure:**
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What Claude automated]</what-built>
  <how-to-verify>[Numbered steps - URLs, commands, expected behavior]</how-to-verify>
  <resume-signal>[How to continue - "approved" or describe issues]</resume-signal>
</task>
```

**Example:**
```xml
<task type="auto">
  <name>Deploy to Vercel</name>
  <action>Run `vercel --yes` to deploy. Capture URL.</action>
  <verify>vercel ls shows deployment, curl {url} returns 200</verify>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Deployed to https://myapp.vercel.app</what-built>
  <how-to-verify>
    Visit URL and confirm:
    1. Homepage loads without errors
    2. All images/assets load
    3. No console errors
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
```

## checkpoint:decision (9% of checkpoints)

**When:** Human must make choice that affects implementation direction.

**Use for:** Technology selection, architecture decisions, design choices, feature prioritization.

**Structure:**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>[What's being decided]</decision>
  <context>[Why this matters]</context>
  <options>
    <option id="option-a"><name>[Name]</name><pros>[Benefits]</pros><cons>[Tradeoffs]</cons></option>
    <option id="option-b"><name>[Name]</name><pros>[Benefits]</pros><cons>[Tradeoffs]</cons></option>
  </options>
  <resume-signal>[How to indicate choice]</resume-signal>
</task>
```

**Example:**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>Select authentication provider</decision>
  <context>Need user auth. Three options with different tradeoffs.</context>
  <options>
    <option id="supabase"><name>Supabase Auth</name><pros>Built-in with DB, free tier, RLS integration</pros><cons>Less customizable, ecosystem lock-in</cons></option>
    <option id="clerk"><name>Clerk</name><pros>Beautiful UI, best DX</pros><cons>Paid after 10k MAU</cons></option>
    <option id="nextauth"><name>NextAuth.js</name><pros>Free, self-hosted, max control</pros><cons>More setup, DIY security</cons></option>
  </options>
  <resume-signal>Select: supabase, clerk, or nextauth</resume-signal>
</task>
```

## checkpoint:human-action (1% - rare)

**When:** Action has NO CLI/API and requires human-only interaction.

**Use ONLY for:** Email verification links, SMS 2FA codes, manual account approvals, 3D Secure payment flows, OAuth app approvals.

**Do NOT use for:** Deployments (use CLI), creating resources (use CLI/API), builds/tests (use Bash), file operations (use Write/Edit).

**Structure:**
```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>[Unavoidable manual step]</action>
  <instructions>[What Claude automated] [ONE thing requiring human action]</instructions>
  <verification>[What Claude checks afterward]</verification>
  <resume-signal>[How to continue]</resume-signal>
</task>
```

**Example (email verification):**
```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>Complete email verification for SendGrid account</action>
  <instructions>
    I created the account and requested verification email.
    Check your inbox for verification link and click it.
  </instructions>
  <verification>SendGrid API key works: curl test succeeds</verification>
  <resume-signal>Type "done" when verified</resume-signal>
</task>
```

</checkpoint_types>

<execution_protocol>

When Claude encounters `type="checkpoint:*"`:

1. **Stop immediately** - do not proceed to next task
2. **Display checkpoint clearly:**

```
════════════════════════════════════════
CHECKPOINT: [Type]
════════════════════════════════════════

Task [X] of [Y]: [Name]

[Checkpoint-specific content]

[Resume signal instruction]
════════════════════════════════════════
```

3. **Wait for user response** - do not hallucinate completion
4. **Verify if possible** - check files, run tests
5. **Resume execution** - continue only after confirmation

</execution_protocol>

<authentication_gates>

**Critical:** When Claude tries CLI/API and gets auth error, this is NOT a failure - it's a gate requiring human input to unblock automation.

**Pattern:** Claude tries automation → auth error → creates checkpoint → you authenticate → Claude retries → continues

**Gate protocol:**
1. Recognize it's not a failure - missing auth is expected
2. Stop current task - don't retry repeatedly
3. Create checkpoint:human-action dynamically
4. Provide exact authentication steps
5. Verify authentication works
6. Retry the original task
7. Continue normally

**Example (Vercel auth gate):**
```xml
<!-- Claude tries to deploy -->
<task type="auto">
  <name>Deploy to Vercel</name>
  <action>Run `vercel --yes` to deploy</action>
</task>

<!-- If vercel returns "Error: Not authenticated" -->
<task type="checkpoint:human-action" gate="blocking">
  <action>Authenticate Vercel CLI so I can continue</action>
  <instructions>
    I tried to deploy but got authentication error.
    Run: vercel login (opens browser)
  </instructions>
  <verification>vercel whoami returns your account</verification>
  <resume-signal>Type "done" when authenticated</resume-signal>
</task>

<!-- After auth, Claude retries automatically -->
<task type="auto">
  <name>Retry deployment</name>
  <action>Run `vercel --yes` (now authenticated)</action>
</task>
```

**Key distinction:**
- Pre-planned checkpoint: "I need you to do X" (wrong - Claude should automate)
- Auth gate: "I tried to automate X but need credentials" (correct - unblocks automation)

</authentication_gates>

<automation_reference>

**The rule:** If it has CLI/API, Claude does it. Never ask human to perform automatable work.

| Service | CLI/API | Key Commands | Auth Gate |
|---------|---------|--------------|-----------|
| Vercel | `vercel` | `--yes`, `env add`, `--prod`, `ls` | `vercel login` |
| Railway | `railway` | `init`, `up`, `variables set` | `railway login` |
| Fly | `fly` | `launch`, `deploy`, `secrets set` | `fly auth login` |
| Stripe | `stripe` + API | `listen`, `trigger`, API calls | API key in .env |
| Supabase | `supabase` | `init`, `link`, `db push`, `gen types` | `supabase login` |
| Upstash | `upstash` | `redis create`, `redis get` | `upstash auth login` |
| PlanetScale | `pscale` | `database create`, `branch create` | `pscale auth login` |
| GitHub | `gh` | `repo create`, `pr create`, `secret set` | `gh auth login` |
| Node | `npm`/`pnpm` | `install`, `run build`, `test` | N/A |
| Xcode | `xcodebuild` | `-project`, `-scheme`, `build`, `test` | N/A |

**Env files:** Use Write/Edit tools. Never ask human to create .env manually.

**Quick reference:**

| Action | Automatable? | Claude does it? |
|--------|--------------|-----------------|
| Deploy to Vercel | Yes (`vercel`) | YES |
| Create Stripe webhook | Yes (API) | YES |
| Write .env file | Yes (Write tool) | YES |
| Create Upstash DB | Yes (`upstash`) | YES |
| Run tests | Yes (`npm test`) | YES |
| Click email verification link | No | NO |
| Enter credit card with 3DS | No | NO |

</automation_reference>

<guidelines>

**DO:**
- Automate everything with CLI/API before checkpoint
- Be specific: "Visit https://myapp.vercel.app" not "check deployment"
- Number verification steps
- State expected outcomes
- Make verification executable

**DON'T:**
- Ask human to do work Claude can automate
- Assume knowledge: "Configure the usual settings"
- Mix multiple verifications in one checkpoint
- Use checkpoints too frequently (verification fatigue)

**Placement:**
- After automation completes (not before)
- After UI buildout
- Before dependent work (decisions)
- At integration points

</guidelines>

<anti_patterns>

**BAD: Asking human to automate**
```xml
<task type="checkpoint:human-action">
  <action>Deploy to Vercel</action>
  <instructions>Visit vercel.com/new, import repo, click Deploy</instructions>
</task>
```
Why bad: Vercel has CLI. Use `vercel --yes`.

**BAD: Too many checkpoints**
```xml
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API</task>
<task type="checkpoint:human-verify">Check API</task>
```
Why bad: Verification fatigue. Combine into one checkpoint at end.

**GOOD: Claude automates, human verifies once**
```xml
<task type="auto">Create schema</task>
<task type="auto">Create API</task>
<task type="auto">Create UI</task>

<task type="checkpoint:human-verify">
  <what-built>Complete auth flow</what-built>
  <how-to-verify>Test full flow: register, login, access protected page</how-to-verify>
</task>
```

</anti_patterns>

<summary>

**The golden rule:** If Claude CAN automate it, Claude MUST automate it.

**Checkpoint priority:**
1. **checkpoint:human-verify** (90%) - Claude automated, human confirms visual/functional correctness
2. **checkpoint:decision** (9%) - Human makes architectural/technology choices
3. **checkpoint:human-action** (1%) - Truly unavoidable manual steps with no API/CLI

**When NOT to use checkpoints:**
- Things Claude can verify programmatically (tests, builds)
- File operations (Claude can read/write)
- Anything with CLI/API available

</summary>
