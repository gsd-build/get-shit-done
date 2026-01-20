# Roadmap: Data Reply Agentic Platform

## Overview

This roadmap delivers the Data Lineage & Quality module through four phases, starting with infrastructure and data profiling to prove the architecture, then building out the complete AI-powered quality workflow, adding column-level lineage for data flow visibility, and finishing with the dashboard and integration layer. The core value is AI agents that automatically profile data, recommend quality rules, and validate with actionable alerts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation & Data Profiling** - Infrastructure, connectors, and Data Profiler agent
- [x] **Phase 2: Data Quality & AI Recommendations** - DQ checks, AI rule generation, validation workflow
- [x] **Phase 3: Column-Level Lineage** - Data flow tracking with transformation visibility
- [x] **Phase 4: Visibility & Integration** - Dashboard, alerts, API, historical trends

## Phase Details

### Phase 1: Foundation & Data Profiling
**Goal**: Users can connect data sources and view automated profiling insights
**Depends on**: Nothing (first phase)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, INT-04
**Success Criteria** (what must be TRUE):
  1. User can connect to an S3/Iceberg, Athena, or Redshift data source
  2. User can view completeness statistics (nulls, distinct counts, cardinality) for any connected table
  3. User can see distribution metrics (min, max, mean, median, std dev) for numeric columns
  4. System automatically infers and displays data types for scanned columns
  5. User can see flagged anomalies when unusual patterns are detected in data
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Infrastructure & backend foundation (CDK, Supabase schema, data connectors)
- [x] 01-02-PLAN.md — Data Profiler agent (Strands agent, Fargate container, API endpoints)
- [x] 01-03-PLAN.md — Frontend foundation (Next.js, source management UI, profile viewer)

### Phase 2: Data Quality & AI Recommendations
**Goal**: Users can generate, review, and execute quality rules with AI assistance
**Depends on**: Phase 1 (profiling results feed AI recommendations)
**Requirements**: DQ-01, DQ-02, DQ-03, DQ-04, AI-01, AI-02, AI-03, AI-04, INT-03
**Success Criteria** (what must be TRUE):
  1. User can describe a quality rule in natural language and receive generated validation code
  2. User can see AI-provided reasoning explaining why each rule was suggested
  3. User can run quality checks (null, unique, range, referential integrity) against data sources
  4. User receives alerts when data freshness exceeds configured SLA or volume anomalies are detected
  5. Quality validations can execute within AWS Step Functions pipelines
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — DQ Recommender Agent & Rule Engine (Strands agent, Bedrock, rule templates, approval workflow)
- [x] 02-02-PLAN.md — Data Validator & Pipeline Integration (Glue DQ, Step Functions, freshness monitoring, alerting)
- [x] 02-03a-PLAN.md — Quality Rules Frontend (rule creation UI, AI generator, approval panel)
- [x] 02-03b-PLAN.md — Validations & Alerts Frontend (validation results, alert dashboard)

### Phase 3: Column-Level Lineage
**Goal**: Users can trace data flow and transformations across connected sources
**Depends on**: Phase 2 (lineage context enhances quality insights)
**Requirements**: LIN-01, LIN-02, LIN-03, LIN-04, INT-02
**Success Criteria** (what must be TRUE):
  1. User can view column-to-column data flow paths between connected sources
  2. User can see transformation logic showing how data changes (not just where it flows)
  3. User can run downstream impact analysis to see what breaks if a column changes
  4. User can trace a quality issue back to its root cause through the lineage graph
  5. System emits and consumes OpenLineage events for interoperability with external tools
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Lineage Schema & Agent Core (database schema, SQLGlot parser, OpenLineage producer, impact analyzer)
- [x] 03-02-PLAN.md — AWS Lineage Extraction (Redshift/Athena query extraction, batch processing, scheduled Lambda)
- [x] 03-03-PLAN.md — Lineage Frontend (React Flow visualization, table nodes, impact/root cause panels)

### Phase 4: Visibility & Integration
**Goal**: Users can monitor data health through dashboards, alerts, and APIs
**Depends on**: Phase 3 (dashboard visualizes lineage and quality together)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, INT-01
**Success Criteria** (what must be TRUE):
  1. User receives alert notifications (Slack/email) when quality issues are detected
  2. User can view a dashboard showing overall data health across all sources
  3. User can see quality scores calculated per table and per domain
  4. User can view historical trends of quality metrics over time
  5. Developers can access metadata and quality results via REST API
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Notifications & Quality Scoring (Slack/email Lambdas, notification CDK stack, trend aggregation functions)
- [x] 04-02-PLAN.md — Dashboard & REST API (overview page with Recharts, REST endpoints, Swagger documentation)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 (decimal phases insert between integers)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Data Profiling | 3/3 | Complete | 2025-01-18 |
| 2. Data Quality & AI Recommendations | 4/4 | Complete | 2025-01-18 |
| 3. Column-Level Lineage | 3/3 | Complete | 2025-01-19 |
| 4. Visibility & Integration | 2/2 | Complete | 2025-01-19 |
