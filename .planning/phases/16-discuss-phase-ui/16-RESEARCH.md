# Phase 16: Discuss Phase UI - Research

**Researched:** 2026-03-11
**Domain:** React streaming chat interface, real-time collaboration, session persistence
**Confidence:** HIGH

## Summary

Phase 16 implements a conversational UI for gathering context before phase planning. The user chats with Claude, sees a live preview of CONTEXT.md being generated, can lock/unlock individual decisions, and can resume sessions after browser refresh. The phase builds on Phase 13's Socket.IO infrastructure, Phase 14's agent orchestrator with checkpoint support, and Phase 15's React component patterns with Zustand stores.

The core technical challenges are: (1) streaming tokens with character-by-character typewriter effect, (2) real-time preview updates with diff highlighting, (3) session persistence using Zustand's persist middleware, and (4) bidirectional sync between manual edits and conversation state. The existing @gsd/events package already provides typed Socket.IO events and RAF-based token buffering, making the streaming foundation solid.

**Primary recommendation:** Use the existing @gsd/events `createTokenBuffer` for streaming, zustand/middleware persist with sessionStorage for session state, react-resizable-panels for the resizable preview pane, and react-markdown with remark-gfm for rendering Claude's responses.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Bubble layout: user messages on right, Claude on left
- Fixed bottom input, always visible at viewport bottom
- Typewriter streaming effect for Claude's responses (character-by-character)
- Mobile: chat-first layout, preview accessible via toggle/drawer
- Persistent side panel on the right for CONTEXT.md preview
- Real-time updates as Claude generates response
- Animation effect highlights parts that were just modified
- Collapsible sections (Decisions, Specifics, Deferred)
- Resizable panel width via drag handle
- Inline lock toggle icon next to each decision
- Visual differentiation: filled lock + blue/solid for locked, open lock + gray/subtle for discretionary
- Default state: discretionary (user explicitly locks what matters)
- Section-level bulk lock/unlock ("Lock all in this section" button)
- Subtle "Saved" indicator appears briefly after changes
- Auto-resume on browser refresh (silently restore conversation and preview state)
- Browser prompt warning when leaving with unsaved changes
- Banner + auto-retry on connection loss (non-blocking, reconnects in background)
- Inline editing: click any text to edit in place
- System message in chat when user edits: "[User edited: Changed X to Y]"
- Conflict handling: show conflict dialog, let user choose which version to keep
- Template-locked editing: only allow editing within predefined fields, preserve structure
- Embedded question cards inline in chat with clickable options
- Multi-select: checkbox cards (click anywhere on card to toggle)
- Progress stepper showing: "Chat UI | Preview | Locking | Session"
- Click any step in stepper to discuss that area (not just revisit)
- Previous question cards stay interactive
- Welcome screen with brief intro, phase context, and "Start discussing" prompt
- Inline error messages in chat: "Failed to generate. Retry?"
- Typing indicator (animated dots) while waiting for Claude's response
- Preview panel: template skeleton with placeholder text before decisions captured

