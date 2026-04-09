# User Profiling: Detection Heuristics Reference

This reference document defines detection heuristics for behavioral profiling across 8 dimensions. The gsd-user-profiler agent applies these rules when analyzing extracted session messages. Do not invent dimensions or scoring rules beyond what is defined here.

## How to Use This Document

1. The gsd-user-profiler agent reads this document before analyzing any messages
2. For each dimension, the agent scans messages for the signal patterns defined below
3. The agent applies the detection heuristics to classify the developer's pattern
4. Confidence is scored using the thresholds defined per dimension
5. Evidence quotes are curated using the rules in the Evidence Curation section
6. Output must conform to the JSON schema in the Output Schema section

---

## Dimensions

### 1. Communication Style

`dimension_id: communication_style`

**What we're measuring:** How the developer phrases requests, instructions, and feedback -- the structural pattern of their messages to Claude.

**Rating spectrum:**

| Rating | Description |
|--------|-------------|
| `terse-direct` | Short, imperative messages with minimal context. Gets to the point immediately. |
| `conversational` | Medium-length messages mixing instructions with questions and thinking-aloud. Natural, informal tone. |
| `detailed-structured` | Long messages with explicit structure -- headers, numbered lists, problem statements, pre-analysis. |
| `mixed` | No dominant pattern; style shifts based on task type or project context. |

**Signal patterns:**

1. **Message length distribution** -- Average word count across messages. Terse < 50 words, conversational 50-200 words, detailed > 200 words.
2. **Imperative-to-interrogative ratio** -- Ratio of commands ("fix this", "add X") to questions ("what do you think?", "should we?"). High imperative ratio suggests terse-direct.
3. **Structural formatting** -- Presence of markdown headers, numbered lists, code blocks, or bullet points within messages. Frequent formatting suggests detailed-structured.
4. **Context preambles** -- Whether the developer provides background/context before making a request. Preambles suggest conversational or detailed-structured.
5. **Sentence completeness** -- Whether messages use full sentences or fragments/shorthand. Fragments suggest terse-direct.
6. **Follow-up pattern** -- Whether the developer provides additional context in subsequent messages (multi-message requests suggest conversational).

**Detection heuristics:**

1. If average message length < 50 words AND predominantly imperative mood AND minimal formatting --> `terse-direct`
2. If average message length 50-200 words AND mix of imperative and interrogative AND occasional formatting --> `conversational`
3. If average message length > 200 words AND frequent structural formatting AND context preambles present --> `detailed-structured`
4. If message length variance is high (std dev > 60% of mean) AND no single pattern dominates (< 60% of messages match one style) --> `mixed`
5. If pattern varies systematically by project type (e.g., terse in CLI projects, detailed in frontend) --> `mixed` with context-dependent note

**Confidence scoring:**

- **HIGH:** 10+ messages showing consistent pattern (> 70% match), same pattern observed across 2+ projects
- **MEDIUM:** 5-9 messages showing pattern, OR pattern consistent within 1 project only
- **LOW:** < 5 messages with relevant signals, OR mixed signals (contradictory patterns observed in similar contexts)
- **UNSCORED:** 0 messages with relevant signals for this dimension

**Example quotes:**

- **terse-direct:** "fix the auth bug" / "add pagination to the list endpoint" / "this test is failing, make it pass"
- **conversational:** "I'm thinking we should probably handle the error case here. What do you think about returning a 422 instead of a 500? The client needs to know it was a validation issue."
- **detailed-structured:** "## Context\nThe auth flow currently uses session cookies but we need to migrate to JWT.\n\n## Requirements\n1. Access tokens (15min expiry)\n2. Refresh tokens (7-day)\n3. httpOnly cookies\n\n## What I've tried\nI looked at jose and jsonwebtoken..."

**Context-dependent patterns:**

When communication style varies systematically by project or task type, report the split rather than forcing a single rating. Example: "context-dependent: terse-direct for bug fixes and CLI tooling, detailed-structured for architecture and frontend work." Phase 3 orchestration resolves context-dependent splits by presenting the split to the user.

---

### 2. Decision Speed

