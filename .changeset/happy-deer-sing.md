---
type: Fixed
pr: 3405
---
Windows Claude Code hook commands no longer receive the PowerShell call operator. The installer now formats Windows hook commands by runtime, preserving PowerShell-compatible commands for PowerShell-hosted runtimes while emitting bash-compatible Claude Code hooks. Fixes #3403.
