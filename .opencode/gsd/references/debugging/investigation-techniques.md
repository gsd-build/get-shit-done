
<overview>
These are systematic approaches to narrowing down bugs. Each technique is a tool in your debugging toolkit. The skill is knowing which tool to use when.
</overview>


<technique name="binary_search">
**When to use**: Large codebase, long execution path, or many possible failure points.

**How it works**: Cut the problem space in half repeatedly until you isolate the issue.

**In practice**:

1. **Identify the boundaries**: Where does it work? Where does it fail?
2. **Find the midpoint**: Add logging/testing at the middle of the execution path
3. **Determine which half**: Does the bug occur before or after the midpoint?
4. **Repeat**: Cut that half in half, test again
5. **Converge**: Keep halving until you find the exact line

<example>
Problem: API request returns wrong data

1. Test: Does the data leave the database correctly? YES
2. Test: Does the data reach the frontend correctly? NO
3. Test: Does the data leave the API route correctly? YES
4. Test: Does the data survive serialization? NO
5. **Found it**: Bug is in the serialization layer

You just eliminated 90% of the code in 4 tests.
</example>
</technique>

<technique name="comment_out_bisection">
**Variant**: Commenting out code to find the breaking change.

1. Comment out the second half of a function
2. Does it work now? The bug is in the commented section
3. Uncomment half of that, repeat
4. Converge on the problematic lines

**Warning**: Only works for code you can safely comment out. Don't use for initialization code.
</technique>


<technique name="rubber_duck">
**When to use**: You're stuck, confused, or your mental model doesn't match reality.

**How it works**: Explain the problem out loud (to a rubber duck, a colleague, or in writing) in complete detail.

**Why it works**: Articulating forces you to:
- Make assumptions explicit
- Notice gaps in your understanding
- Hear how convoluted your explanation sounds
- Realize what you haven't actually verified

**In practice**:

