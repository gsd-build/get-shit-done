# Prepared By Client (PBC) List

## Engagement Information

| Field | Value |
|-------|-------|
| **Client** | {{CLIENT_NAME}} |
| **Issued Date** | {{ISSUED_DATE}} |
| **Due Date** | {{DUE_DATE}} |
| **Issued By** | {{ISSUED_BY}} |

## Summary

| Status | Count |
|--------|-------|
| Requested | {{TOTAL_REQUESTED}} |
| Received | {{TOTAL_RECEIVED}} |
| Outstanding | {{TOTAL_OUTSTANDING}} |
| Overdue | {{TOTAL_OVERDUE}} |
| N/A | {{TOTAL_NA}} |

## Evidence Requests

| PBC # | Control Ref | Evidence Description | Format Expected | Due Date | Assigned To | Status | Received Date | Notes |
|-------|-----------|---------------------|-----------------|----------|-------------|--------|---------------|-------|
| {{PBC_NUM}} | {{PBC_CTRL_REF}} | {{PBC_DESC}} | {{PBC_FORMAT}} | {{PBC_DUE}} | {{PBC_ASSIGNED}} | {{PBC_STATUS}} | {{PBC_RECEIVED}} | {{PBC_NOTES}} |

### Status Key

| Status | Meaning |
|--------|---------|
| **Requested** | Evidence has been requested from client |
| **Received** | Evidence received and pending review |
| **Accepted** | Evidence reviewed and accepted for testing |
| **Insufficient** | Evidence received but insufficient; follow-up needed |
| **Outstanding** | Not yet received, within due date |
| **Overdue** | Not yet received, past due date |
| **N/A** | Not applicable for this engagement |

## General Documents (Always Required)

| PBC # | Description | Format | Status |
|-------|-------------|--------|--------|
| G-01 | Organizational chart | PDF/image | |
| G-02 | List of all employees during audit period (name, title, department, start date, end date if applicable) | CSV/spreadsheet | |
| G-03 | List of terminated employees during audit period | CSV/spreadsheet | |
| G-04 | Information security policy (current version) | PDF | |
| G-05 | Acceptable use policy | PDF | |
| G-06 | Data classification policy | PDF | |
| G-07 | Incident response plan | PDF | |
| G-08 | Business continuity / disaster recovery plan | PDF | |
| G-09 | Change management policy | PDF | |
| G-10 | Access control policy | PDF | |
| G-11 | Vendor management policy | PDF | |
| G-12 | Risk assessment document (current) | PDF | |
| G-13 | List of critical vendors / subservice organizations | Spreadsheet | |
| G-14 | Network diagram | PDF/image | |
| G-15 | Data flow diagram | PDF/image | |
| G-16 | Penetration test report (from qualified third party) | PDF | |
| G-17 | Most recent vulnerability scan report | PDF/system report | |
| G-18 | Prior SOC report (if one exists from predecessor auditor) | PDF | |
| G-19 | SOC reports from subservice organizations (e.g., AWS, Azure, GCP) | PDF | |
| G-20 | Security awareness training completion records | System report/CSV | |
| G-21 | Board/management meeting minutes related to security oversight | PDF (redacted OK) | |

## Notes for Client

1. **Format:** Please provide evidence in the format specified. Screenshots should include the URL bar, timestamp, and full relevant content.
2. **Period:** Evidence should cover the full audit period ({{PERIOD_START}} to {{PERIOD_END}}) unless otherwise noted.
3. **Redaction:** Sensitive information (SSNs, full credit card numbers) may be redacted. Do not redact dates, names, or approval indicators.
4. **Naming:** Please use the PBC # in the filename (e.g., `PBC-G01_org-chart.pdf`).
5. **Delivery:** Upload evidence to the designated secure folder or provide via agreed-upon secure method.
6. **Questions:** Contact {{ISSUED_BY}} for any questions regarding specific requests.
