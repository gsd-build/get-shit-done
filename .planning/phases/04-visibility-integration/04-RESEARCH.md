# Phase 4: Visibility & Integration - Research

**Researched:** 2026-01-19
**Domain:** Dashboards, Notifications, REST APIs, Data Quality Scoring
**Confidence:** HIGH

## Summary

Phase 4 builds user-facing visibility features on top of existing validation infrastructure. The current codebase already has:
- `alerts` table with `notification_sent` and `notification_channels` fields
- `alert_handler` Lambda that emits EventBridge `AlertCreated` events
- `quality_scores` table storing per-dimension scores
- TanStack Query hooks pattern for data fetching
- Recharts for data visualization (already used in `distribution-chart.tsx`)

The primary work involves: (1) Adding notification handlers (Slack/Email) that subscribe to `AlertCreated` events, (2) Building a dashboard page with Recharts time-series charts, (3) Creating historical aggregation views with PostgreSQL window functions, and (4) Exposing a documented REST API via Next.js API routes with OpenAPI spec.

**Primary recommendation:** Leverage existing EventBridge event pattern from `alert_handler` Lambda - add new notification Lambda functions as subscribers rather than modifying the existing handler.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 2.14.0 | Dashboard charts | Already in use, React-native, great DX |
| @tanstack/react-query | 5.60.0 | Data fetching/caching | Already in use, established pattern |
| next-swagger-doc | 0.4.x | OpenAPI generation | JSDoc-based, works with App Router |
| swagger-ui-react | 5.x | API documentation UI | Standard Swagger UI for React |

### AWS Services
| Service | Purpose | Why Standard |
|---------|---------|--------------|
| SNS | Email notifications | Native AWS, simple pub/sub |
| SES | HTML email templates | Rich email formatting, AWS-native |
| EventBridge | Event routing | Already in use for alert events |
| Lambda (Python) | Notification handlers | Consistent with existing Lambdas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| boto3 | Latest | AWS SDK for Python | Lambda notification handlers |
| aws-lambda-powertools | 2.x | Logging/tracing | Consistent with existing Lambdas |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Tremor | Tremor is higher-level but Recharts already in codebase; consistency wins |
| SNS/SES | SendGrid/Mailgun | External services require additional setup; AWS-native preferred |
| next-swagger-doc | ts-rest | ts-rest is more type-safe but adds complexity; JSDoc sufficient for MVP |

**Installation:**
```bash
# Frontend
npm install next-swagger-doc swagger-ui-react

# Lambda (add to requirements.txt)
# boto3 and aws-lambda-powertools already available
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── app/
│   ├── (dashboard)/
│   │   ├── overview/               # NEW: Main dashboard page
│   │   │   └── page.tsx
│   │   └── layout.tsx              # Add "Overview" to nav
│   ├── api/
│   │   ├── v1/                     # NEW: REST API routes
│   │   │   ├── datasets/
│   │   │   │   └── route.ts
│   │   │   ├── quality-scores/
│   │   │   │   └── route.ts
│   │   │   └── alerts/
│   │   │       └── route.ts
│   │   └── docs/                   # NEW: Swagger UI route
│   │       └── page.tsx
├── components/features/
│   ├── dashboard/                  # NEW: Dashboard components
│   │   ├── health-overview.tsx
│   │   ├── quality-trend-chart.tsx
│   │   ├── alert-summary.tsx
│   │   └── domain-scores.tsx
│   └── validations/
│       └── quality-score-card.tsx  # EXISTING: Reuse
├── hooks/
│   ├── use-dashboard.ts            # NEW: Dashboard data hooks
│   └── use-quality-trends.ts       # NEW: Historical trends
└── lib/
    └── api-spec.ts                 # NEW: OpenAPI configuration

lambdas/
├── alert_handler/                  # EXISTING: Emits AlertCreated events
│   └── handler.py
├── slack_notifier/                 # NEW: Subscribes to AlertCreated
│   └── handler.py
└── email_notifier/                 # NEW: Subscribes to AlertCreated
    └── handler.py

infra/lib/
└── notification-stack.ts           # NEW: SNS topics, SES, notification Lambdas
```

### Pattern 1: EventBridge Fan-Out for Notifications

**What:** Existing `alert_handler` emits `AlertCreated` events; new notification Lambdas subscribe independently.

**When to use:** When you need multiple notification channels without tight coupling.

