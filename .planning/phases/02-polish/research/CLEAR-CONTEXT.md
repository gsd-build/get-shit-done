# Research: Clearing Context in Cursor

**Researched:** February 5, 2026  
**Confidence:** HIGH  
**Sources:** Official Cursor forum, community discussions, keyboard shortcut documentation

## Summary

Cursor does **not** have a `/clear` command equivalent to Claude Code. Instead, Cursor uses a **"New Chat"** mechanism via a UI button. There is no keyboard shortcut for clearing context, and no slash command available.

## Cursor's Mechanism for Clearing Context

### Primary Method: New Chat Button

**How it works:**
- Click the **"+" button** in the upper right corner of the chat interface
- Located to the left of the history button (clock/calendar icon)
- Creates a new conversation session with a clean slate
- No previous context or history is carried over

**Visual location:**
```
[Chat Interface]
┌─────────────────────────────────────┐
│  Chat Title                    [+] [📅] │  ← "+" button here
└─────────────────────────────────────┘
```

### Alternative Method: Restart Cursor IDE

- Closing and reopening Cursor IDE will also clear conversation context
- Less convenient than the "+" button method
- Not recommended for regular workflow use

## What Cursor Does NOT Have

### No `/clear` Command
- Cursor does not support slash commands for clearing context
- The `/clear` syntax from Claude Code does not work in Cursor

### No Keyboard Shortcut
- There is no dedicated keyboard shortcut for clearing/resetting context
- `Ctrl/⌘ + L` opens chat but does not clear it
- `Ctrl/⌘ + Alt/Option + L` opens chat history, not a new chat

### No Command Palette Command
- No "Clear Context" or "Reset Chat" command available in Command Palette (`Ctrl/⌘ + Shift + P`)
- Third-party extension "Cursor Context Manager" exists but requires installation

## How GSD Workflows Currently Reference `/clear`

GSD workflows extensively reference `/clear` in instructions:

**Current pattern:**
```markdown
<sub>`/clear` first → fresh context window</sub>
```

**Files using this pattern:**
- `get-shit-done/workflows/execute-phase.md`
- `get-shit-done/workflows/complete-milestone.md`
- `get-shit-done/workflows/verify-work.md`
- `get-shit-done/workflows/transition.md`
- `get-shit-done/workflows/resume-project.md`
- `get-shit-done/workflows/map-codebase.md`
- `get-shit-done/workflows/execute-plan.md`
- `get-shit-done/workflows/discuss-phase.md`
- `get-shit-done/references/continuation-format.md`
- `get-shit-done/references/ui-brand.md`
- `get-shit-done/templates/UAT.md`
- `get-shit-done/templates/DEBUG.md`

## Recommendations for GSD Documentation Updates

### Option 1: Replace with Cursor-Specific Instructions (Recommended)

**Replace:**
```markdown
<sub>`/clear` first → fresh context window</sub>
```

**With:**
```markdown
<sub>Click "+" button (new chat) → fresh context window</sub>
```

**Or more descriptive:**
```markdown
<sub>Start new chat (click "+" in chat header) → fresh context window</sub>
```

### Option 2: Add Cursor Adaptation Note

Create a Cursor-specific instruction format:

```markdown
<sub>**Cursor:** Click "+" button (new chat) → fresh context window</sub>
<sub>**Claude Code:** `/clear` → fresh context window</sub>
```

### Option 3: Abstract the Instruction

Use platform-agnostic language:

```markdown
<sub>Start fresh chat session → clean context window</sub>
```

## Implementation Considerations

### User Experience Impact

**Current state:**
- Users following GSD workflows in Cursor will see `/clear` instructions
- This may cause confusion or users attempting to type `/clear` in chat
- No functional impact (just confusion)

**After update:**
- Clear, actionable instructions for Cursor users
- No confusion about non-existent commands
- Better alignment with actual Cursor UI

### Update Scope

**Files to update:** ~12 files across workflows, references, and templates

**Pattern to replace:** 
- Find: `` `/clear` first → fresh context window``
- Replace with: `` Click "+" button (new chat) → fresh context window``

**Special cases:**
- `templates/UAT.md` line 159: "Resume after /clear:" → "Resume after new chat:"
- `templates/DEBUG.md`: Multiple references to `/clear` in comments → Update to "new chat" or "fresh session"

## Additional Context Management Notes

### Chat History Access
- `Ctrl/⌘ + Alt/Option + L` opens chat history
- Users can access previous conversations but cannot "clear" them from history
- Each new chat via "+" button creates a separate conversation thread

### Context Management Best Practices
- Cursor recommends using `@` symbols for focused context control
- More context isn't always better—focused context produces better results
- Starting new chats is the recommended way to reset context between major tasks

## Sources

**HIGH Confidence:**
- [Cursor Community Forum: Clear context for cursor](https://forum.cursor.com/t/clear-context-for-cursor/36771) - Official community response confirming "+" button method
- [Cursor Keyboard Shortcuts Documentation](https://cursor101.com/cursor/cheat-sheet) - Confirms no shortcut for clearing context

**MEDIUM Confidence:**
- [Cursor Context Management Discussion](https://forum.cursor.com/t/managing-chat-context-in-cursor-ide-for-large-repositories-what-s-working-for-you/76391) - Community patterns for context management

## Open Questions

1. **Will Cursor add `/clear` command in future?** - Unknown, no roadmap information found
2. **Is there a way to programmatically clear context?** - Not found in documentation
3. **Does Composer mode have different context clearing?** - Not researched (out of scope)

## Next Steps

1. **Update GSD workflow files** to replace `/clear` references with Cursor-specific instructions
2. **Update templates** (UAT.md, DEBUG.md) to use "new chat" terminology
3. **Consider adding Cursor adaptation guide** if GSD supports multiple AI editors
4. **Test updated instructions** to ensure clarity for Cursor users
