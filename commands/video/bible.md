---
name: video:bible
description: Create a versioned Bible from the trailer brief
allowed-tools:
  - Read
  - Write
---

<objective>

Generate `video/bible/bible_v001.yaml` from the structured trailer brief.

</objective>

<execution_context>

@~/.claude/get-shit-done/templates/video/bible/bible_v001.yaml
@video/TRAILER.md
@video/STATE.json

</execution_context>

<process>

1. **Load inputs:**
   - Read `video/TRAILER.md` (must exist; if not, instruct to run `/video:discuss`).
   - Read `video/STATE.json` if it exists.

2. **Write Bible v001:**
   - Use the schema from `bible_v001.yaml` template.
   - Fill `intent` fields from the brief (title, logline, duration_target_s, vibe).
   - Populate `locks.*.negatives` from must-not-change and any explicit negatives.
   - Keep lock arrays empty if no confirmed locks yet.

3. **Update `video/STATE.json`:**
   - Set `active_bible` to `bible_v001.yaml`.
   - Record `last_bible_version: 1`.

4. **Confirm next step:**
   Recommend `/video:contact-sheet character`, `/video:contact-sheet environment`, and `/video:contact-sheet style`.

</process>

<success_criteria>

- `video/bible/bible_v001.yaml` created and versioned.
- `video/STATE.json` updated with active bible info.

</success_criteria>
