---
phase: "03"
plan: "01"
name: stripe-setup
wave: 1
depends_on: []
type: tdd
files_modified:
  - src/services/stripe.ts
  - src/config/stripe.ts
  - tests/stripe.test.ts
  - .env.example
autonomous: false
user_setup:
  - service: stripe
    env_vars:
      - STRIPE_SECRET_KEY
      - STRIPE_WEBHOOK_SECRET
    account_setup:
      - "Create Stripe account at stripe.com"
      - "Enable test mode"
    dashboard_config:
      - "Create product and price in Stripe dashboard"
---

# Phase 03 Plan 01: Stripe SDK Setup (TDD)

<objective>
Set up Stripe SDK integration with type-safe configuration and test the connection using TDD approach.
</objective>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/02-auth/02-03-SUMMARY.md
@.planning/phases/03-payments/03-CONTEXT.md
</context>

<behavior>
The Stripe service module should:
1. Initialize Stripe client with API key from environment
2. Validate API key format before use
3. Provide typed wrapper functions for product listing
4. Handle Stripe API errors with proper error types
5. Support test mode detection
</behavior>

<implementation>
- Use stripe npm package
- Create src/services/stripe.ts as singleton
- Create src/config/stripe.ts for configuration
- Type all Stripe responses
</implementation>

<tasks>

<task id="1" type="checkpoint:human-action">
<name>Verify Stripe credentials</name>
<what>Ensure Stripe test API keys are configured in .env.local</what>
<verify>
1. Check .env.local has STRIPE_SECRET_KEY starting with sk_test_
2. Check .env.local has STRIPE_WEBHOOK_SECRET starting with whsec_
</verify>
<resume_signal>Type "done" when Stripe keys are configured</resume_signal>
</task>

<task id="2" type="auto" tdd="true">
<name>RED: Write failing test for Stripe client initialization</name>
<what>Write test that expects stripe client to initialize with valid key and throw on invalid key.</what>
<files>tests/stripe.test.ts</files>
<verification>npm test -- --grep "stripe" fails (RED phase)</verification>
<done>Test exists and fails because implementation doesn't exist yet</done>
</task>

<task id="3" type="auto" tdd="true">
<name>GREEN: Implement Stripe client</name>
<what>Create stripe service that passes the failing test.</what>
<files>src/services/stripe.ts, src/config/stripe.ts</files>
<verification>npm test -- --grep "stripe" passes (GREEN phase)</verification>
<done>All stripe tests pass</done>
</task>

<task id="4" type="checkpoint:human-verify">
<name>Verify Stripe connection</name>
<what>Confirm Stripe SDK connects to test account.</what>
<verify>
1. Run: npx ts-node -e "import {stripe} from './src/services/stripe'; stripe.products.list({limit:1}).then(p => console.log('Connected:', p.data.length >= 0))"
2. Should print "Connected: true"
</verify>
<resume_signal>Type "approved" or describe issues</resume_signal>
</task>

</tasks>

<must_haves>
- Stripe SDK initializes with environment key
- Invalid API key throws typed error
- Test mode detection works
- TDD cycle completed (RED → GREEN)
</must_haves>

<success_criteria>
- [ ] Tests written before implementation (TDD RED)
- [ ] Implementation passes tests (TDD GREEN)
- [ ] Stripe client connects to test account
- [ ] Type-safe configuration
</success_criteria>
