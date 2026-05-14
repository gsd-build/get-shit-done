<purpose>
Power user mode for discuss-phase. Generates ALL questions upfront into a JSON state file and an HTML companion UI, then waits for the user to answer at their own pace. When the user signals readiness, processes all answers in one pass and generates CONTEXT.md.

**When to use:** Large phases with many gray areas, or when users prefer to answer questions offline / asynchronously rather than interactively in the chat session.
</purpose>

<trigger>
This workflow executes when `--power` flag is present in ARGUMENTS to `/gsd:discuss-phase`.

The caller (discuss-phase.md) has already:
- Validated the phase exists
- Provided init context: `phase_dir`, `padded_phase`, `phase_number`, `phase_name`, `phase_slug`

Begin at **Step 1** immediately.
</trigger>

<step name="analyze">
Run the same gray area identification as standard discuss-phase mode.

1. Load prior context (PROJECT.md, REQUIREMENTS.md, STATE.md, prior CONTEXT.md files)
2. Scout codebase for reusable assets and patterns relevant to this phase
3. Read the phase goal from ROADMAP.md
4. Identify ALL gray areas — specific implementation decisions the user should weigh in on
5. For each gray area, generate 2–4 concrete options with tradeoff descriptions

Group questions by topic into sections (e.g., "Visual Style", "Data Model", "Interactions", "Error Handling"). Each section should have 2–6 questions.

Do NOT ask the user anything at this stage. Capture everything internally, then proceed to generate.
</step>

<step name="generate_json">
Write all questions to:

```
{phase_dir}/{padded_phase}-QUESTIONS.json
```

**JSON structure:**

```json
{
  "phase": "{padded_phase}-{phase_slug}",
  "generated_at": "ISO-8601 timestamp",
  "stats": {
    "total": 0,
    "answered": 0,
    "chat_more": 0,
    "remaining": 0
  },
  "sections": [
    {
      "id": "section-slug",
      "title": "Section Title",
      "questions": [
        {
          "id": "Q-01",
          "title": "Short question title",
          "context": "Codebase info, prior decisions, or constraints relevant to this question",
          "options": [
            {
              "id": "a",
              "label": "Option label",
              "description": "Tradeoff or elaboration for this option"
            },
            {
              "id": "b",
              "label": "Another option",
              "description": "Tradeoff or elaboration"
            },
            {
              "id": "c",
              "label": "Custom",
              "description": ""
            }
          ],
          "answer": null,
          "chat_more": "",
          "status": "unanswered"
        }
      ]
    }
  ]
}
```

**Field rules:**
- `stats.total`: count of all questions across all sections
- `stats.answered`: count where `answer` is not null and not empty string
- `stats.chat_more`: count where `chat_more` has content
- `stats.remaining`: `total - answered`
- `question.id`: sequential across all sections — Q-01, Q-02, Q-03, ...
- `question.context`: concrete codebase or prior-decision annotation (not generic)
- `question.answer`: null until user sets it; once answered, the selected option id or free-text
- `question.status`: "unanswered" | "answered" | "chat-more" (has chat_more but no answer yet)
</step>

<step name="generate_html">
Write a self-contained HTML companion file to:

```
{phase_dir}/{padded_phase}-QUESTIONS.html
```

The file must be a single self-contained HTML file with inline CSS and JavaScript. No external dependencies.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Phase {N}: {phase_name} — Discussion Questions      │
│  ┌──────────────────────────────────────────────┐   │
│  │  12 total  |  3 answered  |  9 remaining     │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  ▼ Visual Style (3 questions)                        │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│   │ Q-01     │ │ Q-02     │ │ Q-03     │            │
│   │ Layout   │ │ Density  │ │ Colors   │            │
│   │ ...      │ │ ...      │ │ ...      │            │
│   └──────────┘ └──────────┘ └──────────┘            │
│  ▼ Data Model (2 questions)                          │
│   ...                                                │
└─────────────────────────────────────────────────────┘
```

**Stats bar:**
- Total questions, answered count, remaining count
- A simple CSS progress bar (green fill = answered / total)

**Section headers:**
- Collapsible via click — show/hide questions in the section
- Show answered count for the section (e.g., "2/4 answered")

**Question cards (3-column grid):**
Each card contains:
- Question ID badge (e.g., "Q-01") and title
- Context annotation (gray italic text)
- Option list: radio buttons with bold label + description text
- Chat more textarea (orange border when content present)
- Card highlighted green when answered

**JavaScript behavior:**
- On radio button select: mark question as answered in page state; update stats bar
- On textarea input: update chat_more content in page state; show orange border if content present
- "Save answers" button at top and bottom: serializes page state back to the JSON file path

**Save mechanism:**
The Save button writes the updated JSON back using the File System Access API if available, otherwise generates a downloadable JSON file the user can save over the original. Include clear instructions in the UI:

```
After answering, click "Save answers" — or download the JSON and replace the original file.
Then return to Claude and say "refresh" to process your answers.
```

**Answered question styling:**
- Card border: `2px solid #22c55e` (green)
- Card background: `#f0fdf4` (light green tint)

