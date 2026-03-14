# Phase 15: Frontend Foundation & Dashboard - Research

**Researched:** 2026-03-11
**Domain:** Next.js 15 + Tailwind v4 + Socket.IO + Zustand
**Confidence:** HIGH

## Summary

This phase implements the foundational frontend dashboard for GSD, building on the backend infrastructure completed in Phase 13-14. The frontend will be a Next.js 15 application using the App Router pattern, Tailwind CSS v4 with CSS-first configuration, and Zustand for client-side state management. Real-time connectivity with the backend is provided via Socket.IO, leveraging the existing `@gsd/events` package which already contains typed Socket.IO client utilities.

The dashboard will display project cards in a responsive grid layout, featuring progress bars as hero elements, health status indicators, and compact activity feeds. Search/filter functionality enables instant filtering by name and status. The existing REST API (GET /api/projects) provides all necessary data: project list with embedded health status, progress percentage, current phase, and lastActivity.

**Primary recommendation:** Use `create-next-app` with the monorepo structure, keeping `apps/web` as the web package. Install Vitest + Testing Library for component tests and Playwright for E2E tests. Use MSW for mocking API responses in tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Card grid layout (responsive) - not table/list view
- Progress-forward hierarchy: progress bar as hero element, health badge and phase name secondary
- Standard density: show project name, progress bar, status badge, current phase, and 1-2 recent actions inline
- Hover reveals action buttons (open, archive, settings)
- Color-coded badge with text label (green = healthy, yellow = degraded, red = error)
- Degraded status triggers when: stale activity (no actions in X days) OR planning issues (missing CONTEXT.md, incomplete plans, failed verification)
- Click badge shows diagnostic popover/tooltip explaining why degraded/error
- Badge only - no extra card styling (border tint, dimming) for problem states
- Compact list: 1-2 actions visible inline, expand to reveal all 5
- Each action shows: action description + agent name + relative time ("gsd-executor ran plan 12-01 * 2h ago")
- Icons per action type (plan, execute, verify, discuss) for quick visual scanning
- Click action navigates directly to that execution's detail/log view
- Instant filtering as you type - results filter live
- Filter chips for status (Healthy, Degraded, Error) - toggle on/off
- Clear all button to reset filters
- Filters reset on page load - no localStorage persistence
- Both component tests (Vitest + Testing Library) AND E2E tests (Playwright)
- 80% minimum coverage target for component tests
- E2E tests cover all DASH requirements (DASH-01 through DASH-05)
- Mock API responses using MSW for deterministic test data

### Claude's Discretion
- Exact card dimensions and spacing
- Animation/transition details for hover states
- Specific icon choices for action types
- Filter chip styling and colors
- Popover positioning and timing

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User can view list of all GSD projects with health status indicators (healthy/degraded/error) | REST API `GET /api/projects` returns Project[] with health.status; Zustand store for caching; color-coded badges with text labels |
| DASH-02 | User can see current phase and progress percentage for each project | Project response includes `currentPhase` and `progress.percentage`; progress bar component as hero element per CONTEXT.md |
| DASH-03 | User can view recent activity feed (last 5 actions) for each project | Project.lastActivity available; requires backend enhancement for full activity list OR parse from STATE.md Recent Activity section |
| DASH-04 | User can search and filter projects by name or status | Client-side filtering with Zustand; instant filter as user types; status filter chips |
| DASH-05 | User can navigate to project detail view by clicking a project card | Next.js App Router dynamic route `/projects/[id]`; project detail page placeholder |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (16 available but 15 stable) | React framework with App Router | Official recommendation, SSR/SSG support, file-based routing |
| React | 19.x | UI library | Bundled with Next.js 15, Server Components support |
| Tailwind CSS | 4.x | Utility-first CSS | CSS-first config, 5x faster builds, native dark mode |
| TypeScript | 5.4+ | Type safety | Full monorepo support, Next.js native integration |