### Claude's Discretion
- Exact bubble styling and spacing
- Animation timing for typewriter effect
- Markdown rendering in chat messages
- Keyboard shortcuts
- Rate limit handling UX

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DISC-01 | User can have a chat-style conversation with Claude with real-time token streaming | @gsd/events `createTokenBuffer` with RAF buffering, Socket.IO typed events, agent orchestrator streaming |
| DISC-02 | User can see live preview of CONTEXT.md being generated as conversation progresses | Zustand store for parsed CONTEXT.md state, highlight animation with Tailwind keyframes |
| DISC-03 | User can mark individual decisions as locked (must keep) vs discretionary (agent can adjust) | Lock state in Zustand store with per-decision toggles, persisted to session |
| DISC-04 | User can refresh browser and resume discussion session where they left off | Zustand persist middleware with sessionStorage, message history serialization |
| DISC-05 | User can manually edit CONTEXT.md with sync back to conversation state | react-contenteditable for inline editing, system message generation on edit |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @gsd/events | workspace:* | Socket.IO typed events, token buffering | Already built in Phase 13, RAF-based token buffering |
| zustand | ^5.0.11 | State management with persist | Already in Phase 15, persist middleware for sessionStorage |
| react-resizable-panels | ^2.1.0 | Resizable split panes | Most popular, accessibility-first, TypeScript-native |
| react-markdown | ^10.0.0 | Markdown rendering in chat | Standard for React markdown, safe (no dangerouslySetInnerHTML) |
| remark-gfm | ^4.0.0 | GitHub Flavored Markdown | Tables, task lists, strikethrough support |
| react-contenteditable | ^3.3.7 | Inline text editing | Mature, handles React reconciliation conflicts |
| lucide-react | ^0.460.0 | Icons (Lock, LockOpen, etc.) | Already in Phase 15 |
| clsx | ^2.1.1 | Conditional classnames | Already in Phase 15 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 | Timestamp formatting | Already in Phase 15, relative time display |
| idb-keyval | ^6.2.1 | Simplified IndexedDB | If message history exceeds sessionStorage limits |
| @radix-ui/react-collapsible | ^1.1.1 | Collapsible sections | CONTEXT.md section collapse |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-resizable-panels | allotment | allotment has VS Code-style UI but larger bundle |
| react-contenteditable | use-editable | use-editable is lighter but less battle-tested |
| sessionStorage | localStorage | sessionStorage clears on tab close, better for temp sessions |
| sessionStorage | IndexedDB | IndexedDB for >5MB data, overkill for chat history |

**Installation:**
```bash
pnpm add react-resizable-panels react-markdown remark-gfm react-contenteditable @radix-ui/react-collapsible
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── components/
│   ├── features/
│   │   └── discuss/           # Phase 16 components
│   │       ├── ChatInterface.tsx      # Main chat bubbles
│   │       ├── ChatInput.tsx          # Fixed bottom input
│   │       ├── MessageBubble.tsx      # Individual message
│   │       ├── StreamingMessage.tsx   # Typewriter effect
│   │       ├── TypingIndicator.tsx    # Animated dots
│   │       ├── QuestionCard.tsx       # Embedded options
│   │       ├── ProgressStepper.tsx    # Topic navigation
│   │       ├── ContextPreview.tsx     # CONTEXT.md panel
│   │       ├── DecisionItem.tsx       # Lock toggle + content
│   │       ├── InlineEditor.tsx       # Contenteditable wrapper
│   │       ├── ConflictDialog.tsx     # Edit conflict resolution
│   │       ├── WelcomeScreen.tsx      # Initial state
│   │       ├── ConnectionBanner.tsx   # Reconnect status
│   │       └── index.ts
│   └── ui/
│       └── Collapsible.tsx    # Radix wrapper
├── hooks/
│   ├── useDiscussSession.ts   # Session orchestration
│   ├── useTokenStream.ts      # Streaming token handling
│   ├── useContextPreview.ts   # CONTEXT.md parsing/updates
│   └── useUnsavedChanges.ts   # beforeunload handler
├── stores/
│   ├── discussStore.ts        # Chat messages, session state
│   └── contextStore.ts        # Parsed CONTEXT.md state
├── lib/
│   ├── contextParser.ts       # CONTEXT.md parsing
│   └── contextSerializer.ts   # CONTEXT.md generation
└── app/
    └── projects/
        └── [id]/
            └── discuss/
                └── page.tsx   # Discuss phase page
```

