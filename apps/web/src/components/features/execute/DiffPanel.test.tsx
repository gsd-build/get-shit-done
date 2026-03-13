import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiffPanel } from './DiffPanel';
import { FileTree } from './FileTree';
import { useExecutionStore } from '@/stores/executionStore';

// Mock @monaco-editor/react since Monaco cannot run in jsdom
vi.mock('@monaco-editor/react', () => ({
  DiffEditor: ({ original, modified, language }: { original: string; modified: string; language: string }) => (
    <div data-testid="monaco-diff" data-language={language}>
      <div data-testid="original">{original}</div>
      <div data-testid="modified">{modified}</div>
    </div>
  ),
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light' }),
}));

describe('DiffPanel', () => {
  beforeEach(() => {
    // Reset store state before each test
    useExecutionStore.setState({
      selectedFile: null,
      commits: [],
    });
  });

  it('renders "No file selected" when selectedFile is null', () => {
    render(<DiffPanel />);
    expect(screen.getByText(/no file selected/i)).toBeInTheDocument();
  });

  it('renders DiffEditor when selectedFile is provided', () => {
    useExecutionStore.setState({
      selectedFile: {
        path: '/src/index.ts',
        original: 'const old = 1;',
        modified: 'const new = 2;',
      },
    });
    render(<DiffPanel />);
    expect(screen.getByTestId('monaco-diff')).toBeInTheDocument();
  });

  it('shows file path in header', () => {
    useExecutionStore.setState({
      selectedFile: {
        path: '/src/components/Button.tsx',
        original: '',
        modified: '',
      },
    });
    render(<DiffPanel />);
    expect(screen.getByText('/src/components/Button.tsx')).toBeInTheDocument();
  });

  it('toggle button switches between "Unified" and "Side-by-side"', async () => {
    useExecutionStore.setState({
      selectedFile: {
        path: '/src/index.ts',
        original: 'old',
        modified: 'new',
      },
    });
    render(<DiffPanel />);

    // Default is unified
    const toggleButton = screen.getByRole('button', { name: /unified/i });
    expect(toggleButton).toBeInTheDocument();

    // Click to switch to side-by-side
    await userEvent.click(toggleButton);
    expect(screen.getByRole('button', { name: /side-by-side/i })).toBeInTheDocument();

    // Click again to switch back to unified
    await userEvent.click(screen.getByRole('button', { name: /side-by-side/i }));
    expect(screen.getByRole('button', { name: /unified/i })).toBeInTheDocument();
  });

  it('default view is unified per CONTEXT.md', () => {
    useExecutionStore.setState({
      selectedFile: {
        path: '/src/index.ts',
        original: 'old',
        modified: 'new',
      },
    });
    render(<DiffPanel />);

    // Should show "Unified" as the current mode
    expect(screen.getByRole('button', { name: /unified/i })).toBeInTheDocument();
  });
});

describe('FileTree', () => {
  const mockFiles = [
    { path: 'src/components/Button.tsx', status: 'modified' as const },
    { path: 'src/components/Input.tsx', status: 'added' as const },
    { path: 'src/utils/helpers.ts', status: 'deleted' as const },
    { path: 'package.json', status: 'modified' as const },
  ];

  it('renders files grouped by directory', () => {
    const onSelect = vi.fn();
    render(<FileTree files={mockFiles} onSelect={onSelect} />);

    // Should show directories
    expect(screen.getByText('src/components')).toBeInTheDocument();
    expect(screen.getByText('src/utils')).toBeInTheDocument();
  });

  it('shows file status indicators (green +, yellow ~, red -)', () => {
    const onSelect = vi.fn();
    render(<FileTree files={mockFiles} onSelect={onSelect} />);

    // Added file should have green + indicator
    expect(screen.getByTestId('status-added')).toBeInTheDocument();
    // Modified file should have yellow ~ indicator
    expect(screen.getAllByTestId('status-modified')).toHaveLength(2);
    // Deleted file should have red - indicator
    expect(screen.getByTestId('status-deleted')).toBeInTheDocument();
  });

  it('calls onSelect when file is clicked', async () => {
    const onSelect = vi.fn();
    render(<FileTree files={mockFiles} onSelect={onSelect} />);

    // Click on a file
    await userEvent.click(screen.getByText('Button.tsx'));
    expect(onSelect).toHaveBeenCalledWith('src/components/Button.tsx');
  });

  it('supports expand/collapse for directories', async () => {
    const onSelect = vi.fn();
    render(<FileTree files={mockFiles} onSelect={onSelect} />);

    // Find src/components directory and collapse it
    const srcComponentsDir = screen.getByRole('button', { name: /src\/components/i });
    await userEvent.click(srcComponentsDir);

    // Files should be hidden when collapsed
    expect(screen.queryByText('Button.tsx')).not.toBeInTheDocument();

    // Click again to expand
    await userEvent.click(srcComponentsDir);
    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
  });

  it('highlights selected file', () => {
    const onSelect = vi.fn();
    render(
      <FileTree
        files={mockFiles}
        onSelect={onSelect}
        selectedPath="src/components/Button.tsx"
      />
    );

    const selectedFile = screen.getByTestId('file-src/components/Button.tsx');
    expect(selectedFile).toHaveAttribute('data-selected', 'true');
  });
});