**Example:**
```python
# Source: Existing alert_handler pattern
# lambdas/slack_notifier/handler.py

import json
import os
import urllib.request
from aws_lambda_powertools import Logger

logger = Logger()

@logger.inject_lambda_context
def handler(event, context):
    """Subscribes to AlertCreated events from EventBridge."""
    detail = event.get("detail", {})

    webhook_url = os.environ["SLACK_WEBHOOK_URL"]

    # Build Slack Block Kit message
    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f":warning: {detail.get('title')}"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Severity:* {detail.get('severity')}"},
                {"type": "mrkdwn", "text": f"*Alert ID:* {detail.get('alert_id')}"}
            ]
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": detail.get('message', 'No details')}
        }
    ]

    payload = json.dumps({"blocks": blocks}).encode("utf-8")
    req = urllib.request.Request(webhook_url, data=payload, headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req)

    return {"status": "sent"}
```

### Pattern 2: PostgreSQL Window Functions for Historical Trends

**What:** Aggregate quality scores into daily/weekly rollups using SQL window functions.

**When to use:** Displaying historical trends in dashboard charts.

**Example:**
```sql
-- Source: PostgreSQL docs on window functions
-- Daily aggregation with running average

WITH daily_scores AS (
  SELECT
    dataset_id,
    dimension,
    DATE_TRUNC('day', measured_at) AS day,
    AVG(score) AS avg_score
  FROM quality_scores
  WHERE measured_at >= NOW() - INTERVAL '30 days'
  GROUP BY dataset_id, dimension, DATE_TRUNC('day', measured_at)
)
SELECT
  day,
  dimension,
  avg_score,
  AVG(avg_score) OVER (
    PARTITION BY dimension
    ORDER BY day
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_7day_avg
FROM daily_scores
ORDER BY day, dimension;
```

### Pattern 3: Weighted Quality Score Calculation

**What:** Composite quality score from weighted dimension scores.

**When to use:** Calculating overall table/domain health scores.

**Example:**
```typescript
// Source: DQOps and OvalEdge scoring patterns
interface DimensionWeight {
  completeness: number;
  validity: number;
  uniqueness: number;
  consistency: number;
  freshness: number;
}

const DEFAULT_WEIGHTS: DimensionWeight = {
  completeness: 0.25,
  validity: 0.25,
  uniqueness: 0.20,
  consistency: 0.15,
  freshness: 0.15,
};

function calculateCompositeScore(
  scores: QualityScore[],
  weights: DimensionWeight = DEFAULT_WEIGHTS
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const score of scores) {
    const weight = weights[score.dimension as keyof DimensionWeight];
    if (weight !== undefined) {
      weightedSum += score.score * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
```

### Pattern 4: Next.js API Routes with OpenAPI

**What:** REST API endpoints with JSDoc annotations for OpenAPI spec generation.

**When to use:** Exposing data to external consumers with documentation.

