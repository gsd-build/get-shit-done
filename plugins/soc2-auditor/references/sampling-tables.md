# Attribute Sampling Tables

Statistical sampling tables for SOC 2 control testing. Based on attribute sampling methodology per AICPA Audit Sampling Guide.

---

## Frequency-Based Sample Sizes

For controls that operate at a defined frequency, use the following minimum sample sizes. These are based on professional guidance and assume no expected deviations.

| Control Frequency | Population Size (Type II - 12 months) | Sample Size (Low Risk) | Sample Size (Moderate Risk) | Sample Size (High Risk) |
|-------------------|----------------------------------------|------------------------|-----------------------------|------------------------|
| Annual | 1 | 1 | 1 | 1 |
| Quarterly | 4 | 2 | 3 | 4 |
| Monthly | 12 | 2 | 3 | 5 |
| Semi-monthly | 24 | 3 | 5 | 8 |
| Weekly | 52 | 5 | 9 | 15 |
| Daily | 250+ | 20 | 30 | 40 |
| Multiple per day | 1000+ | 25 | 40 | 60 |
| Per occurrence | Varies | 25 | 40 | 60 |

**Type I Note:** For Type I examinations (point-in-time), sample size = 1 for all frequencies. The test is design effectiveness only.

---

## Statistical Attribute Sampling Tables

### 95% Confidence Level

#### Expected Deviation Rate = 0%

| Tolerable Deviation Rate | Sample Size |
|--------------------------|-------------|
| 1% | 300 |
| 2% | 150 |
| 3% | 100 |
| 4% | 75 |
| 5% | 60 |
| 6% | 50 |
| 7% | 43 |
| 8% | 38 |
| 9% | 34 |
| 10% | 30 |
| 15% | 20 |
| 20% | 15 |

#### Expected Deviation Rate = 1%

| Tolerable Deviation Rate | Sample Size |
|--------------------------|-------------|
| 2% | 300 |
| 3% | 150 |
| 4% | 100 |
| 5% | 93 |
| 6% | 78 |
| 7% | 60 |
| 8% | 51 |
| 9% | 46 |
| 10% | 40 |
| 15% | 25 |
| 20% | 18 |

#### Expected Deviation Rate = 2%

| Tolerable Deviation Rate | Sample Size |
|--------------------------|-------------|
| 3% | 300 |
| 4% | 200 |
| 5% | 132 |
| 6% | 88 |
| 7% | 75 |
| 8% | 65 |
| 9% | 55 |
| 10% | 50 |
| 15% | 30 |
| 20% | 20 |

### 90% Confidence Level

#### Expected Deviation Rate = 0%

| Tolerable Deviation Rate | Sample Size |
|--------------------------|-------------|
| 1% | 230 |
| 2% | 115 |
| 3% | 77 |
| 4% | 58 |
| 5% | 46 |
| 6% | 38 |
| 7% | 33 |
| 8% | 29 |
| 9% | 26 |
| 10% | 23 |
| 15% | 15 |
| 20% | 12 |

#### Expected Deviation Rate = 1%

| Tolerable Deviation Rate | Sample Size |
|--------------------------|-------------|
| 2% | 200 |
| 3% | 130 |
| 4% | 88 |
| 5% | 65 |
| 6% | 55 |
| 7% | 43 |
| 8% | 38 |
| 9% | 34 |
| 10% | 30 |
| 15% | 20 |
| 20% | 15 |

---

## Sample Size Decision Matrix

Use this matrix to quickly determine the appropriate sample size approach:

| Scenario | Method | Reference |
|----------|--------|-----------|
| Control operates at defined frequency (daily/weekly/monthly/etc.) | Frequency-based | Frequency table above |
| Large population, high risk, quantitative threshold needed | Statistical attribute | Statistical tables above |
| Small population (< 52 items) | Consider testing entire population | Professional judgment |
| IT automated control (application-enforced) | Test 1 instance + validate no changes during period | IT general controls |
| Control with no expected deviations | Lower sample sizes acceptable | 0% expected deviation tables |
| Control with known prior deviations | Increase expected deviation rate | Higher expected deviation tables |
| Key control / management review control | Increase sample size by 1.5x-2x | Professional judgment |

---

## Upper Deviation Limit Evaluation

After testing, evaluate whether results support the conclusion:

### 0 Deviations Found

| Sample Size | Upper Deviation Limit (95%) | Upper Deviation Limit (90%) |
|-------------|-----------------------------|-----------------------------|
| 20 | 14.0% | 10.9% |
| 25 | 11.3% | 8.8% |
| 30 | 9.5% | 7.4% |
| 40 | 7.2% | 5.6% |
| 50 | 5.8% | 4.6% |
| 60 | 4.9% | 3.8% |
| 75 | 3.9% | 3.1% |
| 100 | 3.0% | 2.3% |

### 1 Deviation Found

| Sample Size | Upper Deviation Limit (95%) | Upper Deviation Limit (90%) |
|-------------|-----------------------------|-----------------------------|
| 20 | 18.1% | 14.7% |
| 25 | 14.7% | 12.1% |
| 30 | 12.4% | 10.2% |
| 40 | 9.4% | 7.8% |
| 50 | 7.6% | 6.3% |
| 60 | 6.4% | 5.3% |
| 75 | 5.2% | 4.3% |
| 100 | 3.9% | 3.3% |

### 2 Deviations Found

| Sample Size | Upper Deviation Limit (95%) | Upper Deviation Limit (90%) |
|-------------|-----------------------------|-----------------------------|
| 20 | 22.1% | 18.4% |
| 25 | 17.8% | 15.0% |
| 30 | 15.1% | 12.7% |
| 40 | 11.5% | 9.7% |
| 50 | 9.3% | 7.9% |
| 60 | 7.9% | 6.7% |
| 75 | 6.4% | 5.4% |
| 100 | 4.8% | 4.1% |

---

## Interpretation Guidance

1. **Compare Upper Deviation Limit to Tolerable Deviation Rate:**
   - If UDL ≤ Tolerable Rate → Control is effective (supports conclusion)
   - If UDL > Tolerable Rate → Control effectiveness cannot be supported; consider:
     - Extended testing (larger sample)
     - Evaluate compensating controls
     - Assess impact on opinion

2. **Qualitative factors** to consider alongside statistical results:
   - Nature of the deviations (systematic vs. isolated)
   - Cause of the deviations (human error vs. design flaw)
   - Whether deviations were corrected timely
   - Impact on related controls and criteria
