<user_overrides>

Customize GSD behavior without forking the repository.

<overview>

## What It Is

The user override system lets you customize GSD agents, templates, and workflows by placing files in `~/.claude/gsd-overrides/`. GSD checks for override files before using defaults.

## Why It Exists

Previously, customizing GSD required:
1. Fork the entire repository
2. Modify source files
3. Maintain your fork against upstream changes

Now you can customize just the files you need, and updates won't overwrite your changes.

</overview>

<directory_structure>

## Directory Structure

```
~/.claude/
├── gsd-overrides/           # Your customizations (highest priority)
│   ├── agents/
│   │   └── gsd-executor.md  # Custom executor agent
│   ├── templates/
│   │   └── plan.md          # Custom plan template
│   └── workflows/
│       └── execute-plan/
│           └── _commits.md  # Custom commit logic
├── agents/                   # GSD defaults (lower priority)
│   └── gsd-executor.md
└── get-shit-done/
    └── workflows/
        └── execute-plan/
            └── _commits.md
```

</directory_structure>

<resolution_order>

## Priority Resolution

When GSD needs a file, it checks in this order:

1. `~/.claude/gsd-overrides/{type}/{filename}` — **User override (wins)**
2. `~/.claude/{type}/{filename}` or `~/.claude/get-shit-done/{type}/{filename}` — **GSD default**

**Example:** When spawning an executor agent:
- Check: `~/.claude/gsd-overrides/agents/gsd-executor.md`
- If exists: Use override
- If not: Use `~/.claude/agents/gsd-executor.md`

</resolution_order>

<creating_overrides>

## Creating Overrides

### Step 1: Copy the Default

```bash
# Copy default to override location
cp ~/.claude/agents/gsd-executor.md ~/.claude/gsd-overrides/agents/

# For workflows
cp ~/.claude/get-shit-done/workflows/execute-plan/_commits.md \
   ~/.claude/gsd-overrides/workflows/execute-plan/

# For templates
cp ~/.claude/get-shit-done/templates/plan.md \
   ~/.claude/gsd-overrides/templates/
```

### Step 2: Edit Your Copy

Modify the override file to customize behavior.

### Step 3: Test

Run GSD commands. Your override is automatically used.

</creating_overrides>

<common_overrides>

## Common Customizations

### Custom Commit Messages

Override `_commits.md` to change commit format:

```bash
cp ~/.claude/get-shit-done/workflows/execute-plan/_commits.md \
   ~/.claude/gsd-overrides/workflows/execute-plan/
# Edit: Change commit message format from conventional to simple
```

### Custom Executor Behavior

Override `gsd-executor.md` to change how plans are executed:

```bash
cp ~/.claude/agents/gsd-executor.md ~/.claude/gsd-overrides/agents/
# Edit: Add custom verification steps, change commit frequency, etc.
```

### Custom Plan Templates

Override templates to change plan structure:

```bash
cp ~/.claude/get-shit-done/templates/plan.md ~/.claude/gsd-overrides/templates/
# Edit: Add custom frontmatter fields, change task format, etc.
```

</common_overrides>

<maintenance>

## Maintenance

### Updates

When GSD updates, your overrides are preserved. However:

1. **Check CHANGELOG** — See if default files you override changed
2. **Merge changes** — If defaults changed significantly, update your overrides
3. **Test** — Run GSD commands to verify overrides still work

### Debugging

If GSD behavior seems wrong:

```bash
# Check for override files
ls -la ~/.claude/gsd-overrides/

# Remove override to test default behavior
mv ~/.claude/gsd-overrides/agents/gsd-executor.md \
   ~/.claude/gsd-overrides/agents/gsd-executor.md.disabled
```

### Detection Logging

When GSD uses an override, it logs:
```
[GSD] Using override: ~/.claude/gsd-overrides/agents/gsd-executor.md
```

This helps you know when customizations are active.

</maintenance>

<limitations>

## Limitations

1. **Global installs only** — Overrides only work for global GSD installations
2. **Claude Code only** — Override system not available for OpenCode (yet)
3. **Manual sync** — You must manually update overrides when GSD defaults change significantly

</limitations>

</user_overrides>
