<purpose>
Socratic ideation workflow. Guides the developer through exploring an idea via probing questions,
offers mid-conversation research when useful, then routes crystallized outputs to GSD artifacts.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/references/domain-probes.md
</required_reading>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd-phase-researcher — Researches specific questions and returns concise findings
</available_agent_types>

<process>

## Step 1: Open the conversation

If a topic was provided, acknowledge it and begin exploring:
```
## Explore: {topic}

Let's think through this together. I'll ask questions to help clarify the idea
before we commit to any artifacts.
```

If no topic, ask:
```
## Explore

What's on your mind? This could be a feature idea, an architectural question,
a problem you're trying to solve, or something you're not sure about yet.
```

## Step 2: Socratic conversation (2-5 exchanges)

Guide the conversation using principles from `questioning.md` and `domain-probes.md`:

- Ask **one question at a time** (never a list of questions)
- Questions should probe: constraints, tradeoffs, users, scope, dependencies, risks
- Use domain-specific probes contextually when the topic touches a known domain
- Listen for signals: "or" / "versus" / "tradeoff" indicate competing priorities worth exploring
- Reflect back what you hear to confirm understanding before moving forward

**Conversation should feel natural, not formulaic.** Avoid rigid sequences. Follow the developer's energy — if they're excited about one aspect, go deeper there.

## Step 3: Mid-conversation research offer (after 2-3 exchanges)

If the conversation surfaces factual questions, technology comparisons, or unknowns that research could resolve, offer:

```
This touches on [specific question]. Want me to do a quick research pass before we continue?
This would take ~30 seconds and might surface useful context.

[Yes, research this] / [No, let's keep exploring]
```

If yes, spawn a research agent:
```
Task(
  prompt="Quick research: {specific_question}. Return 3-5 key findings, no more than 200 words.",
  subagent_type="gsd-phase-researcher"
)
```

Share findings and continue the conversation.

If the topic doesn't warrant research, skip this step entirely. **Don't force it.**

## Step 4: Crystallize outputs (after 3-6 exchanges)

When the conversation reaches natural conclusions or the developer signals readiness, propose outputs. Analyze the conversation to identify what was discussed and suggest **up to 4 outputs** from:

| Type | Destination | When to suggest |
|------|-------------|-----------------|
| Note | `.planning/notes/{slug}.md` | Observations, context, decisions worth remembering |
| Todo | `.planning/todos/pending/{slug}.md` | Concrete actionable tasks identified |
| Seed | `.planning/seeds/{slug}.md` | Forward-looking ideas with trigger conditions |
| Research question | `.planning/research/questions.md` (append) | Open questions that need deeper investigation |
| Requirement | `REQUIREMENTS.md` (append) | Clear requirements that emerged from discussion |
| New phase | `ROADMAP.md` (append) | Scope large enough to warrant its own phase |

Present suggestions:
```
Based on our conversation, I'd suggest capturing:

1. **Note:** "Authentication strategy decisions" — your reasoning about JWT vs sessions
2. **Todo:** "Evaluate Passport.js vs custom middleware" — the comparison you want to do
3. **Seed:** "OAuth2 provider support" — trigger: when user management phase starts

Create these? You can select specific ones or modify them.

[Create all] / [Let me pick] / [Skip — just exploring]
```

**Never write artifacts without explicit user selection.**

## Step 5: Write selected outputs

For each selected output, write the file:

- **Notes:** Create `.planning/notes/{slug}.md` with frontmatter (title, date, context)
- **Todos:** Create `.planning/todos/pending/{slug}.md` with frontmatter (title, date, priority)
- **Seeds:** Create `.planning/seeds/{slug}.md` with frontmatter (title, trigger_condition, planted_date)
- **Research questions:** Append to `.planning/research/questions.md`
- **Requirements:** Append to `.planning/REQUIREMENTS.md` with next available REQ ID
- **Phases:** Use existing `/gsd-add-phase` command via SlashCommand

Commit if `commit_docs` is enabled:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: capture exploration — {topic_slug}" --files {file_list}
```

## Step 6: Close

```
## Exploration Complete

**Topic:** {topic}
**Outputs:** {count} artifact(s) created
{list of created files}

Continue exploring with `/gsd-explore` or start working with `/gsd-next`.
```

</process>

<success_criteria>
- [ ] Socratic conversation follows questioning.md principles
- [ ] Questions asked one at a time, not in batches
- [ ] Research offered contextually (not forced)
- [ ] Up to 4 outputs proposed from conversation
- [ ] User explicitly selects which outputs to create
- [ ] Files written to correct destinations
- [ ] Commit respects commit_docs config
</success_criteria>
