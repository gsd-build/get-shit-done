# Requirements: Data Reply Agentic Platform

**Version:** v1 (MVP)
**Last Updated:** 2025-01-18

---

## v1 Requirements

### Data Profiling

- [x] **PROF-01**: User can view automated statistics (nulls, distinct counts, distributions, cardinality) for any connected data source
- [x] **PROF-02**: System automatically infers data types and formats from scanned data
- [x] **PROF-03**: User can view distribution analysis (min, max, mean, median, std dev) for numeric columns
- [x] **PROF-04**: System flags statistical anomalies and unusual patterns in data

### Data Quality

- [ ] **DQ-01**: User can run basic quality checks (null, unique, referential integrity, range) on data sources
- [ ] **DQ-02**: System validates data against schema definitions (types, formats, required fields)
- [ ] **DQ-03**: System monitors data freshness and alerts when data is older than configured SLA
- [ ] **DQ-04**: System detects volume anomalies (missing batches, truncated loads)

### AI/DQ Recommender

- [ ] **AI-01**: User can describe quality rules in natural language and system generates validation code
- [ ] **AI-02**: System explains reasoning for each recommended rule
- [ ] **AI-03**: User can apply industry-standard rule templates to data sources
- [ ] **AI-04**: System suggests remediation actions for detected quality issues

### Lineage

- [ ] **LIN-01**: User can view column-to-column data flow across connected sources
- [ ] **LIN-02**: System tracks and displays transformation logic (how data changes, not just where it flows)
- [ ] **LIN-03**: User can see downstream impact analysis (what breaks if this column changes)
- [ ] **LIN-04**: User can trace quality issues back to root cause through lineage

### Visibility

- [ ] **VIS-01**: User receives alert notifications (Slack/email) for quality issues
- [ ] **VIS-02**: User can view quality dashboard with data health overview
- [ ] **VIS-03**: System calculates and displays quality scores per table/domain
- [ ] **VIS-04**: User can view historical trends of quality metrics over time

### Integrations

- [ ] **INT-01**: Developers can access metadata and quality results via REST API
- [ ] **INT-02**: System emits and consumes OpenLineage events for interoperability
- [ ] **INT-03**: Quality validations integrate with AWS Step Functions pipelines
- [x] **INT-04**: System connects to Athena and Redshift for data scanning

---

## v2 Requirements (Deferred)

- ML-based anomaly detection (beyond statistical methods)
- Data contracts support (ODCS standard)
- Business glossary integration
- Advanced impact analysis automation
- Multi-cloud support

---

## Out of Scope

- **Full data catalog/discovery** — Use existing catalogs (Atlan, Glue Catalog); focus on quality metadata
- **Heavy governance workflows** — Overkill for 10-50 users; start simple
- **Complex rule builder UI** — AI-generated rules replace manual rule building
- **Real-time streaming DQ** — Batch covers most use cases; design for streaming later
- **Data masking/security** — Separate concern; integrate with existing security tools
- **Master data management** — Different product category
- **Per-row remediation UI** — Doesn't scale; focus on detection

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PROF-01 | Phase 1 | Complete |
| PROF-02 | Phase 1 | Complete |
| PROF-03 | Phase 1 | Complete |
| PROF-04 | Phase 1 | Complete |
| DQ-01 | Phase 2 | Pending |
| DQ-02 | Phase 2 | Pending |
| DQ-03 | Phase 2 | Pending |
| DQ-04 | Phase 2 | Pending |
| AI-01 | Phase 2 | Pending |
| AI-02 | Phase 2 | Pending |
| AI-03 | Phase 2 | Pending |
| AI-04 | Phase 2 | Pending |
| LIN-01 | Phase 3 | Pending |
| LIN-02 | Phase 3 | Pending |
| LIN-03 | Phase 3 | Pending |
| LIN-04 | Phase 3 | Pending |
| VIS-01 | Phase 4 | Pending |
| VIS-02 | Phase 4 | Pending |
| VIS-03 | Phase 4 | Pending |
| VIS-04 | Phase 4 | Pending |
| INT-01 | Phase 4 | Pending |
| INT-02 | Phase 3 | Pending |
| INT-03 | Phase 2 | Pending |
| INT-04 | Phase 1 | Complete |

---

## Summary

| Category | v1 Count | v2 Count |
|----------|----------|----------|
| Data Profiling | 4 | 0 |
| Data Quality | 4 | 0 |
| AI/DQ Recommender | 4 | 0 |
| Lineage | 4 | 0 |
| Visibility | 4 | 0 |
| Integrations | 4 | 0 |
| **Total** | **24** | **5** |
