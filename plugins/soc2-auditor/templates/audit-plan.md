# Audit Plan

## Engagement Overview

| Field | Value |
|-------|-------|
| **Client** | {{CLIENT_NAME}} |
| **Engagement Type** | SOC 2 Type {{TYPE}} |
| **Audit Period** | {{PERIOD_START}} to {{PERIOD_END}} |
| **Plan Date** | {{PLAN_DATE}} |
| **Prepared By** | {{PREPARER}} |
| **Reviewed By** | {{REVIEWER}} |

## Objectives

1. Obtain reasonable assurance about whether management's description of the system is fairly presented
2. Obtain reasonable assurance about whether controls are suitably designed to meet the applicable Trust Service Criteria
3. {{TYPE_II_ONLY}} Obtain reasonable assurance about whether controls operated effectively throughout the period

## Scope

### Trust Service Categories

| Category | In Scope | Control Count | Risk Level |
|----------|----------|---------------|-----------|
| Security (CC1-CC9) | Yes | {{SEC_COUNT}} | {{SEC_RISK}} |
| Availability (A1) | {{AVAIL_SCOPE}} | {{AVAIL_COUNT}} | {{AVAIL_RISK}} |
| Processing Integrity (PI1) | {{PI_SCOPE}} | {{PI_COUNT}} | {{PI_RISK}} |
| Confidentiality (C1) | {{CONF_SCOPE}} | {{CONF_COUNT}} | {{CONF_RISK}} |
| Privacy (P1-P8) | {{PRIV_SCOPE}} | {{PRIV_COUNT}} | {{PRIV_RISK}} |

### Materiality

| Factor | Determination |
|--------|--------------|
| Materiality approach | {{MATERIALITY_APPROACH}} |
| Tolerable deviation rate | {{TOLERABLE_DEVIATION}} |
| Expected deviation rate | {{EXPECTED_DEVIATION}} |
| Confidence level | {{CONFIDENCE_LEVEL}} |

## Testing Strategy

### By Risk Level

| Risk Level | Controls | Sample Approach | Test Types | Corroboration |
|-----------|----------|----------------|------------|---------------|
| High | {{HIGH_CONTROLS}} | {{HIGH_SAMPLE}} | {{HIGH_TEST}} | Required |
| Moderate | {{MOD_CONTROLS}} | {{MOD_SAMPLE}} | {{MOD_TEST}} | Recommended |
| Low | {{LOW_CONTROLS}} | {{LOW_SAMPLE}} | {{LOW_TEST}} | Not required |

### By Control Type

| Control Type | Approach |
|-------------|----------|
| Manual controls | Frequency-based sampling, inspection + inquiry |
| IT application controls | Test 1 + validate no changes via ITGC testing |
| IT general controls | Full testing per standard procedures |
| Management review controls | Increased sample size (1.5x), inspect evidence of review |
| Entity-level controls | Inquiry + inspection of governance documentation |

## Team Assignments

| Team Member | Role | Assigned Areas | Planned Hours |
|------------|------|---------------|---------------|
| {{PARTNER}} | Engagement Partner | Overall supervision, opinion | {{PARTNER_HOURS}} |
| {{MANAGER}} | Engagement Manager | Planning, review, reporting | {{MANAGER_HOURS}} |
| {{SENIOR}} | Senior Auditor | Testing execution, work papers | {{SENIOR_HOURS}} |
| {{STAFF}} | Staff Auditor | Testing support, evidence collection | {{STAFF_HOURS}} |

## Timeline

| Phase | Start | End | Owner | Deliverable |
|-------|-------|-----|-------|-------------|
| Planning | {{PLAN_START}} | {{PLAN_END}} | {{PLAN_OWNER}} | Risk assessment, audit plan, control matrix |
| PBC issuance | {{PBC_START}} | {{PBC_END}} | {{PBC_OWNER}} | PBC list |
| Evidence collection | {{EVIDENCE_START}} | {{EVIDENCE_END}} | Client | Evidence per PBC list |
| Fieldwork | {{FIELD_START}} | {{FIELD_END}} | {{FIELD_OWNER}} | Testing, work papers |
| Work paper review | {{WP_START}} | {{WP_END}} | {{WP_OWNER}} | Reviewed work papers |
| Draft report | {{DRAFT_START}} | {{DRAFT_END}} | {{DRAFT_OWNER}} | Draft SOC 2 report |
| Management review | {{MGMT_START}} | {{MGMT_END}} | Client | Management comments |
| Final report | {{FINAL_START}} | {{FINAL_END}} | {{FINAL_OWNER}} | Issued SOC 2 report |

## Reliance on Others

### Internal Audit

| Consideration | Assessment |
|--------------|-----------|
| Internal audit function exists | {{IA_EXISTS}} |
| Plan to rely on internal audit work | {{IA_RELY}} |
| Areas of reliance | {{IA_AREAS}} |
| Evaluation of competence/objectivity | {{IA_EVAL}} |

### Subservice Organization Auditors

| Subservice Org | Their Auditor | Reliance Plan |
|---------------|---------------|---------------|
| {{SUB_ORG}} | {{SUB_AUDITOR}} | {{SUB_RELIANCE}} |

## Special Considerations

| Item | Description | Impact on Plan |
|------|-------------|---------------|
| {{SPECIAL_ITEM}} | {{SPECIAL_DESC}} | {{SPECIAL_IMPACT}} |
