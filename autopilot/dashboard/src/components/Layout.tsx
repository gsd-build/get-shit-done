// Layout shell: shared header with nav, connection indicator, SSE hook, and initial data fetch.

import { useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router';
import { useSSE } from '../hooks/useSSE.js';
import { useDashboardStore } from '../store/index.js';
import { fetchStatus, fetchPhases, fetchQuestions } from '../api/client.js';
import { NotificationToggle } from './NotificationToggle.js';
import { useBadgeCount } from '../hooks/useBadgeCount.js';
import { useNotificationSound } from '../hooks/useNotificationSound.js';

export function Layout() {
  const connected = useDashboardStore((s) => s.connected);
  const autopilotAlive = useDashboardStore((s) => s.autopilotAlive);
  const questions = useDashboardStore((s) => s.questions);
  const projectName = useDashboardStore((s) => s.projectName);

  // Establish SSE connection once for the entire app
  useSSE();

  // Update browser badge with pending question count
  useBadgeCount();

  // Play notification sound when questions arrive (if tab is open)
  useNotificationSound();

  // Update browser tab title with project name
  useEffect(() => {
    document.title = projectName ? `${projectName} - GSD Autopilot` : 'GSD Autopilot';
  }, [projectName]);

  // Load initial data on mount
  useEffect(() => {
    void Promise.all([fetchStatus(), fetchPhases(), fetchQuestions()]).then(
      ([statusRes, phasesRes, questionsRes]) => {
        const store = useDashboardStore.getState();
        store.setStatus({
          status: statusRes.status,
          currentPhase: statusRes.currentPhase,
          currentStep: statusRes.currentStep,
          progress: statusRes.progress,
          projectName: statusRes.projectName ?? '',
          projectDescription: statusRes.projectDescription ?? '',
        });
        store.setAutopilotAlive(statusRes.alive);
        store.setPhases(phasesRes.phases);
        store.setQuestions(questionsRes.questions);
      },
    );
  }, []);

  const location = useLocation();
  const onQuestionPage = location.pathname.startsWith('/questions/');
  const hasQuestions = questions.length > 0;
  const showQuestionBanner = hasQuestions && !onQuestionPage;
  const firstQuestion = hasQuestions ? questions[0]! : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* App title + connection indicator */}
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                GSD Autopilot <span className="font-normal text-gray-400">by</span> <img src="/nexera.png" alt="Nexera" className="h-4 -mb-0.5" />
                <span
                  className={`w-2 h-2 rounded-full ${
                    !connected ? 'bg-red-400' : !autopilotAlive ? 'bg-amber-400' : 'bg-green-400'
                  }`}
                  title={!connected ? 'Disconnected' : !autopilotAlive ? 'Autopilot stopped' : 'Connected'}
                />
              </h1>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-6">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-white border-b-2 border-blue-400 pb-0.5'
                      : 'text-gray-400 hover:text-gray-200'
                  }`
                }
              >
                Overview
              </NavLink>
              <NavLink
                to="/logs"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-white border-b-2 border-blue-400 pb-0.5'
                      : 'text-gray-400 hover:text-gray-200'
                  }`
                }
              >
                Logs
              </NavLink>
              <NotificationToggle />
            </nav>
          </div>
        </div>
      </header>

      {/* Alert bar (fixed below header) */}
      {!connected ? (
        <div className="fixed top-14 left-0 right-0 z-40 bg-gradient-to-r from-red-600 to-red-500 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 py-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
              </span>
              <span className="text-sm font-medium text-white">
                Disconnected from autopilot server
              </span>
              <span className="text-xs text-red-200 ml-auto">Reconnecting&hellip;</span>
            </div>
          </div>
        </div>
      ) : !autopilotAlive ? (
        <div className="fixed top-14 left-0 right-0 z-40 bg-gradient-to-r from-amber-500 to-amber-400 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 py-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
              </span>
              <span className="text-sm font-medium text-white">
                Autopilot process has stopped
              </span>
              <span className="text-xs text-amber-100 ml-auto">Dashboard still connected</span>
            </div>
          </div>
        </div>
      ) : showQuestionBanner ? (
        <div className="fixed top-14 left-0 right-0 z-40 bg-gradient-to-r from-amber-500 to-orange-500 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link
              to={`/questions/${firstQuestion!.id}`}
              className="flex items-center gap-3 py-2.5 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 group"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm">
                <span className="text-white text-xs font-bold">{questions.length}</span>
              </span>
              <span className="text-sm font-medium text-white">
                {questions.length === 1 ? 'question needs' : 'questions need'} your attention
              </span>
              <span className="text-xs text-white/70 ml-auto group-hover:text-white transition-colors">
                Click to respond &rarr;
              </span>
            </Link>
          </div>
        </div>
      ) : null}

      {/* Main content area (offset for fixed header + optional alert bar) */}
      <main className={!connected || !autopilotAlive || showQuestionBanner ? 'pt-24' : 'pt-14'}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