`dimension_id: decision_speed`

**What we're measuring:** How quickly the developer makes choices when Claude presents options, alternatives, or trade-offs.

**Rating spectrum:**

| Rating | Description |
|--------|-------------|
| `fast-intuitive` | Decides immediately based on experience or gut feeling. Minimal deliberation. |
| `deliberate-informed` | Requests comparison or summary before deciding. Wants to understand trade-offs. |
| `research-first` | Delays decision to research independently. May leave and return with findings. |
| `delegator` | Defers to Claude's recommendation. Trusts the suggestion. |

**Signal patterns:**

1. **Response latency to options** -- How many messages between Claude presenting options and developer choosing. Immediate (same message or next) suggests fast-intuitive.
2. **Comparison requests** -- Presence of "compare these", "what are the trade-offs?", "pros and cons?" suggests deliberate-informed.
3. **External research indicators** -- Messages like "I looked into X and...", "according to the docs...", "I read that..." suggest research-first.
4. **Delegation language** -- "just pick one", "whatever you recommend", "your call", "go with the best option" suggests delegator.
5. **Decision reversal frequency** -- How often the developer changes a decision after making it. Frequent reversals may indicate fast-intuitive with low confidence.

**Detection heuristics:**

1. If developer selects options within 1-2 messages of presentation AND uses decisive language ("use X", "go with A") AND rarely asks for comparisons --> `fast-intuitive`
2. If developer requests trade-off analysis or comparison tables AND decides after receiving comparison AND asks clarifying questions --> `deliberate-informed`
3. If developer defers decisions with "let me look into this" AND returns with external information AND cites documentation or articles --> `research-first`
4. If developer uses delegation language (> 3 instances) AND rarely overrides Claude's choices AND says "sounds good" or "your call" --> `delegator`
5. If no clear pattern OR evidence is split across multiple styles --> classify as the dominant style with a context-dependent note

**Confidence scoring:**

- **HIGH:** 10+ decision points observed showing consistent pattern, same pattern across 2+ projects
- **MEDIUM:** 5-9 decision points, OR consistent within 1 project only
- **LOW:** < 5 decision points observed, OR mixed decision-making styles
- **UNSCORED:** 0 messages containing decision-relevant signals

**Example quotes:**

- **fast-intuitive:** "Use Tailwind. Next question." / "Option B, let's move on"
- **deliberate-informed:** "Can you compare Prisma vs Drizzle for this use case? I want to understand the migration story and type safety differences before I pick."
- **research-first:** "Hold off on the DB choice -- I want to read the Drizzle docs and check their GitHub issues first. I'll come back with a decision."
- **delegator:** "You know more about this than me. Whatever you recommend, go with it."

**Context-dependent patterns:**

Decision speed often varies by stakes. A developer may be fast-intuitive for styling choices but research-first for database or auth decisions. When this pattern is clear, report the split: "context-dependent: fast-intuitive for low-stakes (styling, naming), deliberate-informed for high-stakes (architecture, security)."

---

### 3. Explanation Depth

`dimension_id: explanation_depth`

**What we're measuring:** How much explanation the developer wants alongside code -- their preference for understanding vs. speed.

**Rating spectrum:**

| Rating | Description |
|--------|-------------|
| `code-only` | Wants working code with minimal or no explanation. Reads and understands code directly. |
| `concise` | Wants brief explanation of approach with code. Key decisions noted, not exhaustive. |
| `detailed` | Wants thorough walkthrough of the approach, reasoning, and code. Appreciates structure. |
| `educational` | Wants deep conceptual explanation. Treats interactions as learning opportunities. |

**Signal patterns:**

1. **Explicit depth requests** -- "just show me the code", "explain why", "teach me about X", "skip the explanation"
2. **Reaction to explanations** -- Does the developer skip past explanations? Ask for more detail? Say "too much"?
3. **Follow-up question depth** -- Surface-level follow-ups ("does it work?") vs. conceptual ("why this pattern over X?")
4. **Code comprehension signals** -- Does the developer reference implementation details in their messages? This suggests they read and understand code directly.
5. **"I know this" signals** -- Messages like "I'm familiar with X", "skip the basics", "I know how hooks work" indicate lower explanation preference.

