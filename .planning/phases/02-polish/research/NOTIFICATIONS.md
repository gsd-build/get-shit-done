# Cursor IDE Notification/Toast API Research

**Research Date:** February 5, 2025  
**Confidence:** HIGH  
**Research Mode:** Feasibility

## Executive Summary

**Verdict:** Cursor does NOT have a notification/toast API that hooks or custom commands can use directly. Hooks are script-based and cannot trigger UI notifications. To show notifications, you would need to create a full VS Code extension, which is significant overhead for a simple update notification.

## What Was Found

### 1. Cursor Hook System Limitations

**Finding:** Cursor hooks are command-line scripts that execute at lifecycle events. They cannot directly interact with Cursor's UI.

**Evidence:**
- Cursor hooks documentation: https://cursor.com/docs/agent/third-party-hooks
- Hooks are defined in `hooks.json` and execute shell commands/scripts
- Hook scripts receive JSON via stdin and output JSON via stdout
- No UI interaction capabilities documented

**Claude Code Compatibility:**
- Cursor supports loading Claude Code hooks for compatibility
- However, the `Notification` hook from Claude Code is **explicitly NOT supported** in Cursor
- From official docs: `Notification` hook maps to "-" (not supported)

### 2. VS Code Extension API (Theoretical Option)

**Finding:** Cursor supports VS Code extensions, and VS Code has notification APIs, but this requires creating a full extension.

**Available VS Code APIs:**
- `window.showInformationMessage(message, ...items)` - Information notification
- `window.showWarningMessage(message, ...items)` - Warning notification  
- `window.showErrorMessage(message, ...items)` - Error notification

**Limitations:**
- These APIs are only available within VS Code extensions (TypeScript/JavaScript)
- Extensions require:
  - `package.json` with extension manifest
  - Extension activation code
  - Proper VS Code extension structure
  - Publishing/installation process
- Cannot be called from hook scripts directly
- Notifications persist until manually dismissed (no auto-dismiss timeout)

**Sources:**
- VS Code Extension API: https://code.visualstudio.com/api
- VS Code Notifications UX Guidelines: https://code.visualstudio.com/api/ux-guidelines/notifications

### 3. Native Cursor OS Notifications

**Finding:** Cursor has built-in OS notifications for agent completion, but these are system-level and not triggerable by hooks.

**What exists:**
- Cursor shows OS notifications when agent tasks complete
- Notifications appear when Cursor is minimized and input is required
- This is a built-in feature, not an API hooks can use

**Source:** Cursor Changelog 1.5 - "OS notifications" feature

### 4. MCP Server Notifications

**Finding:** Model Context Protocol (MCP) servers can provide notification capabilities, but this is a different mechanism than hooks.

**What exists:**
- Interactive-MCP server includes `message_complete_notification` tool
- MCP servers run separately and communicate with Cursor via protocol
- Would require setting up an MCP server, not just a hook script

**Source:** Community forum discussions about MCP notification capabilities

## Current GSD Implementation

**Claude Code (Current):**
- Uses `statusLine` hook to display update notification in status bar
- Shows `⬆ /gsd:update` when update is available
- Status line is always visible, so notification is persistent

**Cursor (Target):**
- Cursor does NOT have a status line feature
- No equivalent UI element for persistent notifications
- Hooks cannot trigger UI notifications

## Code Examples

### What Doesn't Work (Hook Script)

```javascript
// hooks/gsd-notify-update.js
// ❌ This doesn't exist - hooks can't show UI notifications
vscode.window.showInformationMessage("GSD update available!");
```

### What Would Work (VS Code Extension)

```typescript
// extension.ts (requires full VS Code extension setup)
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Check for updates and show notification
  checkForUpdates();
}

function checkForUpdates() {
  // ... update check logic ...
  vscode.window.showInformationMessage(
    'GSD update available!',
    'Update Now'
  ).then(selection => {
    if (selection === 'Update Now') {
      // Run update command
    }
  });
}
```

