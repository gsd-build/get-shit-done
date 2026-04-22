# Skill Discovery Contract

> Canonical rules for scanning, inventorying, and rendering GSD skills.

## Root Categories

### Project Roots

Scan these roots relative to the project root:

- `.claude/skills/`
- `.agents/skills/`
- `.cursor/skills/`
- `.github/skills/`
- `./.codex/skills/`

These roots are used for project-specific skills and for the project `CLAUDE.md` skills section.

### Managed Global Roots

Scan these roots relative to the user home directory:

- `~/.claude/skills/`
- `~/.codex/skills/`

These roots are used for managed runtime installs and inventory reporting.

### Deprecated Import-Only Root

- `~/.claude/get-shit-done/skills/`

This root is kept for legacy migration only. Inventory code may report it, but new installs should not write here.

### Legacy Claude Commands

- `~/.claude/commands/gsd/`

This is not a skills root. Discovery code only checks whether it exists so inventory can report legacy Claude installs.

## Normalization Rules

- Scan only subdirectories that contain `SKILL.md`.
- Read `name` and `description` from YAML frontmatter.
- Use the directory name when `name` is missing.
- Extract trigger hints from body lines that match `TRIGGER when: ...`.
- Treat `gsd-*` directories as installed framework skills.
- Treat `~/.claude/get-shit-done/skills/` entries as deprecated/import-only.
- Treat `~/.claude/commands/gsd/` as legacy command installation metadata, not skills.

## Scanner Behavior

### `sdk/src/query/skills.ts`

- Returns a de-duplicated list of discovered skill names.
- Scans project roots plus managed global roots.
- Does not scan the deprecated import-only root.

### `get-shit-done/bin/lib/profile-output.cjs`

- Builds the project `CLAUDE.md` skills section.
- Scans project roots only.
- Skips `gsd-*` directories so the project section stays focused on user/project skills.
- Adds `.codex/skills/` to the project discovery set.

### `get-shit-done/bin/lib/init.cjs`

- Generates the skill inventory object for `skill-manifest`.
- Reports `skills`, `roots`, `installation`, and `counts`.
- Marks `gsd_skills_installed` when any discovered skill name starts with `gsd-`.
- Marks `legacy_claude_commands_installed` when `~/.claude/commands/gsd/` contains `.md` command files.

## Inventory Shape

`skill-manifest` returns a JSON object with:

- `skills`: normalized skill entries
- `roots`: the canonical roots that were checked
- `installation`: summary booleans for installed GSD skills and legacy Claude commands
- `counts`: small inventory counts for downstream consumers

Each skill entry includes:

- `name`
- `description`
- `triggers`
- `path`
- `file_path`
- `root`
- `scope`
- `installed`
- `deprecated`

