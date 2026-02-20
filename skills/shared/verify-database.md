# Skill: Database Schema Verification Patterns

<database_verification>

## Database Schema (Prisma / Drizzle / SQL)

**Existence check:**
```bash
# Schema file exists
[ -f "prisma/schema.prisma" ] || [ -f "drizzle/schema.ts" ] || [ -f "src/db/schema.sql" ]

# Model/table is defined
grep -E "^model $model_name|CREATE TABLE $table_name|export const $table_name" "$schema_path"
```

**Substantive check:**
```bash
# Has expected fields (not just id)
grep -A 20 "model $model_name" "$schema_path" | grep -E "^\s+\w+\s+\w+"

# Has relationships if expected
grep -E "@relation|REFERENCES|FOREIGN KEY" "$schema_path"

# Has appropriate field types (not all String)
grep -A 20 "model $model_name" "$schema_path" | grep -E "Int|DateTime|Boolean|Float|Decimal|Json"
```

**Stub patterns specific to schemas:**
```prisma
// RED FLAGS - These are stubs:
model User {
  id String @id
  // TODO: add fields
}

model Message {
  id        String @id
  content   String  // Only one real field
}

// Missing critical fields:
model Order {
  id     String @id
  // No: userId, items, total, status, createdAt
}
```

**Wiring check:**
```bash
# Migrations exist and are applied
ls prisma/migrations/ 2>/dev/null | wc -l  # Should be > 0
npx prisma migrate status 2>/dev/null | grep -v "pending"

# Client is generated
[ -d "node_modules/.prisma/client" ]
```

**Functional verification:**
```bash
# Can query the table (automated)
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM $table_name"
```

</database_verification>