**Unanswered question styling:**
- Card border: `1px solid #e2e8f0` (gray)
- Card background: `white`

**Chat more textarea:**
- Placeholder: "Add context, nuance, or clarification for this question..."
- Normal border: `1px solid #e2e8f0`
- Active (has content) border: `2px solid #f97316` (orange)
</step>

<step name="notify_user">
After writing both files, print this message to the user:

```
Questions ready for Phase {N}: {phase_name}

  HTML (open in browser/IDE):   {phase_dir}/{padded_phase}-QUESTIONS.html
  JSON (state file):            {phase_dir}/{padded_phase}-QUESTIONS.json

  {total} questions across {section_count} topics.

Open the HTML file, answer the questions at your own pace, then save.

When ready, tell me:
  "refresh"   — process your answers and update the file
  "finalize"  — generate CONTEXT.md from all answered questions
  "explain Q-05"   — elaborate on a specific question
  "exit power mode" — return to standard one-by-one discussion (answers carry over)
```
</step>

<step name="wait_loop">
Enter wait mode. Claude listens for user commands and handles each:

---

**"refresh"** (or "process answers", "update", "re-read"):

1. Read `{phase_dir}/{padded_phase}-QUESTIONS.json`
2. Recalculate stats: count answered, chat_more, remaining
3. Write updated stats back to the JSON
4. Re-generate the HTML file with the updated state (answered cards highlighted green, progress bar updated)
5. Report to user:

```
Refreshed. Updated state:
  Answered:  {answered} / {total}
  Remaining: {remaining}
  Chat-more: {chat_more}

  {phase_dir}/{padded_phase}-QUESTIONS.html updated.

Answer more questions, then say "refresh" again, or say "finalize" when done.
```

---

**"finalize"** (or "done", "generate context", "write context"):

Proceed to the **finalize** step.

---

**"explain Q-{N}"** (or "more info on Q-{N}", "elaborate Q-{N}"):

1. Find the question by ID in the JSON
2. Provide a detailed explanation: why this decision matters, how it affects the downstream plan, what additional context from the codebase is relevant
3. Return to wait mode

---

**"exit power mode"** (or "switch to interactive"):

1. Read all currently answered questions from JSON
2. Load answers into the internal accumulator as if they were answered interactively
3. Continue with standard `discuss_areas` step from discuss-phase.md for any unanswered questions
4. Generate CONTEXT.md as normal

---

**Any other message:**
Respond helpfully, then remind the user of available commands:
```
(Power mode active — say "refresh", "finalize", "explain Q-N", or "exit power mode")
```
</step>

<step name="finalize">
Process all answered questions from the JSON file and generate CONTEXT.md.

1. Read `{phase_dir}/{padded_phase}-QUESTIONS.json`
2. Filter to questions where `answer` is not null/empty
3. Group decisions by section
4. For each answered question, format as a decision entry:
   - Decision: the selected option label (or custom text if free-form answer)
   - Rationale: the option description, plus `chat_more` content if present
   - Status: "Decided" if fully answered, "Needs clarification" if only chat_more with no option selected

5. Write CONTEXT.md using the standard context template format:
   - `<decisions>` section with all answered questions grouped by section
   - `<deferred_ideas>` section for unanswered questions (carry forward for future discussion)
   - `<specifics>` section for any chat_more content that adds nuance
   - `<code_context>` section with reusable assets found during analysis
   - `<canonical_refs>` section (MANDATORY — paths to relevant specs/docs)

6. If fewer than 50% of questions were answered, warn the user:
```
Warning: Only {answered}/{total} questions answered ({pct}%).
CONTEXT.md generated with available decisions. Unanswered questions listed as deferred.
Consider running /gsd:discuss-phase {N} again to refine before planning.
```

7. Print completion message:
```
CONTEXT.md written: {phase_dir}/{padded_phase}-CONTEXT.md

  Decisions captured: {answered}
  Deferred:          {remaining}

Next step: /gsd:plan-phase {N}
```
</step>

<success_criteria>
- Questions generated into well-structured JSON covering all identified gray areas
- HTML companion file is self-contained and usable without a server
- Stats bar accurately reflects answered/remaining counts after each refresh
- Answered questions highlighted green in HTML
- CONTEXT.md generated in the same format as standard discuss-phase output
- Unanswered questions preserved as deferred items (not silently dropped)
- `canonical_refs` section always present in CONTEXT.md (MANDATORY)
- User knows how to refresh, finalize, explain, or exit power mode
</success_criteria>
