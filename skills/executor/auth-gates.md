# Skill: Authentication Gates

This skill is loaded when plans involve external services requiring authentication.

<authentication_gates>

## When Gates Apply

Authentication gates apply when tasks require:
- External API tokens (Stripe, Twilio, SendGrid)
- OAuth configuration (Google, GitHub, Apple)
- Database connection strings (production)
- Deployment credentials (Vercel, AWS, GCP)

## Gate Protocol

**Before attempting authenticated operations:**

1. **Check for existing credentials**
   ```bash
   # Check environment
   echo $STRIPE_SECRET_KEY | head -c 10  # Just prefix to verify existence

   # Check .env files
   grep -l "STRIPE" .env* 2>/dev/null
   ```

2. **If credentials missing, return CHECKPOINT**
   ```markdown
   ## CHECKPOINT REACHED

   **Type:** human-action
   **Reason:** External service credentials needed

   ### Credentials Required

   | Service | Variable | Where to Get |
   |---------|----------|--------------|
   | Stripe | STRIPE_SECRET_KEY | dashboard.stripe.com/apikeys |

   ### How to Add

   ```bash
   echo 'STRIPE_SECRET_KEY=sk_test_...' >> .env.local
   ```

   ### Awaiting

   Add credentials and confirm, or skip this integration.
   ```

3. **If credentials exist, proceed with caution**
   - Use test/sandbox credentials when available
   - Never log full credentials
   - Verify credential validity before heavy operations

## Service-Specific Notes

### Stripe
- Test keys start with `sk_test_`
- Use test mode for all development
- Never commit keys to git

### OAuth Providers
- Require callback URL configuration
- Test with localhost URLs in dev
- May need app review for production

### Database
- Use connection pooling for production
- Test credentials with simple query first
- Never expose connection strings in logs

## Deviation Handling

If authentication fails during execution:
- Log error type (not credentials)
- Return CHECKPOINT with specific issue
- Suggest credential refresh or service status check

</authentication_gates>
