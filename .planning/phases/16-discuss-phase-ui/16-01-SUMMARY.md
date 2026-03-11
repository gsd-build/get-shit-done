---
phase: 16-discuss-phase-ui
plan: 01
subsystem: web-frontend
tags: [chat-ui, streaming, zustand, react]
dependency_graph:
  requires:
    - "@gsd/events createTokenBuffer"
    - "useSocket hook from Phase 15"
  provides:
    - "useDiscussStore"
    - "useTokenStream"
    - "ChatInterface component"
    - "Discuss page route"
  affects:
    - apps/web/src/stores/
    - apps/web/src/hooks/
    - apps/web/src/components/features/discuss/
    - apps/web/src/app/projects/[id]/discuss/
tech_stack:
  added:
    - react-markdown (^10.1.0)
    - remark-gfm (^4.0.1)
  patterns:
    - "Zustand selectors for optimized re-renders"
    - "RAF token buffering with typewriter animation"
    - "exactOptionalPropertyTypes spread pattern"
key_files:
  created:
    - apps/web/src/stores/discussStore.ts
    - apps/web/src/hooks/useTokenStream.ts
    - apps/web/src/components/features/discuss/ChatInterface.tsx
    - apps/web/src/components/features/discuss/ChatInput.tsx
    - apps/web/src/components/features/discuss/MessageBubble.tsx
    - apps/web/src/components/features/discuss/StreamingMessage.tsx
    - apps/web/src/components/features/discuss/TypingIndicator.tsx
    - apps/web/src/components/features/discuss/QuestionCard.tsx
    - apps/web/src/components/features/discuss/ProgressStepper.tsx
    - apps/web/src/components/features/discuss/WelcomeScreen.tsx
    - apps/web/src/components/features/discuss/ConnectionBanner.tsx
    - apps/web/src/components/features/discuss/index.ts
    - apps/web/src/app/projects/[id]/discuss/page.tsx
  modified:
    - apps/web/package.json
    - apps/web/src/lib/contextParser.ts
decisions:
  - "~30ms typewriter delay for character-by-character streaming per CONTEXT.md"
  - "User messages right-aligned (blue), assistant left-aligned (muted), system centered (yellow)"
  - "exactOptionalPropertyTypes spread pattern for optional props"
metrics:
  duration: "6m 14s"
  completed: "2026-03-11"
---

# Phase 16 Plan 01: Chat Interface & Streaming Summary

Chat conversation interface with real-time token streaming and ~30ms typewriter effect using RAF-batched createTokenBuffer from @gsd/events.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Zustand store and token stream hook | 639afa5 | discussStore.ts, useTokenStream.ts |
| 2 | Create chat UI components | 7e0c4bc | 9 components + index.ts |
| 3 | Create discuss page and wire components | 4c567b5 | page.tsx |

## Implementation Highlights

### Zustand Store (discussStore.ts)
- Message management with role-based typing (user/assistant/system)
- Question card data with multi-select support
- Streaming state tracking (isStreaming, currentStreamingContent)
- Topic index for progress stepper navigation
- Selectors exported for optimized re-renders

### Token Streaming Hook (useTokenStream.ts)
- Wraps createTokenBuffer from @gsd/events for RAF-batched token receipt
- Implements typewriter animation with ~30ms character delay
- Character queue drains via requestAnimationFrame
- Handles agent:start/agent:end events for lifecycle
- Returns displayedText, isStreaming, clear()

### Chat Components
- **MessageBubble**: Role-based styling with markdown rendering (react-markdown + remark-gfm)
- **StreamingMessage**: Blinking cursor (animate-pulse) while streaming
- **ChatInput**: Sticky bottom, Enter to send, Shift+Enter for newline, disabled while streaming
- **TypingIndicator**: Three bouncing dots with staggered animation delay
- **QuestionCard**: Multi/single select with visual feedback on selection
- **ProgressStepper**: Topic navigation with check marks and current indicator
- **WelcomeScreen**: Empty state with phase context
- **ConnectionBanner**: Reconnection status with auto-dismiss
- **ChatInterface**: Main container with auto-scroll behavior

### Discuss Page
- Integrates ChatInterface with discussStore
- Uses useSocket and useTokenStream for real-time streaming
- Sends messages via POST /api/agents with discuss-phase agent
- Handles question card selection with system messages
- Inline error banner per CONTEXT.md "Failed to generate. Retry?"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed contextParser.ts match[1] possibly undefined**
- **Found during:** Task 1 TypeScript verification
- **Issue:** Pre-existing TypeScript error blocking compilation
- **Fix:** Added null check before accessing match[1]
- **Files modified:** apps/web/src/lib/contextParser.ts
- **Commit:** 639afa5

## Verification Results

1. TypeScript compilation passes for apps/web
2. All components export correctly from index.ts
3. Store provides message management functions with selectors
4. Token stream hook implements typewriter effect at ~30ms/char
5. Chat bubbles follow left/right layout per CONTEXT.md

## Self-Check: PASSED

- [x] apps/web/src/stores/discussStore.ts exists
- [x] apps/web/src/hooks/useTokenStream.ts exists
- [x] apps/web/src/components/features/discuss/ChatInterface.tsx exists
- [x] apps/web/src/app/projects/[id]/discuss/page.tsx exists
- [x] Commit 639afa5 exists
- [x] Commit 7e0c4bc exists
- [x] Commit 4c567b5 exists