**Detection heuristics:**

1. If developer says "just the code" or "skip the explanation" AND rarely asks follow-up conceptual questions AND references code details directly --> `code-only`
2. If developer accepts brief explanations without asking for more AND asks focused follow-ups about specific decisions --> `concise`
3. If developer asks "why" questions AND requests walkthroughs AND appreciates structured explanations --> `detailed`
4. If developer asks conceptual questions beyond the immediate task AND uses learning language ("I want to understand", "teach me") --> `educational`

**Confidence scoring:**

- **HIGH:** 10+ messages showing consistent preference, same preference across 2+ projects
- **MEDIUM:** 5-9 messages, OR consistent within 1 project only
- **LOW:** < 5 relevant messages, OR preferences shift between interactions
- **UNSCORED:** 0 messages with relevant signals

**Example quotes:**

- **code-only:** "Just give me the implementation. I'll read through it." / "Skip the explanation, show the code."
- **concise:** "Quick summary of the approach, then the code please." / "Why did you use a Map here instead of an object?"
- **detailed:** "Walk me through this step by step. I want to understand the auth flow before we implement it."
- **educational:** "Can you explain how JWT refresh token rotation works conceptually? I want to understand the security model, not just implement it."

**Context-dependent patterns:**

Explanation depth often correlates with domain familiarity. A developer may want code-only for well-known tech but educational for new domains. Report splits when observed: "context-dependent: code-only for React/TypeScript, detailed for database optimization."

---

### 4. Debugging Approach

`dimension_id: debugging_approach`

**What we're measuring:** How the developer approaches problems, errors, and unexpected behavior when working with Claude.

**Rating spectrum:**

| Rating | Description |
|--------|-------------|
| `fix-first` | Pastes error, wants it fixed. Minimal diagnosis interest. Results-oriented. |
| `diagnostic` | Shares error with context, wants to understand the cause before fixing. |
| `hypothesis-driven` | Investigates independently first, brings specific theories to Claude for validation. |
| `collaborative` | Wants to work through the problem step-by-step with Claude as a partner. |

**Signal patterns:**

1. **Error presentation style** -- Raw error paste only (fix-first) vs. error + "I think it might be..." (hypothesis-driven) vs. "Can you help me understand why..." (diagnostic)
2. **Pre-investigation indicators** -- Does the developer share what they already tried? Do they mention reading logs, checking state, or isolating the issue?
3. **Root cause interest** -- After a fix, does the developer ask "why did that happen?" or just move on?
4. **Step-by-step language** -- "Let's check X first", "what should we look at next?", "walk me through the debugging"
5. **Fix acceptance pattern** -- Does the developer immediately apply fixes or question them first?

**Detection heuristics:**

1. If developer pastes errors without context AND accepts fixes without root cause questions AND moves on immediately --> `fix-first`
2. If developer provides error context AND asks "why is this happening?" AND wants explanation with the fix --> `diagnostic`
3. If developer shares their own analysis AND proposes theories ("I think the issue is X because...") AND asks Claude to confirm or refute --> `hypothesis-driven`
4. If developer uses collaborative language ("let's", "what should we check?") AND prefers incremental diagnosis AND walks through problems together --> `collaborative`

**Confidence scoring:**

- **HIGH:** 10+ debugging interactions showing consistent approach, same approach across 2+ projects
- **MEDIUM:** 5-9 debugging interactions, OR consistent within 1 project only
- **LOW:** < 5 debugging interactions, OR approach varies significantly
- **UNSCORED:** 0 messages with debugging-relevant signals

**Example quotes:**

- **fix-first:** "Getting this error: TypeError: Cannot read properties of undefined. Fix it."
- **diagnostic:** "The API returns 500 when I send a POST to /users. Here's the request body and the server log. What's causing this?"
- **hypothesis-driven:** "I think the race condition is in the useEffect cleanup. I checked and the subscription isn't being cancelled on unmount. Can you confirm?"
- **collaborative:** "Let's debug this together. The test passes locally but fails in CI. What should we check first?"

