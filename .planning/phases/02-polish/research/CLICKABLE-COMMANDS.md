# Research: Clickable Command Links in Cursor Agent Responses

**Researched:** February 5, 2026  
**Confidence:** HIGH  
**Verdict:** NOT SUPPORTED — Cursor does not support clickable command execution via markdown links

## Summary

Cursor does **not** support clickable command links that execute slash commands when clicked in agent responses. Slash commands must be manually typed in the agent input field. While Cursor renders markdown (including inline code), there is no mechanism to make command text clickable for execution.

## Findings

### What Cursor Supports

1. **Markdown Rendering in Agent Responses**
   - Cursor renders standard markdown in agent chat responses
   - Supports inline code with backticks (`` `command` ``)
   - Supports fenced code blocks
   - Markdown links render as clickable URLs (standard HTTP/HTTPS links)

2. **Slash Command Execution**
   - Commands are executed by typing `/command-name` in the agent input field
   - Commands are stored in `.cursor/commands/*.md` files
   - No auto-complete or suggestion system for commands in markdown responses
   - Commands must be manually typed or copy-pasted

3. **Deeplinks (Limited Scope)**
   - Cursor supports `cursor://` protocol scheme
   - **Only for MCP server installation**, not command execution
   - Format: `cursor://anysphere.cursor-deeplink/mcp/install?name=$NAME&config=$BASE64_CONFIG`
   - Cannot be used to execute slash commands

### What Cursor Does NOT Support

1. **Clickable Command Execution**
   - No special markdown syntax for executable command links
   - No custom protocol handler for `cursor://command/...` URLs
   - No auto-detection of slash commands in markdown that makes them clickable
   - Inline code blocks (backticks) do not execute commands when clicked

2. **Command Auto-complete in Markdown**
   - Agent responses cannot trigger command suggestions
   - No integration between markdown rendering and command palette
   - Commands in markdown are treated as plain text

## Current GSD Format

GSD currently formats commands using inline code backticks:

```markdown
`/gsd-plan-phase 2`
```

The `continuation-format.md` reference states this "renders as clickable link" — but this appears to be:
- **Aspirational** (hoping for future support), or
- **Misleading** (referring to standard markdown link behavior for URLs, not command execution)

**Reality:** These render as styled inline code, but clicking them does not execute the command. Users must manually copy-paste or type the command.

## Verification

### Sources Checked

1. **Official Cursor Documentation**
   - `/docs.cursor.com/en/agent/chat/commands` — No mention of clickable commands
   - `/docs.cursor.com/en/context/commands` — Command definition format only
   - `/docs.cursor.com/en/integrations/deeplinks` — MCP installation only, not command execution

2. **Web Search Results**
   - No evidence of clickable command execution feature
   - No community discussions about this capability
   - No workarounds or extensions providing this functionality

3. **Codebase Analysis**
   - GSD continuation format references "clickable link" but no implementation exists
   - Commands are formatted as inline code, not special links

## Recommendations for GSD

### Option 1: Keep Current Format (Recommended)

**Format:** Continue using inline code backticks
```markdown
`/gsd-plan-phase 2`
```

**Rationale:**
- Clear visual indication of command
- Easy to copy-paste
- Standard markdown convention
- No false expectations

**Update `continuation-format.md`:**
- Remove or clarify "renders as clickable link" claim
- State: "Command in inline code — backticks, easy to copy-paste"

### Option 2: Use Explicit Copy-Paste Instructions

**Format:** Add explicit copy instruction
```markdown
**Next:** `/gsd-plan-phase 2`

<sub>Copy and paste the command above into the agent input</sub>
```

**Rationale:**
- Sets clear expectations
- Guides user action explicitly
- No ambiguity about how to execute

### Option 3: Use Markdown Links (Future-Proof)

**Format:** Use markdown link syntax (even if not clickable)
```markdown
[`/gsd-plan-phase 2`](/gsd-plan-phase 2)
```

**Rationale:**
- If Cursor adds support later, links will work automatically
- Still copyable as text
- Visual distinction from plain code

**Note:** This would require Cursor to add command link protocol support, which is not currently available.

## Future Considerations

If Cursor adds clickable command support in the future, likely implementation would be:

1. **Custom Protocol Handler**
   - `cursor://command/gsd-plan-phase?args=2`
   - Would require Cursor to register protocol handler

2. **Markdown Extension**
   - Special syntax like `[command:/gsd-plan-phase 2]`
   - Cursor would need to parse and render specially

3. **Auto-detection**
   - Detect slash commands in markdown and make them clickable
   - Would require Cursor to add markdown renderer hooks

**Current Status:** None of these exist. This would be a new feature request to Cursor.

## Conclusion

**Answer:** No, Cursor cannot render clickable command links in agent responses.

**Recommendation:** 
- Keep current inline code format (`` `/gsd-plan-phase 2` ``)
- Update documentation to remove "clickable link" claim
- Add explicit copy-paste guidance if needed
- Consider future-proofing with markdown links if desired (though they won't work now)

**Action Items:**
1. Update `continuation-format.md` to clarify that commands are copy-paste, not clickable
2. Consider adding copy-paste instructions in continuation format
3. Monitor Cursor changelog for future command link support

## Sources

- [Cursor Documentation - Commands](https://docs.cursor.com/en/context/commands) (HIGH confidence)
- [Cursor Documentation - Deeplinks](https://docs.cursor.com/en/integrations/deeplinks) (HIGH confidence)
- [Cursor Documentation - Agent Chat Commands](https://docs.cursor.com/en/agent/chat/commands) (HIGH confidence)
- Web search: "Cursor IDE clickable command links markdown agent responses 2025" (MEDIUM confidence)
- Web search: "Cursor deeplinks command execution URL scheme 2025" (MEDIUM confidence)
- Codebase analysis: `get-shit-done/references/continuation-format.md` (HIGH confidence)
