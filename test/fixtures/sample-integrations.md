# External Integrations

**Analysis Date:** 2026-02-02

## APIs & External Services

**Internal Services:**
- Customer Service - Handles customer data and preferences
  - Repository: https://github.com/company/customer-service
  - Local Path: ~/workspace/customer-service
  - SDK/Client: gRPC client v2.1
  - Auth: mTLS certificates

- Megamind Service - ML-powered recommendations
  - Repository: https://bitbucket.org/company/megamind
  - Local Path: ~/workspace/megamind
  - SDK/Client: REST API via fetch
  - Auth: Service token

- Garcon Order Service - Order processing and fulfillment
  - Repository: https://github.com/company/garcon
  - Local Path: ~/workspace/garcon-orders
  - SDK/Client: gRPC client v2.1
  - Auth: mTLS certificates

**External Services:**
- Stripe - Payment processing
  - SDK/Client: stripe npm package v14.x
  - Auth: API key in STRIPE_SECRET_KEY env var
  - Endpoints: checkout sessions, webhooks

- SendGrid - Email delivery
  - SDK/Client: @sendgrid/mail v8.x
  - Auth: API key in SENDGRID_API_KEY env var