---
name: video:package
description: Build a render package folder with prompts, checklist, and naming scheme
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>

Create a deterministic render package folder containing all prompts, required input checklist, and naming scheme.

</objective>

<execution_context>

@video/bible/bible_v001.yaml
@video/shotlists/shotlist_v001.yaml
@video/prompts/
@video/STATE.json

</execution_context>

<process>

1. **Load active Bible + shotlist:**
   - Read `video/STATE.json` to determine active versions.
   - If missing, default to `bible_v001.yaml` and `shotlist_v001.yaml`.

2. **Create render package directory:**
   ```bash
   mkdir -p video/packages/render_package_v001
   ```

3. **Write `video/packages/render_package_v001/README.md`:**
   Include:
   - **Prompt bundle:** list all prompt files (NBP + Veo) with relative paths.
   - **Checklist:** selected lock frames, missing locks, target duration, and required inputs.
   - **Naming scheme:** deterministic naming pattern for outputs (e.g., `shotlist_v001_s01_take01.mp4`).

4. **Copy prompt files into package:**
   - Copy `video/prompts/*` into the package folder.

5. **Confirm next step:**
   Tell the user the package is ready for manual render execution.

</process>

<success_criteria>

- `video/packages/render_package_v001/` exists with prompts + README.
- README includes checklist + deterministic naming scheme.

</success_criteria>