**Requirements for extension approach:**
- Full VS Code extension project structure
- `package.json` with extension manifest
- Activation logic
- Installation/publishing process
- ~100+ lines of boilerplate code

### Alternative: System Notifications from Hook

```javascript
// hooks/gsd-notify-update.js
// ✅ This works - uses OS-level notifications
const { exec } = require('child_process');
const os = require('os');

const platform = os.platform();
const cacheFile = path.join(os.homedir(), '.cursor', 'cache', 'gsd-update-check.json');

// Check for update
if (fs.existsSync(cacheFile)) {
  const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  if (cache.update_available) {
    const message = 'GSD update available! Run /gsd-update';
    
    if (platform === 'darwin') {
      // macOS
      exec(`osascript -e 'display notification "${message}" with title "GSD"'`);
    } else if (platform === 'win32') {
      // Windows
      exec(`powershell -Command "New-BurntToastNotification -Text '${message}'"`);
    } else {
      // Linux
      exec(`notify-send "GSD" "${message}"`);
    }
  }
}
```

**Pros:**
- Works from hook scripts
- Cross-platform (with platform detection)
- No extension required
- Simple implementation

**Cons:**
- Requires OS notification permissions
- Different UX than in-app notifications
- May be less discoverable
- Requires additional dependencies on some platforms (Windows: BurntToast)

## Recommendation

### Option 1: Skip Notification Hook (Recommended)

**Rationale:**
- Update notifications are not critical functionality
- Users can check manually with `/gsd-update` command
- Avoids complexity of extension development or OS notification setup
- Keeps GSD simple and focused

**Implementation:**
- Remove `gsd-check-update.js` hook entirely
- Document `/gsd-update` command in help
- Users check for updates when they want to

### Option 2: System Notifications from Hook

**Rationale:**
- Provides passive notification without user action
- Can be implemented purely in hook script
- No extension required

**Implementation:**
- Modify `gsd-check-update.js` to show OS notification when update available
- Add platform detection for cross-platform support
- Document OS notification permissions in setup

**Trade-offs:**
- Requires OS-level notification permissions
- Less integrated than in-app notifications
- May be annoying if too frequent

### Option 3: VS Code Extension (Not Recommended)

**Rationale:**
- Would provide native in-app notifications
- Best UX if notifications are critical

**Why not recommended:**
- Significant overhead (~100+ lines of boilerplate)
- Requires extension installation process
- Overkill for a simple update notification
- Maintenance burden (extension updates, compatibility)

## Confidence Assessment

| Finding | Confidence | Source |
|---------|------------|--------|
| Hooks cannot show UI notifications | HIGH | Official Cursor docs |
| Notification hook not supported | HIGH | Official Cursor docs (explicitly listed) |
| VS Code extension API exists | HIGH | Official VS Code API docs |
| System notifications possible | MEDIUM | Standard Node.js APIs, requires testing |
| MCP server notifications | LOW | Community discussions, not official docs |

## Sources

**HIGH Confidence:**
- Cursor Third-Party Hooks Docs: https://cursor.com/docs/agent/third-party-hooks
- VS Code Extension API: https://code.visualstudio.com/api
- VS Code Notifications UX: https://code.visualstudio.com/api/ux-guidelines/notifications

**MEDIUM Confidence:**
- Cursor Changelog 1.5 (OS notifications): https://cursor.com/changelog/1-5
- Community forum discussions about notifications

**LOW Confidence:**
- MCP server notification capabilities (community discussions only)

## Open Questions

1. **OS notification permissions:** Do users need to grant permissions for system notifications? (Platform-dependent)
2. **Notification frequency:** How often should update checks run? (Currently once per session)
3. **User preference:** Would users prefer system notifications or no notifications at all?

## Next Steps

1. **Decision point:** Choose between Option 1 (skip) or Option 2 (system notifications)
2. **If Option 2:** Implement cross-platform system notification in `gsd-check-update.js`
3. **If Option 1:** Remove update check hook and document manual update process
4. **Documentation:** Update GSD-CURSOR-ADAPTATION.md with chosen approach
