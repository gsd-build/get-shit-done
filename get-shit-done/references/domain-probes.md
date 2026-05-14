# Domain-Aware Probing Patterns

Shared reference for `/gsd-begin`, `/gsd:discuss-phase`, and domain exploration workflows.

When the user mentions a technology area, use these probes to ask insightful follow-up questions. Don't run through them as a checklist -- pick the 2-3 most relevant based on context. The goal is to surface hidden assumptions and trade-offs the user may not have considered yet.

---

## Authentication

| User mentions | Agent probes with domain knowledge |
|---|---|
| "login" or "auth" | OAuth (which providers?), JWT, or session-based? Do you need social login or just email/password? |
| "users" or "accounts" | MFA required? Password reset flow? Email verification? |
| "sessions" | Session duration and refresh strategy? Server-side sessions or stateless tokens? |
| "roles" or "permissions" | RBAC, ABAC, or simple role checks? How many distinct roles? |
| "API keys" | Key rotation strategy? Scoped permissions per key? Rate limiting per key? |

---

## Real-Time Updates

| User mentions | Agent probes with domain knowledge |
|---|---|
| "real-time" or "live updates" | WebSockets, SSE, or polling? What specifically needs to be real-time vs. eventual? |
| "notifications" | Push notifications (browser/mobile), in-app only, or both? Persistence and read receipts? |
| "collaboration" or "multiplayer" | Conflict resolution strategy? Operational transforms or CRDTs? Expected concurrent users? |
| "chat" or "messaging" | Message history and search? Typing indicators? Read receipts? |
| "streaming" | Reconnection strategy? What happens when the connection drops -- queue or discard? |

---

## Dashboard

| User mentions | Agent probes with domain knowledge |
|---|---|
| "dashboard" | What data sources feed it? How many distinct views? |
| "charts" or "graphs" | Interactive or static? Drill-down capability? Export to CSV/PDF? |
| "metrics" or "KPIs" | Refresh strategy -- real-time, periodic polling, or on-demand? Acceptable staleness? |
| "admin panel" | Role-based visibility? Which actions beyond viewing (edit, delete, approve)? |
| "mobile" or "responsive" | Simplified mobile view or full parity? Touch interactions for charts? |

---

## API Design

| User mentions | Agent probes with domain knowledge |
|---|---|
| "API" | REST, GraphQL, or RPC-style? Internal only or public-facing? |
| "endpoints" or "routes" | Versioning strategy (URL path, header, query param)? Breaking change policy? |
| "pagination" | Cursor-based or offset? Expected result set sizes? Stable ordering guarantee? |
| "rate limiting" | Per-user, per-IP, or per-API-key? Burst allowance? How to communicate limits to clients? |
| "errors" | Structured error format? Error codes vs. messages? How much detail in production errors? |

---

## Database

| User mentions | Agent probes with domain knowledge |
|---|---|
| "database" or "storage" | SQL or NoSQL? What drives the choice -- relational integrity, flexibility, scale? |
| "ORM" or "queries" | ORM (which one?) or raw queries? Query builder as middle ground? |
| "migrations" | Migration tool? Rollback strategy? How do you handle data migrations vs. schema migrations? |
| "seeding" or "test data" | Seed data for development? Realistic fake data or minimal fixtures? |
| "scale" or "performance" | Read/write ratio? Read replicas? Connection pooling strategy? |

---

## Search

| User mentions | Agent probes with domain knowledge |
|---|---|
| "search" | Full-text or exact match? Dedicated search engine (Elasticsearch, Meilisearch) or database-level? |
| "filtering" or "facets" | Faceted filtering? How many filter dimensions? Combined filters (AND/OR)? |
| "autocomplete" or "typeahead" | Debounce strategy? Minimum character threshold? Result ranking? |
| "indexing" | Index size and update frequency? Real-time indexing or batch? Acceptable index lag? |
| "fuzzy" or "typo tolerance" | Fuzzy matching? Synonym support? Language-specific stemming? |

---

## File Upload/Storage

| User mentions | Agent probes with domain knowledge |
|---|---|
| "upload" or "file upload" | Local filesystem or cloud (S3, GCS, Azure Blob)? Direct upload or through server? |
| "images" or "media" | Processing pipeline -- resize, compress, thumbnail generation? Format conversion? |
| "size limits" | Max file size? Max total storage per user? What happens when limits are hit? |
| "CDN" | CDN for delivery? Cache invalidation for updated files? Signed URLs for access control? |
| "documents" or "attachments" | Virus scanning? Preview generation? Versioning of uploaded files? |

---

## Caching

| User mentions | Agent probes with domain knowledge |
|---|---|
| "caching" or "performance" | Where to cache -- browser, CDN, application layer, database query cache? |
| "invalidation" | Invalidation strategy -- TTL, event-driven, or manual? Cache-aside vs. write-through? |
| "stale data" | Acceptable staleness window? Stale-while-revalidate pattern? |
| "Redis" or "Memcached" | Cache topology -- single node or clustered? Persistence needed or pure cache? |
| "CDN" or "edge" | Edge caching for static assets? Dynamic content at the edge? Cache key strategy? |

---

## Testing

| User mentions | Agent probes with domain knowledge |
|---|---|
| "testing" or "tests" | Unit, integration, and E2E balance? Where do you invest most testing effort? |
| "mocking" or "stubs" | Mock external services or use test containers? Database mocking strategy? |
| "CI" or "pipeline" | Tests in CI? Parallel test execution? Test-on-PR or test-on-push? |
| "coverage" | Coverage targets? Coverage as gate or advisory? Which metrics (line, branch, function)? |
| "E2E" or "browser testing" | Playwright, Cypress, or other? Headed vs. headless? Visual regression testing? |

---

## Deployment

| User mentions | Agent probes with domain knowledge |
|---|---|
| "deploy" or "hosting" | Container, serverless, or traditional VM/VPS? Managed platform (Vercel, Railway) or self-hosted? |
| "CI/CD" or "pipeline" | GitHub Actions, GitLab CI, or other? Deploy on merge to main or manual trigger? |
| "environments" | How many environments (dev, staging, prod)? Environment parity strategy? |
| "rollback" | Rollback strategy? Blue-green, canary, or instant rollback? Database rollback considerations? |
| "secrets" or "config" | Secret management -- env vars, vault, or platform-native? Per-environment config strategy? |
