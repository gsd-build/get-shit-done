# CRUD Flow Verification Template

Use this template to verify end-to-end Create/Read/Update/Delete flows for any entity in the system.

## Entity: {ENTITY_NAME}

**Source phase:** {phase that introduced this entity}
**API base:** {/api/entity or equivalent}
**Model/Schema:** {path to model definition}

---

## 10-Step Verification

### Step 1: Model/Schema Exists

Verify the entity has a defined data model.

```bash
# Prisma/Drizzle
grep -r "model {Entity}" prisma/ --include="*.prisma" 2>/dev/null
grep -r "{entity}" src/ --include="*.schema.ts" 2>/dev/null

# SQLAlchemy / Django
grep -r "class {Entity}" --include="*.py" 2>/dev/null | grep -E "Base|Model|db.Model"

# Mongoose
grep -r "{entity}Schema\|model.*{Entity}" --include="*.ts" --include="*.js" 2>/dev/null
```

- [ ] Model defined with required fields
- [ ] Relationships/foreign keys defined
- [ ] Validation constraints present

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

### Step 2: Create Route Exists

Verify a POST/create endpoint exists.

```bash
# Next.js App Router
find src/app/api/{entity} -name "route.ts" 2>/dev/null

# Express
grep -rn "router.post.*{entity}\|app.post.*{entity}" --include="*.ts" --include="*.js" 2>/dev/null

# FastAPI
grep -rn "@router.post.*{entity}\|@app.post.*{entity}" --include="*.py" 2>/dev/null

# Flask
grep -rn "@.*route.*{entity}.*methods.*POST" --include="*.py" 2>/dev/null
```

- [ ] POST endpoint exists
- [ ] Input validation on create
- [ ] Returns created entity or ID
- [ ] Proper error responses (400, 409, 500)

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

### Step 3: Read Routes Exist (List + Detail)

Verify GET endpoints for listing and single-entity retrieval.

```bash
# List endpoint (GET /entities)
grep -rn "GET.*{entity}" --include="*.ts" --include="*.js" --include="*.py" 2>/dev/null

# Detail endpoint (GET /entities/:id)
grep -rn "{entity}.*\[id\]\|{entity}.*:id\|{entity}.*<.*id" --include="*.ts" --include="*.js" --include="*.py" 2>/dev/null
```

- [ ] List endpoint returns array/paginated results
- [ ] Detail endpoint returns single entity
- [ ] 404 handling for missing entity
- [ ] Query filters/pagination supported (list)

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

### Step 4: Update Route Exists

Verify PUT/PATCH endpoint exists.

```bash
# Express/Next.js
grep -rn "router\.\(put\|patch\).*{entity}\|app\.\(put\|patch\).*{entity}" --include="*.ts" --include="*.js" 2>/dev/null

# FastAPI
grep -rn "@router\.\(put\|patch\).*{entity}" --include="*.py" 2>/dev/null
```

- [ ] PUT or PATCH endpoint exists
- [ ] Input validation on update
- [ ] Returns updated entity
- [ ] 404 for missing entity
- [ ] Ownership/permission check

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

### Step 5: Delete Route Exists

Verify DELETE endpoint exists.

```bash
# Express/Next.js
grep -rn "router\.delete.*{entity}\|app\.delete.*{entity}" --include="*.ts" --include="*.js" 2>/dev/null

# FastAPI
grep -rn "@router\.delete.*{entity}" --include="*.py" 2>/dev/null
```

- [ ] DELETE endpoint exists
- [ ] Returns confirmation or 204
- [ ] 404 for missing entity
- [ ] Cascade handling (related records)
- [ ] Ownership/permission check

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

### Step 6: UI Create Form Wired to API

Verify the create form submits to the correct API endpoint.

