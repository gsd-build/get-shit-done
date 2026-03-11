/**
 * AgentLane component - stub for TDD RED phase.
 * Will be implemented to show single horizontal agent lane with status, action, timer.
 */

import type { ResearchAgent } from '@/types/plan';

export interface AgentLaneProps {
  agent: ResearchAgent;
  onClick?: () => void;
}

export function AgentLane(_props: AgentLaneProps) {
  // Stub - tests will fail
  return null;
}
