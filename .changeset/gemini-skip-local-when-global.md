---
type: Fixed
pr: 3037
---
**Gemini local install no longer duplicates `/gsd:*` commands across user and workspace scopes** — when GSD is already installed at the user scope (`~/.gemini/commands/gsd/`) and you run `npx get-shit-done-cc --gemini --local` in a project, the installer now skips writing `commands/gsd/` to `<project>/.gemini/` and prints a one-line warning explaining why. Previously, both scopes received the same 65 command files, and Gemini's conflict detector renamed every `/gsd:*` command to `/workspace.gsd:*` and `/user.gsd:*`, breaking the documented namespace. Closes #3037.
