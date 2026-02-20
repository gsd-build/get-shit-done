# Phase 03: Payment Integration — Research

## Stripe Integration Patterns

### Checkout Flow
1. Client requests checkout session from backend
2. Backend creates Stripe Checkout Session with price ID
3. Client redirects to Stripe hosted checkout page
4. Stripe redirects back to success/cancel URL
5. Webhook fires with checkout.session.completed event

### Webhook Security
- Always verify webhook signatures using stripe.webhooks.constructEvent()
- Use raw body (not parsed JSON) for signature verification
- Return 200 quickly, process asynchronously if needed
- Implement idempotency using event ID

### Key Dependencies
- stripe: ^14.0.0 (Node.js SDK)
- @types/stripe: Not needed (SDK includes types since v8)

### Environment Variables
- STRIPE_SECRET_KEY: sk_test_... (test) or sk_live_... (production)
- STRIPE_WEBHOOK_SECRET: whsec_... (from webhook endpoint config)
- STRIPE_PRICE_MONTHLY: price_... (monthly subscription price ID)
- STRIPE_PRICE_ANNUAL: price_... (annual subscription price ID)

### Error Handling
- StripeAuthenticationError: Invalid API key
- StripeCardError: Payment declined
- StripeInvalidRequestError: Invalid parameters
- StripeAPIError: Stripe server issues (retry with backoff)
- StripeConnectionError: Network issues (retry)

### Testing Strategy (TDD)
- RED: Write tests for each Stripe interaction
- GREEN: Implement using Stripe test mode
- Use stripe-mock for unit tests (no network calls)
- Use actual Stripe test API for integration tests
