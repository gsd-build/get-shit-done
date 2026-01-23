---
name: video:shotlist
description: Generate a trailer shotlist with beats and motion prompts
allowed-tools:
  - Read
  - Write
---

<objective>

Create `video/shotlists/shotlist_v001.yaml` with 10–18 beats, each referencing lock frames and motion-focused prompts.

</objective>

<execution_context>

@~/.claude/get-shit-done/templates/video/shotlists/shotlist_v001.yaml
@video/bible/bible_v001.yaml
@video/TRAILER.md
@video/STATE.json

</execution_context>

<process>

1. **Load inputs:**
   - Read `video/TRAILER.md` and the active Bible.

2. **Write shotlist v001:**
   - Use the template schema.
   - Generate 10–18 shots with beats (establish, tension, reveal, action, emotion, twist).
   - Ensure every shot references a `lock_ref` placeholder and uses a **motion-only** `veo_prompt`.
   - Keep prompts focused on camera movement, pacing, and motion; identity/world should be in lock frames.

3. **Update `video/STATE.json`:**
   - Set `active_shotlist` to `shotlist_v001.yaml`.
   - Record `last_shotlist_version: 1`.

4. **Confirm next step:**
   Recommend `/video:package` to generate the render bundle.

</process>

<success_criteria>

- `video/shotlists/shotlist_v001.yaml` created with 10–18 beats.
- `video/STATE.json` updated with active shotlist info.

</success_criteria>
