---
name: occams-razor
description: Find simplest explanation that fits all the facts
---

<objective>
Apply Occam's Razor to evaluate explanations.

Among competing explanations, prefer the one with fewest assumptions. Simplest != easiest; simplest = fewest moving parts.
</objective>

<process>
1. List all possible explanations or approaches
2. For each, count the assumptions required
3. Identify which assumptions are actually supported by evidence
4. Eliminate explanations requiring unsupported assumptions
5. Select the simplest that still explains all observed facts
</process>

<output_format>
**Candidate Explanations:**
1. [Explanation]: Requires assumptions [A, B, C]
2. [Explanation]: Requires assumptions [D, E]
3. [Explanation]: Requires assumptions [F]

**Evidence Check:**
- Assumption A: [supported/unsupported]
- Assumption B: [supported/unsupported]
...

**Simplest Valid Explanation:**
[The one with fewest unsupported assumptions]

**Why This Wins:**
[What it explains without extra machinery]
</output_format>

<success_criteria>
- Enumerates all plausible explanations
- Makes assumptions explicit and countable
- Distinguishes supported from unsupported assumptions
- Doesn't oversimplify (must fit ALL facts)
- Reduces complexity without losing explanatory power
</success_criteria>