**Context-dependent patterns:**

Debugging approach may vary by urgency. A developer might be fix-first under deadline pressure but hypothesis-driven during regular development. Note temporal patterns if detected.

---

### 5. UX Philosophy

`dimension_id: ux_philosophy`

**What we're measuring:** How the developer prioritizes user experience, design, and visual quality relative to functionality.

**Rating spectrum:**

| Rating | Description |
|--------|-------------|
| `function-first` | Get it working, polish later. Minimal UX concern during implementation. |
| `pragmatic` | Basic usability from the start. Nothing ugly or broken, but no design obsession. |
| `design-conscious` | Design and UX are treated as important as functionality. Attention to visual detail. |
| `backend-focused` | Primarily builds backend/CLI. Minimal frontend exposure or interest. |

**Signal patterns:**

1. **Design-related requests** -- Mentions of styling, layout, responsiveness, animations, color schemes, spacing
2. **Polish timing** -- Does the developer ask for visual polish during implementation or defer it?
3. **UI feedback specificity** -- Vague ("make it look better") vs. specific ("increase the padding to 16px, change the font weight to 600")
4. **Frontend vs. backend distribution** -- Ratio of frontend-focused requests to backend-focused requests
5. **Accessibility mentions** -- References to a11y, screen readers, keyboard navigation, ARIA labels

**Detection heuristics:**

1. If developer rarely mentions UI/UX AND focuses on logic, APIs, data AND defers styling ("we'll make it pretty later") --> `function-first`
2. If developer includes basic UX requirements AND mentions usability but not pixel-perfection AND balances form with function --> `pragmatic`
3. If developer provides specific design requirements AND mentions polish, animations, spacing AND treats UI bugs as seriously as logic bugs --> `design-conscious`
4. If developer works primarily on CLI tools, APIs, or backend systems AND rarely or never works on frontend AND messages focus on data, performance, infrastructure --> `backend-focused`

**Confidence scoring:**

- **HIGH:** 10+ messages with UX-relevant signals, same pattern across 2+ projects
- **MEDIUM:** 5-9 messages, OR consistent within 1 project only
- **LOW:** < 5 relevant messages, OR philosophy varies by project type
- **UNSCORED:** 0 messages with UX-relevant signals

**Example quotes:**

- **function-first:** "Just get the form working. We'll style it later." / "I don't care how it looks, I need the data flowing."
- **pragmatic:** "Make sure the loading state is visible and the error messages are clear. Standard styling is fine."
- **design-conscious:** "The button needs more breathing room -- add 12px vertical padding and make the hover state transition 200ms. Also check the contrast ratio."
- **backend-focused:** "I'm building a CLI tool. No UI needed." / "Add the REST endpoint, I'll handle the frontend separately."

**Context-dependent patterns:**

UX philosophy is inherently project-dependent. A developer building a CLI tool is necessarily backend-focused for that project. When possible, distinguish between project-driven and preference-driven patterns. If the developer only has backend projects, note that the rating reflects available data: "backend-focused (note: all analyzed projects are backend/CLI -- may not reflect frontend preferences)."

---

### 6. Vendor Philosophy

`dimension_id: vendor_philosophy`

**What we're measuring:** How the developer approaches choosing and evaluating libraries, frameworks, and external services.

**Rating spectrum:**

| Rating | Description |
|--------|-------------|
| `pragmatic-fast` | Uses what works, what Claude suggests, or what's fastest. Minimal evaluation. |
| `conservative` | Prefers well-known, battle-tested, widely-adopted options. Risk-averse. |
| `thorough-evaluator` | Researches alternatives, reads docs, compares features and trade-offs before committing. |
| `opinionated` | Has strong, pre-existing preferences for specific tools. Knows what they like. |

**Signal patterns:**