### Pattern 1: Token Stream with Typewriter Effect
**What:** Character-by-character streaming using RAF-batched tokens with animation delay
**When to use:** Displaying Claude's streaming responses
**Example:**
```typescript
// Source: @gsd/events createTokenBuffer + custom animation
import { createTokenBuffer, type TypedSocket } from '@gsd/events';
import { useState, useRef, useEffect } from 'react';

export function useTokenStream(socket: TypedSocket | null) {
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bufferRef = useRef<ReturnType<typeof createTokenBuffer> | null>(null);
  const queueRef = useRef<string[]>([]);
  const frameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Character animation at ~30ms per character (typewriter feel)
    const CHAR_DELAY = 30;
    let lastCharTime = 0;

    function animateCharacter(time: number) {
      if (queueRef.current.length > 0 && time - lastCharTime >= CHAR_DELAY) {
        const char = queueRef.current.shift()!;
        setDisplayedText(prev => prev + char);
        lastCharTime = time;
      }
      if (queueRef.current.length > 0) {
        frameIdRef.current = requestAnimationFrame(animateCharacter);
      } else {
        frameIdRef.current = null;
      }
    }

    bufferRef.current = createTokenBuffer(socket, (tokens) => {
      // Push individual characters to animation queue
      const newText = tokens.join('');
      queueRef.current.push(...newText.split(''));
      if (!frameIdRef.current) {
        frameIdRef.current = requestAnimationFrame(animateCharacter);
      }
    });

    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      bufferRef.current?.clear();
    };
  }, [socket]);

  return { displayedText, isStreaming, clear: () => setDisplayedText('') };
}
```

### Pattern 2: Zustand Persist with Session Storage
**What:** Persist conversation state across browser refreshes within a session
**When to use:** All session state that should survive refresh but not persist long-term
**Example:**
```typescript
// Source: zustand docs - persist middleware
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface DiscussState {
  phaseId: string | null;
  messages: Message[];
  isStreaming: boolean;
  agentId: string | null;
  addMessage: (message: Message) => void;
  setStreaming: (streaming: boolean) => void;
  reset: () => void;
}

export const useDiscussStore = create<DiscussState>()(
  persist(
    (set) => ({
      phaseId: null,
      messages: [],
      isStreaming: false,
      agentId: null,
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      setStreaming: (isStreaming) => set({ isStreaming }),
      reset: () => set({ phaseId: null, messages: [], isStreaming: false, agentId: null }),
    }),
    {
      name: 'gsd-discuss-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        phaseId: state.phaseId,
        messages: state.messages,
        agentId: state.agentId,
      }),
    }
  )
);
```

### Pattern 3: Highlight Animation for Updates
**What:** Flash highlight when CONTEXT.md content changes
**When to use:** Preview panel when new decisions are captured
**Example:**
```typescript
// tailwind.config.js extension
module.exports = {
  theme: {
    extend: {
      keyframes: {
        highlight: {
          '0%': { backgroundColor: 'rgb(134 239 172 / 0.5)' }, // green-300/50
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        highlight: 'highlight 1.5s ease-out',
      },
    },
  },
};

// Component usage
function DecisionItem({ decision, isNew }: { decision: Decision; isNew: boolean }) {
  return (
    <div className={clsx(
      'p-2 rounded',
      isNew && 'animate-highlight'
    )}>
      {decision.content}
    </div>
  );
}
```

### Pattern 4: Unsaved Changes Warning
**What:** Browser prompt when leaving with unsaved changes
**When to use:** Before navigation when session has uncommitted edits
**Example:**
```typescript
// Source: Browser beforeunload API
import { useEffect } from 'react';

export function useUnsavedChanges(hasUnsavedChanges: boolean) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Modern browsers ignore custom messages
        return '';
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);
}
```

### Anti-Patterns to Avoid
- **Direct DOM manipulation for streaming:** React reconciliation will fight you; use state with RAF batching
- **Polling for streaming updates:** Use Socket.IO events, not HTTP polling
- **Storing full message history in URL:** sessionStorage or IndexedDB, not query params
- **Blocking UI on reconnect:** Use non-blocking banner with background retry
- **Uncontrolled contenteditable:** Always sync with React state on blur/change

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable panels | Custom drag handlers | react-resizable-panels | Accessibility, keyboard support, edge cases |
| Markdown rendering | dangerouslySetInnerHTML with marked | react-markdown | XSS prevention, React integration |
| Socket reconnection | Custom retry logic | Socket.IO built-in reconnection | Exponential backoff, connection state recovery |
| Token buffering | Direct event handlers | @gsd/events createTokenBuffer | RAF batching, telemetry, memory limits |
| Session persistence | Manual localStorage | zustand persist middleware | Automatic serialization, hydration handling |
| Collapsible sections | CSS-only accordion | @radix-ui/react-collapsible | Accessibility, animation, controlled state |

