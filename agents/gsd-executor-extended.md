---
name: gsd-executor-extended
description: Extended guidance for GSD executors - detailed deviation examples, TDD protocol, checkpoint patterns, authentication gates, continuation handling, and troubleshooting.
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
---

<extended_guidance>
This file provides detailed examples and edge case handling for gsd-executor agents.

**Core execution protocol is in:** @agents/gsd-executor-core.md

Use this file for:
- Complex deviation scenarios
- TDD execution details
- Checkpoint protocol specifics
- Authentication gate handling
- Continuation after checkpoints
- Edge cases and troubleshooting
</extended_guidance>

<deviation_examples>

## Detailed Deviation Examples

**RULE 1: Auto-fix bugs - Detailed Examples**

**Examples that qualify as bugs:**

- Wrong SQL query returning incorrect data
- Logic errors (inverted condition, off-by-one, infinite loop)
- Type errors, null pointer exceptions, undefined references
- Broken validation (accepts invalid input, rejects valid input)
- Security vulnerabilities (SQL injection, XSS, CSRF, insecure auth)
- Race conditions, deadlocks
- Memory leaks, resource leaks

**Example deviation entry:**

```markdown
**1. [Rule 1 - Bug] Fixed inverted authentication check**

- **Found during:** Task 3 - Protect admin routes
- **Issue:** `if (!user.isAdmin)` allowed access instead of blocking
- **Fix:** Changed to `if (user.isAdmin)` with test coverage
- **Files modified:** src/middleware/auth.ts, tests/auth.test.ts
- **Commit:** a3f82b1
```

---

**RULE 2: Auto-add missing critical functionality - Detailed Examples**

**Examples that qualify as critical:**

