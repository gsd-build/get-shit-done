/**
 * ResearchSwimlanes component - container for agent lanes using CSS Grid.
 * GitHub Actions-like swimlane layout for research agents.
 */

import type { ResearchAgent } from '@/types/plan';
import { AgentLane } from './AgentLane';

export interface ResearchSwimlanesProps {
  agents: ResearchAgent[];
  onAgentClick?: (agentId: string) => void;
}

export function ResearchSwimlanes({ agents, onAgentClick }: ResearchSwimlanesProps) {
  return (
    <div
      role="list"
      aria-label="Research agents"
      className="grid grid-rows-[auto] gap-2 p-4"
    >
      {agents.map((agent) => (
        <AgentLane
          key={agent.id}
          agent={agent}
          {...(onAgentClick && { onClick: () => onAgentClick(agent.id) })}
        />
      ))}
    </div>
  );
}
