---
name: video:new
description: Scaffold a trailer video project workspace with starter docs
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>

Create a local `video/` workspace that mirrors GSD structure for trailer workflows.

**Creates:**
- `video/TRAILER.md` — intent brief starter questions
- `video/bible/bible_v001.yaml` — bible schema starter
- `video/shotlists/shotlist_v001.yaml` — shotlist starter
- `video/prompts/` — prompt templates
- `video/runs/README.md` — run log instructions
- `video/STATE.json` — active versions + last run ids

</objective>

<execution_context>

@~/.claude/get-shit-done/templates/video/TRAILER.md
@~/.claude/get-shit-done/templates/video/bible/bible_v001.yaml
@~/.claude/get-shit-done/templates/video/shotlists/shotlist_v001.yaml
@~/.claude/get-shit-done/templates/video/prompts/nano_banana_contactsheet.md
@~/.claude/get-shit-done/templates/video/prompts/veo_shot_prompt.md
@~/.claude/get-shit-done/templates/video/runs/README.md
@~/.claude/get-shit-done/templates/video/STATE.json

</execution_context>

<process>

1. **Abort if video workspace exists:**
   ```bash
   [ -d video ] && echo "ERROR: video/ already exists. Use /video:discuss or /video:bible." && exit 1
   ```

2. **Create workspace and copy templates:**
   ```bash
   mkdir -p video
   cp -R ~/.claude/get-shit-done/templates/video/* video/
   ```

3. **Confirm success:**
   List the created files and tell the user to run `/video:discuss` next.

</process>

<success_criteria>

- `video/` directory exists with the template structure.
- User is prompted to start the discuss phase with `/video:discuss`.

</success_criteria>
