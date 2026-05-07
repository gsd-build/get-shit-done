---
type: Fixed
pr: 3181
---
resolveNodeRunner() and rewriteLegacyManagedNodeHookCommands() now prefer stable Homebrew symlinks (/usr/local/bin/node, /opt/homebrew/bin/node) over versioned Cellar paths when a Cellar path is detected, preventing dyld: Library not loaded errors after brew upgrade node
