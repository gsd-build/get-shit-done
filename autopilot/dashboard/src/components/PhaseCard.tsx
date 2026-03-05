// Phase overview card (DASH-11).
// Shows ALL phases with status indicators. Current phase is highlighted.
// During init (no phases yet), shows an "Initializing" state.

import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useDashboardStore } from '../store/index.js';
import type { PhaseState, PhaseStep } from '../types/index.js';

interface PhaseCardProps {
  phases: PhaseState[];
  currentPhase: number;
}

function padPhaseDisplay(num: number): string {
  const str = String(num);
  const dotIndex = str.indexOf('.');
  if (dotIndex === -1) return str.padStart(2, '0');
  return str.slice(0, dotIndex).padStart(2, '0') + str.slice(dotIndex);
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-yellow-100 text-yellow-700',
};

const STEP_ORDER = ['discuss', 'plan', 'execute', 'verify'] as const;
type StepKey = (typeof STEP_ORDER)[number];

function StepDot({ stepName, stepStatus, isActive }: {
  stepName: string;
  stepStatus: PhaseStep;
  isActive: boolean;
}) {
  let dotClass = 'w-2.5 h-2.5 rounded-full border-2 ';

  if (stepStatus === 'done') {
    dotClass += 'bg-green-500 border-green-500';
  } else if (isActive) {
    dotClass += 'bg-blue-500 border-blue-500 animate-pulse';
  } else {
    dotClass += 'bg-white border-gray-300';
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={dotClass} />
      <span className="text-[10px] text-gray-400">{stepName}</span>
    </div>
  );
}

function PhaseRow({ phase, isCurrent }: {
  phase: PhaseState;
  isCurrent: boolean;
}) {
  const statusColor = STATUS_COLORS[phase.status] ?? STATUS_COLORS['pending']!;
  const borderClass = isCurrent ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100';

  return (
    <Link
      to={`/phases/${String(phase.number)}`}
      data-phase={phase.number}
      className={`block rounded-lg border ${borderClass} p-3 hover:shadow-sm transition-shadow`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400">
            {padPhaseDisplay(phase.number)}
          </span>
          <span className={`text-sm font-medium ${isCurrent ? 'text-gray-900' : 'text-gray-700'}`}>
            {phase.name}
          </span>
          {phase.inserted && (
            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700 uppercase tracking-wide">
              inserted
            </span>
          )}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${statusColor}`}
        >
          {phase.status.replace('_', ' ')}
        </span>
      </div>

      {/* Step progress dots */}
      <div className="flex items-center gap-3 ml-6">
        {STEP_ORDER.map((step) => {
          const stepStatus = phase.steps[step];
          const isActive = isCurrent && stepStatus !== 'idle' && stepStatus !== 'done' && stepStatus === step;
          return (
            <StepDot
              key={step}
              stepName={step}
              stepStatus={stepStatus}
              isActive={isActive}
            />
          );
        })}
      </div>
    </Link>
  );
}

export function PhaseCard({ phases, currentPhase }: PhaseCardProps) {
  const currentMilestone = useDashboardStore((s) => s.currentMilestone);
  const autopilotAlive = useDashboardStore((s) => s.autopilotAlive);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  // Auto-scroll to the in-progress phase on initial load
  useEffect(() => {
    if (hasScrolledRef.current || currentPhase === 0 || phases.length === 0) return;
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-phase="${currentPhase}"]`);
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      hasScrolledRef.current = true;
    }
  }, [currentPhase, phases.length]);

  if (phases.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 shadow-sm p-6 bg-white">
        <div className="flex items-center gap-3">
          {autopilotAlive ? (
            <>
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              <div>
                <p className="text-sm font-medium text-gray-700">Initializing project...</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Setting up research, requirements, and roadmap
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-700">No phases yet</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Run <code className="text-xs bg-gray-100 px-1 rounded">/gsd:autopilot</code> to start
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const completedCount = phases.filter((p) => p.status === 'completed').length;
  const totalCount = phases.length;

  return (
    <div className="rounded-lg border border-gray-200 shadow-sm p-6 bg-white">
      <div className="flex items-center justify-between mb-4">
        {currentMilestone ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-700">
              {currentMilestone.version} {currentMilestone.name} — Phases
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Milestone {currentMilestone.phasesCompleted} of {currentMilestone.phaseCount} phases complete
            </p>
          </div>
        ) : (
          <h3 className="text-sm font-semibold text-gray-700">Phases</h3>
        )}
        <span className="text-xs text-gray-400">
          {completedCount}/{totalCount} complete
        </span>
      </div>
      <div ref={containerRef} className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {phases.map((phase) => (
          <PhaseRow
            key={phase.number}
            phase={phase}
            isCurrent={phase.number === currentPhase}
          />
        ))}
      </div>
    </div>
  );
}
