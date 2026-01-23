# Nano Banana Contact Sheet Prompt Pack

Use this template to generate 12-frame contact sheets for character, environment, or style exploration.

<template>

```markdown
# Contact Sheet — [character|environment|style]

## Prompt (12 frames)
"""
[Prompt describing the subject, consistency constraints, and desired style.]
Return 12 frames in a 3x4 grid, consistent framing, consistent lighting, clear variation in pose or angle.
"""

## Expected outputs
- Format: 12-frame contact sheet (3x4 grid)
- Resolution: [e.g., 1536x1024 or provider default]
- Naming: contact_sheet_[domain]_v001.png

## Selection rubric (0–5 each)
- identity: Does the subject read consistently?
- world: Does the environment feel cohesive and believable?
- style: Is the look aligned with the trailer vibe?
- iconic_frames: Are there 1–2 standout frames worth locking?

## Notes
- Keep prompts locked to must-not-change constraints.
- Avoid new wardrobe/props unless explicitly allowed.
```

</template>
