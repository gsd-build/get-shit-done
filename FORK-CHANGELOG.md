# Fork Changelog

All fork-specific changes to `get-shit-done-github-copilot` are documented here.  
This file covers **v1.5 and later**. For v1.0–v1.4 history, see [CHANGELOG.md](CHANGELOG.md).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
This fork tracks the upstream [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) release cadence and layers a VS Code Copilot compatibility shim on top.

---

## [v1.6] - 2026-03-12 — Install Architecture Refactor

### Added
- `bin/install-copilot.js` — new fork-owned module containing all Copilot conversion logic; extracted from `bin/install.js` to minimize upstream merge conflict surface
- `scripts/tools.json` — Claude-to-VS Code tool map (added to `guard-exemptions.txt`)
- `scripts/guard-exemptions.txt`: added `bin/install-copilot.js`, `scripts/tools.json`, and `agents/gsd-upstream-sync.md`
- PS1 installer: version-gated migration step that removes legacy `.claude/gsd-*` files on upgrade; `-SkipLegacyCleanup` flag allows side-by-side Claude+Copilot installs
- README: model profiles callout clarifying Opus/Sonnet/Haiku are GSD tier labels (not Copilot model names); contributor clone note for generating prompts locally

### Changed
- `bin/install.js`: slimmed to entry-point + `require('./install-copilot')` + branch logic only; upstream changes will no longer conflict with Copilot code
- `release.yml`: replaced static `cp -r` staging with `node bin/install.js --copilot --local`; release zip now contains only `.github/` + `gsd-copilot-installer/` (no `.claude/`)
- `upstream-sync-worker.yml`: replaced `generate-prompts.mjs` and `verify-prompts.mjs` steps with single `node bin/install.js --copilot --local` step
- PS1 installer: removed `.claude/` install section entirely; installer now only delivers `.github/prompts/`, `.github/agents/`, `.github/get-shit-done/`
- `patchContentForCopilot`: `/gsd.update` command now uses PS1 one-liner (`irm ... | iex`) instead of `npx -y get-shit-done-cc@latest --copilot --local`
- All docs updated: `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/upstream-sync-guide.md`, `agents/gsd-upstream-sync.md` now reference `bin/install-copilot.js` and `node bin/install.js --copilot --local`

### Removed
- `.github/prompts/*.prompt.md` — generated prompt files are no longer checked into the repo; produced on-demand by the installer and `node bin/install.js --copilot --local`
- `.github/instructions/gsd-port.instructions.md` — rules folded into `bin/install-copilot.js` file header and `AGENTS.md`

---

## [v1.5] - 2026-02-22 — Repo Metadata Alignment

### Added
- `FORK-CHANGELOG.md` — fork-specific release history (this file), forward-looking from v1.5
- Fork identity documentation phase (Phase 16): rewrote README for VS Code Copilot audience, added AGENTS.md and CLAUDE.md, documented fork vs upstream relationship, recorded fork-specific CHANGELOG history through v1.4

### Changed
- `package.json`: updated `description` and `repository.url` to reflect this fork (not upstream)
- `.github/FUNDING.yml`: added comment explaining intentional decision to retain upstream funding link
- `.github/ISSUE_TEMPLATE/bug_report.yml`: replaced upstream-specific fields (npm version check, runtime dropdown) with fork-appropriate AI assistant input field
- `README.md`: removed broken Option A install method (degit `.github`-only copy); removed incorrect "no Node.js required" claims; installation section now directs users to PowerShell installer or release zip
