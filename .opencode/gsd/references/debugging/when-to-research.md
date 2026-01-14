
<overview>
Debugging requires both reasoning about code and researching external knowledge. The skill is knowing when to use each. This guide helps you recognize signals that indicate you need external knowledge vs when you can reason through the problem with the code in front of you.
</overview>


<research_signals>

**1. Error messages you don't recognize**
- Stack traces from libraries you haven't used
- Cryptic system errors
- Framework-specific error codes

**Action**: Web search the exact error message in quotes
- Often leads to GitHub issues, Stack Overflow, or official docs
- Others have likely encountered this

<example>
Error: `EADDRINUSE: address already in use :::3000`

This is a system-level error. Research it:
- Web search: "EADDRINUSE address already in use"
- Learn: Port is already occupied by another process
- Solution: Find and kill the process, or use different port
</example>

**2. Library/framework behavior doesn't match expectations**
- You're using a library correctly (you think) but it's not working
- Documentation seems to contradict behavior
- Version-specific quirks

**Action**: Check official documentation and recent issues
- Use Context7 MCP for library docs
- Search GitHub issues for the library
- Check if there are breaking changes in recent versions

<example>
You're using `useEffect` in React but it's running on every render despite empty dependency array.

Research needed:
- Check React docs for useEffect rules
- Search: "useEffect running on every render"
- Discover: React 18 StrictMode runs effects twice in dev mode
</example>

**3. Domain knowledge gaps**
- Debugging authentication: need to understand OAuth flow
- Debugging database: need to understand indexes, query optimization
- Debugging networking: need to understand HTTP caching, CORS

**Action**: Research the domain concept, not just the specific bug
- Use MCP servers for domain knowledge
- Read official specifications
- Find authoritative guides

**4. Platform-specific behavior**
- "Works in Chrome but not Safari"
- "Works on Mac but not Windows"
- "Works in Node 16 but not Node 18"

**Action**: Research platform differences
- Browser compatibility tables
- Platform-specific documentation
- Known platform bugs

**5. Recent changes in ecosystem**
- Package update broke something
- New framework version behaves differently
- Deprecated API

**Action**: Check changelogs and migration guides
- Library CHANGELOG.md
- Migration guides
- "Breaking changes" documentation

</research_signals>


<reasoning_signals>

**1. The bug is in YOUR code**
- Not library behavior, not system issues
- Your business logic, your data structures
- Code you or your team wrote

**Approach**: Read the code, trace execution, add logging
- You have full access to the code
- You can modify it to add observability
- No external documentation will help

<example>
Bug: Shopping cart total calculates incorrectly

This is your logic:
```javascript
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

Don't research "shopping cart calculation bugs"
DO reason through it:
- Log each item's price and quantity
- Log the running sum
- Trace the logic step by step
</example>

**2. You have all the information needed**
- The bug is reproducible
- You can read all relevant code
- No external dependencies involved

**Approach**: Use investigation techniques
- Binary search to narrow down
- Minimal reproduction
- Working backwards
- Add observability

**3. It's a logic error, not a knowledge gap**
- Off-by-one errors
- Wrong conditional
- State management issue
- Data transformation bug

**Approach**: Trace the logic carefully
- Print intermediate values
- Check assumptions
- Verify each step

**4. The answer is in the behavior, not the documentation**
- "What is this function actually doing?"
- "Why is this value null?"
- "When does this code execute?"

**Approach**: Observe the actual behavior
- Add logging
- Use a debugger
- Test with different inputs

</reasoning_signals>


<research_how>

**Web Search - When and How**

**When**:
- Error messages
- Library-specific questions
- "How to X in framework Y"
- Troubleshooting platform issues

**How**:
- Use exact error messages in quotes: `"Cannot read property 'map' of undefined"`
- Include framework/library version: `"react 18 useEffect behavior"`
- Add "github issue" for known bugs: `"prisma connection pool github issue"`
- Add year for recent changes: `"nextjs 14 middleware 2024"`

**Good search queries**:
- `"ECONNREFUSED" node.js postgres`
- `"Maximum update depth exceeded" react hooks`
- `typescript generic constraints examples`

**Bad search queries**:
- `my code doesn't work` (too vague)
- `bug in react` (too broad)
- `help` (useless)

**Context7 MCP - When and How**

**When**:
- Need API reference
- Understanding library concepts
- Finding specific function signatures
- Learning correct usage patterns

**How**:
```
Use mcp__context7__resolve-library-id with library name
Then mcp__context7__get-library-docs with library ID
Ask specific questions about the library
```

**Good uses**:
- "How do I use Prisma transactions?"
- "What are the parameters for stripe.customers.create?"
- "How does Express middleware error handling work?"