**Key insight:** The phase requires real-time streaming with smooth animations while maintaining React's reconciliation model. Using battle-tested libraries for panels, markdown, and state persistence lets you focus on the unique UX (typewriter effect, decision locking, bidirectional sync).

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with Persisted State
**What goes wrong:** Server renders with initial state, client hydrates with persisted state, React warns about mismatch
**Why it happens:** Zustand persist loads from sessionStorage on client only
**How to avoid:** Use `skipHydration` option and manually trigger hydration after mount, or use `'use client'` boundary
**Warning signs:** Console warning "Text content does not match server-rendered HTML"

### Pitfall 2: Streaming Text Causes Layout Shift
**What goes wrong:** Content jumps as text streams in, chat bubbles resize erratically
**Why it happens:** Container height recalculates on every character
**How to avoid:** Use min-height on message bubbles, scroll-to-bottom on new content only
**Warning signs:** Scrollbar jumping, user loses reading position

### Pitfall 3: Socket Reconnection Loses Checkpoint State
**What goes wrong:** User refreshes during a checkpoint, response never reaches agent
**Why it happens:** Socket reconnects but pending checkpoint was lost
**How to avoid:** Use orchestrator.getPendingCheckpointsForAgent on reconnect (already in Phase 14)
**Warning signs:** Agent hangs in awaiting_checkpoint state after refresh

### Pitfall 4: ContentEditable Cursor Position Lost
**What goes wrong:** User edits text, cursor jumps to end or beginning
**Why it happens:** React re-renders on state change, DOM node is replaced
**How to avoid:** Use react-contenteditable which preserves selection, or debounce state updates
**Warning signs:** Cursor moves unexpectedly during typing

### Pitfall 5: beforeunload Fires on All Navigation
**What goes wrong:** Prompt shows even when navigating within the app
**Why it happens:** Single-page navigation doesn't distinguish from external navigation
**How to avoid:** Combine beforeunload (external) with React Router's useBlocker (internal)
**Warning signs:** Warning dialog on in-app navigation

## Code Examples

Verified patterns from official sources:

### Socket.IO Reconnection with Pending Checkpoints
```typescript
// Source: Phase 14 orchestrator + Socket.IO reconnection
import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useDiscussStore } from '@/stores/discussStore';

export function useDiscussSession(phaseId: string) {
  const { socket, isConnected } = useSocket(process.env['NEXT_PUBLIC_WS_URL']!);
  const agentId = useDiscussStore((s) => s.agentId);

  useEffect(() => {
    if (!socket || !isConnected || !agentId) return;

    // On reconnect, check for pending checkpoints
    socket.emit('agent:subscribe', agentId);

    // Server will auto-push pending checkpoints after subscribe
  }, [socket, isConnected, agentId]);

  return { socket, isConnected };
}
```

### Message Bubble with Markdown
```typescript
// Source: react-markdown docs
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  return (
    <div className={clsx(
      'flex',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      <div className={clsx(
        'max-w-[80%] rounded-2xl px-4 py-2',
        isUser && 'bg-primary text-primary-foreground',
        !isUser && !isSystem && 'bg-muted',
        isSystem && 'bg-yellow-100 dark:bg-yellow-900 text-sm italic'
      )}>
        {isSystem ? (
          <span>{content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose prose-sm dark:prose-invert max-w-none"
          >
            {content}
          </ReactMarkdown>
        )}
        {isStreaming && (
          <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
        )}
      </div>
    </div>
  );
}
```

