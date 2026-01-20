-- Data Foundations Platform: Quality Trends Functions
-- Migration: 005_quality_trends
-- Description: Creates functions for quality trend aggregation, composite scoring, and dashboard stats

-- ============================================================================
-- Function 1: get_quality_trends
-- Returns daily aggregated scores for trend charts with 7-day rolling average
-- ============================================================================
CREATE OR REPLACE FUNCTION get_quality_trends(
  p_dataset_id UUID,
  p_days INTEGER DEFAULT 30
) RETURNS TABLE (
  day DATE,
  dimension VARCHAR(50),
  avg_score DECIMAL(5,4),
  rolling_7day_avg DECIMAL(5,4)
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_scores AS (
    SELECT
      DATE_TRUNC('day', qs.measured_at)::DATE AS day,
      qs.dimension,
      AVG(qs.score) AS avg_score
    FROM quality_scores qs
    WHERE qs.dataset_id = p_dataset_id
      AND qs.measured_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE_TRUNC('day', qs.measured_at)::DATE, qs.dimension
  )
  SELECT
    ds.day,
    ds.dimension,
    ds.avg_score,
    AVG(ds.avg_score) OVER (
      PARTITION BY ds.dimension
      ORDER BY ds.day
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_7day_avg
  FROM daily_scores ds
  ORDER BY ds.day, ds.dimension;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_quality_trends(UUID, INTEGER) IS
  'Returns daily aggregated quality scores with 7-day rolling average for trend visualization';

-- ============================================================================
-- Function 2: get_composite_quality_score
-- Returns weighted composite score using dimension weights:
-- completeness: 0.25, validity: 0.25, uniqueness: 0.20, consistency: 0.15, freshness: 0.15
-- ============================================================================
CREATE OR REPLACE FUNCTION get_composite_quality_score(p_dataset_id UUID)
RETURNS DECIMAL(5,4) AS $$
DECLARE
  v_score DECIMAL(5,4);
BEGIN
  WITH latest_scores AS (
    SELECT DISTINCT ON (dimension)
      dimension,
      score
    FROM quality_scores
    WHERE dataset_id = p_dataset_id
    ORDER BY dimension, measured_at DESC
  ),
  weighted AS (
    SELECT
      SUM(
        CASE dimension
          WHEN 'completeness' THEN score * 0.25
          WHEN 'validity' THEN score * 0.25
          WHEN 'uniqueness' THEN score * 0.20
          WHEN 'consistency' THEN score * 0.15
          WHEN 'freshness' THEN score * 0.15
          ELSE 0
        END
      ) AS weighted_sum,
      SUM(
        CASE dimension
          WHEN 'completeness' THEN 0.25
          WHEN 'validity' THEN 0.25
          WHEN 'uniqueness' THEN 0.20
          WHEN 'consistency' THEN 0.15
          WHEN 'freshness' THEN 0.15
          ELSE 0
        END
      ) AS total_weight
    FROM latest_scores
  )
  SELECT
    CASE WHEN total_weight > 0
      THEN weighted_sum / total_weight
      ELSE NULL
    END INTO v_score
  FROM weighted;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_composite_quality_score(UUID) IS
  'Returns weighted composite quality score from latest dimension scores. Weights: completeness 25%, validity 25%, uniqueness 20%, consistency 15%, freshness 15%';

-- ============================================================================
-- Function 3: get_dashboard_stats
-- Returns aggregated stats for dashboard overview
-- ============================================================================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_datasets BIGINT,
  avg_composite_score DECIMAL(5,4),
  datasets_above_threshold BIGINT,
  datasets_below_threshold BIGINT,
  open_alerts BIGINT,
  critical_alerts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH dataset_scores AS (
    SELECT
      d.id,
      get_composite_quality_score(d.id) AS composite_score
    FROM datasets d
  )
  SELECT
    (SELECT COUNT(*) FROM datasets)::BIGINT AS total_datasets,
    (SELECT AVG(ds.composite_score) FROM dataset_scores ds WHERE ds.composite_score IS NOT NULL) AS avg_composite_score,
    (SELECT COUNT(*) FROM dataset_scores ds WHERE ds.composite_score >= 0.8)::BIGINT AS datasets_above_threshold,
    (SELECT COUNT(*) FROM dataset_scores ds WHERE ds.composite_score < 0.8 AND ds.composite_score IS NOT NULL)::BIGINT AS datasets_below_threshold,
    (SELECT COUNT(*) FROM alerts WHERE status = 'open')::BIGINT AS open_alerts,
    (SELECT COUNT(*) FROM alerts WHERE status = 'open' AND severity = 'critical')::BIGINT AS critical_alerts;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_dashboard_stats() IS
  'Returns aggregated dashboard statistics: dataset counts, average quality score, alert counts. Quality threshold is 0.8 (80%)';

-- ============================================================================
-- Function 4: get_dataset_quality_summary
-- Returns quality summary for a single dataset
-- ============================================================================
CREATE OR REPLACE FUNCTION get_dataset_quality_summary(p_dataset_id UUID)
RETURNS TABLE (
  dimension VARCHAR(50),
  latest_score DECIMAL(5,4),
  previous_score DECIMAL(5,4),
  trend VARCHAR(10),
  last_measured_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_scores AS (
    SELECT
      qs.dimension,
      qs.score,
      qs.measured_at,
      ROW_NUMBER() OVER (PARTITION BY qs.dimension ORDER BY qs.measured_at DESC) AS rn
    FROM quality_scores qs
    WHERE qs.dataset_id = p_dataset_id
  ),
  latest AS (
    SELECT dimension, score, measured_at FROM ranked_scores WHERE rn = 1
  ),
  previous AS (
    SELECT dimension, score FROM ranked_scores WHERE rn = 2
  )
  SELECT
    l.dimension,
    l.score AS latest_score,
    p.score AS previous_score,
    CASE
      WHEN p.score IS NULL THEN 'new'
      WHEN l.score > p.score THEN 'up'
      WHEN l.score < p.score THEN 'down'
      ELSE 'stable'
    END::VARCHAR(10) AS trend,
    l.measured_at AS last_measured_at
  FROM latest l
  LEFT JOIN previous p ON l.dimension = p.dimension
  ORDER BY l.dimension;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_dataset_quality_summary(UUID) IS
  'Returns quality summary for a dataset with latest/previous scores and trend direction';

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_quality_trends(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_composite_quality_score(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dataset_quality_summary(UUID) TO authenticated;
