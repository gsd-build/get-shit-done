# Checkpoint Return Template

Structured format for subagent checkpoint returns. Enables orchestrator to spawn continuation agents without relying on resume.

---

## Template

```markdown
## CHECKPOINT REACHED

**Type:** [human-verify | decision | human-action]
**Plan:** {phase}-{plan}
**Progress:** {completed}/{total} tasks complete

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | [task name] | [hash] | [key files created/modified] |
| 2 | [task name] | [hash] | [key files created/modified] |

### Current Task

**Task {N}:** [task name]
**Status:** [blocked | awaiting verification | awaiting decision]
**Blocked by:** [specific blocker - auth required, user verification needed, decision needed]

### Checkpoint Details

[Checkpoint-specific content based on type - see below]

### Awaiting

[What user needs to do/provide]
```

---

## Checkpoint Type Details

### For human-verify

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

### For human-action

```markdown
### Checkpoint Details

**Automation attempted:**
[What Claude tried to do]

**Error encountered:**
[Exact error message or auth failure]

**What you need to do:**
1. [Step 1]
2. [Step 2]

**I'll verify after:**
[How Claude will confirm completion]

### Awaiting

Type "done" when complete.
```

### For decision

```markdown
### Checkpoint Details

**Decision needed:**
[What's being decided]

**Context:**
[Why this matters]

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| [option-a] | [benefits] | [tradeoffs] |
| [option-b] | [benefits] | [tradeoffs] |

### Awaiting

Select: [option-a | option-b | ...]
```

---

## Why This Structure

**Completed Tasks table:** Orchestrator knows exactly what's done. Fresh agent won't redo work.

**Commit hashes:** Verification that work was committed. Fresh agent can check git log.

**Files column:** Quick reference for what exists. Fresh agent can verify state.

**Current Task + Blocked by:** Precise continuation point. Fresh agent knows exactly where to pick up.

**Checkpoint Details:** User-facing content. Orchestrator presents this directly.

---

## Example: Auth Gate

```markdown
## CHECKPOINT REACHED

**Type:** human-action
**Plan:** 01-01
**Progress:** 1/3 tasks complete

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Initialize Next.js 15 project | d6fe73f | package.json, tsconfig.json, next.config.js, app/ |

### Current Task

**Task 2:** Initialize Convex backend
**Status:** blocked
**Blocked by:** Convex CLI authentication required

### Checkpoint Details

**Automation attempted:**
Ran `npx convex dev` to initialize Convex backend

**Error encountered:**
"Error: Not authenticated. Run `npx convex login` first."

**What you need to do:**
1. Run: `npx convex login`
2. Complete browser authentication
3. Run: `npx convex dev`
4. Create project named "convex-saas-community" when prompted

**I'll verify after:**
`cat .env.local | grep CONVEX` returns the Convex URL

### Awaiting

Type "done" when Convex is authenticated and project created.
```

---

## Example: Visual Verification

```markdown
## CHECKPOINT REACHED

**Type:** human-verify
**Plan:** 03-02
**Progress:** 2/3 tasks complete

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create dashboard layout | a1b2c3d | src/app/dashboard/layout.tsx, src/components/Sidebar.tsx |
| 2 | Add responsive navigation | e4f5g6h | src/components/NavBar.tsx, src/styles/nav.css |

### Current Task

**Task 3:** Verify responsive behavior
**Status:** awaiting verification
**Blocked by:** Human visual verification required

### Checkpoint Details

**What was built:**
Responsive dashboard with collapsible sidebar navigation

**How to verify:**
1. Run: `npm run dev`
2. Visit: http://localhost:3000/dashboard
3. Desktop (>1024px): Sidebar visible on left, content on right
4. Tablet (768px): Sidebar collapses to icons
5. Mobile (375px): Sidebar hidden, hamburger menu appears

### Awaiting

Type "approved" or describe issues to fix.
```