### State & Data
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.x | Client-side state | UI state, filter state, cached project data |
| @gsd/events | workspace | Socket.IO client types + utilities | Already exists - use `createSocketClient`, `createTokenBuffer` |
| socket.io-client | 4.8.x | WebSocket connectivity | Peer dependency of @gsd/events |
| TanStack Query | 5.x | Server state / API caching | Optional - consider for future phases; Zustand sufficient for Phase 15 |

### Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.x | Test runner | Unit and component tests, fast with Vite |
| @testing-library/react | 16.x | Component testing | Test user interactions, accessibility |
| @testing-library/jest-dom | 6.x | DOM matchers | Extended assertions like toBeInTheDocument() |
| @testing-library/user-event | 14.x | User interaction simulation | Click, type, hover events |
| Playwright | 1.50.x | E2E testing | Full browser testing, DASH requirement coverage |
| MSW | 2.x | API mocking | Mock REST API responses in tests |

### UI Components
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-themes | 0.4.x | Theme switching | Dark mode toggle with SSR-safe hydration |
| lucide-react | 0.400+ | Icons | Action type icons (plan, execute, verify, discuss) |
| @radix-ui/react-popover | 1.x | Popover primitives | Health diagnostic popovers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | Redux Toolkit | Zustand ~1KB vs RTK ~15KB; simpler API; sufficient for dashboard state |
| Zustand | TanStack Query | TanStack better for server state caching; can combine both if needed |
| Tailwind CSS | CSS Modules | Tailwind v4 has best DX; consistent with modern Next.js patterns |
| lucide-react | heroicons | Both good; lucide has more icons, smaller bundle per icon |
| @radix-ui | shadcn/ui | shadcn is built on Radix; can add later if more components needed |

**Installation:**
```bash
# In apps/web directory
pnpm add next@15 react react-dom tailwindcss@4 postcss @tailwindcss/postcss
pnpm add zustand next-themes lucide-react @radix-ui/react-popover
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
pnpm add -D @vitejs/plugin-react jsdom
pnpm add -D playwright @playwright/test
pnpm add -D msw
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout with providers
│   │   ├── page.tsx              # Dashboard home page
│   │   ├── globals.css           # Tailwind imports + theme vars
│   │   └── projects/
│   │       └── [id]/
│   │           └── page.tsx      # Project detail view (stub)
│   ├── components/
│   │   ├── ui/                   # Reusable UI primitives
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── FilterChip.tsx
│   │   │   └── Popover.tsx
│   │   └── features/
│   │       └── dashboard/
│   │           ├── ProjectCard.tsx
│   │           ├── ProjectGrid.tsx
│   │           ├── ActivityFeed.tsx
│   │           ├── HealthBadge.tsx
│   │           ├── SearchBar.tsx
│   │           └── FilterBar.tsx
│   ├── hooks/
│   │   ├── useSocket.ts          # Socket.IO connection hook
│   │   └── useProjects.ts        # Projects data hook
│   ├── stores/
│   │   ├── projectStore.ts       # Zustand store for projects
│   │   └── filterStore.ts        # Zustand store for filters
│   ├── lib/
│   │   ├── api.ts                # API client functions
│   │   └── utils.ts              # Utility functions
│   └── types/
│       └── index.ts              # Shared TypeScript types
├── tests/
│   ├── setup.ts                  # Vitest setup with MSW
│   ├── mocks/
│   │   ├── handlers.ts           # MSW request handlers
│   │   └── server.ts             # MSW server setup
│   └── e2e/
│       └── dashboard.spec.ts     # Playwright E2E tests
├── vitest.config.ts
├── playwright.config.ts
├── tailwind.config.ts            # Optional - for legacy config
├── postcss.config.mjs
└── package.json
```

### Pattern 1: Zustand Store with Selectors
**What:** Zustand store pattern optimized for React Server Component compatibility
**When to use:** Client-side state management in dashboard
**Example:**
```typescript
// Source: https://github.com/pmndrs/zustand + best practices
import { create } from 'zustand';

interface Project {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'unknown';
  health: { status: 'healthy' | 'degraded' | 'error'; issues: string[] };
  progress: { percentage: number };
  currentPhase: string | null;
}

interface ProjectStore {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  setProjects: (projects: Project[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  isLoading: false,
  error: null,
  setProjects: (projects) => set({ projects }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

// Selectors for optimized re-renders
export const selectProjects = (state: ProjectStore) => state.projects;
export const selectIsLoading = (state: ProjectStore) => state.isLoading;
```

