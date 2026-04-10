# Sampling Methodology Reference

Guidance for selecting and applying sampling methods in SOC 2 control testing.

---

## Sampling Method Selection

### Statistical Sampling

Use statistical sampling when:

- Large populations (typically > 250 items)
- Quantitative conclusion required
- High-risk controls requiring precise deviation rate assessment
- Firm methodology requires statistical basis for conclusions

**Advantages:** Objective, defensible, quantifiable confidence level
**Disadvantages:** Requires larger samples, more complex execution

### Judgmental (Non-Statistical) Sampling

Use judgmental sampling when:

- Small to moderate populations
- Qualitative conclusion sufficient
- Lower-risk controls
- Professional judgment appropriate for the engagement

**Advantages:** Flexibility, smaller samples possible, efficiency
**Disadvantages:** Cannot quantify sampling risk, relies on auditor judgment

### Frequency-Based Sampling

The most common method for SOC 2 control testing. Sample sizes are driven by control operating frequency rather than statistical tables.

**Rationale:** SOC 2 controls typically operate at defined frequencies. The sample provides evidence that the control operated consistently throughout the period.

---

## Sample Selection Methods

### Random Selection

1. Number the population items sequentially
2. Use a random number generator to select items
3. Document the seed and method used

**Best for:** Large populations, automated controls, transaction-based controls

### Systematic Selection

1. Calculate the interval: Population Size ÷ Sample Size
2. Select a random start point
3. Select every nth item

**Best for:** Sequentially numbered populations, time-based selections

### Haphazard Selection

1. Select items without any conscious bias
2. Not truly random but acceptable for non-statistical sampling
3. Ensure coverage across the full period

**Best for:** Judgmental sampling, small populations, inquiry/observation tests

### Block Selection

1. Select contiguous blocks of items (e.g., all items from March)
2. Generally NOT recommended as primary method
3. Acceptable as supplementary selection

**Caution:** Block selection provides evidence only for the selected period, not the full audit period.

---

## Period Coverage (Type II)

For Type II examinations, sample items should cover the full audit period:

| Sample Size | Minimum Period Coverage |
|-------------|------------------------|
| 1-4 | Cover each quarter represented |
| 5-15 | Spread across all months; no more than 2 items from any single month |
| 16-30 | Spread across all months; proportional distribution |
| 31+ | Random or systematic selection ensures period coverage |

**Exception:** For annual or quarterly controls, the population is small enough that the sample naturally covers the period.

---

## IT Application Controls

IT application controls (automated, system-enforced) require a different approach:

### Testing Strategy

1. **Initial test:** Test 1 instance of the control operating correctly
2. **Change validation:** Verify no unauthorized changes to the application during the audit period via:
   - Change management logs
   - Configuration comparison
   - IT general control testing (CC8.1)
3. **If no changes:** 1 instance is sufficient for the full period
4. **If changes occurred:** Test 1 instance before and 1 instance after each change

### IPE (Information Produced by the Entity)

When relying on system-generated reports as evidence:

1. Verify the report parameters match the audit scope
2. Test the completeness of the report (reconcile totals, check date ranges)
3. Test the accuracy of the report (trace sample items to source)
4. Document the IPE testing in the work paper

---

## Dual-Purpose Testing

When a single test addresses both design and operating effectiveness:

1. **Design test:** Verify the control is properly designed to achieve the criteria
   - Policy/procedure exists and is appropriate
   - Control is assigned to appropriate personnel
   - Frequency is appropriate for the risk
2. **Operating test:** Verify the control operated as designed
   - Control was performed as described
   - Performed by authorized personnel
   - Performed timely per defined frequency
   - Evidence of operation retained

---

## Extended Testing

When initial sample results indicate possible control failure:

### Triggers for Extended Testing

- Exception rate exceeds expected deviation rate
- Nature of exceptions suggests systematic failure
- Compensating controls do not mitigate the risk

### Extended Testing Approach

1. **Increase sample size** — Typically double the original sample
2. **Expand scope** — Include additional periods or populations
3. **Alternative procedures** — Different test approach (e.g., reperformance instead of inspection)
4. **Root cause analysis** — Understand why exceptions occurred before expanding

### Documentation

When extending testing, document:
- Original sample results
- Rationale for extending
- Extended sample size and selection
- Combined results and conclusion

---

## Sampling Documentation Checklist

Every sampling memo should include:

- [ ] Control description and criteria addressed
- [ ] Population description and source
- [ ] Population size and completeness assertion
- [ ] Sampling method (statistical/judgmental/frequency-based)
- [ ] Justification for method selected
- [ ] Sample size determination (reference to tables or professional judgment)
- [ ] Risk level and tolerable deviation rate
- [ ] Expected deviation rate
- [ ] Confidence level (if statistical)
- [ ] Selection method (random/systematic/haphazard)
- [ ] Period coverage analysis
- [ ] Specific items selected (or random seed for reproducibility)
