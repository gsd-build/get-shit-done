---
phase: "02"
plan: "01"
name: user-registration
wave: 1
depends_on: []
files_modified:
  - src/routes/auth.ts
  - src/models/user.ts
  - src/middleware/validate.ts
  - tests/auth.test.ts
autonomous: false
---

# Phase 02 Plan 01: User Registration

<objective>
Create user registration endpoint with email/password validation, bcrypt hashing, and database storage.
</objective>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/01-foundation/01-02-SUMMARY.md
</context>

<tasks>

<task id="1" type="auto">
<name>Create User model and migration</name>
<what>Define User table with id, email, password_hash, created_at. Create migration file.</what>
<files>src/models/user.ts, migrations/001_create_users.sql</files>
<verification>Migration runs successfully against test database</verification>
<done>User table exists with correct schema</done>
</task>

<task id="2" type="auto">
<name>Implement registration endpoint</name>
<what>POST /auth/register accepts email and password. Validate input, hash password with bcrypt, store user.</what>
<files>src/routes/auth.ts, src/middleware/validate.ts</files>
<verification>POST /auth/register with valid data returns 201</verification>
<done>Registration creates user with hashed password</done>
</task>

<task id="3" type="checkpoint:human-verify">
<name>Verify registration flow</name>
<what>Confirm the registration endpoint works end-to-end.</what>
<verify>
1. Run: curl -X POST localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"secure123"}'
2. Check response is 201 with user ID
3. Check database has user with hashed password (not plaintext)
</verify>
<resume_signal>Type "approved" or describe issues</resume_signal>
</task>

<task id="4" type="auto">
<name>Add registration tests</name>
<what>Write integration tests for registration: success case, duplicate email, invalid input.</what>
<files>tests/auth.test.ts</files>
<verification>npm test passes with all auth tests green</verification>
<done>3+ test cases covering registration edge cases</done>
</task>

</tasks>

<must_haves>
- Registration endpoint accepts email/password
- Passwords are hashed (never stored plaintext)
- Duplicate emails are rejected with 409
- Input validation rejects invalid emails
</must_haves>

<success_criteria>
- [ ] POST /auth/register works
- [ ] Passwords hashed with bcrypt
- [ ] Duplicate email returns 409
- [ ] Tests pass
</success_criteria>