**Example:**
```typescript
// Source: next-swagger-doc documentation
// app/api/v1/quality-scores/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * @swagger
 * /api/v1/quality-scores:
 *   get:
 *     summary: Get quality scores
 *     description: Returns quality scores with optional filtering by dataset
 *     tags:
 *       - Quality Scores
 *     parameters:
 *       - in: query
 *         name: dataset_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by dataset ID
 *       - in: query
 *         name: dimension
 *         schema:
 *           type: string
 *           enum: [completeness, validity, uniqueness, consistency, freshness]
 *         description: Filter by dimension
 *     responses:
 *       200:
 *         description: Quality scores array
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/QualityScore'
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get('dataset_id');
  const dimension = searchParams.get('dimension');

  let query = supabase.from('quality_scores').select('*');

  if (datasetId) query = query.eq('dataset_id', datasetId);
  if (dimension) query = query.eq('dimension', dimension);

  const { data, error } = await query.order('measured_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

### Anti-Patterns to Avoid
- **Polling for notifications:** Use EventBridge subscriptions, not polling
- **Storing webhook URLs in code:** Use environment variables or Secrets Manager
- **N+1 queries for dashboard:** Use SQL aggregations, not client-side loops
- **Calculating trends in JavaScript:** Use PostgreSQL window functions
- **Hardcoding score weights:** Make weights configurable per domain

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slack message formatting | Plain text messages | Block Kit JSON | Rich formatting, interactive buttons, proper rendering |
| Email templates | String concatenation | SES Templates | Variable substitution, HTML/text fallback, preview |
| Time-series aggregation | JS loops over data | PostgreSQL window functions | Performance, proper date handling, memory efficiency |
| OpenAPI spec | Manual JSON/YAML | next-swagger-doc | Auto-generated from JSDoc, stays in sync with code |
| Chart responsiveness | Manual resize handlers | `<ResponsiveContainer>` | Recharts handles it, cross-browser tested |

**Key insight:** AWS services (SNS, SES) handle email deliverability, bounce handling, and rate limiting that would take weeks to build correctly.

## Common Pitfalls

### Pitfall 1: Slack Webhook URL Exposure
**What goes wrong:** Webhook URL committed to repo or logged
**Why it happens:** Developers test locally with hardcoded values
**How to avoid:** Always use environment variables; never log the full URL
**Warning signs:** URL appears in CloudWatch logs or git history

### Pitfall 2: SES Sandbox Mode
**What goes wrong:** Emails fail silently in production
**Why it happens:** SES accounts start in sandbox, only verified addresses work
**How to avoid:** Request production access early; verify sender domain
**Warning signs:** `MessageRejected` errors, emails only work to team addresses

### Pitfall 3: Dashboard Query Performance
**What goes wrong:** Dashboard loads slowly with many datasets
**Why it happens:** Fetching all raw scores instead of aggregations
**How to avoid:** Create materialized views or use SQL aggregations
**Warning signs:** Dashboard takes >2s to load, browser freezes

### Pitfall 4: Time Zone Confusion in Trends
**What goes wrong:** Charts show wrong days, data appears shifted
**Why it happens:** Mixing UTC timestamps with local time display
**How to avoid:** Store everything in UTC (TIMESTAMPTZ), convert only for display
**Warning signs:** Data "jumps" at midnight, off-by-one day errors

### Pitfall 5: Notification Storm
**What goes wrong:** 100s of notifications in minutes
**Why it happens:** Validation failures trigger alerts for every rule
**How to avoid:** Implement alert batching or rate limiting
**Warning signs:** User complaints about notification spam

## Code Examples

Verified patterns from official sources:

### Recharts Time-Series Line Chart
```typescript
// Source: Recharts examples, adapted for quality trends
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TrendDataPoint {
  date: string;
  completeness: number;
  validity: number;
  uniqueness: number;
  consistency: number;
  freshness: number;
}