### Pattern 2: Socket.IO Hook with @gsd/events
**What:** Custom hook leveraging existing @gsd/events utilities
**When to use:** Real-time data updates from backend
**Example:**
```typescript
// Source: @gsd/events package + Socket.IO React patterns
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createSocketClient, type TypedSocket } from '@gsd/events';

export function useSocket(url: string) {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const client = createSocketClient({ url, autoConnect: true });

    client.on('connect', () => setIsConnected(true));
    client.on('disconnect', () => setIsConnected(false));

    setSocket(client);

    return () => {
      client.disconnect();
    };
  }, [url]);

  return { socket, isConnected };
}
```

### Pattern 3: Tailwind v4 CSS-First Dark Mode
**What:** CSS variables for theme tokens with class-based dark mode
**When to use:** All styling with dark mode support
**Example:**
```css
/* Source: https://tailwindcss.com/docs/upgrade-guide + next-themes docs */
/* globals.css */
@import "tailwindcss";

@theme {
  /* Light mode colors */
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
  --color-card: #ffffff;
  --color-card-foreground: #0a0a0a;

  /* Health status colors */
  --color-healthy: #22c55e;
  --color-degraded: #eab308;
  --color-error: #ef4444;

  /* Progress bar */
  --color-progress-bg: #e5e7eb;
  --color-progress-fill: #3b82f6;
}

.dark {
  --color-background: #0a0a0a;
  --color-foreground: #fafafa;
  --color-card: #1c1c1c;
  --color-card-foreground: #fafafa;
  --color-progress-bg: #374151;
}
```

### Pattern 4: MSW Handler Setup for Testing
**What:** Mock Service Worker handlers matching backend API
**When to use:** Component tests and development
**Example:**
```typescript
// Source: https://mswjs.io/docs/
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/projects', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 'project-1',
          name: 'GSD Dashboard',
          status: 'active',
          health: { status: 'healthy', issues: [] },
          progress: { percentage: 65, completedPlans: 8, totalPlans: 12 },
          currentPhase: 'Phase 15',
          lastActivity: '2026-03-11T10:00:00Z',
        },
      ],
      meta: { total: 1, hasNextPage: false },
    });
  }),
];
```

### Anti-Patterns to Avoid
- **Storing server state in Zustand:** Use Zustand for UI state only; fetch data with useEffect or TanStack Query
- **Using `use client` everywhere:** Start with Server Components; add `use client` only when needed for interactivity
- **Dark mode flash on load:** Use next-themes with `attribute="class"` and `enableSystem` for SSR-safe theming
- **Direct socket manipulation in components:** Wrap Socket.IO in a hook or context; reuse connection
- **Testing implementation details:** Test user behavior, not internal state; use Testing Library queries

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark mode toggle | Custom theme state management | next-themes | Handles SSR hydration, localStorage, system preference |
| Popover/tooltip | Custom positioning logic | @radix-ui/react-popover | Handles positioning, focus, accessibility |
| Progress bar accessibility | Custom aria attributes | Radix Progress or semantic HTML | Correct ARIA roles, keyboard nav |
| API mocking in tests | Custom fetch stubs | MSW | Network-level interception, reusable across test types |
| Socket.IO typed client | Custom type definitions | @gsd/events | Already exists with full type safety |

**Key insight:** The @gsd/events package already provides `createSocketClient`, `createTokenBuffer`, and full TypeScript types for Socket.IO. Use it directly rather than reimplementing.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with Dark Mode
**What goes wrong:** Server renders light mode, client renders dark mode, causing flash/error
**Why it happens:** Server doesn't know user's theme preference
**How to avoid:** Use next-themes with `suppressHydrationWarning` on html element; defer theme-dependent rendering
**Warning signs:** Console errors about hydration mismatch; visible flash on page load