```bash
# Find create/add form component
grep -r -l "create.*{entity}\|add.*{entity}\|new.*{entity}" src/ \
  --include="*.tsx" --include="*.jsx" --include="*.vue" 2>/dev/null

# Check it calls POST API
grep -E "fetch.*{entity}.*POST\|axios\.post.*{entity}\|method.*POST" \
  {form_file} 2>/dev/null
```

- [ ] Create form component exists
- [ ] Form submits to correct POST endpoint
- [ ] Success feedback shown to user
- [ ] Error feedback shown on failure
- [ ] Form clears/redirects after success

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

### Step 7: UI List View Wired to API

Verify the list view fetches and displays entities.

```bash
# Find list component
grep -r -l "list.*{entity}\|{entity}.*list\|{entity}.*table" src/ \
  --include="*.tsx" --include="*.jsx" --include="*.vue" 2>/dev/null

# Check it fetches from GET API
grep -E "fetch.*{entity}\|useSWR.*{entity}\|useQuery.*{entity}" \
  {list_file} 2>/dev/null
```

- [ ] List component exists
- [ ] Fetches from correct GET endpoint
- [ ] Renders entity data in list/table
- [ ] Loading state shown during fetch
- [ ] Empty state when no entities
- [ ] Error state on fetch failure

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

### Step 8: UI Edit Form Wired to API

Verify the edit form loads existing data and submits updates.

```bash
# Find edit form component
grep -r -l "edit.*{entity}\|update.*{entity}" src/ \
  --include="*.tsx" --include="*.jsx" --include="*.vue" 2>/dev/null

# Check it loads then submits
grep -E "fetch.*{entity}.*PUT\|fetch.*{entity}.*PATCH\|axios\.\(put\|patch\).*{entity}" \
  {edit_file} 2>/dev/null
```

- [ ] Edit form component exists
- [ ] Pre-populates with existing entity data
- [ ] Submits to correct PUT/PATCH endpoint
- [ ] Success feedback shown
- [ ] Optimistic update or refetch after save

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

### Step 9: UI Delete Action Wired to API

Verify delete action triggers API call and updates UI.

```bash
# Find delete button/action
grep -r -l "delete.*{entity}\|remove.*{entity}" src/ \
  --include="*.tsx" --include="*.jsx" --include="*.vue" 2>/dev/null

# Check it calls DELETE API
grep -E "fetch.*{entity}.*DELETE\|axios\.delete.*{entity}" \
  {delete_file} 2>/dev/null
```

- [ ] Delete button/action exists
- [ ] Confirmation prompt before delete
- [ ] Calls correct DELETE endpoint
- [ ] Entity removed from UI after delete
- [ ] Error handling on delete failure

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

### Step 10: Auth Protection on All CRUD Routes

Verify all CRUD operations check authentication and authorization.

```bash
# Check auth on all entity routes
grep -B5 "{entity}" routes/ src/ --include="*.ts" --include="*.js" --include="*.py" 2>/dev/null | \
  grep -E "requireAuth|isAuthenticated|Depends.*auth|login_required|getServerSession"
```

- [ ] Create requires authentication
- [ ] Read may be public or authenticated (as designed)
- [ ] Update requires authentication + ownership check
- [ ] Delete requires authentication + ownership check
- [ ] Admin-only operations protected by role check

**Status:** {PASS | FAIL | PARTIAL}
**Notes:** {details}

---

## CRUD Flow Summary

| Step | Check | Status |
|------|-------|--------|
| 1 | Model/Schema | {status} |
| 2 | Create Route | {status} |
| 3 | Read Routes | {status} |
| 4 | Update Route | {status} |
| 5 | Delete Route | {status} |
| 6 | UI Create -> API | {status} |
| 7 | UI List -> API | {status} |
| 8 | UI Edit -> API | {status} |
| 9 | UI Delete -> API | {status} |
| 10 | Auth Protection | {status} |

**CRUD Score:** {passed}/{total} steps passing ({percent}%)

**Critical Gaps:**
- {gap 1}
- {gap 2}
