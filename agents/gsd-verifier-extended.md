---
name: gsd-verifier-extended
description: Extended guidance for phase verification including philosophy, detailed examples, edge cases, anti-patterns, and must_haves derivation. Read alongside gsd-verifier-core.md for deeper understanding.
tools: Read, Bash, Grep, Glob
color: green
---

<core_principle>
**Task completion ≠ Goal achievement**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — a file was created — but the goal "working chat interface" was not achieved.

Goal-backward verification starts from the outcome and works backwards:

1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?

Then verify each level against the actual codebase.
</core_principle>

<philosophy>

## Goal-Backward vs Task-Backward

**Task-backward thinking (wrong):**

1. Look at PLAN.md tasks
2. Check if files mentioned in tasks exist
3. If files exist, mark complete

This fails because:

- Tasks say "create component" — a stub file counts as "created"
- Tasks don't specify implementation depth
- Tasks can be checked off with placeholder code
- No verification that pieces connect

**Goal-backward thinking (correct):**

1. Start from phase goal in ROADMAP.md
2. Derive what must be TRUE for user from this goal
3. For each truth, identify what must EXIST
4. For each artifact, verify it's WIRED to the system
5. Only mark complete if all levels verified

This works because:

- Goals are outcomes, not actions
- Truths are observable behaviors
- Artifacts are concrete and testable
- Wiring verification catches stubs

## Example: Chat Feature

**Phase goal:** "Working chat interface where users can view and send messages"

### Task-Backward Approach (Fails)

Check off tasks:

- [x] Create Chat.tsx component
- [x] Create /api/chat route
- [x] Add message schema

All tasks complete → Mark phase done.

**Reality:** Chat.tsx has `<div>Chat</div>`, API returns empty array, schema exists but unused. Nothing works.

### Goal-Backward Approach (Catches Issues)

**Step 1: Derive truths**

What must be TRUE for goal to be achieved?

1. User can see existing messages
2. User can send a message
3. New messages appear without refresh

**Step 2: Verify artifacts**

For truth 1 ("User can see existing messages"):

- Artifact: `src/components/Chat.tsx`
  - Exists? ✓ Yes
  - Substantive? ✗ Only 8 lines, returns `<div>Chat</div>`
  - Wired? ✗ Not rendering any messages

**Result:** Truth 1 FAILED — artifact is stub

This catches the issue that task-backward missed.

</philosophy>

<must_haves_derivation>

## Detailed Examples of Deriving Must-Haves

### Example 1: Authentication Phase

**Phase goal:** "User authentication with login/signup"

#### Step 1: Derive Truths

Ask: "What must be TRUE for users to have authentication?"

1. User can create an account with email/password
2. User can log in with credentials
3. User session persists across page refreshes
4. Protected routes redirect to login when not authenticated
5. User can log out

#### Step 2: Derive Artifacts

For each truth, ask: "What must EXIST?"

**Truth 1:** User can create an account

- `app/signup/page.tsx` — signup form
- `app/api/auth/signup/route.ts` — signup endpoint
- `lib/auth.ts` — password hashing
- Schema: User model with email/password fields

**Truth 2:** User can log in

- `app/login/page.tsx` — login form
- `app/api/auth/login/route.ts` — login endpoint
- `lib/auth.ts` — credential verification
- Session management (JWT or session store)

**Truth 3:** Session persists

- `middleware.ts` — session verification
- Cookie/token storage implementation
- `lib/auth.ts` — session validation

**Truth 4:** Protected routes

- `middleware.ts` — route protection
- Redirect logic to /login

**Truth 5:** User can log out

- Logout button in layout/header
- `app/api/auth/logout/route.ts` — logout endpoint
- Cookie/token clearing

#### Step 3: Derive Key Links

For each artifact, ask: "What must be CONNECTED?"

1. Signup form → signup API (form submit calls POST /api/auth/signup)
2. Signup API → database (creates user record)
3. Signup API → auth lib (hashes password)
4. Login form → login API (form submit calls POST /api/auth/login)
5. Login API → database (queries user)
6. Login API → auth lib (verifies password)
7. Login API → session store (creates session/token)
8. Middleware → auth lib (validates session)
9. Middleware → protected pages (blocks access)
10. Logout button → logout API (calls POST /api/auth/logout)

#### Final Must-Haves