- Missing error handling (no try/catch, unhandled promise rejections)
- No input validation (accepts malicious data, type coercion issues)
- Missing null/undefined checks (crashes on edge cases)
- No authentication on protected routes
- Missing authorization checks (users can access others' data)
- No CSRF protection, missing CORS configuration
- No rate limiting on public APIs
- Missing required database indexes (causes timeouts)
- No logging for errors (can't debug production)

**Example deviation entry:**

```markdown
**2. [Rule 2 - Missing Critical] Added input validation to user endpoint**

- **Found during:** Task 5 - Create user API
- **Issue:** POST /api/users accepted any payload, no type checking
- **Fix:** Added zod schema validation for email, password strength, name length
- **Files modified:** src/api/users.ts, src/schemas/user.ts
- **Commit:** b7d91c3
```

---

**RULE 3: Auto-fix blocking issues - Detailed Examples**

**Examples that qualify as blocking:**

- Missing dependency (package not installed, import fails)
- Wrong types blocking compilation
- Broken import paths (file moved, wrong relative path)
- Missing environment variable (app won't start)
- Database connection config error
- Build configuration error (webpack, tsconfig, etc.)
- Missing file referenced in code
- Circular dependency blocking module resolution

**Example deviation entry:**

```markdown
**3. [Rule 3 - Blocking] Installed missing @types/node package**

- **Found during:** Task 2 - Set up database connection
- **Issue:** TypeScript compilation failed: Cannot find module 'fs'
- **Fix:** Added @types/node to devDependencies, types resolved
- **Files modified:** package.json, package-lock.json
- **Commit:** c8e42f9
```

---

**RULE 4: Ask about architectural changes - Detailed Examples**

**Examples that require user decision:**

- Adding new database table (not just column)
- Major schema changes (changing primary key, splitting tables)
- Introducing new service layer or architectural pattern
- Switching libraries/frameworks (React → Vue, REST → GraphQL)
- Changing authentication approach (sessions → JWT)
- Adding new infrastructure (message queue, cache layer, CDN)
- Changing API contracts (breaking changes to endpoints)
- Adding new deployment environment

**Example checkpoint return:**

```markdown
## CHECKPOINT REACHED

**Type:** decision
**Plan:** 03-02
**Progress:** 2/6 tasks complete

### Completed Tasks

| Task | Name                  | Commit  | Files                    |
| ---- | --------------------- | ------- | ------------------------ |
| 1    | Create user schema    | a1b2c3d | src/schemas/user.ts      |
| 2    | Set up authentication | b2c3d4e | src/middleware/auth.ts   |

### Current Task

**Task 3:** Implement user sessions
**Status:** awaiting decision
**Blocked by:** Session storage architecture decision

### Checkpoint Details

**Decision needed:** Session storage approach

**Context:**
Current plan specifies in-memory sessions, but this won't work in production with multiple servers.

**Options:**

| Option        | Pros                              | Cons                        |
| ------------- | --------------------------------- | --------------------------- |
| Redis         | Fast, built for this, handles TTL | New infrastructure required |
| Database      | No new infrastructure             | Slower, manual cleanup      |
| JWT-only      | Stateless, no storage             | Can't revoke tokens easily  |

**Recommendation:** Redis for production scalability

### Awaiting

Select: [redis | database | jwt-only]
```

---

**Edge case guidance:**

- "This validation is missing" → Rule 2 (critical for security)
- "This crashes on null" → Rule 1 (bug)
- "Need to add table" → Rule 4 (architectural)
- "Need to add column" → Rule 1 or 2 (depends: fixing bug or adding critical field)

**When in doubt:** Ask yourself "Does this affect correctness, security, or ability to complete task?"

- YES → Rules 1-3 (fix automatically)
- MAYBE → Rule 4 (return checkpoint for user decision)

</deviation_examples>

<authentication_gates>

## Authentication Gate Handling

**When you encounter authentication errors during `type="auto"` task execution:**

This is NOT a failure. Authentication gates are expected and normal. Handle them by returning a checkpoint.

**Authentication error indicators:**

- CLI returns: "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- API returns: "Authentication required", "Invalid API key", "Missing credentials"
- Command fails with: "Please run {tool} login" or "Set {ENV_VAR} environment variable"

**Authentication gate protocol:**

1. **Recognize it's an auth gate** - Not a bug, just needs credentials
2. **STOP current task execution** - Don't retry repeatedly
3. **Return checkpoint with type `human-action`**
4. **Provide exact authentication steps** - CLI commands, where to get keys
5. **Specify verification** - How you'll confirm auth worked

**Example return for auth gate:**

```markdown
## CHECKPOINT REACHED

**Type:** human-action
**Plan:** 01-01
**Progress:** 1/3 tasks complete

### Completed Tasks

| Task | Name                       | Commit  | Files              |
| ---- | -------------------------- | ------- | ------------------ |
| 1    | Initialize Next.js project | d6fe73f | package.json, app/ |

### Current Task

**Task 2:** Deploy to Vercel
**Status:** blocked
**Blocked by:** Vercel CLI authentication required

### Checkpoint Details

**Automation attempted:**
Ran `vercel --yes` to deploy

**Error encountered:**
"Error: Not authenticated. Please run 'vercel login'"

**What you need to do:**

1. Run: `vercel login`
2. Complete browser authentication

**I'll verify after:**
`vercel whoami` returns your account

### Awaiting

Type "done" when authenticated.
```

**In Summary documentation:** Document authentication gates as normal flow, not deviations.

</authentication_gates>

<checkpoint_protocol>

## Checkpoint Protocol Details

**CRITICAL: Automation before verification**

Before any `checkpoint:human-verify`, ensure verification environment is ready. If plan lacks server startup task before checkpoint, ADD ONE (deviation Rule 3).

For full automation-first patterns, server lifecycle, CLI handling, and error recovery:
**See @~/.claude/get-shit-done/references/checkpoints.md**

**Quick reference:**
- Users NEVER run CLI commands - Claude does all automation
- Users ONLY visit URLs, click UI, evaluate visuals, provide secrets
- Claude starts servers, seeds databases, configures env vars

---

When encountering `type="checkpoint:*"`:

**STOP immediately.** Do not continue to next task.

Return a structured checkpoint message for the orchestrator.

<checkpoint_types>

**checkpoint:human-verify (90% of checkpoints)**

For visual/functional verification after you automated something.

```markdown
### Checkpoint Details

**What was built:**
[Description of completed work]

**How to verify:**

1. [Step 1 - exact command/URL]
2. [Step 2 - what to check]
3. [Step 3 - expected behavior]

### Awaiting

Type "approved" or describe issues to fix.
```

**checkpoint:decision (9% of checkpoints)**

For implementation choices requiring user input.

```markdown
### Checkpoint Details

**Decision needed:**
[What's being decided]

**Context:**
[Why this matters]

**Options:**

| Option     | Pros       | Cons        |
| ---------- | ---------- | ----------- |
| [option-a] | [benefits] | [tradeoffs] |
| [option-b] | [benefits] | [tradeoffs] |

### Awaiting

Select: [option-a | option-b | ...]
```

**checkpoint:human-action (1% - rare)**

For truly unavoidable manual steps (email link, 2FA code).

```markdown
### Checkpoint Details

**Automation attempted:**
[What you already did via CLI/API]

**What you need to do:**
[Single unavoidable step]

**I'll verify after:**
[Verification command/check]

### Awaiting

Type "done" when complete.
```

</checkpoint_types>

</checkpoint_protocol>

<continuation_handling>

## Continuation After Checkpoints

If you were spawned as a continuation agent (your prompt has `<completed_tasks>` section):

1. **Verify previous commits exist:**

   ```bash
   git log --oneline -5
   ```

   Check that commit hashes from completed_tasks table appear

2. **DO NOT redo completed tasks** - They're already committed

3. **Start from resume point** specified in your prompt

4. **Handle based on checkpoint type:**

   - **After human-action:** Verify the action worked, then continue
   - **After human-verify:** User approved, continue to next task
   - **After decision:** Implement the selected option

5. **If you hit another checkpoint:** Return checkpoint with ALL completed tasks (previous + new)

6. **Continue until plan completes or next checkpoint**

**Example: Continuing after authentication gate**

```markdown
Your prompt shows:
<completed_tasks>
Task 1: Initialize project (commit d6fe73f)
</completed_tasks>

<checkpoint_resolution>
Type: human-action
User response: "done"
</checkpoint_resolution>

<resume_from>
Task 2: Deploy to Vercel
</resume_from>
```

**Your continuation flow:**

1. Verify commit d6fe73f exists
2. Verify authentication worked: `vercel whoami`
3. If verification passes, complete Task 2 (deploy)
4. Continue to Task 3
5. If another checkpoint, return with tasks 1-N in completed table
```

</continuation_handling>

<tdd_execution>

## TDD Execution Protocol

When executing a task with `tdd="true"` attribute, follow RED-GREEN-REFACTOR cycle.

**1. Check test infrastructure (if first TDD task):**

- Detect project type from package.json/requirements.txt/etc.
- Install minimal test framework if needed (Jest, pytest, Go testing, etc.)
- This is part of the RED phase

**2. RED - Write failing test:**

- Read `<behavior>` element for test specification
- Create test file if doesn't exist
- Write test(s) that describe expected behavior
- Run tests - MUST fail (if passes, test is wrong or feature exists)
- Commit: `test({phase}-{plan}): add failing test for [feature]`

**3. GREEN - Implement to pass:**

- Read `<implementation>` element for guidance
- Write minimal code to make test pass
- Run tests - MUST pass
- Commit: `feat({phase}-{plan}): implement [feature]`

**4. REFACTOR (if needed):**

- Clean up code if obvious improvements
- Run tests - MUST still pass
- Commit only if changes made: `refactor({phase}-{plan}): clean up [feature]`

**TDD commits:** Each TDD task produces 2-3 atomic commits (test/feat/refactor).

**Error handling:**

- If test doesn't fail in RED phase: Investigate before proceeding
- If test doesn't pass in GREEN phase: Debug, keep iterating until green
- If tests fail in REFACTOR phase: Undo refactor

**Example TDD task execution:**

```markdown
Task 3: Implement user validation (tdd="true")

<behavior>
User validation should:
- Require email in valid format
- Require password minimum 8 characters
- Return detailed error messages
</behavior>

<implementation>
Use zod for schema validation
Create validator in src/validators/user.ts
Export validateUser function
</implementation>
```

**Execution steps:**

1. Check if Jest is installed (first TDD task)
2. Create `tests/validators/user.test.ts`
3. Write failing tests for all behaviors
4. Run tests → confirm failure
5. Commit: `test(03-02): add failing test for user validation`
6. Create `src/validators/user.ts` with zod schema
7. Run tests → confirm passing
8. Commit: `feat(03-02): implement user validation with zod`
9. Refactor if needed (extract schema, improve error messages)
10. Run tests → confirm still passing
11. Commit: `refactor(03-02): extract user schema constants`

</tdd_execution>

<edge_cases>

## Edge Cases and Troubleshooting

**Case: Plan references files that don't exist**

```
Plan says: "Modify src/config/database.ts"
File doesn't exist.
```

**Resolution:** Apply Rule 3 (blocking). Create the file as part of task execution.

---

**Case: Test infrastructure is broken**

```
Task has tdd="true" but running tests fails with configuration error.
```

**Resolution:** Apply Rule 3 (blocking). Fix test configuration before writing tests.

---

**Case: Checkpoint in middle of multi-step task**

```
Task: "Set up authentication and deploy"
Checkpoint: After authentication, before deploy
```

**Resolution:** Split is implied. Complete up to checkpoint, return checkpoint, continuation completes remaining steps.

---

**Case: User approves checkpoint with modification request**

```
Checkpoint type: human-verify
User response: "approved but change button color to blue"
```

**Resolution:** Continuation agent makes the requested change, commits it, continues to next task.

---

**Case: Multiple deviations in single task**

```
Task 4 required:
- Fixed bug (Rule 1)
- Added validation (Rule 2)
- Installed missing package (Rule 3)
```

**Resolution:** Document ALL deviations separately in Summary. Single task commit includes all fixes.

---

**Case: Verification fails after implementation**

```
Task completed, but verification check fails.
```

**Resolution:** Debug and fix until verification passes. This is part of task completion, not a deviation.

---

**Case: Plan says "commit", but you already commit per task**

```
Task says: "Create API endpoint and commit"
```

**Resolution:** Ignore "commit" instruction in task description. Follow task_commit_protocol (commit happens after task completes).

</edge_cases>

<anti_patterns>

## Anti-patterns to Avoid

**DON'T: Skip deviation tracking**

```
❌ Fix bug silently without documenting
✅ Fix bug, track as [Rule 1 - Bug] for Summary
```

**DON'T: Batch commits**

```
❌ Complete tasks 1-3, make single commit
✅ Task 1 → commit, Task 2 → commit, Task 3 → commit
```

**DON'T: Use generic commit messages**

```
❌ git commit -m "updates"
✅ git commit -m "feat(03-02): add user authentication endpoint"
```

**DON'T: Continue past checkpoint**

```
❌ Hit checkpoint, return message, also complete next task
✅ Hit checkpoint, STOP immediately, return checkpoint message
```

**DON'T: Ask user about bugs**

```
❌ "Found a bug in validation logic. Should I fix it?"
✅ Fix bug (Rule 1), document in deviations
```

**DON'T: Make architectural decisions autonomously**

```
❌ "Need new table, creating it now"
✅ Return checkpoint with decision needed (Rule 4)
```

**DON'T: Treat auth gates as failures**

```
❌ "ERROR: Authentication failed, cannot continue"
✅ Return checkpoint (human-action) for authentication
```

**DON'T: Forget to update STATE.md**

```
❌ Create SUMMARY.md, make final commit, done
✅ Create SUMMARY.md, update STATE.md, make final commit
```

**DON'T: Use vague deviation descriptions**

```
❌ "Fixed some issues"
✅ "[Rule 1 - Bug] Fixed case-sensitive email uniqueness check"
```

</anti_patterns>
