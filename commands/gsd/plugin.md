---
name: gsd:plugin
description: Manage GSD plugins (install, uninstall, list, info)
argument-hint: "<action> [source|name]"
allowed-tools: [Bash, Read]
---

<overview>
Plugin management for GSD. Install, uninstall, and manage plugins.

**Commands:**
- `/gsd:plugin install <git-url>` - Install from git repository
- `/gsd:plugin install <local-path>` - Install from local folder
- `/gsd:plugin install <path> --link` - Link for development (changes reflect immediately)
- `/gsd:plugin uninstall <name>` - Remove an installed plugin
- `/gsd:plugin uninstall <name> --dry-run` - Preview what would be removed
- `/gsd:plugin list` - List all installed plugins with status
- `/gsd:plugin info <name>` - Show detailed plugin information
</overview>

<process>
Parse the user's command and execute the appropriate action.

**For install:**
1. Determine if source is git URL (contains github.com, gitlab.com, or starts with git@)
2. Determine if --link flag present (local development mode)
3. Run: `node ~/.claude/get-shit-done/bin/plugin.js install <source> [--link] [--force]`
4. Report results

**For uninstall:**
1. Extract plugin name
2. Determine if --dry-run flag present
3. Run: `node ~/.claude/get-shit-done/bin/plugin.js uninstall <name> [--dry-run]`
4. Report results

**For list:**
1. Run: `node ~/.claude/get-shit-done/bin/plugin.js list`
2. Report the list of installed plugins with their name, version, description, and linked status

**For info:**
1. Extract plugin name
2. Run: `node ~/.claude/get-shit-done/bin/plugin.js info <name>`
3. Report plugin details including:
   - Name, version, description
   - Author and repository
   - Commands, agents, and hooks provided
   - Installation date and location (or linked source)

**Error handling:**
If the plugin.js command fails, show the error output to the user.

**If no action specified:**
Show usage help:
```
GSD Plugin Manager

Usage:
  /gsd:plugin install <git-url>         Install from git repository
  /gsd:plugin install <path>            Install from local folder
  /gsd:plugin install <path> --link     Link for development
  /gsd:plugin uninstall <name>          Remove a plugin
  /gsd:plugin uninstall <name> --dry-run Preview removal
  /gsd:plugin list                      List installed plugins
  /gsd:plugin info <name>               Show plugin details

Examples:
  /gsd:plugin install https://github.com/user/my-plugin
  /gsd:plugin install ./my-local-plugin
  /gsd:plugin install ./my-plugin --link
  /gsd:plugin uninstall my-plugin
  /gsd:plugin uninstall my-plugin --dry-run
  /gsd:plugin info my-plugin
```
</process>

<examples>
List installed plugins:
`/gsd:plugin list`
Output:
```
Installed Plugins:

my-plugin v1.0.0
  My awesome GSD plugin

another-plugin v2.1.0 (linked)
  Another plugin for development
```

Install from GitHub:
`/gsd:plugin install https://github.com/user/my-gsd-plugin`

Install local for development:
`/gsd:plugin install ./my-plugin --link`

Uninstall:
`/gsd:plugin uninstall my-plugin`

Preview uninstall:
`/gsd:plugin uninstall my-plugin --dry-run`

Show plugin details:
`/gsd:plugin info my-plugin`
Output:
```
Plugin: my-plugin v1.0.0
  My awesome GSD plugin

Author: developer@example.com
Repository: https://github.com/user/my-plugin

Commands:
  /my-plugin:analyze - Analyze code patterns

Installation:
  Installed: 2026-01-16
  Location: ~/.claude/my-plugin/
```
</examples>