1. **Library selection language** -- "just use whatever", "is X the standard?", "I want to compare A vs B", "we're using X, period"
2. **Evaluation depth** -- Does the developer accept the first suggestion or ask for alternatives?
3. **Stated preferences** -- Explicit mentions of preferred tools, past experience, or tool philosophy
4. **Rejection patterns** -- Does the developer reject Claude's suggestions? On what basis (popularity, personal experience, docs quality)?
5. **Dependency attitude** -- "minimize dependencies", "no external deps", "add whatever we need" -- reveals philosophy about external code

**Detection heuristics:**

1. If developer accepts library suggestions without pushback AND uses phrases like "sounds good" or "go with that" AND rarely asks about alternatives --> `pragmatic-fast`
2. If developer asks about popularity, maintenance, community AND prefers "industry standard" or "battle-tested" AND avoids new/experimental --> `conservative`
3. If developer requests comparisons AND reads docs before deciding AND asks about edge cases, license, bundle size --> `thorough-evaluator`
4. If developer names specific libraries unprompted AND overrides Claude's suggestions AND expresses strong preferences --> `opinionated`

**Confidence scoring:**

- **HIGH:** 10+ vendor/library decisions observed, same pattern across 2+ projects
- **MEDIUM:** 5-9 decisions, OR consistent within 1 project only
- **LOW:** < 5 vendor decisions observed, OR pattern varies
- **UNSCORED:** 0 messages with vendor-selection signals

**Example quotes:**

- **pragmatic-fast:** "Use whatever ORM you recommend. I just need it working." / "Sure, Tailwind is fine."
- **conservative:** "Is Prisma the most widely used ORM for this? I want something with a large community." / "Let's stick with what most teams use."
- **thorough-evaluator:** "Before we pick a state management library, can you compare Zustand vs Jotai vs Redux Toolkit? I want to understand bundle size, API surface, and TypeScript support."
- **opinionated:** "We're using Drizzle, not Prisma. I've used both and Drizzle's SQL-like API is better for complex queries."

**Context-dependent patterns:**

Vendor philosophy may shift based on project importance or domain. Personal projects may use pragmatic-fast while professional projects use thorough-evaluator. Report the split if detected.

---

### 7. Frustration Triggers

`dimension_id: frustration_triggers`

**What we're measuring:** What causes visible frustration, correction, or negative emotional signals in the developer's messages to Claude.

**Rating spectrum:**

| Rating | Description |
|--------|-------------|
| `scope-creep` | Frustrated when Claude does things that were not asked for. Wants bounded execution. |
| `instruction-adherence` | Frustrated when Claude doesn't follow instructions precisely. Values exactness. |
| `verbosity` | Frustrated when Claude over-explains or is too wordy. Wants conciseness. |
| `regression` | Frustrated when Claude breaks working code while fixing something else. Values stability. |

**Signal patterns:**

1. **Correction language** -- "I didn't ask for that", "don't do X", "I said Y not Z", "why did you change this?"
2. **Repetition patterns** -- Repeating the same instruction with emphasis suggests instruction-adherence frustration
3. **Emotional tone shifts** -- Shift from neutral to terse, use of capitals, exclamation marks, explicit frustration words
4. **"Don't" statements** -- "don't add extra features", "don't explain so much", "don't touch that file" -- what they prohibit reveals what frustrates them
5. **Frustration recovery** -- How quickly the developer returns to neutral tone after a frustration event

**Detection heuristics:**

1. If developer corrects Claude for doing unrequested work AND uses language like "I only asked for X", "stop adding things", "stick to what I asked" --> `scope-creep`
2. If developer repeats instructions AND corrects specific deviations from stated requirements AND emphasizes precision ("I specifically said...") --> `instruction-adherence`
3. If developer asks Claude to be shorter AND skips explanations AND expresses annoyance at length ("too much", "just the answer") --> `verbosity`
4. If developer expresses frustration at broken functionality AND checks for regressions AND says "you broke X while fixing Y" --> `regression`

**Confidence scoring:**

- **HIGH:** 10+ frustration events showing consistent trigger pattern, same trigger across 2+ projects
- **MEDIUM:** 5-9 frustration events, OR consistent within 1 project only
- **LOW:** < 5 frustration events observed (note: low frustration count is POSITIVE -- it means the developer is generally satisfied, not that data is insufficient)
- **UNSCORED:** 0 messages with frustration signals (note: "no frustration detected" is a valid finding)