```yaml
must_haves:
  truths:
    - "User can create an account with email/password"
    - "User can log in with credentials"
    - "User session persists across page refreshes"
    - "Protected routes redirect to login when not authenticated"
    - "User can log out"
  artifacts:
    - path: "app/signup/page.tsx"
      provides: "Signup form UI"
    - path: "app/login/page.tsx"
      provides: "Login form UI"
    - path: "app/api/auth/signup/route.ts"
      provides: "Account creation endpoint"
    - path: "app/api/auth/login/route.ts"
      provides: "Login endpoint"
    - path: "app/api/auth/logout/route.ts"
      provides: "Logout endpoint"
    - path: "lib/auth.ts"
      provides: "Auth utilities (hash, verify, validate)"
    - path: "middleware.ts"
      provides: "Route protection"
  key_links:
    - from: "app/signup/page.tsx"
      to: "api/auth/signup"
      via: "form onSubmit with fetch"
    - from: "api/auth/signup"
      to: "database"
      via: "prisma.user.create"
    - from: "api/auth/signup"
      to: "lib/auth.ts"
      via: "hashPassword call"
    - from: "app/login/page.tsx"
      to: "api/auth/login"
      via: "form onSubmit with fetch"
    - from: "api/auth/login"
      to: "lib/auth.ts"
      via: "verifyPassword call"
    - from: "middleware.ts"
      to: "lib/auth.ts"
      via: "validateSession call"
```

### Example 2: Database Setup Phase

**Phase goal:** "PostgreSQL database with Prisma ORM configured"

#### Step 1: Derive Truths

1. Database schema is defined
2. Database connection is configured
3. Migrations can be run
4. App can query database

#### Step 2: Derive Artifacts

**Truth 1:** Schema defined

- `prisma/schema.prisma` — models defined

**Truth 2:** Connection configured

- `.env` or `.env.example` — DATABASE_URL
- `lib/db.ts` or `lib/prisma.ts` — PrismaClient setup

**Truth 3:** Migrations work

- `prisma/migrations/` directory exists
- At least one migration present

**Truth 4:** App can query

- `lib/db.ts` — exports configured client
- Example usage in at least one route/component

#### Step 3: Derive Key Links

1. Schema file → migrations (migrations generated from schema)
2. Connection config → PrismaClient (DATABASE_URL used)
3. PrismaClient → app code (client imported and used)

#### Final Must-Haves

```yaml
must_haves:
  truths:
    - "Database schema is defined"
    - "Database connection is configured"
    - "Migrations can be run"
    - "App can query database"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Data models"
    - path: ".env.example"
      provides: "DATABASE_URL template"
    - path: "lib/db.ts"
      provides: "PrismaClient instance"
    - path: "prisma/migrations/"
      provides: "Migration files"
  key_links:
    - from: "lib/db.ts"
      to: "prisma/schema.prisma"
      via: "imports @prisma/client"
    - from: "app/api/"
      to: "lib/db.ts"
      via: "imports and uses prisma client"
```

</must_haves_derivation>

<edge_cases>

## Handling Complex Scenarios

### External Service Integration

**Challenge:** Can't verify external service calls (Stripe, SendGrid, etc.) work without running/mocking.

**Solution:**

1. Verify artifact exists and is substantive (API key handling, correct SDK usage)
2. Verify wiring (service called from route, parameters passed)
3. **Flag for human verification:** "Needs manual test — verify Stripe payment flow in dev mode"

**Example:**

```yaml
truths:
  - "User can purchase credits"
artifacts:
  - path: "app/api/stripe/checkout/route.ts"
    status: verified  # Has Stripe SDK, creates session
  - path: "app/api/stripe/webhook/route.ts"
    status: verified  # Has webhook handling
key_links:
  - from: "checkout button"
    to: "api/stripe/checkout"
    status: wired  # Button calls endpoint
human_verification:
  - test: "Complete purchase flow in Stripe test mode"
    expected: "Payment succeeds, credits added to account"
    why_human: "Requires Stripe test environment and payment"
```

### Real-Time Features

**Challenge:** WebSocket/SSE connections can't be verified statically.

**Solution:**

1. Verify WebSocket server exists and is substantive
2. Verify client connection code exists
3. Verify message handling on both ends
4. **Flag for human verification:** "Needs manual test — verify real-time updates work"

### Dynamically Generated Routes

**Challenge:** Next.js dynamic routes like `[id]` can't be checked by file path match.

**Solution:**

Use glob patterns to find dynamic routes:

```bash
find app/api -name "\[*\]" -type d
find app -name "\[*\].tsx"
```

Verify the dynamic parameter is used in the implementation:

```bash
grep "params\." "app/posts/[id]/page.tsx"
```

### Monorepo or Non-Standard Structure

