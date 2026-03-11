/**
 * Types for Plan phase UI - research agent visualization (swimlanes).
 *
 * These types support the research agent state management and streaming.
 */

/** Status of a research agent */
export type AgentStatus = 'pending' | 'running' | 'complete' | 'error';

/** Research agent state for swimlane visualization */
export interface ResearchAgent {
  id: string;
  name: string;
  status: AgentStatus;
  currentAction?: string;
  elapsedMs: number;
  summary?: string;
  error?: string;
}

/** Plan task definition */
export interface PlanTask {
  id: string;
  name: string;
  description: string;
  wave: number;
  dependsOn: string[];
  files?: string[];
  type: 'auto' | 'checkpoint:human-verify' | 'checkpoint:decision' | 'checkpoint:human-action';
}

/** Plan state */
export interface Plan {
  id: string;
  phaseId: string;
  tasks: PlanTask[];
  createdAt: string;
}
