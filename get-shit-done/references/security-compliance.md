# Security Compliance Reference

Project security compliance level. Asked once in `/gsd:new-project`, stored in PROJECT.md and config.json.

## Levels

| Level | Use Case | Key Focus |
|-------|----------|-----------|
| none | Internal tools, prototypes | OWASP basics |
| soc2 | B2B SaaS, enterprise | Trust services (security, availability, confidentiality) |
| hipaa | Healthcare apps | PHI protection, audit trails |
| pci-dss | Payments, e-commerce | Card data protection |
| iso27001 | Enterprise ISMS | Risk-based security management |

## Level: none

Basic security. No formal compliance.

**Required tests:**
```
# Input validation
- validates input length
- encodes HTML output
- no hardcoded secrets in code
- uses HTTPS for external calls
```

## Level: soc2

SOC 2 Type II. Trust services criteria.

**Required tests (includes 'none' plus):**
```
# Access control
- denies unauthenticated access
- enforces role-based permissions
- session expires after inactivity

# Audit logging
- logs authentication attempts
- logs data access with user ID
- audit logs are immutable

# Encryption
- data encrypted at rest
- TLS 1.2+ for all connections
- secrets stored in vault, not code
```

## Level: hipaa

Healthcare data protection. Protects PHI.

**Required tests (includes 'soc2' plus):**
```
# PHI protection
- PHI masked in all logs
- PHI encrypted at rest and transit
- no PHI in URLs or query params

# Access control
- minimum necessary access enforced
- access revocation is immediate

# Audit
- all PHI access logged
- audit logs retained 6 years
- logs include user, action, timestamp, PHI type
```

## Level: pci-dss

Payment card data protection.

**Required tests (includes 'soc2' plus):**
```
# Cardholder data
- PAN never logged, even partial
- CVV never stored
- PAN masked in UI, show last 4 only
- stored PAN encrypted with AES-256

# Authentication
- passwords minimum 12 chars
- MFA required for admin access
- lockout after 6 failed attempts
- session timeout 15 minutes

# Network
- TLS 1.2+ only, no deprecated ciphers
```

## Level: iso27001

Information Security Management System.

**Required tests (includes 'soc2' plus):**
```
# Risk-based
- critical assets identified and protected
- risk register maintained

# Access control
- least privilege enforced
- privileged access monitored

# Cryptography
- strong algorithms only, no deprecated crypto
- key rotation implemented

# Incident response
- security events detected and logged
- alerts route to on-call
```

## Usage in Plans

Planner reads `security_compliance` from config.json and includes appropriate tests:

```xml
<tests>
  <security>
    <!-- Tests from compliance level -->
    - Denies unauthenticated access
    - Logs data access with user ID
    - Data encrypted at rest
  </security>
</tests>
```

## Mapping to SEC Rules

| Level | SEC-01 | SEC-02 | SEC-03 | SEC-04 | SEC-05 | SEC-06 | SEC-07 |
|-------|--------|--------|--------|--------|--------|--------|--------|
| none | req | req | req | req | req | - | - |
| soc2 | audit | audit | audit | audit | audit | req | req |
| hipaa | audit | audit | audit | audit | audit | audit | audit |
| pci-dss | audit | audit | audit | audit | audit | audit | audit |
| iso27001 | audit | audit | audit | audit | audit | audit | audit |

req = required, audit = required + audited

## Storage

**PROJECT.md:**
```markdown
## Security Compliance

Level: soc2
Decided: {date}
Rationale: {why this level}
```

**config.json:**
```json
{
  "security_compliance": "soc2"
}
```
