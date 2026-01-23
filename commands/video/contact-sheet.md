---
name: video:contact-sheet
description: Generate contact sheet prompt packs for character, environment, or style
argument-hint: "<character|environment|style>"
allowed-tools:
  - Read
  - Write
---

<objective>

Create a contact sheet prompt pack for the specified domain (character/environment/style), plus a selection rubric, and update Bible locks placeholders.

</objective>

<execution_context>

@~/.claude/get-shit-done/templates/video/prompts/nano_banana_contactsheet.md
@video/bible/bible_v001.yaml
@video/STATE.json

</execution_context>

<process>

1. **Validate arguments:**
   - `$ARGUMENTS` must be one of: `character`, `environment`, `style`.
   - If not, stop and show usage.

2. **Load Bible:**
   - Read `video/bible/bible_v001.yaml` (or `active_bible` from `video/STATE.json`).

3. **Generate prompt pack:**
   - Create `video/prompts/contact_sheet_${ARG}_v001.md`.
   - Include:
     - A concise prompt block for 12 frames.
     - Expected outputs (frame naming, resolution assumptions).
     - A selection rubric (identity/world/style/iconic scores).
   - Use the template from `nano_banana_contactsheet.md` as the base.

4. **Update Bible locks placeholders:**
   - For the selected domain, add placeholders for `identity_lock`, `wardrobe_lock`, `style_lock`, etc.
   - Keep arrays empty but insert comments or placeholders such as `TBD: choose from contact sheet winners`.

5. **Confirm next step:**
   - Tell the user to run the other contact sheets or select winners and update `selected_locks`.

</process>

<success_criteria>

- `video/prompts/contact_sheet_${ARG}_v001.md` exists with prompts + rubric.
- `video/bible/bible_v001.yaml` updated with lock placeholders for the domain.

</success_criteria>
