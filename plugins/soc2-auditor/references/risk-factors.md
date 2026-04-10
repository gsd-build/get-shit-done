# Risk Factor Catalog

Risk factors for SOC 2 engagement risk assessment. Used by `soc2-plan` to build the risk assessment and determine testing strategy.

---

## Risk Classification Matrix

| Risk Level | Inherent Risk | Control Risk | Detection Risk (Required) | Testing Intensity |
|------------|--------------|--------------|---------------------------|-------------------|
| **High** | High | High | Low | Maximum samples, multiple test types, corroborative evidence |
| **Moderate-High** | High | Moderate | Low-Moderate | Above-standard samples, dual-purpose testing |
| **Moderate** | Moderate | Moderate | Moderate | Standard samples, standard testing |
| **Moderate-Low** | Moderate | Low | Moderate-High | Standard samples, may rely more on inquiry |
| **Low** | Low | Low | High | Minimum samples, single test type acceptable |

---

## Entity-Level Risk Factors

### Industry and Regulatory Environment

| Factor | Higher Risk Indicators | Lower Risk Indicators |
|--------|----------------------|----------------------|
| Industry regulation | Highly regulated (healthcare, financial services, government) | Less regulated (general SaaS, consulting) |
| Data sensitivity | PII, PHI, PCI, financial data | Non-sensitive operational data |
| Regulatory history | Prior regulatory actions, consent decrees | Clean regulatory history |
| Industry breach history | Industry with frequent breaches | Industry with low breach rates |

### Entity Characteristics

| Factor | Higher Risk Indicators | Lower Risk Indicators |
|--------|----------------------|----------------------|
| Entity maturity | Startup, rapid growth, recent M&A | Established, stable operations |
| Management stability | High turnover, new leadership | Stable, experienced management |
| Prior audit findings | Material exceptions in prior reports | Clean prior reports |
| First-time engagement | New client, no prior SOC reports | Existing client, prior reports available |
| Organizational complexity | Multiple locations, subsidiaries, subservice orgs | Single location, simple structure |
| Control environment | Informal processes, limited documentation | Formal governance, documented policies |

### Technology Environment

| Factor | Higher Risk Indicators | Lower Risk Indicators |
|--------|----------------------|----------------------|
| Infrastructure complexity | Multi-cloud, hybrid, legacy systems | Single cloud provider, modern stack |
| Change velocity | Frequent deployments, rapid development | Stable, infrequent changes |
| Custom vs. COTS | Heavy customization, proprietary systems | Standard SaaS/PaaS, well-known platforms |
| Data volume | High volume, complex data flows | Low volume, simple data flows |
| Third-party dependencies | Many integrations, subservice organizations | Few external dependencies |

---

## Control-Level Risk Factors

### Control Design Factors

| Factor | Higher Risk | Lower Risk |
|--------|------------|------------|
| Automation level | Manual control (human judgment) | Fully automated (system-enforced) |
| Frequency | Per-occurrence, ad-hoc | Defined frequency (daily, weekly, monthly) |
| Complexity | Multi-step, cross-functional | Simple, single-step |
| Control operator | Junior staff, rotated frequently | Senior staff, dedicated role |
| Evidence availability | Oral, no documentation trail | System-generated logs, documented approvals |
| Compensating controls | No backup controls | Multiple layers of redundancy |

### Control Categories by Risk

| Control Type | Typical Risk Level | Rationale |
|-------------|-------------------|-----------|
| Access provisioning/deprovisioning | High | Direct impact on unauthorized access risk |
| Change management approvals | High | Unauthorized changes can compromise system |
| Incident response | High | Failure to respond impacts all TSC categories |
| Backup and recovery | High | Data loss/unavailability risk |
| Encryption (at rest/in transit) | Moderate-High | Misconfiguration exposes data |
| Monitoring and alerting | Moderate | Detection control, compensating nature |
| Vendor management | Moderate | Third-party risk, less direct control |
| Security awareness training | Moderate | Preventive but indirect |
| Physical access controls | Moderate-Low | Typically well-established (if cloud: N/A) |
| Board/management oversight | Low-Moderate | Entity-level, tone at the top |
| Policy documentation | Low | Design control, typically well-maintained |

---

## Risk Assessment Process

### Step 1: Inherent Risk Assessment

Evaluate the risk of material misstatement BEFORE considering controls:

1. What could go wrong? (Threat scenarios)
2. What is the impact? (Financial, operational, reputational, compliance)
3. What is the likelihood? (Based on entity-level risk factors)

### Step 2: Control Risk Assessment

Evaluate the risk that controls will not prevent or detect material misstatements:

1. Are controls properly designed to address the risk?
2. Are controls operating as designed?
3. What is the history of control effectiveness? (Prior period results)

### Step 3: Detection Risk Determination

Based on inherent and control risk, determine the required level of detection risk (via testing):

- Higher inherent/control risk → Lower acceptable detection risk → More extensive testing
- Lower inherent/control risk → Higher acceptable detection risk → Less extensive testing

### Step 4: Testing Strategy

Map risk levels to testing approach:

| Risk Level | Sample Size Multiplier | Test Types Required | Evidence Corroboration |
|------------|----------------------|--------------------|-----------------------|
| High | 1.5x – 2.0x standard | 2+ types (e.g., inspect + reperform) | Required |
| Moderate | 1.0x standard | 1-2 types | Recommended |
| Low | 0.75x – 1.0x standard | 1 type sufficient | Not required |

---

## Materiality Considerations

### Quantitative Materiality

SOC 2 does not define quantitative materiality thresholds like financial audits. However, consider:

- Number of user entities affected by a control failure
- Volume of transactions processed by the control
- Financial impact of a control failure on user entities

### Qualitative Materiality

The primary materiality framework for SOC 2:

| Factor | Material | Immaterial |
|--------|----------|------------|
| Nature of exception | Systematic design flaw | Isolated human error |
| Root cause | Inadequate control design | One-time procedural miss |
| Duration | Persisted throughout period | Corrected promptly |
| Compensating controls | None available | Effective compensating control exists |
| Impact on criteria | Directly undermines criteria | Tangential to criteria |
| Pervasiveness | Affects multiple criteria | Isolated to one control |
| Management response | No remediation plan | Prompt remediation with evidence |
