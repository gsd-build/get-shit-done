---
phase: 15-frontend-foundation-dashboard
plan: 01
subsystem: ui
tags: [next.js, react, tailwind, vitest, playwright, msw, dark-mode]

# Dependency graph
requires:
  - phase: 13-foundation-infrastructure
    provides: monorepo scaffold, @gsd/events package, pnpm workspace
  - phase: 14-backend-core
    provides: REST API types and envelope patterns
provides:
  - Next.js 15 application scaffold with App Router
  - Tailwind CSS v4 with CSS-first @theme configuration
  - Dark mode toggle via next-themes
  - Vitest configuration with Testing Library and MSW
  - Playwright E2E testing configuration
  - MSW handlers for /api/projects mock endpoint
affects: [15-02, 15-03, 15-04, dashboard-components]

# Tech tracking
tech-stack:
  added: [next.js@15, react@19, tailwindcss@4, next-themes, vitest@2, playwright@1.50, msw@2, lucide-react]
  patterns: [CSS-first theming, App Router, ThemeProvider wrapping]

key-files:
  created:
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
    - apps/web/src/app/globals.css
    - apps/web/vitest.config.ts
    - apps/web/playwright.config.ts
    - apps/web/tests/mocks/handlers.ts
  modified:
    - apps/web/package.json
    - apps/web/tsconfig.json

key-decisions:
  - "Tailwind v4 CSS-first pattern with @import and @theme block"
  - "next-themes with attribute=class for CSS variable theming"
  - "Vitest 2.x (stable) over 4.x (alpha) for reliability"
  - "MSW 2.x with http.get syntax matching upstream patterns"
  - "exactOptionalPropertyTypes spread pattern for optional config"

patterns-established:
  - "Health status colors: --color-healthy, --color-degraded, --color-error"
  - "Dark mode via .dark class overriding CSS variables"
  - "MSW handlers in tests/mocks/handlers.ts with envelope format"

requirements-completed: [DASH-01]

# Metrics
duration: 8m 30s
completed: 2026-03-11
---

# Phase 15 Plan 01: Next.js Scaffold Summary

**Next.js 15 with Tailwind v4 CSS-first theming, dark mode toggle via next-themes, and full test infrastructure (Vitest + Playwright + MSW)**

## Performance

- **Duration:** 8m 30s
- **Started:** 2026-03-11T13:13:52Z
- **Completed:** 2026-03-11T13:22:22Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Next.js 15 app with App Router builds and starts successfully
- Tailwind CSS v4 with CSS-first @theme configuration for health status colors
- Dark mode toggle using next-themes ThemeProvider
- Vitest 2.x with Testing Library, jest-dom, and MSW integration
- Playwright configured for Desktop and Mobile Chrome E2E testing
- MSW handlers mocking /api/projects endpoint with envelope format

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Next.js 15 app with Tailwind v4 and dark mode** - `9114d78` (feat)
2. **Task 2: Configure Vitest with Testing Library and MSW** - `f46e92f` (feat)
3. **Task 3: Configure Playwright for E2E testing** - `2bc045d` (feat)
4. **Auto-fix: TypeScript strict compliance** - `6fe126b` (fix)

## Files Created/Modified

- `apps/web/package.json` - Dependencies and scripts for Next.js, testing
- `apps/web/next.config.ts` - Turbopack and transpilePackages config
- `apps/web/postcss.config.mjs` - Tailwind v4 PostCSS plugin
- `apps/web/tsconfig.json` - Next.js compiler options and path aliases
- `apps/web/src/app/globals.css` - Tailwind v4 @theme with health colors
- `apps/web/src/app/layout.tsx` - Root layout with ThemeProvider
- `apps/web/src/app/page.tsx` - Dashboard placeholder with dark mode toggle
- `apps/web/vitest.config.ts` - Vitest with jsdom and React plugin
- `apps/web/tests/setup.ts` - MSW server lifecycle hooks
- `apps/web/tests/mocks/handlers.ts` - Mock handlers for /api/projects
- `apps/web/tests/mocks/server.ts` - MSW setupServer
- `apps/web/playwright.config.ts` - Playwright with webServer config

## Decisions Made

- **Tailwind v4 CSS-first:** Using `@import "tailwindcss"` and `@theme` block instead of tailwind.config.js (per v4 best practices)
- **Vitest 2.x over 4.x:** Chose stable 2.1.x release over alpha 4.x for production reliability
- **exactOptionalPropertyTypes pattern:** Use spread `...(condition && { key: value })` to avoid undefined in optional properties per project tsconfig.base.json
- **MSW envelope format:** Match backend REST API envelope with `{ success, data, meta }` structure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed strict TypeScript compliance**
- **Found during:** Final verification (build check)
- **Issue:** Project's strict tsconfig (exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature) caused type errors in Playwright config and MSW handlers
- **Fix:** Used bracket notation for process.env access, spread pattern for optional workers, bracket notation for params access
- **Files modified:** apps/web/playwright.config.ts, apps/web/tests/mocks/handlers.ts
- **Verification:** `pnpm run build` passes, `pnpm run typecheck` passes
- **Committed in:** `6fe126b`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Essential fix for TypeScript strict mode compliance. No scope creep.

## Issues Encountered

- Vitest reports "No test files found" - this is expected as we only set up infrastructure, actual tests come in later plans
- Playwright reports "No tests found" when listing - expected since tests/e2e only has .gitkeep
- Next.js warns about multiple lockfiles in worktree setup - informational only, does not affect functionality

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Foundation scaffold complete and verified
- Ready for Plan 02: Layout components (header, sidebar, navigation)
- Ready for Plan 03: Dashboard components (project cards, progress bars)
- Test infrastructure ready for component tests

---
*Phase: 15-frontend-foundation-dashboard*
*Completed: 2026-03-11*
