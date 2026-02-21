# GSD Copilot Installer

Install GSD Copilot files into your VS Code workspace with a single PowerShell command — no Node.js required.

---

## Prerequisites

- **PowerShell 5.1+** — built into Windows 10 and Windows 11 (no install needed)
- Internet access to download from GitHub Releases
- No Node.js, npm, or any other runtime required

---

## Quick Start

Open a PowerShell terminal in your project root, then:

```powershell
# 1. Download the installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/maitaitime/get-shit-done-github-copilot/main/installer/install.ps1" -OutFile install.ps1

# 2. Run it
.\install.ps1

# 3. Clean up
Remove-Item install.ps1
```

That's it. GSD Copilot is now set up in your workspace.

---

## What Gets Installed

The installer writes only into three subdirectories of `.github/`:

- `.github/prompts/` — VS Code slash command prompts (e.g. `/gsd.new-project`)
- `.github/agents/` — Copilot agent profiles (e.g. `gsd-planner.agent.md`)
- `.github/instructions/` — Reusable instruction files for Copilot context

Non-GSD files in `.github/` (your workflows, issue templates, etc.) are never touched.

---

## Options

| Flag | Description | Example |
|------|-------------|---------|
| `-Tag <version>` | Install a specific release tag instead of latest | `.\install.ps1 -Tag v1.2.0` |
| `-DryRun` | Preview what would be installed without writing any files | `.\install.ps1 -DryRun` |
| `-Force` | Skip overwrite warnings; also overrides the downgrade block | `.\install.ps1 -Force` |
| `-Verbose` | Show file-by-file output as the install runs | `.\install.ps1 -Verbose` |
| `-WorkspaceDir <path>` | Target a directory other than the current one | `.\install.ps1 -WorkspaceDir C:\myproject` |

---

## Upgrading

Re-run the same install command. GSD-owned files are overwritten with a warning; non-GSD files are untouched.

## Downgrades

Blocked by default — the installer exits with an error if the installed version is newer than the target. Use `-Force` to override.

---

## Safety

- **Never touches non-GSD files** — only files from the release zip are written; your workflows, templates, and other `.github/` content remain unchanged.
- **No backup created** — the installer relies on your workspace being under git version control. Run `git status` first if you're unsure.

---

## Version Tracking

After a successful install, `.github/.gsd-version` is written with the installed version string. This file is used for downgrade detection on subsequent runs.
