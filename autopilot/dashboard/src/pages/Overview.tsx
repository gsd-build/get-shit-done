// Overview page: main dashboard landing page composing all overview components.
// Wired to Zustand store with individual selectors for each data slice.

import { useDashboardStore } from '../store/index.js';
import { TunnelBanner } from '../components/TunnelBanner.js';
import { RemoteSessionCard } from '../components/RemoteSessionCard.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { PhaseCard } from '../components/PhaseCard.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import { LogStream } from '../components/LogStream.js';
import { VictoryScreen } from '../components/VictoryScreen.js';

export function Overview() {
  const status = useDashboardStore((s) => s.status);
  const progress = useDashboardStore((s) => s.progress);
  const phases = useDashboardStore((s) => s.phases);
  const currentPhase = useDashboardStore((s) => s.currentPhase);
  const activities = useDashboardStore((s) => s.activities);
  const logs = useDashboardStore((s) => s.logs);
  const projectName = useDashboardStore((s) => s.projectName);
  const projectDescription = useDashboardStore((s) => s.projectDescription);
  const currentMilestone = useDashboardStore((s) => s.currentMilestone);
  const milestones = useDashboardStore((s) => s.milestones);

  // Victory screen state: Milestone just shipped (status === 'shipped' OR currentMilestone is null but shipped milestones exist)
  const shouldShowVictory =
    currentMilestone?.status === 'shipped' ||
    (currentMilestone === null && milestones.length > 0 && milestones[0]);

  const victoryMilestone = currentMilestone?.status === 'shipped'
    ? currentMilestone
    : milestones[0];

  // If victory screen should be shown, render it instead of normal overview
  if (shouldShowVictory && victoryMilestone) {
    return <VictoryScreen milestone={victoryMilestone} />;
  }

  // No active milestone state: No milestone at all (fresh project or between milestones)
  const showNoMilestone = currentMilestone === null && milestones.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Tunnel banner (top of page, before all content) */}
      <TunnelBanner />

      {/* Remote session card (below tunnel banner) */}
      <RemoteSessionCard />

      {/* Project description */}
      {projectDescription && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {projectName || 'Project'}
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">{projectDescription}</p>
        </div>
      )}

      {/* No active milestone card */}
      {showNoMilestone && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-600">No active milestone</p>
          <p className="text-xs text-gray-400 mt-1">
            Run <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">/gsd:new-milestone</code> to define your first milestone
          </p>
        </div>
      )}

      {/* Progress bar (full width) */}
      <ProgressBar progress={progress} isInitializing={status === 'running' && phases.length === 0} />

      {/* Main content: Left column (Phases + Logs) | Right column (Activity feed spanning both) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Phases then Logs stacked */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <PhaseCard
            phases={phases}
            currentPhase={currentPhase}
          />
          <LogStream logs={logs} collapsible={true} />
        </div>

        {/* Right column: Activity feed pinned to viewport height */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] flex flex-col">
            <ActivityFeed activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
