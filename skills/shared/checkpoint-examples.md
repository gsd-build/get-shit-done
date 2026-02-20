# Skill: Checkpoint Examples

Detailed examples of each checkpoint type for reference.

<checkpoint_examples>

## Example 1: Deployment Flow (Correct)

```xml
<!-- Claude automates everything -->
<task type="auto">
  <name>Deploy to Vercel</name>
  <files>.vercel/, vercel.json, package.json</files>
  <action>
    1. Run `vercel --yes` to create project and deploy
    2. Capture deployment URL from output
    3. Set environment variables with `vercel env add`
    4. Trigger production deployment with `vercel --prod`
  </action>
  <verify>
    - vercel ls shows deployment
    - curl {url} returns 200
    - Environment variables set correctly
  </verify>
  <done>App deployed to production, URL captured</done>
</task>

<!-- Human verifies visual/functional correctness -->
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Deployed to https://myapp.vercel.app</what-built>
  <how-to-verify>
    Visit https://myapp.vercel.app and confirm:
    - Homepage loads correctly
    - All images/assets load
    - Navigation works
    - No console errors
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
```

## Example 2: Database Setup (No Checkpoint Needed)

```xml
<!-- Claude automates everything -->
<task type="auto">
  <name>Create Upstash Redis database</name>
  <files>.env</files>
  <action>
    1. Run `upstash redis create myapp-cache --region us-east-1`
    2. Capture connection URL from output
    3. Write to .env: UPSTASH_REDIS_URL={url}
    4. Verify connection with test command
  </action>
  <verify>
    - upstash redis list shows database
    - .env contains UPSTASH_REDIS_URL
    - Test connection succeeds
  </verify>
  <done>Redis database created and configured</done>
</task>

<!-- NO CHECKPOINT NEEDED - Claude automated everything and verified programmatically -->
```

## Example 3: Stripe Webhooks (Correct)

```xml
<!-- Claude automates everything -->
<task type="auto">
  <name>Configure Stripe webhooks</name>
  <files>.env, src/app/api/webhooks/route.ts</files>
  <action>
    1. Use Stripe API to create webhook endpoint pointing to /api/webhooks
    2. Subscribe to events: payment_intent.succeeded, customer.subscription.updated
    3. Save webhook signing secret to .env
    4. Implement webhook handler in route.ts
  </action>
  <verify>
    - Stripe API returns webhook endpoint ID
    - .env contains STRIPE_WEBHOOK_SECRET
    - curl webhook endpoint returns 200
  </verify>
  <done>Stripe webhooks configured and handler implemented</done>
</task>

<!-- Human verifies in Stripe dashboard -->
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Stripe webhook configured via API</what-built>
  <how-to-verify>
    Visit Stripe Dashboard > Developers > Webhooks
    Confirm: Endpoint shows https://myapp.com/api/webhooks with correct events
  </how-to-verify>
  <resume-signal>Type "yes" if correct</resume-signal>
</task>
```

## Example 4: Full Auth Flow Verification (Correct)

```xml
<task type="auto">
  <name>Create user schema</name>
  <files>src/db/schema.ts</files>
  <action>Define User, Session, Account tables with Drizzle ORM</action>
  <verify>npm run db:generate succeeds</verify>
</task>

<task type="auto">
  <name>Create auth API routes</name>
  <files>src/app/api/auth/[...nextauth]/route.ts</files>
  <action>Set up NextAuth with GitHub provider, JWT strategy</action>
  <verify>TypeScript compiles, no errors</verify>
</task>

<task type="auto">
  <name>Create login UI</name>
  <files>src/app/login/page.tsx, src/components/LoginButton.tsx</files>
  <action>Create login page with GitHub OAuth button</action>
  <verify>npm run build succeeds</verify>
</task>

<task type="auto">
  <name>Start dev server for auth testing</name>
  <action>Run `npm run dev` in background, wait for ready signal</action>
  <verify>curl http://localhost:3000 returns 200</verify>
  <done>Dev server running at http://localhost:3000</done>
</task>

<!-- ONE checkpoint at end verifies the complete flow - Claude already started server -->
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete authentication flow - dev server running at http://localhost:3000</what-built>
  <how-to-verify>
    1. Visit: http://localhost:3000/login
    2. Click "Sign in with GitHub"
    3. Complete GitHub OAuth flow
    4. Verify: Redirected to /dashboard, user name displayed
    5. Refresh page: Session persists
    6. Click logout: Session cleared
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
```

## Example 5: Vercel Deployment with UI Component

```xml
<task type="auto">
  <name>Deploy to Vercel</name>
  <files>.vercel/, vercel.json</files>
  <action>Run `vercel --yes` to create project and deploy. Capture deployment URL from output.</action>
  <verify>vercel ls shows deployment, curl {url} returns 200</verify>
  <done>App deployed, URL captured</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Deployed to Vercel at https://myapp-abc123.vercel.app</what-built>
  <how-to-verify>
    Visit https://myapp-abc123.vercel.app and confirm:
    - Homepage loads without errors
    - Login form is visible
    - No console errors in browser DevTools
  </how-to-verify>
  <resume-signal>Type "approved" to continue, or describe issues to fix</resume-signal>
</task>
```

## Example 6: Responsive UI Component

```xml
<task type="auto">
  <name>Build responsive dashboard layout</name>
  <files>src/components/Dashboard.tsx, src/app/dashboard/page.tsx</files>
  <action>Create dashboard with sidebar, header, and content area. Use Tailwind responsive classes for mobile.</action>
  <verify>npm run build succeeds, no TypeScript errors</verify>
  <done>Dashboard component builds without errors</done>
</task>

<task type="auto">
  <name>Start dev server for verification</name>
  <action>Run `npm run dev` in background, wait for "ready" message, capture port</action>
  <verify>curl http://localhost:3000 returns 200</verify>
  <done>Dev server running at http://localhost:3000</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Responsive dashboard layout - dev server running at http://localhost:3000</what-built>
  <how-to-verify>
    Visit http://localhost:3000/dashboard and verify:
    1. Desktop (>1024px): Sidebar left, content right, header top
    2. Tablet (768px): Sidebar collapses to hamburger menu
    3. Mobile (375px): Single column layout, bottom nav appears
    4. No layout shift or horizontal scroll at any size
  </how-to-verify>
  <resume-signal>Type "approved" or describe layout issues</resume-signal>
</task>
```

## Example 7: Xcode Build Verification

```xml
<task type="auto">
  <name>Build macOS app with Xcode</name>
  <files>App.xcodeproj, Sources/</files>
  <action>Run `xcodebuild -project App.xcodeproj -scheme App build`. Check for compilation errors in output.</action>
  <verify>Build output contains "BUILD SUCCEEDED", no errors</verify>
  <done>App builds successfully</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Built macOS app at DerivedData/Build/Products/Debug/App.app</what-built>
  <how-to-verify>
    Open App.app and test:
    - App launches without crashes
    - Menu bar icon appears
    - Preferences window opens correctly
    - No visual glitches or layout issues
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
```

</checkpoint_examples>