Write or say out loud:
1. "The system should do X"
2. "Instead it does Y"
3. "I think this is because Z"
4. "The code path is: A → B → C → D"
5. "I've verified that..." (List what you've actually tested)
6. "I'm assuming that..." (List assumptions)

Often you'll spot the bug mid-explanation: "Wait, I never actually verified that B returns what I think it does."

<example>
"So when the user clicks the button, it calls handleClick, which dispatches an action, which... wait, does the reducer actually handle this action type? Let me check... Oh. The reducer is looking for 'UPDATE_USER' but I'm dispatching 'USER_UPDATE'."
</example>
</technique>


<technique name="minimal_reproduction">
**When to use**: Complex system, many moving parts, unclear which part is failing.

**How it works**: Strip away everything until you have the smallest possible code that reproduces the bug.

**Why it works**:
- Removes distractions
- Isolates the actual issue
- Often reveals the bug during the stripping process
- Makes it easier to reason about

**Process**:

1. **Copy the failing code to a new file**
2. **Remove one piece** (a dependency, a function, a feature)
3. **Test**: Does it still reproduce?
   - YES: Keep it removed, continue
   - NO: Put it back, it's needed
4. **Repeat** until you have the bare minimum
5. **The bug is now obvious** in the stripped-down code

<example>
Start with: 500-line React component with 15 props, 8 hooks, 3 contexts

End with:
```jsx
function MinimalRepro() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(count + 1); // Bug: infinite loop, missing dependency array
  });

  return <div>{count}</div>;
}
```

The bug was hidden in complexity. Minimal reproduction made it obvious.
</example>
</technique>


<technique name="working_backwards">
**When to use**: You know what the correct output should be, but don't know why you're not getting it.

**How it works**: Start from the desired end state and trace backwards through the execution path.

**Process**:

1. **Define the desired output precisely**
2. **Ask**: What function produces this output?
3. **Test that function**: Give it the input it should receive. Does it produce correct output?
   - YES: The bug is earlier (wrong input to this function)
   - NO: The bug is here
4. **Repeat backwards** through the call stack
5. **Find the divergence point**: Where does expected vs actual first differ?

<example>
Problem: UI shows "User not found" when user exists

Trace backwards:
1. UI displays: `user.error` → Is this the right value to display? YES
2. Component receives: `user.error = "User not found"` → Is this correct? NO, should be null
3. API returns: `{ error: "User not found" }` → Why?
4. Database query: `SELECT * FROM users WHERE id = 'undefined'` → AH!
5. **Found it**: The user ID is 'undefined' (string) instead of a number

Working backwards revealed the bug was in how the ID was passed to the query.
</example>
</technique>


<technique name="differential_debugging">
**When to use**: Something used to work and now doesn't. A feature works in one environment but not another.

**How it works**: Compare the working vs broken states to find what's different.

**Questions to ask**:

**Time-based** (it worked, now it doesn't):
- What changed in the code since it worked?
- What changed in the environment? (Node version, OS, dependencies)
- What changed in the data? (Database schema, API responses)
- What changed in the configuration?

**Environment-based** (works in dev, fails in prod):
- What's different between environments?
- Configuration values
- Environment variables
- Network conditions
- Data volume
- Third-party service behavior

**Process**:

1. **Make a list of differences** between working and broken
2. **Test each difference** in isolation
3. **Find the difference that causes the failure**
4. **That difference reveals the root cause**

<example>
Works locally, fails in CI:

Differences:
- Node version: Same ✓
- Environment variables: Same ✓
- Timezone: Different! ✗

Test: Set local timezone to UTC (like CI)
Result: Now fails locally too

**Found it**: Date comparison logic assumes local timezone
</example>
</technique>


<technique name="observability_first">
**When to use**: Always. Before making any fix.

**Why it matters**: You can't fix what you can't see. Add visibility before changing behavior.

**Approaches**:

**1. Strategic logging**
```javascript
// Not this (useless):
console.log('in function');

// This (useful):
console.log('[handleSubmit] Input:', { email, password: '***' });
console.log('[handleSubmit] Validation result:', validationResult);
console.log('[handleSubmit] API response:', response);
```

**2. Assertion checks**
```javascript
function processUser(user) {
  console.assert(user !== null, 'User is null!');
  console.assert(user.id !== undefined, 'User ID is undefined!');
  // ... rest of function
}
```

**3. Timing measurements**
```javascript
console.time('Database query');
const result = await db.query(sql);
console.timeEnd('Database query');
```

**4. Stack traces at key points**
```javascript
console.log('[updateUser] Called from:', new Error().stack);
```

**The workflow**:
1. **Add logging/instrumentation** at suspected points
2. **Run the code**
3. **Observe the output**
4. **Form hypothesis** based on what you see
5. **Only then** make changes

Don't code in the dark. Light up the execution path first.
</technique>


<technique name="comment_out_everything">
**When to use**: Many possible interactions, unclear which code is causing the issue.

**How it works**:

1. **Comment out everything** in a function/file
2. **Verify the bug is gone**
3. **Uncomment one piece at a time**
4. **After each uncomment, test**
5. **When the bug returns**, you found the culprit

**Variant**: For config files, reset to defaults and add back one setting at a time.

<example>
Problem: Some middleware breaks requests, but you have 8 middleware functions.

```javascript
app.use(helmet()); // Uncomment, test → works
app.use(cors()); // Uncomment, test → works
app.use(compression()); // Uncomment, test → works
app.use(bodyParser.json({ limit: '50mb' })); // Uncomment, test → BREAKS

// Found it: Body size limit too high causes memory issues
```
</example>
</technique>


<technique name="git_bisect">
**When to use**: Feature worked in the past, broke at some unknown commit.

**How it works**: Binary search through git history to find the breaking commit.

**Process**:

```bash
git bisect start

git bisect bad

git bisect good abc123

git bisect bad

git bisect good

```

**Why it's powerful**: Turns "it broke sometime in the last 100 commits" into "it broke in commit abc123" in ~7 tests (log₂ 100 ≈ 7).

<example>
100 commits between working and broken
Manual testing: 100 commits to check
Git bisect: 7 commits to check

Time saved: Massive
</example>
</technique>


<decision_tree>
**Large codebase, many files**:
→ Binary search / Divide and conquer

**Confused about what's happening**:
→ Rubber duck debugging
→ Observability first (add logging)

**Complex system with many interactions**:
→ Minimal reproduction

**Know the desired output**:
→ Working backwards

**Used to work, now doesn't**:
→ Differential debugging
→ Git bisect

**Many possible causes**:
→ Comment out everything
→ Binary search

**Always**:
→ Observability first before making changes
</decision_tree>

<combining_techniques>
Often you'll use multiple techniques together:

1. **Differential debugging** to identify what changed
2. **Binary search** to narrow down where in the code
3. **Observability first** to add logging at that point
4. **Rubber duck** to articulate what you're seeing
5. **Minimal reproduction** to isolate just that behavior
6. **Working backwards** to find the root cause

Techniques compose. Use as many as needed.
</combining_techniques>
