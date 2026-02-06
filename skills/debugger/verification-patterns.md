# Skill: Verification Patterns

This skill is loaded when verifying bug fixes.

<verification_patterns>

## What "Verified" Means

A fix is verified when ALL of these are true:

1. **Original issue no longer occurs** - Exact reproduction steps now produce correct behavior
2. **You understand why the fix works** - Can explain the mechanism
3. **Related functionality still works** - Regression testing passes
4. **Fix works across environments** - Not just on your machine
5. **Fix is stable** - Works consistently, not "worked once"

## Reproduction Verification

**Before fixing:** Document exact steps to reproduce
**After fixing:** Execute the same steps exactly
**Test edge cases:** Related scenarios

**If you can't reproduce original bug:**
- You don't know if fix worked
- **Solution:** Revert fix. If bug comes back, you've verified fix addressed it.

## Regression Testing

1. Identify adjacent functionality (what else uses the code you changed?)
2. Test each adjacent area manually
3. Run existing tests (unit, integration, e2e)

## Stability Testing

**For intermittent bugs:**
```bash
for i in {1..100}; do
  npm test -- specific-test.js || echo "Failed on run $i"
done
```

If it fails even once, it's not fixed.

## Verification Checklist

```markdown
### Original Issue
- [ ] Can reproduce original bug before fix
- [ ] Have documented exact reproduction steps

### Fix Validation
- [ ] Original steps now work correctly
- [ ] Can explain WHY the fix works
- [ ] Fix is minimal and targeted

### Regression Testing
- [ ] Adjacent features work
- [ ] Existing tests pass
- [ ] Added test to prevent regression

### Environment Testing
- [ ] Works in development
- [ ] Works in staging/QA
- [ ] Works in production
```

## Verification Red Flags

Your verification might be wrong if:
- You can't reproduce original bug anymore
- Fix is large or complex
- You're not sure why it works
- It only works sometimes

</verification_patterns>
