# Prompt Caching Best Practices

When building applications on the GSD SDK, system prompts that include workflow instructions (executor prompts, planner context, verification rules) are large and stable across requests. Prompt caching avoids re-processing these on every API call.

## Recommended: 1-Hour Cache TTL

Use `cache_control` with a 1-hour TTL on system prompts that include GSD workflow content:

```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: [
    {
      type: 'text',
      text: executorPrompt, // GSD workflow instructions — large, stable across requests
      cache_control: { type: 'ephemeral', ttl: '1h' },
    },
  ],
  messages,
});
```

### Why 1 hour instead of the default 5 minutes

GSD workflows involve human review pauses between phases — discussing results, checking verification output, deciding next steps. The default 5-minute TTL expires during these pauses, forcing full re-processing of the system prompt on the next request.

With a 1-hour TTL:

- **Cost:** 2x write cost on cache miss (vs. 1.25x for 5-minute TTL)
- **Break-even:** Pays for itself after 3 cache hits per hour
- **GSD usage pattern:** Phase execution involves dozens of requests per hour, well above break-even
- **Cache refresh:** Every cache hit resets the TTL at no cost, so active sessions maintain warm cache throughout

### Which prompts to cache

| Prompt | Cache? | Reason |
|--------|--------|--------|
| Executor system prompt | Yes | Large (~10K tokens), identical across tasks in a phase |
| Planner system prompt | Yes | Large, stable within a planning session |
| Verifier system prompt | Yes | Large, stable within a verification session |
| User/task-specific content | No | Changes per request |

### SDK integration point

In `session-runner.ts`, the `systemPrompt.append` field carries the executor/planner prompt. When using the Claude API directly (outside the Agent SDK's `query()` helper), wrap this content with `cache_control`:

```typescript
// In runPlanSession / runPhaseStepSession, the systemPrompt is:
systemPrompt: {
  type: 'preset',
  preset: 'claude_code',
  append: executorPrompt, // <-- this is the content to cache
}

// When calling the API directly, convert to:
system: [
  {
    type: 'text',
    text: executorPrompt,
    cache_control: { type: 'ephemeral', ttl: '1h' },
  },
]
```

## References

- [Anthropic Prompt Caching documentation](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Extended caching (1-hour TTL)](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching#extended-caching)
