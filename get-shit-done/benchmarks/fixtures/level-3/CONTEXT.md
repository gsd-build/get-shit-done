# Phase 03: Payment Integration — Context

## Decisions (LOCKED)

- **Payment provider:** Stripe (not PayPal, not custom)
- **Integration pattern:** Stripe Checkout (hosted page, not Elements)
- **Subscription model:** Monthly and annual plans
- **Webhook handling:** Verify signatures, idempotent processing
- **Currency:** USD only for v1
- **Testing approach:** TDD for all payment logic

## Claude's Discretion

- Error handling patterns for Stripe API failures
- Retry strategy for webhook processing
- Database schema for subscription tracking
- Test fixture approach (mock vs Stripe test mode)

## Deferred Ideas

- Multi-currency support (v2)
- Invoicing (v2)
- Usage-based billing (v2)
- Stripe Connect for marketplace (v3)
