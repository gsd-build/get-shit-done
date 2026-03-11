---
phase: 15-frontend-foundation-dashboard
plan: 03
subsystem: ui
tags: [react, vitest, radix-ui, tailwind, tdd, accessibility]

# Dependency graph
requires:
  - phase: 15-frontend-foundation-dashboard
    plan: 01
    provides: Next.js 15 scaffold, Vitest, Tailwind v4
  - phase: 15-frontend-foundation-dashboard
    plan: 02
    provides: TypeScript types (Project, HealthStatus), Zustand stores
provides:
  - ProgressBar UI primitive with accessibility (aria-valuenow, aria-valuemin, aria-valuemax)
  - Badge UI primitive with variants (neutral, success, warning, error)
  - FilterChip UI primitive with keyboard accessibility (aria-pressed)
  - HealthBadge component with Radix Popover for diagnostic display
  - ActivityFeed component with compact mode (2 items) and expansion (5 items)
  - ProjectCard component with progress hero, health badge, phase, hover actions
affects: [15-04, dashboard-page, project-detail]

# Tech tracking
tech-stack:
  added: [clsx@2, date-fns@4]
  patterns: [TDD component development, Radix Popover for tooltips, hover reveal actions]

key-files:
  created:
    - apps/web/src/components/ui/ProgressBar.tsx
    - apps/web/src/components/ui/Badge.tsx
    - apps/web/src/components/ui/FilterChip.tsx
    - apps/web/src/components/ui/index.ts
    - apps/web/src/components/features/dashboard/HealthBadge.tsx
    - apps/web/src/components/features/dashboard/ActivityFeed.tsx
    - apps/web/src/components/features/dashboard/ProjectCard.tsx
    - apps/web/src/components/features/dashboard/index.ts
  modified:
    - apps/web/package.json
    - apps/web/tests/setup.ts

key-decisions:
  - "clsx for className merging (lightweight, tree-shakeable)"
  - "date-fns formatDistanceToNow for relative timestamps"
  - "Radix Popover for diagnostic tooltips (accessible, portal-based)"
  - "ResizeObserver mock for Radix components in jsdom tests"
  - "Vitest matchers via expect.extend for jest-dom compatibility"

patterns-established:
  - "UI primitives in components/ui/ with barrel index.ts"
  - "Feature components in components/features/{domain}/"
  - "Test files co-located with components"
  - "Hover reveal pattern for action buttons"
  - "Compact mode with expand/collapse for lists"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-05]

# Metrics
duration: 10m 38s
completed: 2026-03-11
---

# Phase 15 Plan 03: UI Primitives & Dashboard Components Summary

**Accessible UI primitives (ProgressBar, Badge, FilterChip) and dashboard components (HealthBadge, ActivityFeed, ProjectCard) with TDD methodology achieving 98% component coverage**

## Performance

- **Duration:** 10m 38s
- **Started:** 2026-03-11T13:37:39Z
- **Completed:** 2026-03-11T13:48:17Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- ProgressBar with aria attributes, percentage fill, value clamping (0-100)
- Badge with four variants matching Tailwind CSS health colors
- FilterChip with keyboard accessibility (aria-pressed, Enter key support)
- HealthBadge with Radix Popover showing diagnostic issues on click
- ActivityFeed showing 2 items compact, expandable to 5, with lucide-react icons
- ProjectCard with progress bar hero, health badge, phase, hover-reveal actions
- 33 component tests passing with 98% coverage

## Task Commits

Each task was committed atomically with TDD pattern:

1. **Task 1: RED - Write failing tests for UI primitives** - `910b9f7` (test)
2. **Task 2: GREEN - Implement UI primitives** - `7a1c378` (feat)
3. **Task 3: TDD - Dashboard components** - `6887356` (feat)

## Files Created/Modified

- `apps/web/src/components/ui/ProgressBar.tsx` - Accessible progress bar with fill animation
- `apps/web/src/components/ui/Badge.tsx` - Variant-based badge (neutral, success, warning, error)
- `apps/web/src/components/ui/FilterChip.tsx` - Toggle chip with aria-pressed
- `apps/web/src/components/ui/index.ts` - Barrel export for UI primitives
- `apps/web/src/components/features/dashboard/HealthBadge.tsx` - Health status with diagnostic popover
- `apps/web/src/components/features/dashboard/ActivityFeed.tsx` - Compact expandable activity list
- `apps/web/src/components/features/dashboard/ProjectCard.tsx` - Project card with progress hero
- `apps/web/src/components/features/dashboard/index.ts` - Barrel export for dashboard components
- `apps/web/package.json` - Added clsx, date-fns dependencies
- `apps/web/tests/setup.ts` - Fixed jest-dom matchers, added ResizeObserver mock

## Decisions Made

- **clsx over classnames:** Lighter package, same API for conditional className merging
- **date-fns v4:** Major version with ESM-first design, tree-shakeable
- **expect.extend(matchers):** Direct matcher extension instead of vitest import path for jest-dom
- **ResizeObserver mock:** Required for Radix UI popover component in jsdom test environment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed jest-dom matchers not loading**
- **Found during:** Task 2 (GREEN phase - running tests)
- **Issue:** `@testing-library/jest-dom/vitest` import not providing matchers - "Invalid Chai property: toBeInTheDocument"
- **Fix:** Changed to `import * as matchers from '@testing-library/jest-dom/matchers'` + `expect.extend(matchers)`
- **Files modified:** apps/web/tests/setup.ts
- **Verification:** All tests pass with proper matchers
- **Committed in:** `7a1c378` (part of Task 2)

**2. [Rule 3 - Blocking] Added ResizeObserver mock for Radix components**
- **Found during:** Task 3 (HealthBadge popover tests)
- **Issue:** Radix Popover requires ResizeObserver which doesn't exist in jsdom
- **Fix:** Added global ResizeObserver mock class with no-op methods
- **Files modified:** apps/web/tests/setup.ts
- **Verification:** HealthBadge popover tests pass
- **Committed in:** `6887356` (part of Task 3)

---

**Total deviations:** 2 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Essential fixes for test execution. No scope creep.

## Issues Encountered

- Initial test isolation issue (multiple progressbar elements found) resolved by adding cleanup() to afterEach
- Badge test CSS class assertion required understanding Tailwind theme variable naming (bg-healthy not bg-green)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Component library complete and tested
- Ready for Plan 04: Layout components (Header, Sidebar, PageLayout)
- Components export via barrel files for clean imports
- All CONTEXT.md specifications implemented (progress hero, hover actions, compact activity feed)

## Self-Check: PASSED

All files verified:
- apps/web/src/components/ui/ProgressBar.tsx
- apps/web/src/components/ui/Badge.tsx
- apps/web/src/components/ui/FilterChip.tsx
- apps/web/src/components/features/dashboard/HealthBadge.tsx
- apps/web/src/components/features/dashboard/ActivityFeed.tsx
- apps/web/src/components/features/dashboard/ProjectCard.tsx

All commits verified: 910b9f7, 7a1c378, 6887356

---
*Phase: 15-frontend-foundation-dashboard*
*Completed: 2026-03-11*
