# Data Reply Agentic Platform

## What This Is

An AI-powered data management platform that uses specialized agents to automate data lineage tracking, quality validation, and schema management. Production MVP focused on the Data Lineage & Quality module for internal capability building at Data Reply.

## Core Value

**The ONE thing that must work:** AI agents that automatically profile data assets, recommend quality rules based on patterns, and validate data with actionable alerts — enabling data teams to trust their data without manual inspection.

## Target Users

- **Data Engineers** — Building pipelines, managing data quality
- **Data Architects** — Designing schemas, ensuring data standards
- **Business Analysts** — Exploring data, understanding quality issues

Expected scale: 10-50 users (internal team proving the concept)

## v1 Scope: Data Lineage & Quality Module

### Agents

1. **Data Profiler**
   - Scan data assets (S3/Iceberg, Redshift, RDS, External APIs)
   - Generate quality and completeness summaries
   - Detect patterns, distributions, anomalies

2. **DQ Recommender**
   - GenAI-powered validation rule suggestions
   - Context-aware recommendations based on data patterns
   - Industry-standard rule templates
   - Reasoning support (explains WHY each rule)

3. **Data Validator**
   - Execute validation rules against data sources
   - Real-time alerts on validation failures
   - Pipeline integration (Step Functions)
   - Actionable insights and remediation suggestions

### Lineage Tracking

- **Full lineage:** Column-level + transformations
- Track data flow from source to consumption
- Visualize dependencies and impact analysis

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend | Next.js on Vercel | Fast iteration, edge performance, as per architecture doc |
| Backend | AWS (Lambda/Step Functions) | Native integration with data sources |
| AI Provider | Amazon Bedrock (Claude) | Stays within AWS, enterprise compliance |
| Auth | AWS IAM/SSO | Federated with existing AWS identity |
| Database | Supabase (PostgreSQL) | Rapid development, real-time subscriptions |
| Data Sources | S3/Iceberg, Redshift, RDS/Aurora, External APIs | Cover primary enterprise data landscape |

## Constraints

- **Existing AWS infrastructure** — Must integrate with current AWS accounts/regions
- **AWS-native** — Tight coupling to AWS services is acceptable and preferred
- **Internal use** — Security via AWS IAM/SSO, no public access

## Out of Scope (v1)

- Data Modelling module (Phase 2)
- Scripts Conversion module (Phase 3)
- Multi-cloud support
- Public/external user access
- Mobile interface

## Success Criteria

1. Data Profiler can scan and profile S3/Iceberg tables with <5min latency for typical datasets
2. DQ Recommender generates relevant rules that users accept >70% of the time
3. Data Validator integrates with at least one production pipeline
4. Full column-level lineage visible for connected sources
5. Internal team actively using for real data quality workflows

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Start with Data Lineage & Quality | Foundational for data trust, enables other modules | — Active |
| AWS-native architecture | Leverage existing infrastructure, enterprise compliance | — Active |
| Vercel + AWS split | Frontend velocity on Vercel, backend power on AWS | — Active |
| All 3 agents in v1 | Complete value proposition for data quality workflow | — Active |

## Reference Materials

- `data-reply-architecture.md` — Full architecture proposal
- `data-reply-platform.jsx` — UI prototype/mockup

---
*Last updated: 2025-01-18 after initialization*
