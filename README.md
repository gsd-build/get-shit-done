# Get Shit Done - Codex Fork

This repository packages the get-shit-done (GSD) workflow for Codex. It installs Codex prompts plus the supporting GSD reference files used by the workflows and agents.

Use this fork if you want the GSD workflow inside Codex with a simple installer that works for a single project or your home directory.

## Quick Install

```bash
npx gsd-codex-cli@latest --path .
```

Install globally (prompts available from any project):

```bash
npx gsd-codex-cli@latest --global
```

You can combine both:

```bash
npx gsd-codex-cli@latest --path . --global
```

## What Gets Installed

The installer copies these directories into the target location:

- `.codex/prompts` and `.codex/skills` for Codex commands
- `.codex/agents` for Codex agent roles (model routing)
- `.claude/get-shit-done` for workflow references
- `.claude/agents` for agent definitions

This fork is Codex-first, but the Claude assets are kept alongside for compatibility with the upstream workflow files.

The installer also registers GSD agent roles under `[agents.gsd-*]` in your Codex config (`.codex/config.toml` for local installs and `~/.codex/config.toml` for global installs). It only appends missing sections.

## Using the Prompts

Open your project in Codex and run these prompt commands:

- `/prompts:gsd-new-project`
- `/prompts:gsd-plan-phase`
- `/prompts:gsd-execute-phase`

All Codex prompts live in `.codex/prompts`.

## Update

Re-run the installer to update your local or global install. It overwrites the existing files with the latest version.

```bash
npx gsd-codex-cli@latest --path . --global
```

## CLI Options

```
--path <target-dir>   Install into this directory (defaults to current directory)
--global              Also install to your home directory
--help                Show help
```

## Examples

```bash
npx gsd-codex-cli@latest --path .
npx gsd-codex-cli@latest --global
npx gsd-codex-cli@latest --path . --global
```

## Development

```bash
git clone https://github.com/redstar1337/get-shit-done-codex.git
cd get-shit-done-codex
node bin/install-codex.js --path .
```

Run tests and build hooks:

```bash
npm test
npm run build:hooks
```

## Notes

- This package is published as `gsd-codex-cli`. Use `npx gsd-codex-cli@latest` for installs.
- The npm binary names `get-shit-done-codex` and `get-shit-done-cc` are still provided for compatibility after install.

## Upstream

GSD originated in the upstream repository by TACHES. This fork keeps the core workflow and adds Codex-native prompts and packaging.

Upstream: https://github.com/glittercowboy/get-shit-done

## License

MIT. See `LICENSE`.
