---
name: video:discuss
description: Run the trailer discuss phase and capture a structured intent brief
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

<objective>

Run a trailer-first discuss phase to capture intent, constraints, references, and trailer grammar.

**Output:** Structured answers (YAML or Markdown table) saved to `video/TRAILER.md`.

</objective>

<execution_context>

@~/.claude/get-shit-done/templates/video/TRAILER.md

</execution_context>

<process>

1. **Load existing brief (if present):**
   - If `video/TRAILER.md` exists, read it first.
   - Summarize current answers and ask only missing or unclear questions.

2. **Ask the trailer discuss questions (in conversation, not a form):**

   **Intent**
   - What’s the promise of the trailer in one sentence?
   - What should the viewer feel in the last 3 seconds?
   - CTA: watch / buy / attend / join / other?

   **Constraints**
   - Duration target (30/45/60s)?
   - Rating/safety constraints?
   - Must-not-change list (character identity, wardrobe, location, palette)?

   **References**
   - 2–3 reference trailers (titles + links)
   - 2–3 reference frames (still images + links)

   **Trailer grammar**
   - Pacing: slow-burn vs aggressive montage?
   - Voiceover: none / minimal / full?
   - Title cards: yes/no; tone (cryptic vs explicit)?

3. **Write the brief to `video/TRAILER.md` in YAML:**

   ```yaml
   intent:
     promise: ""
     final_feel: ""
     cta: ""
   constraints:
     duration_target_s: 45
     rating: ""
     must_not_change:
       - ""
   references:
     trailers:
       - title: ""
         link: ""
     frames:
       - description: ""
         link: ""
   trailer_grammar:
     pacing: "slow-burn" # or aggressive montage
     voiceover: "none"   # none/minimal/full
     title_cards:
       enabled: true
       tone: "cryptic"     # cryptic/explicit
   ```

4. **Confirm next step:**
   Recommend running `/video:bible` once the brief looks right.

</process>

<success_criteria>

- `video/TRAILER.md` exists and contains structured YAML answers.
- Unclear sections are explicitly flagged or asked about.

</success_criteria>
