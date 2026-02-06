# Skill: Investigation Techniques

This skill is loaded for complex debugging requiring systematic investigation.

<investigation_techniques>

## Binary Search / Divide and Conquer

**When:** Large codebase, long execution path, many possible failure points.

**How:** Cut problem space in half repeatedly until you isolate the issue.

1. Identify boundaries (where works, where fails)
2. Add logging/testing at midpoint
3. Determine which half contains the bug
4. Repeat until you find exact line

## Rubber Duck Debugging

**When:** Stuck, confused, mental model doesn't match reality.

**How:** Explain the problem out loud in complete detail.

Write or say:
1. "The system should do X"
2. "Instead it does Y"
3. "I think this is because Z"
4. "The code path is: A -> B -> C -> D"
5. "I've verified that..." (list what you tested)
6. "I'm assuming that..." (list assumptions)

## Minimal Reproduction

**When:** Complex system, many moving parts, unclear which part fails.

**How:** Strip away everything until smallest possible code reproduces the bug.

1. Copy failing code to new file
2. Remove one piece (dependency, function, feature)
3. Test: Does it still reproduce? YES = keep removed. NO = put back.
4. Repeat until bare minimum

## Working Backwards

**When:** You know correct output, don't know why you're not getting it.

**How:** Start from desired end state, trace backwards through call stack.

## Differential Debugging

**When:** Something used to work and now doesn't. Works in one environment but not another.

**Time-based:** What changed in code, environment, data, configuration?
**Environment-based:** Configuration values, env vars, network, data volume?

## Git Bisect

**When:** Feature worked in past, broke at unknown commit.

```bash
git bisect start
git bisect bad              # Current commit is broken
git bisect good abc123      # This commit worked
# Git checks out middle commit, repeat until found
```

## Technique Selection

| Situation | Technique |
|-----------|-----------|
| Large codebase, many files | Binary search |
| Confused about what's happening | Rubber duck, Observability |
| Complex system, many interactions | Minimal reproduction |
| Know the desired output | Working backwards |
| Used to work, now doesn't | Differential debugging, Git bisect |
| Many possible causes | Comment out everything |

</investigation_techniques>