**Example quotes:**

- **scope-creep:** "I asked you to fix the login bug, not refactor the entire auth module. Revert everything except the bug fix."
- **instruction-adherence:** "I said to use a Map, not an object. I was specific about this. Please redo it with a Map."
- **verbosity:** "Way too much explanation. Just show me the code change, nothing else."
- **regression:** "The search was working fine before. Now after your 'fix' to the filter, search results are empty. Don't touch things I didn't ask you to change."

**Context-dependent patterns:**

Frustration triggers tend to be consistent across projects (personality-driven, not project-driven). However, their intensity may vary with project stakes. If multiple frustration triggers are observed, report the primary (most frequent) and note secondaries.

---

### 8. Learning Style

`dimension_id: learning_style`

**What we're measuring:** How the developer prefers to understand new concepts, tools, or patterns they encounter.

**Rating spectrum:**

| Rating | Description |
|--------|-------------|
| `self-directed` | Reads code directly, figures things out independently. Asks Claude specific questions. |
| `guided` | Asks Claude to explain relevant parts. Prefers guided understanding. |
| `documentation-first` | Reads official docs and tutorials before diving in. References documentation. |
| `example-driven` | Wants working examples to modify and learn from. Pattern-matching learner. |

**Signal patterns:**

1. **Learning initiation** -- Does the developer start by reading code, asking for explanation, requesting docs, or asking for examples?
2. **Reference to external sources** -- Mentions of documentation, tutorials, Stack Overflow, blog posts suggest documentation-first
3. **Example requests** -- "show me an example", "can you give me a sample?", "let me see how this looks in practice"
4. **Code-reading indicators** -- "I looked at the implementation", "I see that X calls Y", "from reading the code..."
5. **Explanation requests vs. code requests** -- Ratio of "explain X" to "show me X" messages

**Detection heuristics:**

1. If developer references reading code directly AND asks specific targeted questions AND demonstrates independent investigation --> `self-directed`
2. If developer asks Claude to explain concepts AND requests walkthroughs AND prefers Claude-mediated understanding --> `guided`
3. If developer cites documentation AND asks for doc links AND mentions reading tutorials or official guides --> `documentation-first`
4. If developer requests examples AND modifies provided examples AND learns by pattern matching --> `example-driven`

**Confidence scoring:**

- **HIGH:** 10+ learning interactions showing consistent preference, same preference across 2+ projects
- **MEDIUM:** 5-9 learning interactions, OR consistent within 1 project only
- **LOW:** < 5 learning interactions, OR preference varies by topic familiarity
- **UNSCORED:** 0 messages with learning-relevant signals

**Example quotes:**

- **self-directed:** "I read through the middleware code. The issue is that the token check happens after the rate limiter. Should those be swapped?"
- **guided:** "Can you walk me through how the auth flow works in this codebase? Start from the login request."
- **documentation-first:** "I read the Prisma docs on relations. Can you help me apply the many-to-many pattern from their guide to our schema?"
- **example-driven:** "Show me a working example of a protected API route with JWT validation. I'll adapt it for our endpoints."

**Context-dependent patterns:**

Learning style often varies with domain expertise. A developer may be self-directed in familiar domains but guided or example-driven in new ones. Report the split if detected: "context-dependent: self-directed for TypeScript/Node, example-driven for Rust/systems programming."

---

## Evidence Curation

### Evidence Format

Use the combined format for each evidence entry:

**Signal:** [pattern interpretation -- what the quote demonstrates] / **Example:** "[trimmed quote, ~100 characters]" -- project: [project name]

### Evidence Targets

- **3 evidence quotes per dimension** (24 total across all 8 dimensions)
- Select quotes that best illustrate the rated pattern
- Prefer quotes from different projects to demonstrate cross-project consistency
- When fewer than 3 relevant quotes exist, include what is available and note the evidence count

### Quote Truncation

