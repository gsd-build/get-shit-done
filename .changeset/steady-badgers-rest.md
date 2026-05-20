---
type: Fixed
pr: 3768
---
**Codex on Windows: SessionStart/PostToolUse hooks now use a .cmd shim** — previous `bash.exe: cannot execute binary file` failure on v1.42.3+ caused by the installer writing a node-runner command that Codex's MSYS hook-dispatch shell tried to POSIX-exec via execvp(); Windows PE binaries fail that path. The fix writes a .cmd shim alongside the hook .js file; cmd.exe executes .cmd natively via CreateProcess with no POSIX exec layer.
