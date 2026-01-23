# TRAILER.md Template

Intent brief for a trailer-style video project.

<template>

```yaml
intent:
  title: ""
  promise: ""        # One-sentence promise
  final_feel: ""      # What should the viewer feel in the last 3 seconds?
  cta: ""             # watch / buy / attend / join

constraints:
  duration_target_s: 45
  rating: ""
  must_not_change:
    - "character identity"
    - "wardrobe"
    - "location"
    - "palette"

references:
  trailers:
    - title: ""
      link: ""
  frames:
    - description: ""
      link: ""

trailer_grammar:
  pacing: "slow-burn"   # slow-burn / aggressive montage
  voiceover: "none"     # none / minimal / full
  title_cards:
    enabled: true
    tone: "cryptic"     # cryptic / explicit
```

</template>

<guidelines>

**Intent:**
- Promise is the hook in one sentence.
- Final feel is a visceral emotion (awe, dread, curiosity, relief).
- CTA should be a concrete action.

**Constraints:**
- Duration target is a hard budget.
- Must-not-change list are identity locks (never break them in later docs).

**References:**
- Include links whenever possible.
- Frames can be still images or timestamps in trailers.

**Trailer grammar:**
- Decide pacing + voiceover early; it shapes the shotlist.
- Title cards should reflect tone (cryptic vs explicit).

</guidelines>