- Trim quotes to the behavioral signal -- the part that demonstrates the pattern
- Target approximately 100 characters per quote
- Preserve the meaningful fragment, not the full message
- If the signal is in the middle of a long message, use "..." to indicate trimming
- Never include the full 500-character message when 50 characters capture the signal

### Project Attribution

- Every evidence quote must include the project name
- Project attribution enables verification and shows cross-project patterns
- Format: `-- project: [name]`

### Sensitive Content Exclusion (Layer 1)

The profiler agent must never select quotes containing any of the following patterns:

- `sk-` (API key prefixes)
- `Bearer ` (auth tokens)
- `password` (credentials)
- `secret` (secrets)
- `token` (when used as a credential value, not a concept discussion)
- `api_key` or `API_KEY` (API key references)
- Full absolute file paths containing usernames (e.g., `/Users/john/...`, `/home/john/...`)

**When sensitive content is found and excluded**, report as metadata in the analysis output:

```json
{
  "sensitive_excluded": [
    { "type": "api_key_pattern", "count": 2 },
    { "type": "file_path_with_username", "count": 1 }
  ]
}
```

This metadata enables defense-in-depth auditing. Layer 2 (regex filter in the write-profile step) provides a second pass, but the profiler should still avoid selecting sensitive quotes.

### Natural Language Priority

Weight natural language messages higher than:
- Pasted log output (detected by timestamps, repeated format strings, `[DEBUG]`, `[INFO]`, `[ERROR]`)
- Session context dumps (messages starting with "This session is being continued from a previous conversation")
- Large code pastes (messages where > 80% of content is inside code fences)

These message types are genuine but carry less behavioral signal. Deprioritize them when selecting evidence quotes.

---

## Recency Weighting

### Guideline

Recent sessions (last 30 days) should be weighted approximately 3x compared to older sessions when analyzing patterns.

### Rationale

Developer styles evolve. A developer who was terse six months ago may now provide detailed structured context. Recent behavior is a more accurate reflection of current working style.

### Application

1. When counting signals for confidence scoring, recent signals count 3x (e.g., 4 recent signals = 12 weighted signals)
2. When selecting evidence quotes, prefer recent quotes over older ones when both demonstrate the same pattern
3. When patterns conflict between recent and older sessions, the recent pattern takes precedence for the rating, but note the evolution: "recently shifted from terse-direct to conversational"
4. The 30-day window is relative to the analysis date, not a fixed date

### Edge Cases

- If ALL sessions are older than 30 days, apply no weighting (all sessions are equally stale)
- If ALL sessions are within the last 30 days, apply no weighting (all sessions are equally recent)
- The 3x weight is a guideline, not a hard multiplier -- use judgment when the weighted count changes a confidence threshold

---

## Thin Data Handling

### Message Thresholds

| Total Genuine Messages | Mode | Behavior |
|------------------------|------|----------|
| > 50 | `full` | Full analysis across all 8 dimensions. Questionnaire optional (user can choose to supplement). |
| 20-50 | `hybrid` | Analyze available messages. Score each dimension with confidence. Supplement with questionnaire for LOW/UNSCORED dimensions. |
| < 20 | `insufficient` | All dimensions scored LOW or UNSCORED. Recommend questionnaire fallback as primary profile source. Note: "insufficient session data for behavioral analysis." |

### Handling Insufficient Dimensions

When a specific dimension has insufficient data (even if total messages exceed thresholds):

- Set confidence to `UNSCORED`
- Set summary to: "Insufficient data -- no clear signals detected for this dimension."
- Set claude_instruction to a neutral fallback: "No strong preference detected. Ask the developer when this dimension is relevant."
- Set evidence_quotes to empty array `[]`
- Set evidence_count to `0`

### Questionnaire Supplement

When operating in `hybrid` mode, the questionnaire fills gaps for dimensions where session analysis produced LOW or UNSCORED confidence. The questionnaire-derived ratings use:
- **MEDIUM** confidence for strong, definitive picks
- **LOW** confidence for "it varies" or ambiguous selections

If session analysis and questionnaire agree on a dimension, confidence can be elevated (e.g., session LOW + questionnaire MEDIUM agreement = MEDIUM).

---