**Bad uses**:
- "Fix my bug" (too vague, Context7 provides docs not debugging)
- "Why isn't my code working?" (need to research specific concepts, not general debugging)

**GitHub Issues Search**

**When**:
- Experiencing behavior that seems like a bug
- Library not working as documented
- Looking for workarounds

**How**:
- Search in the library's GitHub repo
- Include relevant keywords
- Check both open and closed issues
- Look for issues with "bug" or "regression" labels

**Official Documentation**

**When**:
- Learning how something should work
- Checking if you're using API correctly
- Understanding configuration options
- Finding migration guides

**How**:
- Start with official docs, not blog posts
- Check version-specific docs
- Read examples and guides, not just API reference
- Look for "Common Pitfalls" or "Troubleshooting" sections

</research_how>


<balance>

**The research trap**: Spending hours reading docs about topics tangential to your bug
- You think it's a caching issue, so you read all about cache invalidation
- But the actual bug is a typo in a variable name

**The reasoning trap**: Spending hours reading code when the answer is well-documented
- You're debugging why auth doesn't work
- The docs clearly explain the setup you missed
- You could have found it in 5 minutes of reading

**The balance**:

1. **Start with quick research** (5-10 minutes)
   - Search the error message
   - Check official docs for the feature you're using
   - Skim recent issues

2. **If research doesn't yield answers, switch to reasoning**
   - Add logging
   - Trace execution
   - Form hypotheses

3. **If reasoning reveals knowledge gaps, research those specific gaps**
   - "I need to understand how WebSocket reconnection works"
   - "I need to know if this library supports transactions"

4. **Alternate as needed**
   - Research → reveals what to investigate
   - Reasoning → reveals what to research
   - Keep switching based on what you learn

<example>
**Bug**: Real-time updates stop working after 1 hour

**Start with research** (5 min):
- Search: "websocket connection drops after 1 hour"
- Find: Common issue with load balancers having connection timeouts

**Switch to reasoning**:
- Check if you're using a load balancer: YES
- Check load balancer timeout setting: 3600 seconds (1 hour)
- Hypothesis: Load balancer is killing the connection

**Quick research**:
- Search: "websocket load balancer timeout fix"
- Find: Implement heartbeat/ping to keep connection alive

**Reasoning**:
- Check if library supports heartbeat: YES
- Implement ping every 30 seconds
- Test: Connection stays alive for 3+ hours

**Total time**: 20 minutes (research: 10 min, reasoning: 10 min)
**Success**: Found and fixed the issue

vs

**Wrong approach**: Spend 2 hours reading WebSocket spec
- Learned a lot about WebSocket protocol
- Didn't solve the problem (it was a config issue)
</example>

</balance>


<decision_tree>
```
Is this a error message I don't recognize?
├─ YES → Web search the error message
└─ NO ↓

Is this library/framework behavior I don't understand?
├─ YES → Check docs (Context7 or official docs)
└─ NO ↓

Is this code I/my team wrote?
├─ YES → Reason through it (logging, tracing, hypothesis testing)
└─ NO ↓

Is this a platform/environment difference?
├─ YES → Research platform-specific behavior
└─ NO ↓

Can I observe the behavior directly?
├─ YES → Add observability and reason through it
└─ NO → Research the domain/concept first, then reason
```
</decision_tree>


<red_flags>

**You're researching too much if**:
- You've read 20 blog posts but haven't looked at your code
- You understand the theory but haven't traced your actual execution
- You're learning about edge cases that don't apply to your situation
- You've been reading for 30+ minutes without testing anything

**You're reasoning too much if**:
- You've been staring at code for an hour without progress
- You keep finding things you don't understand and guessing
- You're debugging library internals (that's research territory)
- The error message is clearly from a library you don't know

**You're doing it right if**:
- You alternate between research and reasoning
- Each research session answers a specific question
- Each reasoning session tests a specific hypothesis
- You're making steady progress toward understanding

</red_flags>


<mindset>

**Good researchers ask**:
- "What specific question do I need answered?"
- "Where is the authoritative source for this?"
- "Is this a known issue or unique to my code?"
- "What version-specific information do I need?"

**Good reasoners ask**:
- "What is actually happening in my code?"
- "What am I assuming that might be wrong?"
- "How can I observe this behavior directly?"
- "What experiment would test my hypothesis?"

**Great debuggers do both**:
- Research to fill knowledge gaps
- Reason to understand actual behavior
- Switch fluidly based on what they learn
- Never stuck in one mode

**The goal**: Minimum time to maximum understanding.
- Research what you don't know
- Reason through what you can observe
- Fix what you understand
</mindset>
