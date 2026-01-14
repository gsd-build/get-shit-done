
<overview>
The most common debugging mistake: declaring victory too early. A fix isn't complete until it's verified. This document defines what "verified" means and provides systematic approaches to proving your fix works.
</overview>


<definition>
A fix is verified when:

1. **The original issue no longer occurs**
   - The exact reproduction steps now produce correct behavior
   - Not "it seems better" - it definitively works

2. **You understand why the fix works**
   - You can explain the mechanism
   - Not "I changed X and it worked" but "X was causing Y, and changing it prevents Y"

3. **Related functionality still works**
   - You haven't broken adjacent features
   - Regression testing passes

4. **The fix works across environments**
   - Not just on your machine
   - In production-like conditions

5. **The fix is stable**
   - Works consistently, not intermittently
   - Not just "worked once" but "works reliably"

**Anything less than this is not verified.**
</definition>

<examples>
❌ **Not verified**:
- "I ran it once and it didn't crash"
- "It seems to work now"
- "The error message is gone" (but is the behavior correct?)
- "Works on my machine"

✅ **Verified**:
- "I ran the original reproduction steps 20 times - zero failures"
- "The data now saves correctly and I can retrieve it"
- "All existing tests pass, plus I added a test for this scenario"
- "Verified in dev, staging, and production environments"
</examples>


<pattern name="reproduction_verification">
**The golden rule**: If you can't reproduce the bug, you can't verify it's fixed.

**Process**:

1. **Before fixing**: Document exact steps to reproduce
   ```markdown
   Reproduction steps:
   1. Login as admin user
   2. Navigate to /settings
   3. Click "Export Data" button
   4. Observe: Error "Cannot read property 'data' of undefined"
   ```

2. **After fixing**: Execute the same steps exactly
   ```markdown
   Verification:
   1. Login as admin user ✓
   2. Navigate to /settings ✓
   3. Click "Export Data" button ✓
   4. Observe: CSV downloads successfully ✓
   ```

3. **Test edge cases** related to the bug
   ```markdown
   Additional tests:
   - Export with empty data set ✓
   - Export with 1000+ records ✓
   - Export while another request is pending ✓
   ```

**If you can't reproduce the original bug**:
- You don't know if your fix worked
- Maybe it's still broken
- Maybe your "fix" did nothing
- Maybe you fixed a different bug

**Solution**: Revert your fix. If the bug comes back, you've verified your fix addressed it.
</pattern>


<pattern name="regression_testing">
**The problem**: You fix one thing, break another.

**Why it happens**:
- Your fix changed shared code
- Your fix had unintended side effects
- Your fix broke an assumption other code relied on

**Protection strategy**:

**1. Identify adjacent functionality**
- What else uses the code you changed?
- What features depend on this behavior?
- What workflows include this step?

**2. Test each adjacent area**
- Manually test the happy path
- Check error handling
- Verify data integrity

**3. Run existing tests**
- Unit tests for the module
- Integration tests for the feature
- End-to-end tests for the workflow

<example>
**Fix**: Changed how user sessions are stored (from memory to database)

**Adjacent functionality to verify**:
- Login still works ✓
- Logout still works ✓
- Session timeout still works ✓
- Concurrent logins are handled correctly ✓
- Session data persists across server restarts ✓ (new capability)
- Password reset flow still works ✓
- OAuth login still works ✓

If you only tested "login works", you missed 6 other things that could break.
</example>
</pattern>


<pattern name="test_first_debugging">
**Strategy**: Write a failing test that reproduces the bug, then fix until the test passes.

**Benefits**:
- Proves you can reproduce the bug
- Provides automatic verification
- Prevents regression in the future
- Forces you to understand the bug precisely

**Process**:

1. **Write a test that reproduces the bug**
   ```javascript
   test('should handle undefined user data gracefully', () => {
     const result = processUserData(undefined);
     expect(result).toBe(null); // Currently throws error
   });
   ```

2. **Verify the test fails** (confirms it reproduces the bug)
   ```
   ✗ should handle undefined user data gracefully
     TypeError: Cannot read property 'name' of undefined
   ```

3. **Fix the code**
   ```javascript
   function processUserData(user) {
     if (!user) return null; // Add defensive check
     return user.name;
   }
   ```

4. **Verify the test passes**
   ```
   ✓ should handle undefined user data gracefully
   ```

5. **Test is now regression protection**
   - If someone breaks this again, the test will catch it

**When to use**:
- Clear, reproducible bugs
- Code that has test infrastructure
- Bugs that could recur

