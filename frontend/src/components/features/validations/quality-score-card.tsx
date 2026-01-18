'use client';

import { QualityScore } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QualityScoreCardProps {
  score: QualityScore;
  previousScore?: number;
  onClick?: () => void;
}

// Icons for each dimension
const dimensionIcons: Record<string, string> = {
  completeness: 'C',
  validity: 'V',
  uniqueness: 'U',
  consistency: 'S',
  freshness: 'F',
};

const dimensionLabels: Record<string, string> = {
  completeness: 'Completeness',
  validity: 'Validity',
  uniqueness: 'Uniqueness',
  consistency: 'Consistency',
  freshness: 'Freshness',
};

const dimensionDescriptions: Record<string, string> = {
  completeness: 'Measures non-null values',
  validity: 'Measures format and range compliance',
  uniqueness: 'Measures distinct values',
  consistency: 'Measures cross-field coherence',
  freshness: 'Measures data recency',
};

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 0.8) return 'bg-green-50';
  if (score >= 0.6) return 'bg-yellow-50';
  return 'bg-red-50';
}

function getTrendIcon(current: number, previous: number | undefined): { icon: string; color: string } | null {
  if (previous === undefined) return null;

  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return null; // No significant change

  if (diff > 0) {
    return { icon: '\u2191', color: 'text-green-500' }; // Up arrow
  }
  return { icon: '\u2193', color: 'text-red-500' }; // Down arrow
}

export function QualityScoreCard({ score, previousScore, onClick }: QualityScoreCardProps) {
  const scorePercent = Math.round(score.score * 100);
  const trend = getTrendIcon(score.score, previousScore);

  return (
    <Card
      className={`${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${getScoreBgColor(score.score)}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {dimensionIcons[score.dimension]}
            </span>
            <span>{dimensionLabels[score.dimension]}</span>
          </div>
          {trend && (
            <span className={`text-lg ${trend.color}`}>{trend.icon}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${getScoreColor(score.score)}`}>
            {scorePercent}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {dimensionDescriptions[score.dimension]}
        </p>
      </CardContent>
    </Card>
  );
}

interface QualityScoreGridProps {
  scores: QualityScore[];
  previousScores?: QualityScore[];
  onDimensionClick?: (dimension: string) => void;
}

/**
 * Grid display for all quality dimension scores
 */
export function QualityScoreGrid({ scores, previousScores, onDimensionClick }: QualityScoreGridProps) {
  const getPreviousScore = (dimension: string): number | undefined => {
    return previousScores?.find((s) => s.dimension === dimension)?.score;
  };

  // Sort by dimension order
  const dimensionOrder = ['completeness', 'validity', 'uniqueness', 'consistency', 'freshness'];
  const sortedScores = [...scores].sort(
    (a, b) => dimensionOrder.indexOf(a.dimension) - dimensionOrder.indexOf(b.dimension)
  );

  if (sortedScores.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No quality dimension scores available yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {sortedScores.map((score) => (
        <QualityScoreCard
          key={score.id}
          score={score}
          previousScore={getPreviousScore(score.dimension)}
          onClick={onDimensionClick ? () => onDimensionClick(score.dimension) : undefined}
        />
      ))}
    </div>
  );
}
