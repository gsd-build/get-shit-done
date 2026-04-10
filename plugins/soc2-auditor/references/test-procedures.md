# Test Procedures Reference

Standard test procedures for SOC 2 control testing by control type and category.

---

## Test Types Overview

| Test Type | What It Proves | Strength | When to Use |
|-----------|---------------|----------|-------------|
| **Inspection** | Control was performed, evidence exists | Moderate-High | Most common; review documents, screenshots, logs |
| **Reperformance** | Control produces correct results | Highest | High-risk controls, calculations, automated controls |
| **Observation** | Control is being performed currently | Moderate | Real-time controls, physical controls, demonstrations |
| **Inquiry** | Management/staff describe the control | Lowest (alone) | Supplement to other types; understanding context |

**Combination guidance:**
- High-risk controls: Inspection + Reperformance (or Observation)
- Moderate-risk controls: Inspection + Inquiry
- Low-risk controls: Inspection alone (or Inquiry with corroboration)

---

## Procedures by Control Category

### CC1 — Control Environment

#### CC1.1 — Integrity and Ethical Values

**Procedure: Test Code of Conduct Distribution**
1. Obtain the current code of conduct document
2. Inspect the code for coverage of: ethics, conflicts of interest, reporting mechanisms, consequences
3. Obtain acknowledgment tracking report for the audit period
4. Select sample of employees; verify acknowledgment recorded
5. For new hires in sample: verify acknowledgment within defined onboarding period

#### CC1.4 — Competent Individuals

**Procedure: Test Background Check Process**
1. Obtain background check policy
2. Select sample of new hires during audit period
3. For each: verify background check was completed prior to or within defined period of start date
4. Verify check includes components specified in policy (criminal, employment, education as applicable)

### CC2 — Communication and Information

#### CC2.2 — Internal Communication

**Procedure: Test Security Policy Communication**
1. Obtain current security policies (information security, acceptable use, data classification)
2. Verify policies include version date, owner, review cadence
3. Obtain policy acknowledgment records
4. Select sample of employees; verify acknowledgment within required timeframe
5. If policy was updated during period: verify re-acknowledgment was required

### CC3 — Risk Assessment

#### CC3.2 — Risk Identification

**Procedure: Test Risk Assessment Process**
1. Obtain the entity's risk assessment document
2. Verify it was performed/updated within the audit period (date stamp, version)
3. Verify it covers: threat identification, likelihood assessment, impact assessment, risk ranking
4. Verify risk treatment decisions are documented (accept, mitigate, transfer, avoid)
5. Inquire of management regarding process and participants

### CC4 — Monitoring Activities

#### CC4.1 — Vulnerability Management

**Procedure: Test Vulnerability Scanning and Remediation**
1. Obtain vulnerability scanning tool configuration
2. Verify scanning frequency meets policy (typically weekly or monthly)
3. Select sample of scan periods; obtain scan reports
4. For each scan: verify critical/high vulnerabilities were tracked for remediation
5. Select sample of critical/high findings; verify remediation within defined SLA
6. Verify rescanning confirmed remediation

#### CC4.1 — Penetration Testing

**Procedure: Test Annual Penetration Test**
1. Obtain penetration test report from qualified third party
2. Verify test was performed within the audit period
3. Verify scope covers in-scope systems/applications
4. Review findings and severity classifications
5. Verify remediation plan for identified findings
6. Verify critical findings were remediated; obtain evidence of remediation

### CC6 — Logical and Physical Access

#### CC6.1 — Logical Access Security

**Procedure: Test Authentication Controls**
1. Obtain authentication/password policy
2. Inspect system configuration for password complexity requirements
3. Verify MFA is enabled and required for: admin access, remote access, production systems
4. Screenshot MFA configuration from identity provider
5. Select sample of users; verify MFA enrollment

#### CC6.2 — User Registration and Authorization

**Procedure: Test Access Provisioning**
1. Obtain access provisioning policy/procedure
2. Select sample of new access grants during audit period
3. For each: verify access request was submitted
4. Verify appropriate manager/owner approved the request
5. Verify access granted matches what was approved (no excess privileges)
6. Verify timeliness of provisioning process

#### CC6.3 — Access Modification and Removal

**Procedure: Test Termination Access Removal**
1. Obtain termination/offboarding procedure
2. Obtain list of terminated employees during audit period
3. Select sample of terminations
4. For each: verify access was revoked within defined SLA (typically 24 hours)
5. Verify across all critical systems (SSO, email, VPN, production systems)
6. Verify no activity after termination date