### Resizable Panel Layout
```typescript
// Source: react-resizable-panels docs
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';

export function DiscussLayout({ children }: { children: React.ReactNode }) {
  return (
    <PanelGroup direction="horizontal" className="h-screen">
      <Panel defaultSize={60} minSize={40}>
        {/* Chat interface */}
        {children}
      </Panel>
      <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20 transition-colors flex items-center justify-center">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </PanelResizeHandle>
      <Panel defaultSize={40} minSize={25}>
        {/* CONTEXT.md preview */}
        <ContextPreview />
      </Panel>
    </PanelGroup>
  );
}
```

### Inline Editable Decision
```typescript
// Source: react-contenteditable docs
import ContentEditable from 'react-contenteditable';
import { useRef, useCallback } from 'react';

interface InlineEditorProps {
  value: string;
  onChange: (newValue: string, oldValue: string) => void;
  disabled?: boolean;
}

export function InlineEditor({ value, onChange, disabled }: InlineEditorProps) {
  const contentRef = useRef(value);
  const originalRef = useRef(value);

  const handleChange = useCallback((evt: { target: { value: string } }) => {
    contentRef.current = evt.target.value;
  }, []);

  const handleBlur = useCallback(() => {
    if (contentRef.current !== originalRef.current) {
      onChange(contentRef.current, originalRef.current);
      originalRef.current = contentRef.current;
    }
  }, [onChange]);

  return (
    <ContentEditable
      html={value}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className="outline-none focus:ring-2 focus:ring-primary/50 rounded px-1 -mx-1"
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux + redux-persist | Zustand + persist middleware | 2024 | Simpler API, smaller bundle, no boilerplate |
| Custom WebSocket | Socket.IO v4 with typed events | 2023 | Built-in reconnection, rooms, namespaces |
| dangerouslySetInnerHTML | react-markdown | Ongoing | XSS-safe, plugin ecosystem |
| CSS-only collapsible | Radix UI Collapsible | 2023 | Accessibility, controlled state |
| react-split-pane | react-resizable-panels | 2024 | Active maintenance, better a11y |

**Deprecated/outdated:**
- `Prompt` from react-router v5: Use `useBlocker` in v6
- Manual RAF batching: Use @gsd/events createTokenBuffer
- localStorage for session: sessionStorage for temp data, IndexedDB for large

## Open Questions

1. **Bidirectional sync conflict frequency**
   - What we know: User can edit CONTEXT.md while Claude is generating
   - What's unclear: How often will real conflicts occur in practice?
   - Recommendation: Start with simple "last write wins" for same field, escalate to conflict dialog only for structural changes

2. **Message history size limits**
   - What we know: sessionStorage has ~5MB limit
   - What's unclear: How long can conversations get?
   - Recommendation: Track message count, warn at 100 messages, offer to export/clear older messages

3. **Mobile drawer behavior**
   - What we know: User wants chat-first on mobile with preview toggle
   - What's unclear: Exact breakpoint and gesture for drawer
   - Recommendation: Use 768px breakpoint, bottom sheet drawer pattern

## Sources

### Primary (HIGH confidence)
- @gsd/events package source - packages/events/src/*.ts - token buffering, Socket.IO types
- Phase 14 orchestrator - apps/server/src/orchestrator/*.ts - checkpoint handling
- Phase 15 patterns - apps/web/src/**/*.ts - Zustand stores, hooks, component patterns

### Secondary (MEDIUM confidence)
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) - Panel component API
- [zustand persist docs](https://github.com/pmndrs/zustand) - Persist middleware configuration
- [react-markdown docs](https://github.com/remarkjs/react-markdown) - Markdown rendering
- [Socket.IO React guide](https://socket.io/how-to/use-with-react) - React integration patterns
- [Motion Typewriter](https://motion.dev/docs/react-typewriter) - Animation approach reference

### Tertiary (LOW confidence)
- Community patterns for beforeunload in Next.js (varies by version)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are established, some already in project
- Architecture: HIGH - Follows Phase 15 patterns, clear component structure
- Pitfalls: MEDIUM - Based on common React real-time patterns, may discover more

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days - stable libraries)
