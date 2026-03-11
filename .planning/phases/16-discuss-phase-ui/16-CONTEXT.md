# Phase 16: Discuss Phase UI - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable conversational context gathering with real-time streaming and CONTEXT.md preview. Users can have chat-style discussions with Claude, see decisions populate live, mark decisions as locked vs discretionary, and resume sessions after browser refresh.

</domain>

<decisions>
## Implementation Decisions

### Chat Interface Design
- Bubble layout: user messages on right, Claude on left
- Fixed bottom input, always visible at viewport bottom
- Typewriter streaming effect for Claude's responses (character-by-character)
- Mobile: chat-first layout, preview accessible via toggle/drawer

### Live CONTEXT.md Preview
- Persistent side panel on the right
- Real-time updates as Claude generates response
- Animation effect highlights parts that were just modified
- Collapsible sections (Decisions, Specifics, Deferred)
- Resizable panel width via drag handle

### Decision Locking UX
- Inline lock toggle icon next to each decision
- Visual differentiation: filled lock + blue/solid for locked, open lock + gray/subtle for discretionary
- Default state: discretionary (user explicitly locks what matters)
- Section-level bulk lock/unlock ("Lock all in this section" button)

### Session Persistence
- Subtle "Saved" indicator appears briefly after changes
- Auto-resume on browser refresh (silently restore conversation and preview state)
- Browser prompt warning when leaving with unsaved changes
- Banner + auto-retry on connection loss (non-blocking, reconnects in background)

### Manual CONTEXT.md Editing
- Inline editing: click any text to edit in place
- System message in chat when user edits: "[User edited: Changed X to Y]"
- Conflict handling: show conflict dialog, let user choose which version to keep
- Template-locked editing: only allow editing within predefined fields, preserve structure

### Gray Area Questions UX
- Embedded question cards inline in chat with clickable options
- Multi-select: checkbox cards (click anywhere on card to toggle)
- Progress stepper showing: "Chat UI ✓ | Preview ✓ | Locking → | Session"
- Click any step in stepper to discuss that area (not just revisit)
- Previous question cards stay interactive — click to change answer and re-ask follow-ups

### Empty/Error States
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

</decisions>

<specifics>
## Specific Ideas

- Animation effect for real-time preview updates should temporarily highlight modified parts (like git diff highlighting)
- Progress stepper should be clickable to navigate to any discussion area, not just show progress
- Chat interface should feel responsive and modern, similar to ChatGPT or Claude.ai

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-discuss-phase-ui*
*Context gathered: 2026-03-11*