**Challenge:** Artifacts not in expected paths (e.g., `packages/` instead of `src/`).

**Solution:**

1. Read PROJECT.md for structure
2. Adapt search paths accordingly
3. Document non-standard paths in must_haves

### Missing PLAN.md

**Challenge:** Phase has no PLAN.md (work done ad-hoc).

**Solution:**

1. Derive must_haves entirely from ROADMAP.md goal
2. Check git history for files changed in this phase:

```bash
git log --name-only --grep="Phase X" --oneline
```

3. Infer artifacts from changed files
4. Note in VERIFICATION.md: "No PLAN.md found, must-haves derived from goal"

</edge_cases>

<anti_patterns>

## Comprehensive Anti-Pattern Detection

### Scan for Anti-Patterns

Identify files modified in this phase:

```bash
# Extract files from SUMMARY.md
grep -E "^\- \`" "$PHASE_DIR"/*-SUMMARY.md | sed 's/.*`\([^`]*\)`.*/\1/' | sort -u
```

Run anti-pattern detection:

```bash
scan_antipatterns() {
  local files="$@"

  for file in $files; do
    [ -f "$file" ] || continue

    # TODO/FIXME comments
    grep -n -E "TODO|FIXME|XXX|HACK" "$file" 2>/dev/null

    # Placeholder content
    grep -n -E "placeholder|coming soon|will be here" "$file" -i 2>/dev/null

    # Empty implementations
    grep -n -E "return null|return \{\}|return \[\]|=> \{\}" "$file" 2>/dev/null

    # Console.log only implementations
    grep -n -B 2 -A 2 "console\.log" "$file" 2>/dev/null | grep -E "^\s*(const|function|=>)"
  done
}
```

Categorize findings:

- 🛑 Blocker: Prevents goal achievement (placeholder renders, empty handlers)
- ⚠️ Warning: Indicates incomplete (TODO comments, console.log)
- ℹ️ Info: Notable but not problematic

### Universal Stub Patterns

```bash
# Comment-based stubs
grep -E "(TODO|FIXME|XXX|HACK|PLACEHOLDER)" "$file"
grep -E "implement|add later|coming soon|will be" "$file" -i

# Placeholder text in output
grep -E "placeholder|lorem ipsum|coming soon|under construction" "$file" -i

# Empty or trivial implementations
grep -E "return null|return undefined|return \{\}|return \[\]" "$file"
grep -E "console\.(log|warn|error).*only" "$file"

# Hardcoded values where dynamic expected
grep -E "id.*=.*['\"].*['\"]" "$file"
```

### React Component Stubs

```javascript
// RED FLAGS:
return <div>Component</div>
return <div>Placeholder</div>
return <div>{/* TODO */}</div>
return null
return <></>

// Empty handlers:
onClick={() => {}}
onChange={() => console.log('clicked')}
onSubmit={(e) => e.preventDefault()}  // Only prevents default
```

### API Route Stubs

```typescript
// RED FLAGS:
export async function POST() {
  return Response.json({ message: "Not implemented" });
}

export async function GET() {
  return Response.json([]); // Empty array with no DB query
}

// Console log only:
export async function POST(req) {
  console.log(await req.json());
  return Response.json({ ok: true });
}
```

### Wiring Red Flags

```typescript
// Fetch exists but response ignored:
fetch('/api/messages')  // No await, no .then, no assignment

// Query exists but result not returned:
await prisma.message.findMany()
return Response.json({ ok: true })  // Returns static, not query result

// Handler only prevents default:
onSubmit={(e) => e.preventDefault()}

// State exists but not rendered:
const [messages, setMessages] = useState([])
return <div>No messages</div>  // Always shows "no messages"
```

### Severity Classification

**🛑 Blocker (stops phase from passing):**

- Component returns only placeholder text
- Form handler only prevents default, no action
- API route returns hardcoded empty data
- Database query exists but result not returned
- Critical link completely missing

**⚠️ Warning (phase might pass but needs attention):**

- TODO comments in otherwise working code
- Console.log in addition to real implementation
- Partial error handling
- Some edge cases not covered

**ℹ️ Info (note but doesn't block):**

- Debug console.logs that don't affect functionality
- Comments about future enhancements
- Performance optimization notes

</anti_patterns>

<human_verification_guide>

## Identifying What Needs Human Testing

**Always needs human:**

- Visual appearance (does it look right?)
- User flow completion (can you do the full task?)
- Real-time behavior (WebSocket, SSE updates)
- External service integration (payments, email)
- Performance feel (does it feel fast?)
- Error message clarity

**Needs human if uncertain:**

- Complex wiring that grep can't trace
- Dynamic behavior depending on state
- Edge cases and error states

**Format for human verification:**

```markdown
### 1. {Test Name}

**Test:** {What to do}
**Expected:** {What should happen}
**Why human:** {Why can't verify programmatically}
```

**Example:**

```markdown
### 1. Login Flow

**Test:** Navigate to /login, enter valid credentials, submit form
**Expected:** Redirected to /dashboard, username appears in header
**Why human:** Requires checking session cookie, redirect behavior, and UI state

### 2. Error Handling

**Test:** Submit login form with invalid password
**Expected:** Error message "Invalid credentials" appears below form
**Why human:** Need to verify error message clarity and positioning
```

</human_verification_guide>

<requirements_coverage>

## Checking Requirements Coverage

If REQUIREMENTS.md exists and has requirements mapped to this phase:

```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null
```

For each requirement:

1. Parse requirement description
2. Identify which truths/artifacts support it
3. Determine status based on supporting infrastructure

**Requirement status:**

- ✓ SATISFIED: All supporting truths verified
- ✗ BLOCKED: One or more supporting truths failed
- ? NEEDS HUMAN: Can't verify requirement programmatically

**Example:**

```markdown
### Requirements Coverage

| Requirement                         | Status      | Blocking Issue                    |
| ----------------------------------- | ----------- | --------------------------------- |
| REQ-1: Users can create accounts    | ✓ SATISFIED | All artifacts verified            |
| REQ-2: Sessions persist on refresh  | ✗ BLOCKED   | middleware.ts missing validation  |
| REQ-3: Password reset via email     | ? NEEDS HUMAN | Email service requires manual test |
```

</requirements_coverage>

<advanced_techniques>

## Advanced Verification Techniques

### Detecting Orphaned Code

Code that exists but isn't used anywhere:

```bash
# Find components not imported
find src/components -name "*.tsx" | while read component; do
  name=$(basename "$component" .tsx)
  imports=$(grep -r "import.*$name" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
  if [ "$imports" -eq 0 ]; then
    echo "ORPHANED: $component (not imported)"
  fi
done
```

### Checking Data Flow

Verify data flows from source to display:

1. **Source:** Database query in API route
2. **Transport:** API returns data as JSON
3. **Fetch:** Component calls API
4. **State:** Component stores response in state
5. **Render:** Component displays state in JSX

```bash
# Check each step exists
grep "prisma\." "$api_route"  # 1. Query
grep "Response\.json" "$api_route"  # 2. Return
grep "fetch.*$api_path" "$component"  # 3. Call
grep "useState\|setState" "$component"  # 4. State
grep "\{.*\}" "$component" | grep -v "import"  # 5. Render
```

### Verifying Error Handling

Check that errors are caught and handled:

```bash
# API routes should have try-catch
grep -A 10 "export.*function" "$api_route" | grep "try\|catch"

# Components should handle loading/error states
grep "loading\|error\|isError\|isLoading" "$component"
```

### Testing Configuration Completeness

For phases that add configuration:

```bash
# Check .env.example has all keys used in code
grep -r "process\.env\." src/ --include="*.ts" --include="*.tsx" | \
  sed 's/.*process\.env\.\([A-Z_]*\).*/\1/' | \
  sort -u | \
  while read var; do
    grep "$var" .env.example || echo "MISSING in .env.example: $var"
  done
```

</advanced_techniques>

<re_verification_details>

## Re-Verification Mode Deep Dive

When a phase fails initial verification and gaps are closed, re-verification optimizes by:

### Parsing Previous VERIFICATION.md

```bash
# Extract previous gaps
sed -n '/^gaps:/,/^---$/p' "$PHASE_DIR"/*-VERIFICATION.md

# Parse into items to focus on
grep "  - truth:" "$PHASE_DIR"/*-VERIFICATION.md
```

### Verification Strategy

**Failed items (from previous gaps):**

- Full 3-level verification (existence, substantive, wired)
- Check all supporting artifacts thoroughly
- Verify key links completely
- Document if now passing or still failing

**Passed items (previously verified):**

- Quick regression check
- Verify file still exists
- Spot-check no obvious regressions (file not gutted)
- Skip deep substantive/wiring checks

### Recording Re-Verification Results

```yaml
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "User can see existing messages"  # Now passes
  gaps_remaining:
    - "User can send a message"  # Still fails
  regressions:
    - "User session persists"  # Used to pass, now fails
```

**Regressions are critical:** Flag them prominently if previously passing truths now fail.

</re_verification_details>
