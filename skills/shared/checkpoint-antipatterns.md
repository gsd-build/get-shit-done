# Skill: Checkpoint Anti-Patterns

Common mistakes when writing checkpoints and how to fix them.

<checkpoint_antipatterns>

## ❌ BAD: Asking user to start dev server

```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dashboard component</what-built>
  <how-to-verify>
    1. Run: npm run dev
    2. Visit: http://localhost:3000/dashboard
    3. Check layout is correct
  </how-to-verify>
</task>
```

**Why bad:** Claude can run `npm run dev`. User should only visit URLs, not execute commands.

## ✅ GOOD: Claude starts server, user visits

```xml
<task type="auto">
  <name>Start dev server</name>
  <action>Run `npm run dev` in background</action>
  <verify>curl localhost:3000 returns 200</verify>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dashboard at http://localhost:3000/dashboard (server running)</what-built>
  <how-to-verify>
    Visit http://localhost:3000/dashboard and verify:
    1. Layout matches design
    2. No console errors
  </how-to-verify>
</task>
```

## ❌ BAD: Asking user to add env vars in dashboard

```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>Add environment variables to Convex</action>
  <instructions>
    1. Go to dashboard.convex.dev
    2. Select your project
    3. Navigate to Settings → Environment Variables
    4. Add OPENAI_API_KEY with your key
  </instructions>
</task>
```

**Why bad:** Convex has `npx convex env set`. Claude should ask for the key value, then run the CLI command.

## ✅ GOOD: Claude collects secret, adds via CLI

```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>Provide your OpenAI API key</action>
  <instructions>
    I need your OpenAI API key. Get it from: https://platform.openai.com/api-keys
    Paste the key below (starts with sk-)
  </instructions>
  <verification>I'll configure it via CLI</verification>
  <resume-signal>Paste your key</resume-signal>
</task>

<task type="auto">
  <name>Add OpenAI key to Convex</name>
  <action>Run `npx convex env set OPENAI_API_KEY {key}`</action>
  <verify>`npx convex env get` shows OPENAI_API_KEY configured</verify>
</task>
```

## ❌ BAD: Asking human to deploy

```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>Deploy to Vercel</action>
  <instructions>
    1. Visit vercel.com/new
    2. Import Git repository
    3. Click Deploy
    4. Copy deployment URL
  </instructions>
  <verification>Deployment exists</verification>
  <resume-signal>Paste URL</resume-signal>
</task>
```

**Why bad:** Vercel has a CLI. Claude should run `vercel --yes`.

## ✅ GOOD: Claude automates, human verifies

```xml
<task type="auto">
  <name>Deploy to Vercel</name>
  <action>Run `vercel --yes`. Capture URL.</action>
  <verify>vercel ls shows deployment, curl returns 200</verify>
</task>

<task type="checkpoint:human-verify">
  <what-built>Deployed to {url}</what-built>
  <how-to-verify>Visit {url}, check homepage loads</how-to-verify>
  <resume-signal>Type "approved"</resume-signal>
</task>
```

## ❌ BAD: Too many checkpoints

```xml
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API route</task>
<task type="checkpoint:human-verify">Check API</task>
<task type="auto">Create UI form</task>
<task type="checkpoint:human-verify">Check form</task>
```

**Why bad:** Verification fatigue. Combine into one checkpoint at end.

## ✅ GOOD: Single verification checkpoint

```xml
<task type="auto">Create schema</task>
<task type="auto">Create API route</task>
<task type="auto">Create UI form</task>

<task type="checkpoint:human-verify">
  <what-built>Complete auth flow (schema + API + UI)</what-built>
  <how-to-verify>Test full flow: register, login, access protected page</how-to-verify>
  <resume-signal>Type "approved"</resume-signal>
</task>
```

## ❌ BAD: Asking for automatable file operations

```xml
<task type="checkpoint:human-action">
  <action>Create .env file</action>
  <instructions>
    1. Create .env in project root
    2. Add: DATABASE_URL=...
    3. Add: STRIPE_KEY=...
  </instructions>
</task>
```

**Why bad:** Claude has Write tool. This should be `type="auto"`.

## ❌ BAD: Vague verification steps

```xml
<task type="checkpoint:human-verify">
  <what-built>Dashboard</what-built>
  <how-to-verify>Check it works</how-to-verify>
  <resume-signal>Continue</resume-signal>
</task>
```

**Why bad:** No specifics. User doesn't know what to test or what "works" means.

## ✅ GOOD: Specific verification steps (server already running)

```xml
<task type="checkpoint:human-verify">
  <what-built>Responsive dashboard - server running at http://localhost:3000</what-built>
  <how-to-verify>
    Visit http://localhost:3000/dashboard and verify:
    1. Desktop (>1024px): Sidebar visible, content area fills remaining space
    2. Tablet (768px): Sidebar collapses to icons
    3. Mobile (375px): Sidebar hidden, hamburger menu in header
    4. No horizontal scroll at any size
  </how-to-verify>
  <resume-signal>Type "approved" or describe layout issues</resume-signal>
</task>
```

## ❌ BAD: Asking user to run any CLI command

```xml
<task type="checkpoint:human-action">
  <action>Run database migrations</action>
  <instructions>
    1. Run: npx prisma migrate deploy
    2. Run: npx prisma db seed
    3. Verify tables exist
  </instructions>
</task>
```

**Why bad:** Claude can run these commands. User should never execute CLI commands.

## ❌ BAD: Asking user to copy values between services

```xml
<task type="checkpoint:human-action">
  <action>Configure webhook URL in Stripe</action>
  <instructions>
    1. Copy the deployment URL from terminal
    2. Go to Stripe Dashboard → Webhooks
    3. Add endpoint with URL + /api/webhooks
    4. Copy webhook signing secret
    5. Add to .env file
  </instructions>
</task>
```

**Why bad:** Stripe has an API. Claude should create the webhook via API and write to .env directly.

</checkpoint_antipatterns>