export function QualityTrendChart({ data }: { data: TrendDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(value) => `${Math.round(value * 100)}%`}
        />
        <Tooltip
          formatter={(value: number) => [`${Math.round(value * 100)}%`]}
          labelFormatter={(label) => new Date(label).toLocaleDateString()}
        />
        <Legend />
        <Line type="monotone" dataKey="completeness" stroke="#22c55e" dot={false} />
        <Line type="monotone" dataKey="validity" stroke="#3b82f6" dot={false} />
        <Line type="monotone" dataKey="uniqueness" stroke="#8b5cf6" dot={false} />
        <Line type="monotone" dataKey="consistency" stroke="#f59e0b" dot={false} />
        <Line type="monotone" dataKey="freshness" stroke="#ec4899" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### AWS SES Email with Template (Python)
```python
# Source: AWS SES Boto3 documentation
import boto3
import json

ses_client = boto3.client('ses', region_name='us-east-1')

def send_alert_email(alert_detail: dict, recipient: str):
    """Send alert notification email using SES template."""

    template_data = {
        "alert_title": alert_detail.get("title"),
        "severity": alert_detail.get("severity"),
        "message": alert_detail.get("message"),
        "alert_id": alert_detail.get("alert_id"),
        "dashboard_url": f"https://app.example.com/alerts/{alert_detail.get('alert_id')}"
    }

    response = ses_client.send_templated_email(
        Source='alerts@example.com',
        Destination={
            'ToAddresses': [recipient]
        },
        Template='DataQualityAlertTemplate',
        TemplateData=json.dumps(template_data)
    )

    return response['MessageId']
```

### Dashboard Hook with Aggregation
```typescript
// Source: TanStack Query patterns from existing codebase
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  total_datasets: number;
  avg_quality_score: number;
  open_alerts: number;
  critical_alerts: number;
  datasets_below_threshold: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async (): Promise<DashboardStats> => {
      // Parallel queries for efficiency
      const [datasetsResult, scoresResult, alertsResult] = await Promise.all([
        supabase.from('datasets').select('*', { count: 'exact', head: true }),
        supabase.rpc('get_latest_quality_scores'),  // Custom function
        supabase.from('alerts').select('severity', { count: 'exact' })
          .eq('status', 'open'),
      ]);

      return {
        total_datasets: datasetsResult.count || 0,
        avg_quality_score: scoresResult.data?.[0]?.avg_score || 0,
        open_alerts: alertsResult.count || 0,
        critical_alerts: alertsResult.data?.filter(a => a.severity === 'critical').length || 0,
        datasets_below_threshold: scoresResult.data?.[0]?.below_threshold || 0,
      };
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}
```

### OpenAPI Spec Configuration
```typescript
// Source: next-swagger-doc documentation
// lib/api-spec.ts

import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: 'app/api/v1',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Data Foundations API',
        version: '1.0.0',
        description: 'REST API for metadata and quality results',
      },
      servers: [
        { url: '/api/v1', description: 'API v1' },
      ],
      components: {
        schemas: {
          QualityScore: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              dataset_id: { type: 'string', format: 'uuid' },
              dimension: {
                type: 'string',
                enum: ['completeness', 'validity', 'uniqueness', 'consistency', 'freshness']
              },
              score: { type: 'number', minimum: 0, maximum: 1 },
              measured_at: { type: 'string', format: 'date-time' },
            },
          },
          Alert: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              alert_type: { type: 'string', enum: ['rule_failure', 'freshness_sla', 'volume_anomaly'] },
              severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
              status: { type: 'string', enum: ['open', 'acknowledged', 'resolved', 'snoozed'] },
              title: { type: 'string' },
              message: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
    },
  });
  return spec;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy Slack webhooks | Slack App webhooks | 2020 | Interactive messages, better security |
| SES v1 API | SES v2 API | 2020 | Templates, better error handling |
| Manual OpenAPI YAML | JSDoc + auto-generation | 2022 | Spec stays in sync with code |
| Client-side aggregation | SQL window functions | Always | Performance, less data transfer |

**Deprecated/outdated:**
- Legacy Slack custom integrations: Use Slack App webhooks instead
- SES `send_email` for templates: Use `send_templated_email` instead
- Recharts 1.x: 2.x has better TypeScript support and performance

## Open Questions

Things that couldn't be fully resolved:

1. **Domain-level score aggregation**
   - What we know: Weighted scoring per table works well
   - What's unclear: How to define "domains" (business areas) - database schema? tags? folder structure?
   - Recommendation: Start with per-dataset scores; add domain grouping as a future enhancement

2. **Notification preferences storage**
   - What we know: Need per-user Slack/email preferences
   - What's unclear: Where to store (Supabase? Slack user IDs? Email list?)
   - Recommendation: Start with environment variable configuration; add user preferences table later

3. **Historical data retention**
   - What we know: quality_scores grows over time
   - What's unclear: How long to keep granular data vs aggregates
   - Recommendation: Keep 90 days granular, aggregate to daily after that via scheduled job

## Sources

### Primary (HIGH confidence)
- [AWS Lambda SNS Tutorial](https://docs.aws.amazon.com/lambda/latest/dg/with-sns-example.html) - SNS + Lambda integration
- [AWS SES Boto3 Templates](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/ses-template.html) - Email templating
- [Slack Incoming Webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/) - Slack webhook API
- [PostgreSQL Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html) - Time-series aggregation
- [next-swagger-doc GitHub](https://github.com/jellydn/next-swagger-doc) - OpenAPI for Next.js

### Secondary (MEDIUM confidence)
- [DQOps Data Quality KPIs](https://dqops.com/docs/dqo-concepts/definition-of-data-quality-kpis/) - Scoring methodology
- [DataKitchen Dashboard Types](https://datakitchen.io/the-six-types-of-data-quality-dashboards/) - Dashboard design patterns
- [Recharts Examples](https://recharts.github.io/en-US/examples/SimpleLineChart/) - Chart implementations

### Tertiary (LOW confidence)
- WebSearch results on Recharts vs Tremor - preference is subjective; stick with Recharts for consistency

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Leverages existing libraries (Recharts, TanStack Query)
- Architecture: HIGH - Extends established EventBridge pattern
- Notifications: MEDIUM - Slack/SES patterns well-documented but require AWS verification
- Dashboard design: MEDIUM - Based on industry patterns, needs user feedback
- Pitfalls: HIGH - Common issues well-documented in AWS forums

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (30 days - stable domain)
