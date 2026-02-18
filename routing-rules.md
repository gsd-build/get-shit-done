# Global Routing Rules

Rules for mapping task patterns to model tiers. Project rules in `.planning/routing/project-rules.md` override these.

## Rules Table

| Pattern | Model | Priority | Rationale |
|---------|-------|----------|-----------|
| **Testing** |  |  |  |
| create.*unit test | haiku | 1 | Isolated, pattern replication |
| create.*integration test.*critical,create.*integration test.*important | sonnet | 2 | Cross-component critical flow |
| create.*integration test | haiku | 1 | Mid/low importance patterns |
| create.*e2e test,create.*end-to-end test | sonnet | 2 | Full user flow |
| create.*e2e test.*critical | opus | 3 | Critical user journey |
| create.*mock,create.*fixture,create.*test data | haiku | 1 | Mechanical pattern |
| setup.*test framework | sonnet | 2 | Foundational testing infrastructure |
| debug.*test.*fail | haiku | 1 | Pattern matching analysis |
| **Architecture** |  |  |  |
| design.*database schema,design.*data model | opus | 3 | Foundational data decisions |
| design.*api.*specification,design.*endpoint design | opus | 3 | Contract definitions |
| design.*cache.*architecture,design.*caching strategy | opus | 3 | System-level thinking |
| design.*auth flow,design.*authentication architecture | opus | 3 | Security-critical |
| design.*system architecture,design.*service boundary | opus | 3 | Component interaction |
| design.*permission.*system,design.*rbac,design.*access control | opus | 3 | Security foundational |
| design.*error handling.*strategy | opus | 3 | System-wide UX |
| design.*notification system,design.*messaging | opus | 3 | User communication |
| design.*backup.*strategy,design.*disaster recovery | opus | 3 | Data safety |
| design.*logging strategy,design.*observability | opus | 3 | System monitoring |
| **Implementation** |  |  |  |
| implement.*api endpoint | sonnet | 2 | Important feature |
| implement.*database.*operation,implement.*database.*query,implement.*database.*migration | sonnet | 2 | Persistent state |
| implement.*auth.*flow,implement.*auth.*login,implement.*auth.*register | sonnet | 2 | Security implementation |
| implement.*form,implement.*input handling | haiku | 1 | Pattern replication |
| implement.*ui component,implement.*visual feature | haiku | 1 | Design system patterns |
| implement.*simple.*function,implement.*simple.*utility | haiku | 1 | Pure function logic |
| implement.*state machine,implement.*workflow | sonnet | 2 | State transitions |
| implement.*retry logic,implement.*exponential backoff | sonnet | 2 | Reliability |
| implement.*polling,implement.*websocket,implement.*real-time | sonnet | 2 | State sync |
| implement.*pagination,implement.*cursor,implement.*infinite scroll | sonnet | 2 | Data handling |
| implement.*search feature,implement.*filter | sonnet | 2 | Query performance |
| implement.*locking,implement.*mutex,implement.*semaphore | opus | 3 | Concurrency correctness |
| **Debugging** |  |  |  |
| fix.*bug.*critical,fix.*bug.*blocking,fix.*bug.*data loss | opus | 3 | Systems thinking |
| fix.*bug.*important | sonnet | 2 | Bounded reasoning |
| fix.*bug | haiku | 1 | Narrow scope |
| read.*logs.*find.*error | haiku | 1 | Pattern matching |
| trace.*request.*flow,trace.*execution path | haiku | 1 | Following patterns |
| investigate.*race condition,investigate.*concurrency | opus | 3 | Complex systems |
| fix.*memory leak,fix.*resource cleanup | sonnet | 2 | System health |
| **Analysis** |  |  |  |
| analyze.*codebase.*find.*where.*invokes | haiku | 1 | Grep and exploration |
| analyze.*performance.*profile,analyze.*performance.*bottleneck | sonnet | 2 | Performance reasoning |
| analyze.*architecture.*decision,analyze.*architecture.*structure | opus | 3 | System-wide implications |
| search.*code.*pattern,search.*code.*usage | haiku | 1 | Pure search |
| investigate.*dependency.*conflict | sonnet | 2 | Version compatibility |
| compare.*performance.*benchmark | sonnet | 2 | Implications reasoning |
| analyze.*bundle size,analyze.*code splitting | sonnet | 2 | Performance implications |
| analyze.*sql.*explain plan | sonnet | 2 | Database reasoning |
| analyze.*code coverage | haiku | 1 | Mechanical reporting |
| **Refactoring** |  |  |  |
| refactor.*large.*system,refactor.*large.*architecture | opus | 3 | System-wide implications |
| refactor.*module.*important | sonnet | 2 | Critical path bounded |
| refactor.*utility.*function,refactor.*non-critical | haiku | 1 | Mechanical low impact |
| rename.*variable,rename.*simple.*cleanup | haiku | 1 | Mechanical tooling |
| refactor.*component hierarchy | sonnet | 2 | Structural change |
| **Security** |  |  |  |
| audit.*security.*vulnerability | opus | 3 | System-wide review |
| implement.*authentication.*token,implement.*authentication.*jwt | sonnet | 2 | Security implementation |
| implement.*input validation,implement.*sanitization | sonnet | 2 | Data safety |
| implement.*password hashing,implement.*encryption | sonnet | 2 | Best practices |
| **DevOps** |  |  |  |
| create.*deployment.*configuration | sonnet | 2 | Infrastructure |
| setup.*ci.*cd.*pipeline | sonnet | 2 | Automation |
| write.*deployment.*script | haiku | 1 | Mechanical script |
| configure.*environment.*variable,configure.*secret | haiku | 1 | Mechanical config |
| setup.*monitoring,setup.*alerting | sonnet | 2 | System health |
| write.*pre-commit hook,write.*linter config | haiku | 1 | Mechanical |
| configure.*type checking,configure.*tsconfig | haiku | 1 | Conventions |
| update.*dependency,npm audit | haiku | 1 | Mechanical update |
| create.*github workflow | sonnet | 2 | CI/CD thinking |
| **Documentation** |  |  |  |
| create.*readme,create.*documentation | haiku | 1 | Mechanical |
| write.*code comment | haiku | 1 | Explain intent |
| design.*api documentation | sonnet | 2 | Developer experience |
| create.*architecture document,create.*adr | opus | 3 | Foundational decisions |
| create.*storybook story | haiku | 1 | Component example |
| **Research** |  |  |  |
| investigate.*library.*comparison | sonnet | 2 | Tradeoff reasoning |
| research.*framework.*technology choice | opus | 3 | Foundational choice |
| explore.*api,explore.*sdk.*documentation | haiku | 1 | Reading docs |
| **Performance** |  |  |  |
| optimize.*performance.*query,optimize.*performance.*database | sonnet | 2 | Data access patterns |
| optimize.*algorithm | sonnet | 2 | Algorithmic thinking |
| implement.*caching.*layer | sonnet | 2 | Cache invalidation |
| add.*index.*database | haiku | 1 | Established patterns |
| profile.*memory usage | haiku | 1 | Mechanical profiling |

## Priority Levels

- 3 = Opus (strongest model wins ties)
- 2 = Sonnet
- 1 = Haiku

## Adding Rules

Add new patterns as comma-separated alternatives. Patterns are case-insensitive and will be converted to regex `|` alternation.
