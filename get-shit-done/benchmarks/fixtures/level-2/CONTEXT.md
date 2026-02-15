# Phase 02: Authentication — Context

## Decisions (LOCKED)

- **Auth method:** JWT with refresh tokens (not sessions)
- **Password hashing:** bcrypt with salt rounds = 12
- **Token storage:** Access token in memory, refresh token in httpOnly cookie
- **Email validation:** RFC 5322 compliant, case-insensitive uniqueness

## Claude's Discretion

- Database query patterns (ORM vs raw SQL)
- Test framework choice
- Error response format

## Deferred Ideas

- OAuth/social login (future milestone)
- 2FA/MFA (future milestone)
- Password reset flow (Phase 04)
