
<overview>
Debugging is applied scientific method. You observe a phenomenon (the bug), form hypotheses about its cause, design experiments to test those hypotheses, and revise based on evidence. This isn't metaphorical - it's literal experimental science.
</overview>


<principle name="falsifiability">
A good hypothesis can be proven wrong. If you can't design an experiment that could disprove it, it's not a useful hypothesis.

**Bad hypotheses** (unfalsifiable):
- "Something is wrong with the state"
- "The timing is off"
- "There's a race condition somewhere"
- "The library is buggy"

**Good hypotheses** (falsifiable):
- "The user state is being reset because the component remounts when the route changes"
- "The API call completes after the component unmounts, causing the state update on unmounted component warning"
- "Two async operations are modifying the same array without locking, causing data loss"
- "The library's caching mechanism is returning stale data because our cache key doesn't include the timestamp"

**The difference**: Specificity. Good hypotheses make specific, testable claims.
</principle>

<how_to_form>
**Process for forming hypotheses**:

1. **Observe the behavior precisely**
   - Not "it's broken"
   - But "the counter shows 3 when clicking once, should show 1"

2. **Ask "What could cause this?"**
   - List every possible cause you can think of
   - Don't judge them yet, just brainstorm

3. **Make each hypothesis specific**
   - Not "state is wrong"
   - But "state is being updated twice because handleClick is called twice"

4. **Identify what evidence would support/refute each**
   - If hypothesis X is true, I should see Y
   - If hypothesis X is false, I should see Z

<example>
**Observation**: Button click sometimes saves data, sometimes doesn't.

**Vague hypothesis**: "The save isn't working reliably"
❌ Unfalsifiable, not specific

**Specific hypotheses**:
1. "The save API call is timing out when network is slow"
   - Testable: Check network tab for timeout errors
   - Falsifiable: If all requests complete successfully, this is wrong

2. "The save button is being double-clicked, and the second request overwrites with stale data"
   - Testable: Add logging to count clicks
   - Falsifiable: If only one click is registered, this is wrong

3. "The save is successful but the UI doesn't update because the response is being ignored"
   - Testable: Check if API returns success
   - Falsifiable: If UI updates on successful response, this is wrong
</example>
</how_to_form>


<experimental_design>
An experiment is a test that produces evidence supporting or refuting a hypothesis.

**Good experiments**:
- Test one hypothesis at a time
- Have clear success/failure criteria
- Produce unambiguous results
- Are repeatable

**Bad experiments**:
- Test multiple things at once
- Have unclear outcomes ("maybe it works better?")
- Rely on subjective judgment
- Can't be reproduced

<framework>
For each hypothesis, design an experiment:

**1. Prediction**: If hypothesis H is true, then I will observe X
**2. Test setup**: What do I need to do to test this?
**3. Measurement**: What exactly am I measuring?
**4. Success criteria**: What result confirms H? What result refutes H?
**5. Run the experiment**: Execute the test
**6. Observe the result**: Record what actually happened
**7. Conclude**: Does this support or refute H?

</framework>

<example>
**Hypothesis**: "The component is re-rendering excessively because the parent is passing a new object reference on every render"

**1. Prediction**: If true, the component will re-render even when the object's values haven't changed

**2. Test setup**:
   - Add console.log in component body to count renders
   - Add console.log in parent to track when object is created
   - Add useEffect with the object as dependency to log when it changes

**3. Measurement**: Count of renders and object creations

**4. Success criteria**:
   - Confirms H: Component re-renders match parent renders, object reference changes each time
   - Refutes H: Component only re-renders when object values actually change

**5. Run**: Execute the code with logging

**6. Observe**:
   ```
   [Parent] Created user object
   [Child] Rendering (1)
   [Parent] Created user object
   [Child] Rendering (2)
   [Parent] Created user object
   [Child] Rendering (3)
   ```

**7. Conclude**: CONFIRMED. New object every parent render → child re-renders
</example>
</experimental_design>


<evidence_quality>
Not all evidence is equal. Learn to distinguish strong from weak evidence.

**Strong evidence**:
- Directly observable ("I can see in the logs that X happens")
- Repeatable ("This fails every time I do Y")
- Unambiguous ("The value is definitely null, not undefined")
- Independent ("This happens even in a fresh browser with no cache")

**Weak evidence**:
- Hearsay ("I think I saw this fail once")
- Non-repeatable ("It failed that one time but I can't reproduce it")
- Ambiguous ("Something seems off")
- Confounded ("It works after I restarted the server and cleared the cache and updated the package")

<examples>
**Strong**:
```javascript
console.log('User ID:', userId); // Output: User ID: undefined
console.log('Type:', typeof userId); // Output: Type: undefined
```
✅ Direct observation, unambiguous

**Weak**:
"I think the user ID might not be set correctly sometimes"
❌ Vague, not verified, uncertain

**Strong**:
```javascript
for (let i = 0; i < 100; i++) {
  const result = processData(testData);
  if (result !== expected) {
    console.log('Failed on iteration', i);
  }
}
// Output: Failed on iterations: 3, 7, 12, 23, 31...
```
✅ Repeatable, shows pattern

**Weak**:
"It usually works, but sometimes fails"
❌ Not quantified, no pattern identified
</examples>
</evidence_quality>


<decision_point>
Don't act too early (premature fix) or too late (analysis paralysis).

**Act when you can answer YES to all**:

1. **Do you understand the mechanism?**
   - Not just "what fails" but "why it fails"
   - Can you explain the chain of events that produces the bug?

2. **Can you reproduce it reliably?**
   - Either always reproduces, or you understand the conditions that trigger it
   - If you can't reproduce, you don't understand it yet