### Pitfall 2: Socket.IO Connection Leak
**What goes wrong:** Multiple socket connections created, memory leaks, duplicate events
**Why it happens:** Socket created inside useEffect without proper cleanup; re-renders create new connections
**How to avoid:** Create socket once with proper cleanup; use singleton pattern or context
**Warning signs:** Multiple "connect" events in console; increasing memory usage

### Pitfall 3: Zustand Store in Server Components
**What goes wrong:** "Cannot use hooks in Server Component" error
**Why it happens:** Zustand uses React hooks; Server Components don't support hooks
**How to avoid:** Mark components using Zustand stores with `'use client'`; pass data as props from Server Components
**Warning signs:** Build errors; runtime errors about hooks

### Pitfall 4: Tailwind v4 Config File Confusion
**What goes wrong:** Custom classes not working; dark mode not toggling
**Why it happens:** Tailwind v4 uses CSS-first config (@theme); old tailwind.config.js patterns don't apply
**How to avoid:** Define tokens in `@theme` block in CSS; use @import "tailwindcss" not @tailwind directives
**Warning signs:** Custom colors undefined; dark: classes not applying

### Pitfall 5: MSW v2 Missing Globals in Vitest
**What goes wrong:** Tests fail with undefined globals (TextEncoder, Blob, BroadcastChannel)
**Why it happens:** MSW v2 requires browser-like globals; jsdom doesn't provide all of them
**How to avoid:** Add polyfills in vitest setup; use `happy-dom` environment instead of jsdom if issues persist
**Warning signs:** ReferenceError: TextEncoder is not defined

### Pitfall 6: Testing Library Async Queries
**What goes wrong:** Tests pass locally, fail in CI; flaky tests
**Why it happens:** Using getBy for async content; not waiting for state updates
**How to avoid:** Use findBy queries for async content; wrap state updates in act(); use waitFor for assertions
**Warning signs:** Intermittent test failures; "not found" errors for content that should exist

## Code Examples

Verified patterns from official sources:

### Next.js 15 App with Providers
```typescript
// Source: https://nextjs.org/docs/app/getting-started/installation
// app/layout.tsx
import { ThemeProvider } from 'next-themes';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Project Card Component Pattern
```typescript
// Source: CONTEXT.md requirements + React patterns
// components/features/dashboard/ProjectCard.tsx
'use client';

import { useState } from 'react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { HealthBadge } from './HealthBadge';
import { ActivityFeed } from './ActivityFeed';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  onNavigate: (id: string) => void;
}

export function ProjectCard({ project, onNavigate }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="bg-card p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onNavigate(project.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate(project.id)}
    >
      <h3 className="font-semibold text-foreground mb-2">{project.name}</h3>

      {/* Progress bar as hero element */}
      <ProgressBar
        value={project.progress.percentage}
        className="mb-3"
      />

      <div className="flex items-center gap-2 mb-2">
        <HealthBadge status={project.health.status} issues={project.health.issues} />
        {project.currentPhase && (
          <span className="text-sm text-muted-foreground">{project.currentPhase}</span>
        )}
      </div>

      <ActivityFeed
        lastActivity={project.lastActivity}
        compact
      />

      {/* Hover actions */}
      {isHovered && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          <button className="text-sm text-primary hover:underline">Open</button>
          <button className="text-sm text-muted-foreground hover:underline">Archive</button>
          <button className="text-sm text-muted-foreground hover:underline">Settings</button>
        </div>
      )}
    </div>
  );
}
```

### Vitest + Testing Library Setup
```typescript
// Source: https://vitest.dev/guide/ + https://testing-library.com/docs/
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