## Output Schema

The profiler agent must return JSON matching this exact schema, wrapped in `<analysis>` tags.

```json
{
  "profile_version": "1.0",
  "analyzed_at": "ISO-8601 timestamp",
  "data_source": "session_analysis",
  "projects_analyzed": ["project-name-1", "project-name-2"],
  "messages_analyzed": 0,
  "message_threshold": "full|hybrid|insufficient",
  "sensitive_excluded": [
    { "type": "string", "count": 0 }
  ],
  "dimensions": {
    "communication_style": {
      "rating": "terse-direct|conversational|detailed-structured|mixed",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [
        {
          "signal": "Pattern interpretation describing what the quote demonstrates",
          "quote": "Trimmed quote, approximately 100 characters",
          "project": "project-name"
        }
      ],
      "summary": "One to two sentence description of the observed pattern",
      "claude_instruction": "Imperative directive for Claude: 'Match structured communication style' not 'You tend to provide structured context'"
    },
    "decision_speed": {
      "rating": "fast-intuitive|deliberate-informed|research-first|delegator",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "explanation_depth": {
      "rating": "code-only|concise|detailed|educational",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "debugging_approach": {
      "rating": "fix-first|diagnostic|hypothesis-driven|collaborative",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "ux_philosophy": {
      "rating": "function-first|pragmatic|design-conscious|backend-focused",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "vendor_philosophy": {
      "rating": "pragmatic-fast|conservative|thorough-evaluator|opinionated",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "frustration_triggers": {
      "rating": "scope-creep|instruction-adherence|verbosity|regression",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    },
    "learning_style": {
      "rating": "self-directed|guided|documentation-first|example-driven",
      "confidence": "HIGH|MEDIUM|LOW|UNSCORED",
      "evidence_count": 0,
      "cross_project_consistent": true,
      "evidence_quotes": [],
      "summary": "string",
      "claude_instruction": "string"
    }
  }
}
```

### Schema Notes

- **`profile_version`**: Always `"1.0"` for this schema version
- **`analyzed_at`**: ISO-8601 timestamp of when the analysis was performed
- **`data_source`**: `"session_analysis"` for session-based profiling, `"questionnaire"` for questionnaire-only, `"hybrid"` for combined
- **`projects_analyzed`**: List of project names that contributed messages
- **`messages_analyzed`**: Total number of genuine user messages processed
- **`message_threshold`**: Which threshold mode was triggered (`full`, `hybrid`, `insufficient`)
- **`sensitive_excluded`**: Array of excluded sensitive content types with counts (empty array if none found)
- **`claude_instruction`**: Must be written in imperative form directed at Claude. This field is how the profile becomes actionable.
  - Good: "Provide structured responses with headers and numbered lists to match this developer's communication style."
  - Bad: "You tend to like structured responses."
  - Good: "Ask before making changes beyond the stated request -- this developer values bounded execution."
  - Bad: "The developer gets frustrated when you do extra work."

---

## Cross-Project Consistency

### Assessment

For each dimension, assess whether the observed pattern is consistent across the projects analyzed:

- **`cross_project_consistent: true`** -- Same rating would apply regardless of which project is analyzed. Evidence from 2+ projects shows the same pattern.
- **`cross_project_consistent: false`** -- Pattern varies by project. Include a context-dependent note in the summary.

### Reporting Splits

When `cross_project_consistent` is false, the summary must describe the split:

- "Context-dependent: terse-direct for CLI/backend projects (gsd-tools, api-server), detailed-structured for frontend projects (dashboard, landing-page)."
- "Context-dependent: fast-intuitive for familiar tech (React, Node), research-first for new domains (Rust, ML)."

The rating field should reflect the **dominant** pattern (most evidence). The summary describes the nuance.

### Phase 3 Resolution

Context-dependent splits are resolved during Phase 3 orchestration. The orchestrator presents the split to the developer and asks which pattern represents their general preference. Until resolved, Claude uses the dominant pattern with awareness of the context-dependent variation.

---

*Reference document version: 1.0*
*Dimensions: 8*
*Schema: profile_version 1.0*
