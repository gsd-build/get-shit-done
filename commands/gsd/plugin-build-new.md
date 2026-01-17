---
name: gsd:plugin-build-new
description: Create a new GSD plugin through interactive workflow
argument-hint: "[output-directory]"
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion]
---

<objective>
Guide users through creating a new GSD plugin with an interactive workflow.

Purpose: Make plugin development accessible by asking questions and generating all necessary files.
Output: Complete plugin directory ready for development and installation.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/plugin-builder.md
</execution_context>

<process>

<step name="determine_output">
## Step 1: Determine Output Directory

Check if output directory was specified as an argument:
- If provided: Use that directory as the base for plugin creation
- If not provided: Default to current working directory

**Validation:**
1. Verify the directory exists and is writable
2. Ensure the path is NOT inside `~/.claude/` (plugins should be developed separately, then installed)

If inside ~/.claude/:
```
Plugins should be developed outside of ~/.claude/ and then installed using:
  /gsd:plugin install ./your-plugin

Please specify a different directory or run from your development folder.
```
Exit if invalid.
</step>

<step name="invoke_workflow">
## Step 2: Execute Plugin Builder Workflow

Follow the plugin-builder.md workflow to:

1. **Gather plugin metadata:**
   - Plugin name (kebab-case, 3-50 chars)
   - Description (one-line)
   - Author (name or name + email)
   - License (MIT, Apache-2.0, ISC, GPL-3.0, or other)

2. **Select components:**
   - Commands (slash commands users can invoke)
   - Hooks (respond to GSD lifecycle events)
   - Workflows (multi-step procedures)
   - Agents (specialized subagents for execution)
   - Services (Docker containers)

3. **Collect component details:**
   - Names and descriptions for each selected component
   - Hook triggers, service configurations, etc.

4. **Confirm and generate:**
   - Present summary of what will be created
   - Generate all files from templates

**Important naming rules:**
- Plugin name must be kebab-case (lowercase letters, numbers, hyphens only)
- Commands will be namespaced as `{plugin-name}:{command-name}`
- All component names should be kebab-case

**Output structure:**
```
{output-directory}/{plugin-name}/
├── plugin.json      (manifest)
├── README.md        (documentation)
├── commands/        (if commands selected)
├── hooks/           (if hooks selected)
├── workflows/       (if workflows selected)
├── agents/          (if agents selected)
└── docker/          (if services selected)
```
</step>

<step name="validate_and_report">
## Step 3: Validate and Report

After generation:

1. **Validate plugin.json:**
   - Confirm it has required fields (name, version, description, gsd)
   - Verify all referenced files exist

2. **Show creation summary:**
   ```
   Created plugin: {plugin-name}/

   Files generated:
   - plugin.json
   - README.md
   {list of component files}
   ```

3. **Provide next steps:**
   ```
   ## Next Steps

   1. Review and customize the generated files
   2. Implement command/workflow/hook logic in the placeholder sections
   3. Test locally:
      /gsd:plugin install ./{plugin-name}

   4. When ready, publish to a git repository for others to install

   ## Your Commands

   After installation, your plugin provides:
   {list commands with descriptions}
   ```
</step>

</process>

<examples>

**Basic usage (current directory):**
```
/gsd:plugin-build-new
```
Creates plugin in `./` — prompts for name, which becomes the subdirectory.

**Specify output directory:**
```
/gsd:plugin-build-new ./my-plugins/my-new-plugin
```
Creates plugin at the specified path.

**Example session:**
```
> /gsd:plugin-build-new

[Plugin Name]
What should your plugin be called?
> code-analyzer

[Description]
One-line description of what this plugin does?
> Analyze code quality and generate reports

[Author]
Author name (or name + email)?
> Jane Developer <jane@example.com>

[License]
What license?
> MIT

[Commands]
Will your plugin have slash commands users can invoke?
> Yes, add commands

... (continues through workflow)

Created plugin: code-analyzer/

Files generated:
- plugin.json
- README.md
- commands/analyze.md
- commands/report.md

## Next Steps

1. Review and customize the generated files
2. Implement command logic in commands/*.md
3. Test locally:
   /gsd:plugin install ./code-analyzer

## Your Commands

After installation, your plugin provides:
  /code-analyzer:analyze - Analyze code in the current project
  /code-analyzer:report - Generate a code quality report
```

</examples>

<success_criteria>
- [ ] Output directory validated (exists, writable, not in ~/.claude/)
- [ ] Plugin builder workflow completed successfully
- [ ] All selected component files generated
- [ ] plugin.json is valid with all required fields
- [ ] User shown next steps for customization and testing
</success_criteria>