// tests/setup.ts
import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Playwright E2E Test
```typescript
// Source: https://nextjs.org/docs/app/guides/testing/playwright
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('DASH-01: displays project list with health indicators', async ({ page }) => {
    await page.goto('/');

    // Wait for projects to load
    await expect(page.getByRole('main')).toContainText('Projects');

    // Check for project cards
    const cards = page.getByRole('button', { name: /project/i });
    await expect(cards.first()).toBeVisible();

    // Check for health badge
    await expect(page.getByText(/healthy|degraded|error/i).first()).toBeVisible();
  });

  test('DASH-04: filters projects by search and status', async ({ page }) => {
    await page.goto('/');

    // Search filter
    await page.getByPlaceholder(/search/i).fill('dashboard');
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();

    // Status filter chip
    await page.getByRole('button', { name: /healthy/i }).click();
    // Assert filtering works
  });

  test('DASH-05: navigates to project detail on click', async ({ page }) => {
    await page.goto('/');

    // Click first project card
    await page.getByRole('button', { name: /project/i }).first().click();

    // Should navigate to project detail
    await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js | CSS-first @theme config | Tailwind v4 (2024) | Simpler config, faster builds |
| @tailwind directives | @import "tailwindcss" | Tailwind v4 (2024) | Single import, auto content detection |
| Redux for all state | Zustand + TanStack Query | 2023-2024 | Smaller bundle, simpler API |
| Pages Router | App Router | Next.js 13+ (2023) | Server Components, streaming, layouts |
| Jest for React testing | Vitest | 2023-2024 | 4x faster, native ESM, Vite integration |
| Manual socket management | @gsd/events utilities | Phase 13 (current) | Type-safe, reconnection built-in |

**Deprecated/outdated:**
- `@tailwind base/components/utilities`: Replaced by `@import "tailwindcss"`
- `create-react-app`: Use Next.js or Vite for React apps
- `enzyme` for React testing: Use Testing Library
- `msw` v1 syntax: v2 uses `http` and `HttpResponse` instead of `rest`

## Open Questions

1. **Activity Feed Data Source**
   - What we know: Project.lastActivity provides single timestamp; STATE.md has "Recent Activity" section
   - What's unclear: API doesn't expose full activity list (last 5 actions with agent names)
   - Recommendation: Either enhance backend API to return activity array, or parse STATE.md client-side (less clean). Suggest backend enhancement in Plan 15-03 as prerequisite.

2. **Filter Reset on Page Load**
   - What we know: CONTEXT.md specifies no localStorage persistence
   - What's unclear: Should filters survive client-side navigation within the app?
   - Recommendation: Use Zustand without persistence middleware; filters reset on full page reload but persist during SPA navigation.

3. **Click Action Navigation Target**
   - What we know: CONTEXT.md says "Click action navigates directly to that execution's detail/log view"
   - What's unclear: Execute UI (Phase 17) not yet implemented; what URL structure?
   - Recommendation: Implement navigation as `/projects/[id]/executions/[executionId]`; page can be placeholder until Phase 17.

## Sources

### Primary (HIGH confidence)
- [Next.js Official Documentation](https://nextjs.org/docs) - Installation, App Router, Testing guides (updated Feb 2026)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs/upgrade-guide) - CSS-first configuration
- [Zustand GitHub](https://github.com/pmndrs/zustand) - Official patterns and TypeScript usage
- [MSW Documentation](https://mswjs.io/docs/) - v2 setup with Vitest
- [Playwright Documentation](https://playwright.dev/) - Next.js integration
- [Vitest Documentation](https://vitest.dev/guide/) - Configuration and Testing Library integration

### Secondary (MEDIUM confidence)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/) - Component testing patterns
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - Dark mode with Next.js
- [@gsd/events source code](/Users/mauricevandermerwe/Projects/get-shit-done/packages/events) - Existing Socket.IO utilities

### Tertiary (LOW confidence)
- Community blog posts on Tailwind v4 migration - Patterns still evolving
- Socket.IO React hook patterns - Various approaches, official docs prefer context pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Next.js/Tailwind docs verified, aligned with Phase 13-14 patterns
- Architecture: HIGH - Follows established monorepo structure, uses existing packages
- Pitfalls: HIGH - Well-documented issues with known solutions
- Activity feed data: MEDIUM - May require backend enhancement beyond current API

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days - stable technologies)
