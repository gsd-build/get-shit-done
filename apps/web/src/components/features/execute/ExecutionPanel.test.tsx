/**
 * ExecutionPanel component tests
 *
 * Tests for the main execution panel container that integrates all execute components.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutionPanel } from './ExecutionPanel';

// Mock all child components to isolate testing
vi.mock('./ExecutionControls', () => ({
  ExecutionControls: () => <div data-testid="execution-controls">Controls</div>,
}));

vi.mock('./TddIndicator', () => ({
  TddIndicator: ({ phase }: { phase: string | null }) => (
    <div data-testid="tdd-indicator" data-phase={phase}>
      TDD Indicator
    </div>
  ),
}));

vi.mock('./PipelineView', () => ({
  PipelineView: ({ waves }: { waves: unknown[] }) => (
    <div data-testid="pipeline-view" data-wave-count={waves.length}>
      Pipeline View
    </div>
  ),
}));

vi.mock('./DiffPanel', () => ({
  DiffPanel: () => <div data-testid="diff-panel">Diff Panel</div>,
}));

vi.mock('./CheckpointModal', () => ({
  CheckpointModal: ({
    checkpoint,
  }: {
    checkpoint: { prompt: string } | null;
    onRespond: (response: string) => void;
  }) =>
    checkpoint ? (
      <div data-testid="checkpoint-modal">{checkpoint.prompt}</div>
    ) : null,
}));

vi.mock('./ErrorRecovery', () => ({
  ErrorRecovery: ({ error }: { error: { message: string } }) => (
    <div data-testid="error-recovery">{error.message}</div>
  ),
}));

// Use vi.hoisted to create mutable state that can be modified in tests
const { mockState, mockSetCheckpoint } = vi.hoisted(() => ({
  mockState: {
    status: 'idle' as string,
    tddPhase: null as string | null,
    pendingCheckpoint: null as { checkpointId: string; prompt: string; options?: unknown[] } | null,
    plans: new Map<string, unknown>(),
    agentId: null as string | null,
    setCheckpoint: vi.fn(),
  },
  mockSetCheckpoint: vi.fn(),
}));

// Mock zustand store
vi.mock('@/stores/executionStore', () => {
  // Selectors defined inside the factory
  const selectTddPhase = (state: { tddPhase: string | null }) => state.tddPhase;
  const selectStatus = (state: { status: string }) => state.status;
  const selectPendingCheckpoint = (state: { pendingCheckpoint: unknown }) =>
    state.pendingCheckpoint;
  const selectPlans = (state: { plans: Map<string, unknown> }) => state.plans;
  const selectAgentId = (state: { agentId: string | null }) => state.agentId;

  return {
    useExecutionStore: (selector: (state: typeof mockState) => unknown) => {
      // Handle action selector (setCheckpoint)
      if (typeof selector === 'function') {
        const result = selector(mockState);
        // If it returned setCheckpoint, return the mock
        if (result === mockState.setCheckpoint) {
          return mockSetCheckpoint;
        }
        return result;
      }
      return mockState;
    },
    selectTddPhase,
    selectStatus,
    selectPendingCheckpoint,
    selectPlans,
    selectAgentId,
  };
});

// Mock react-resizable-panels (using v4 API names: Group, Separator)
vi.mock('react-resizable-panels', () => ({
  Panel: ({
    children,
    defaultSize,
    minSize,
  }: {
    children: React.ReactNode;
    defaultSize: number;
    minSize: number;
  }) => (
    <div data-testid="panel" data-default-size={defaultSize} data-min-size={minSize}>
      {children}
    </div>
  ),
  Group: ({
    children,
    orientation,
    className,
  }: {
    children: React.ReactNode;
    orientation: string;
    className: string;
  }) => (
    <div data-testid="panel-group" data-orientation={orientation} className={className}>
      {children}
    </div>
  ),
  Separator: ({ className }: { className: string }) => (
    <div data-testid="panel-resize-handle" className={className} />
  ),
}));

describe('ExecutionPanel', () => {
  // Reset mock state before each test
  beforeEach(() => {
    mockState.status = 'idle';
    mockState.tddPhase = null;
    mockState.pendingCheckpoint = null;
    mockState.plans = new Map();
    mockState.agentId = null;
    mockSetCheckpoint.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('header rendering', () => {
    it('renders header with controls', () => {
      render(<ExecutionPanel waves={[]} />);

      expect(screen.getByTestId('execution-controls')).toBeInTheDocument();
    });

    it('renders TddIndicator in header area', () => {
      mockState.tddPhase = 'red';

      render(<ExecutionPanel waves={[]} />);

      expect(screen.getByTestId('tdd-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('tdd-indicator')).toHaveAttribute(
        'data-phase',
        'red'
      );
    });
  });

  describe('main content area', () => {
    it('renders pipeline view in main area', () => {
      const waves = [
        { id: 'wave-1', status: 'running' as const, plans: [] },
      ];
      render(<ExecutionPanel waves={waves} />);

      const pipelineView = screen.getByTestId('pipeline-view');
      expect(pipelineView).toBeInTheDocument();
      expect(pipelineView).toHaveAttribute('data-wave-count', '1');
    });

    it('renders diff panel in sidebar', () => {
      render(<ExecutionPanel waves={[]} />);

      expect(screen.getByTestId('diff-panel')).toBeInTheDocument();
    });

    it('renders resizable panel group with horizontal direction', () => {
      render(<ExecutionPanel waves={[]} />);

      const panelGroup = screen.getByTestId('panel-group');
      expect(panelGroup).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('renders panel resize handle between panels', () => {
      render(<ExecutionPanel waves={[]} />);

      expect(screen.getByTestId('panel-resize-handle')).toBeInTheDocument();
    });
  });

  describe('checkpoint modal', () => {
    it('does not render checkpoint modal when no pending checkpoint', () => {
      render(<ExecutionPanel waves={[]} />);

      expect(screen.queryByTestId('checkpoint-modal')).not.toBeInTheDocument();
    });

    it('shows checkpoint modal when pendingCheckpoint exists', () => {
      mockState.pendingCheckpoint = {
        checkpointId: 'cp-1',
        prompt: 'Please confirm to proceed',
        options: [],
      };

      render(<ExecutionPanel waves={[]} />);

      const modal = screen.getByTestId('checkpoint-modal');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveTextContent('Please confirm to proceed');
    });
  });

  describe('error recovery', () => {
    it('does not render error recovery when status is not error', () => {
      render(<ExecutionPanel waves={[]} />);

      expect(screen.queryByTestId('error-recovery')).not.toBeInTheDocument();
    });

    it('shows error recovery when status is error', () => {
      mockState.status = 'error';
      mockState.agentId = 'agent-1';
      mockState.plans = new Map([
        [
          'plan-1',
          {
            planId: 'plan-1',
            taskName: 'Test task',
            status: 'error',
            logs: '',
            toolCalls: [],
          },
        ],
      ]);

      render(
        <ExecutionPanel
          waves={[]}
          error={{ agentId: 'agent-1', message: 'Something went wrong', code: 'ERR_001' }}
          projectPath="/path/to/project"
        />
      );

      expect(screen.getByTestId('error-recovery')).toBeInTheDocument();
      expect(screen.getByTestId('error-recovery')).toHaveTextContent(
        'Something went wrong'
      );
    });

    it('does not show error recovery when status is error but no error prop', () => {
      mockState.status = 'error';

      render(<ExecutionPanel waves={[]} />);

      expect(screen.queryByTestId('error-recovery')).not.toBeInTheDocument();
    });
  });

  describe('layout structure', () => {
    it('has fixed header at top', () => {
      render(<ExecutionPanel waves={[]} />);

      const header = screen.getByTestId('execution-panel-header');
      expect(header).toBeInTheDocument();
    });

    it('has full-height container', () => {
      const { container } = render(<ExecutionPanel waves={[]} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('h-full');
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('flex-col');
    });
  });
});