3. **Do you have evidence, not just theory?**
   - You've observed the behavior directly
   - You've logged the values, traced the execution
   - You're not guessing

4. **Have you ruled out alternatives?**
   - You've considered other hypotheses
   - Evidence contradicts the alternatives
   - This is the most likely cause, not just the first idea

**Don't act if**:
- "I think it might be X" - Too uncertain
- "This could be the issue" - Not confident enough
- "Let me try changing Y and see" - Random changes, not hypothesis-driven
- "I'll fix it and if it works, great" - Outcome-based, not understanding-based

<example>
**Too early** (don't act):
- Hypothesis: "Maybe the API is slow"
- Evidence: None, just a guess
- Action: Add caching
- Result: Bug persists, now you have caching to debug too

**Right time** (act):
- Hypothesis: "API response is missing the 'status' field when user is inactive, causing the app to crash"
- Evidence:
  - Logged API response for active user: has 'status' field
  - Logged API response for inactive user: missing 'status' field
  - Logged app behavior: crashes on accessing undefined status
- Action: Add defensive check for missing status field
- Result: Bug fixed because you understood the cause
</example>
</decision_point>


<recovery>
You will be wrong sometimes. This is normal. The skill is recovering gracefully.

**When your hypothesis is disproven**:

1. **Acknowledge it explicitly**
   - "This hypothesis was wrong because [evidence]"
   - Don't gloss over it or rationalize
   - Intellectual honesty with yourself

2. **Extract the learning**
   - What did this experiment teach you?
   - What did you rule out?
   - What new information do you have?

3. **Revise your understanding**
   - Update your mental model
   - What does the evidence actually suggest?

4. **Form new hypotheses**
   - Based on what you now know
   - Avoid just moving to "second-guess" - use the evidence

5. **Don't get attached to hypotheses**
   - You're not your ideas
   - Being wrong quickly is better than being wrong slowly

<example>
**Initial hypothesis**: "The memory leak is caused by event listeners not being cleaned up"

**Experiment**: Check Chrome DevTools for listener counts
**Result**: Listener count stays stable, doesn't grow over time

**Recovery**:
1. ✅ "Event listeners are NOT the cause. The count doesn't increase."
2. ✅ "I've ruled out event listeners as the culprit"
3. ✅ "But the memory profile shows objects accumulating. What objects? Let me check the heap snapshot..."
4. ✅ "New hypothesis: Large arrays are being cached and never released. Let me test by checking the heap for array sizes..."

This is good debugging. Wrong hypothesis, quick recovery, better understanding.
</example>
</recovery>


<multiple_hypotheses>
Don't fall in love with your first hypothesis. Generate multiple alternatives.

**Strategy**: "Strong inference" - Design experiments that differentiate between competing hypotheses.

<example>
**Problem**: Form submission fails intermittently

**Competing hypotheses**:
1. Network timeout
2. Validation failure
3. Race condition with auto-save
4. Server-side rate limiting

**Design experiment that differentiates**:

Add logging at each stage:
```javascript
try {
  console.log('[1] Starting validation');
  const validation = await validate(formData);
  console.log('[1] Validation passed:', validation);

  console.log('[2] Starting submission');
  const response = await api.submit(formData);
  console.log('[2] Response received:', response.status);

  console.log('[3] Updating UI');
  updateUI(response);
  console.log('[3] Complete');
} catch (error) {
  console.log('[ERROR] Failed at stage:', error);
}
```

**Observe results**:
- Fails at [2] with timeout error → Hypothesis 1
- Fails at [1] with validation error → Hypothesis 2
- Succeeds but [3] has wrong data → Hypothesis 3
- Fails at [2] with 429 status → Hypothesis 4

**One experiment, differentiates between four hypotheses.**
</example>
</multiple_hypotheses>


<workflow>
```
1. Observe unexpected behavior
     ↓
2. Form specific hypotheses (plural)
     ↓
3. For each hypothesis: What would prove/disprove?
     ↓
4. Design experiment to test
     ↓
5. Run experiment
     ↓
6. Observe results
     ↓
7. Evaluate: Confirmed, refuted, or inconclusive?
     ↓
8a. If CONFIRMED → Design fix based on understanding
8b. If REFUTED → Return to step 2 with new hypotheses
8c. If INCONCLUSIVE → Redesign experiment or gather more data
```

**Key insight**: This is a loop, not a line. You'll cycle through multiple times. That's expected.
</workflow>


<pitfalls>

**Pitfall: Testing multiple hypotheses at once**
- You change three things and it works
- Which one fixed it? You don't know
- Solution: Test one hypothesis at a time

**Pitfall: Confirmation bias in experiments**
- You only look for evidence that confirms your hypothesis
- You ignore evidence that contradicts it
- Solution: Actively seek disconfirming evidence

**Pitfall: Acting on weak evidence**
- "It seems like maybe this could be..."
- Solution: Wait for strong, unambiguous evidence

**Pitfall: Not documenting results**
- You forget what you tested
- You repeat the same experiments
- Solution: Write down each hypothesis and its result

**Pitfall: Giving up on the scientific method**
- Under pressure, you start making random changes
- "Let me just try this..."
- Solution: Double down on rigor when pressure increases
</pitfalls>

<excellence>
**Great debuggers**:
- Form multiple competing hypotheses
- Design clever experiments that differentiate between them
- Follow the evidence wherever it leads
- Revise their beliefs when proven wrong
- Act only when they have strong evidence
- Understand the mechanism, not just the symptom

This is the difference between guessing and debugging.
</excellence>
