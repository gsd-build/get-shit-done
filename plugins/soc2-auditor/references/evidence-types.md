# Evidence Types Reference

Catalog of evidence types by control category for SOC 2 examinations. Used by `soc2-pbc` and `soc2-test` to identify required evidence.

---

## Evidence Hierarchy (Reliability)

From most to least reliable:

1. **External, system-generated** — Third-party audit logs, CSP reports, penetration test reports
2. **Internal, system-generated** — Application logs, automated reports, system screenshots
3. **External, manual** — Third-party confirmations, vendor attestations
4. **Internal, manual** — Signed approvals, meeting minutes, completed checklists
5. **Inquiry** — Verbal representations from management/staff (least reliable alone)

**General rule:** Corroborate inquiry evidence with at least one other type.

---

## Evidence by Control Category

### CC1 — Control Environment

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Code of conduct / ethics | Signed code of conduct, acknowledgment records | PDF, system screenshot |
| Organizational structure | Org charts, role descriptions, board charter | PDF, document |
| Background checks | Background check completion records (redacted) | PDF, system report |
| Performance evaluations | Evaluation completion reports (summary, not individual) | System report |
| Training completion | Training records, LMS completion reports | System screenshot, CSV |

### CC2 — Communication and Information

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Security policies | Published policy documents with version/date | PDF |
| Policy acknowledgment | Acknowledgment tracking reports | System screenshot |
| External communication | Privacy notices, terms of service, public security page | URL, screenshot |
| Incident notifications | Sample notification emails, status page history | Email, screenshot |

### CC3 — Risk Assessment

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Risk assessment process | Risk assessment document, risk register | PDF, spreadsheet |
| Risk assessment frequency | Meeting minutes, calendar entries, versioned documents | PDF, screenshot |
| Fraud risk assessment | Fraud risk assessment document | PDF |
| Change risk evaluation | Change impact assessments, risk reviews for changes | PDF, ticket screenshots |

### CC4 — Monitoring Activities

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Continuous monitoring | Dashboard screenshots, monitoring tool configs | Screenshot |
| Internal audit | Internal audit reports, findings tracking | PDF |
| Penetration testing | Penetration test report (from qualified third party) | PDF |
| Vulnerability scanning | Scan reports, remediation tracking | PDF, system report |
| Control deficiency tracking | Deficiency log, remediation evidence | Spreadsheet, tickets |

### CC5 — Control Activities

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Segregation of duties | Access matrix, role definitions, conflicting access report | System report, PDF |
| Approval workflows | Ticket history showing approvals, approval screenshots | Screenshot, system export |
| Reconciliations | Completed reconciliation documents with sign-off | PDF, spreadsheet |

### CC6 — Logical and Physical Access

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Access provisioning | Provisioning tickets with approvals, access request forms | Ticket screenshot |
| Access deprovisioning | Termination tickets, access removal confirmation | Ticket screenshot, system log |
| Access reviews | Completed access review spreadsheets with sign-off | Spreadsheet, screenshot |
| Authentication settings | MFA configuration screenshots, password policy config | System screenshot |
| Network security | Firewall rules, network diagrams, WAF configs | Screenshot, diagram |
| Encryption at rest | Encryption configuration evidence, key management | System screenshot |
| Encryption in transit | TLS/SSL configuration, certificate evidence | Screenshot, scan report |
| Physical access | Badge reader logs, visitor logs, data center audit reports | System report, PDF |
| Endpoint protection | EDR/antivirus configuration, deployment reports | System screenshot |

### CC7 — System Operations

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Vulnerability management | Vulnerability scan reports, patch records | PDF, system report |
| SIEM / log monitoring | SIEM configuration, alert rules, alert samples | Screenshot |
| Incident response | IR plan, incident tickets, post-mortem reports | PDF, ticket screenshots |
| Incident communication | Notification emails, status page updates | Email, screenshot |
| Recovery testing | DR test results, recovery time documentation | PDF |

### CC8 — Change Management

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Change requests | Change tickets with description, approval, testing | Ticket screenshot |
| Code review | Pull request / merge request with review approval | Screenshot, system export |
| Testing evidence | Test results, QA sign-off | Screenshot, document |
| Deployment records | Deployment logs, CI/CD pipeline records | System log, screenshot |
| Emergency changes | Emergency change tickets with post-approval | Ticket screenshot |

### CC9 — Risk Mitigation

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Business continuity plan | BCP document with review date | PDF |
| BCP testing | Test results, lessons learned | PDF |
| Vendor management | Vendor assessments, SOC reports of subservice orgs | PDF |
| Vendor contracts | MSAs, DPAs, SLAs with security requirements | PDF (redacted OK) |
| Insurance | Cyber insurance certificate of coverage | PDF |

### A1 — Availability

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Capacity monitoring | Capacity dashboards, alerting rules | Screenshot |
| Backup configuration | Backup policy, backup job configs and logs | Screenshot, system log |
| Backup testing / restoration | Restoration test results with dates | Screenshot, document |
| SLA monitoring | Uptime reports, SLA dashboards | Screenshot, report |

### PI1 — Processing Integrity

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Input validation | Input validation rules, error handling screenshots | Screenshot, code |
| Processing accuracy | Reconciliation reports, accuracy checks | System report |
| Output completeness | Delivery logs, output reconciliation | System report |
| Error handling | Error logs, exception reports, correction evidence | System log |

### C1 — Confidentiality

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Data classification | Classification policy, data inventory/catalog | PDF, spreadsheet |
| DLP controls | DLP configuration, alert reports | Screenshot |
| Confidential data disposal | Disposal certificates, secure deletion logs | PDF, system log |
| NDA / confidentiality agreements | Signed agreements (redacted) | PDF |

### P1–P8 — Privacy

| Control Area | Evidence Types | Format |
|-------------|---------------|--------|
| Privacy notice | Published privacy notice/policy | URL, screenshot |
| Consent mechanisms | Consent UI screenshots, consent records | Screenshot, system report |
| Data subject access requests | DSAR process, fulfillment records | Ticket screenshot |
| Data retention schedule | Retention policy, automated deletion configs | PDF, screenshot |
| Data breach notification | Notification templates, incident records | PDF, email |
| Privacy impact assessments | PIA/DPIA documents | PDF |

---

## Evidence Collection Best Practices

1. **Screenshots must include:**
   - URL bar or system identifier visible
   - Date/timestamp visible (system clock or audit date watermark)
   - Full relevant content (no cropping of critical fields)

2. **System reports must include:**
   - Report parameters (date range, filters applied)
   - Generation date
   - Source system identification

3. **Documents must include:**
   - Version number or date
   - Author or owner
   - Approval/sign-off (if applicable)

4. **File naming convention:**
   ```
   {CONTROL-ID}_{EVIDENCE-TYPE}_{DATE}.{ext}
   Example: CC6.1_access-review_2025-03-15.pdf
   ```
