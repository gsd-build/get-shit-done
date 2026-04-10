# Scope

## Trust Service Categories

### Security (Common Criteria) — REQUIRED

**Status:** {{SECURITY_STATUS}}

The security category is always in scope for a SOC 2 examination. It covers the Common Criteria (CC1 through CC9):

| Criteria Group | Description | Control Count |
|---------------|-------------|---------------|
| CC1 | Control Environment | {{CC1_COUNT}} |
| CC2 | Communication and Information | {{CC2_COUNT}} |
| CC3 | Risk Assessment | {{CC3_COUNT}} |
| CC4 | Monitoring Activities | {{CC4_COUNT}} |
| CC5 | Control Activities | {{CC5_COUNT}} |
| CC6 | Logical and Physical Access Controls | {{CC6_COUNT}} |
| CC7 | System Operations | {{CC7_COUNT}} |
| CC8 | Change Management | {{CC8_COUNT}} |
| CC9 | Risk Mitigation | {{CC9_COUNT}} |

### Availability

**Status:** {{AVAILABILITY_STATUS}}

| Criteria | Description | Control Count |
|----------|-------------|---------------|
| A1 | System Availability | {{A1_COUNT}} |

### Processing Integrity

**Status:** {{PI_STATUS}}

| Criteria | Description | Control Count |
|----------|-------------|---------------|
| PI1 | Processing Accuracy, Completeness, Timeliness | {{PI1_COUNT}} |

### Confidentiality

**Status:** {{CONFIDENTIALITY_STATUS}}

| Criteria | Description | Control Count |
|----------|-------------|---------------|
| C1 | Confidential Information Protection | {{C1_COUNT}} |

### Privacy

**Status:** {{PRIVACY_STATUS}}

| Criteria Group | Description | Control Count |
|---------------|-------------|---------------|
| P1 | Notice | {{P1_COUNT}} |
| P2 | Choice and Consent | {{P2_COUNT}} |
| P3 | Collection | {{P3_COUNT}} |
| P4 | Use, Retention, and Disposal | {{P4_COUNT}} |
| P5 | Access | {{P5_COUNT}} |
| P6 | Disclosure and Notification | {{P6_COUNT}} |
| P7 | Quality | {{P7_COUNT}} |
| P8 | Monitoring and Enforcement | {{P8_COUNT}} |

## System Boundaries

### Infrastructure

| Component | Description | In Scope |
|-----------|-------------|----------|
| {{INFRA_COMPONENT}} | {{INFRA_DESC}} | {{INFRA_IN_SCOPE}} |

### Software

| Component | Description | In Scope |
|-----------|-------------|----------|
| {{SW_COMPONENT}} | {{SW_DESC}} | {{SW_IN_SCOPE}} |

### People

| Role | Responsibilities | In Scope |
|------|-----------------|----------|
| {{ROLE}} | {{RESPONSIBILITIES}} | {{ROLE_IN_SCOPE}} |

### Data

| Data Category | Description | Classification | In Scope |
|--------------|-------------|----------------|----------|
| {{DATA_CATEGORY}} | {{DATA_DESC}} | {{DATA_CLASS}} | {{DATA_IN_SCOPE}} |

### Processes

| Process | Description | In Scope |
|---------|-------------|----------|
| {{PROCESS}} | {{PROCESS_DESC}} | {{PROCESS_IN_SCOPE}} |

## Subservice Organizations

| Organization | Services | Method | Complementary Controls |
|-------------|----------|--------|----------------------|
| {{SUB_ORG}} | {{SUB_SERVICES}} | {{SUB_METHOD}} | {{SUB_CUEC}} |

## Exclusions

| Exclusion | Rationale |
|-----------|-----------|
| {{EXCLUSION}} | {{EXCLUSION_RATIONALE}} |
