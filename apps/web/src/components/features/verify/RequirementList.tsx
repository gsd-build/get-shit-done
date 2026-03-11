import { useState, useMemo } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import type { TestResult } from '@/types/verification';
import { RequirementItem } from './RequirementItem';

interface RequirementListProps {
  results: TestResult[];
}

/**
 * Group test results by requirementId.
 */
function groupByRequirement(
  results: TestResult[]
): Map<string, TestResult[]> {
  const grouped = new Map<string, TestResult[]>();

  for (const result of results) {
    const existing = grouped.get(result.requirementId) || [];
    grouped.set(result.requirementId, [...existing, result]);
  }

  return grouped;
}

/**
 * RequirementList - Expandable accordion of requirement groups.
 *
 * Groups test results by requirementId and renders each as an
 * expandable RequirementItem. Supports multiple items expanded.
 */
export function RequirementList({ results }: RequirementListProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Group results by requirementId
  const groupedResults = useMemo(
    () => groupByRequirement(results),
    [results]
  );

  const requirementIds = Array.from(groupedResults.keys());

  if (requirementIds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No test results yet
      </div>
    );
  }

  return (
    <Accordion.Root
      type="multiple"
      value={expandedItems}
      onValueChange={setExpandedItems}
      className="space-y-2"
    >
      {requirementIds.map((reqId) => {
        const tests = groupedResults.get(reqId) || [];
        const isExpanded = expandedItems.includes(reqId);

        return (
          <Accordion.Item key={reqId} value={reqId} asChild>
            <div>
              <RequirementItem
                requirementId={reqId}
                requirementName={`Requirement ${reqId}`}
                tests={tests}
                isExpanded={isExpanded}
                onToggle={() => {
                  setExpandedItems((prev) =>
                    prev.includes(reqId)
                      ? prev.filter((id) => id !== reqId)
                      : [...prev, reqId]
                  );
                }}
              />
            </div>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