**Procedure: Test Periodic Access Reviews**
1. Obtain access review policy (frequency, scope, participants)
2. Verify access review was performed during audit period
3. Obtain completed access review documentation
4. Verify reviewer is appropriate (system owner or manager)
5. Verify all users in scope were reviewed
6. For flagged items: verify action was taken (removal or justification documented)

### CC7 — System Operations

#### CC7.2 — Security Event Monitoring

**Procedure: Test SIEM/Monitoring Configuration**
1. Obtain monitoring/alerting policy
2. Inspect SIEM or monitoring tool configuration
3. Verify alert rules cover: unauthorized access attempts, privilege escalation, configuration changes, malware detection
4. Select sample of alerts during audit period
5. For each alert: verify timely investigation and documented response
6. Verify escalation to incident response when warranted

#### CC7.4 — Incident Response

**Procedure: Test Incident Response Process**
1. Obtain incident response plan
2. Verify plan covers: identification, containment, eradication, recovery, lessons learned, communication
3. If incidents occurred during period: select sample and trace through IR process
4. Verify incident was classified by severity
5. Verify response actions matched severity classification
6. Verify stakeholder communication occurred per plan
7. If no incidents: verify IR tabletop exercise or drill was conducted

### CC8 — Change Management

#### CC8.1 — Change Authorization

**Procedure: Test Change Management Process**
1. Obtain change management policy
2. Select sample of changes deployed to production during audit period
3. For each change:
   - Verify change request/ticket was created
   - Verify description of change is documented
   - Verify testing was performed (test results, QA approval)
   - Verify code review was completed (peer review evidence)
   - Verify appropriate approval prior to deployment
   - Verify separation of duties (developer ≠ deployer ≠ approver)
4. Verify emergency change procedure exists and was followed when used

### CC9 — Risk Mitigation

#### CC9.2 — Vendor Management

**Procedure: Test Vendor Risk Assessment**
1. Obtain vendor management policy
2. Obtain list of critical vendors/subservice organizations
3. Select sample of vendors
4. For each: verify risk assessment was performed (due diligence questionnaire, security review)
5. Verify SOC report or equivalent assurance was obtained and reviewed
6. Verify contractual security requirements are in place (DPA, security addendum)
7. For SOC reports: verify CUEC (complementary user entity controls) are addressed

### A1 — Availability

#### A1.2 — Backup and Recovery

**Procedure: Test Backup Process**
1. Obtain backup policy (frequency, retention, scope)
2. Inspect backup configuration; verify alignment with policy
3. Select sample of backup periods; verify successful completion
4. For failures in sample: verify detection, alerting, and re-execution
5. Verify backup restoration test was performed during period
6. Obtain restoration test results; verify successful recovery within RTO

### PI1 — Processing Integrity

#### PI1.2 — Input Controls

**Procedure: Test Input Validation**
1. Obtain input validation requirements for in-scope application(s)
2. Inspect application configuration for validation rules
3. Reperform: attempt to submit invalid inputs; verify rejection
4. Select sample of processing errors/exceptions; verify handling per policy

### CC9 — Risk Mitigation (Subservice Organizations)

#### CC9.2 — Vendor and Subservice Organization Management

**Procedure: Test Subservice Organization Controls**
1. Obtain list of subservice organizations from SCOPE.md
2. For each subservice org with carve-out method:
   a. Obtain their current SOC 1 or SOC 2 report
   b. Verify the report covers the audit period (or acceptable gap ≤ 3 months)
   c. Verify the report opinion is unqualified (flag if qualified/adverse)
   d. Review Complementary User Entity Controls (CUECs) — verify the entity has implemented each applicable CUEC
   e. Review exceptions in the subservice org's report — assess impact on the entity's system
3. For each subservice org with inclusive method:
   a. The subservice org's controls are included in the entity's description and tested directly
   b. Verify the testing covers the subservice org's relevant controls
4. Document: which CUECs are applicable, which are implemented, which have gaps

---

## Test Documentation Standards

For each test performed, document:

1. **Control reference** — Control ID from the control matrix
2. **Criteria addressed** — TSC criteria the control maps to
3. **Test objective** — What the test is designed to determine
4. **Population** — Description of full population, source, size
5. **Sample** — Size, method, items selected (reference sampling memo)
6. **Procedure** — Step-by-step actions taken
7. **Results** — Per-item observations
8. **Exceptions** — Detailed description of any deviations
9. **Conclusion** — Professional judgment on effectiveness