**When not to use**:
- Exploratory debugging (you don't understand the bug yet)
- Infrastructure issues (can't easily test)
- One-off data issues
</pattern>


<pattern name="environment_verification">
**The trap**: "Works on my machine"

**Reality**: Production is different.

**Differences to consider**:

**Environment variables**:
- `NODE_ENV=development` vs `NODE_ENV=production`
- Different API keys
- Different database connections
- Different feature flags

**Dependencies**:
- Different package versions (if not locked)
- Different system libraries
- Different Node/Python/etc versions

**Data**:
- Volume (100 records locally, 1M in production)
- Quality (clean test data vs messy real data)
- Edge cases (nulls, special characters, extreme values)

**Network**:
- Latency (local: 5ms, production: 200ms)
- Reliability (local: perfect, production: occasional failures)
- Firewalls, proxies, load balancers

**Verification checklist**:
```markdown
- [ ] Works locally (dev environment)
- [ ] Works in Docker container (mimics production)
- [ ] Works in staging (production-like)
- [ ] Works in production (the real test)
```

<example>
**Bug**: Batch processing fails in production but works locally

**Investigation**:
- Local: 100 test records, completes in 2 seconds
- Production: 50,000 records, times out at 30 seconds

**The difference**: Volume. Local testing didn't catch it.

**Fix verification**:
- Test locally with 50,000 records
- Verify performance in staging
- Monitor first production run
- Confirm all environments work
</example>
</pattern>


<pattern name="stability_testing">
**The problem**: It worked once, but will it work reliably?

**Intermittent bugs are the worst**:
- Hard to reproduce
- Hard to verify fixes
- Easy to declare fixed when they're not

**Verification strategies**:

**1. Repeated execution**
```bash
for i in {1..100}; do
  npm test -- specific-test.js || echo "Failed on run $i"
done
```

If it fails even once, it's not fixed.

**2. Stress testing**
```javascript
// Run many instances in parallel
const promises = Array(50).fill().map(() =>
  processData(testInput)
);

const results = await Promise.all(promises);
// All results should be correct
```

**3. Soak testing**
- Run for extended period (hours, days)
- Monitor for memory leaks, performance degradation
- Ensure stability over time

**4. Timing variations**
```javascript
// For race conditions, add random delays
async function testWithRandomTiming() {
  await randomDelay(0, 100);
  triggerAction1();
  await randomDelay(0, 100);
  triggerAction2();
  await randomDelay(0, 100);
  verifyResult();
}

// Run this 1000 times
```

<example>
**Bug**: Race condition in file upload

**Weak verification**:
- Upload one file
- "It worked!"
- Ship it

**Strong verification**:
- Upload 100 files sequentially: all succeed ✓
- Upload 20 files in parallel: all succeed ✓
- Upload while navigating away: handles correctly ✓
- Upload, cancel, upload again: works ✓
- Run all tests 50 times: zero failures ✓

Now it's verified.
</example>
</pattern>


<checklist>
Copy this checklist when verifying a fix:

```markdown

### Original Issue
- [ ] Can reproduce the original bug before the fix
- [ ] Have documented exact reproduction steps

### Fix Validation
- [ ] Original reproduction steps now work correctly
- [ ] Can explain WHY the fix works
- [ ] Fix is minimal and targeted

### Regression Testing
- [ ] Adjacent feature 1: [name] works
- [ ] Adjacent feature 2: [name] works
- [ ] Adjacent feature 3: [name] works
- [ ] Existing tests pass
- [ ] Added test to prevent regression

### Environment Testing
- [ ] Works in development
- [ ] Works in staging/QA
- [ ] Works in production
- [ ] Tested with production-like data volume

### Stability Testing
- [ ] Tested multiple times (n=__): zero failures
- [ ] Tested edge cases: [list them]
- [ ] Tested under load/stress: stable

### Documentation
- [ ] Code comments explain the fix
- [ ] Commit message explains the root cause
- [ ] If needed, updated user-facing docs

### Sign-off
- [ ] I understand why this bug occurred
- [ ] I understand why this fix works
- [ ] I've verified it works in all relevant environments
- [ ] I've tested for regressions
- [ ] I'm confident this won't recur
```

**Do not merge/deploy until all checkboxes are checked.**
</checklist>


<distrust>
Your verification might be wrong if:

**1. You can't reproduce the original bug anymore**
- Maybe you forgot how
- Maybe the environment changed
- Maybe you're testing the wrong thing
- **Action**: Document reproduction steps FIRST, before fixing

**2. The fix is large or complex**
- Changed 10 files, modified 200 lines
- Too many moving parts
- **Action**: Simplify the fix, then verify each piece

**3. You're not sure why it works**
- "I changed X and the bug went away"
- But you can't explain the mechanism
- **Action**: Investigate until you understand, then verify

**4. It only works sometimes**
- "Usually works now"
- "Seems more stable"
- **Action**: Not verified. Find and fix the remaining issue

**5. You can't test in production-like conditions**
- Only tested locally
- Different data, different scale
- **Action**: Set up staging environment or use production data in dev

**Red flag phrases**:
- "It seems to work"
- "I think it's fixed"
- "Looks good to me"
- "Can't reproduce anymore" (but you never could reliably)

**Trust-building phrases**:
- "I've verified 50 times - zero failures"
- "All tests pass including new regression test"
- "Deployed to staging, tested for 3 days, no issues"
- "Root cause was X, fix addresses X directly, verified by Y"
</distrust>


<mindset>
**Assume your fix is wrong until proven otherwise.**

This isn't pessimism - it's professionalism.

**Questions to ask yourself**:
- "How could this fix fail?"
- "What haven't I tested?"
- "What am I assuming?"
- "Would this survive production?"

**The cost of insufficient verification**:
- Bug returns in production
- User frustration
- Lost trust
- Emergency debugging sessions
- Rollbacks

**The benefit of thorough verification**:
- Confidence in deployment
- Prevention of regressions
- Trust from team
- Learning from the investigation

**Verification is not optional. It's the most important part of debugging.**
</mindset>
