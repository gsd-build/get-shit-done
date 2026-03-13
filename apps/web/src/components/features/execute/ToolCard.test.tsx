import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolCard } from './ToolCard';
import { ToolCardList } from './ToolCardList';
import type { ToolCall } from './types';

// Mock tool data factory
function createToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  const base: ToolCall = {
    toolId: 'tool-1',
    toolName: 'Read',
    input: { file_path: '/src/index.ts' },
    startTime: Date.now(),
    status: 'running',
  };
  // Use spread to merge, avoiding explicit undefined
  return { ...base, ...overrides };
}

describe('ToolCard', () => {
  describe('Icon tests', () => {
    it('shows document icon for Read tool', () => {
      const tool = createToolCall({ toolName: 'Read' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button', { name: /read/i });
      expect(within(header).getByTestId('icon-file-text')).toBeInTheDocument();
    });

    it('shows pencil icon for Write tool', () => {
      const tool = createToolCall({ toolName: 'Write' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button', { name: /write/i });
      expect(within(header).getByTestId('icon-pencil')).toBeInTheDocument();
    });

    it('shows terminal icon for Bash tool', () => {
      const tool = createToolCall({ toolName: 'Bash' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button', { name: /bash/i });
      expect(within(header).getByTestId('icon-terminal')).toBeInTheDocument();
    });

    it('shows edit icon for Edit tool', () => {
      const tool = createToolCall({ toolName: 'Edit' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button', { name: /edit/i });
      expect(within(header).getByTestId('icon-file-edit')).toBeInTheDocument();
    });

    it('shows search icon for Glob tool', () => {
      const tool = createToolCall({ toolName: 'Glob' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button', { name: /glob/i });
      expect(within(header).getByTestId('icon-search')).toBeInTheDocument();
    });

    it('shows search icon for Grep tool', () => {
      const tool = createToolCall({ toolName: 'Grep' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button', { name: /grep/i });
      expect(within(header).getByTestId('icon-file-search')).toBeInTheDocument();
    });
  });

  describe('Collapse/expand tests', () => {
    it('is collapsed by default', () => {
      const tool = createToolCall({ output: 'file contents' });
      render(<ToolCard tool={tool} />);
      const content = screen.queryByTestId('tool-content');
      expect(content).not.toBeInTheDocument();
    });

    it('expands card when header is clicked', async () => {
      const tool = createToolCall({
        output: 'file contents',
        status: 'success',
      });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button');
      await userEvent.click(header);
      expect(screen.getByTestId('tool-content')).toBeInTheDocument();
    });

    it('collapses card when clicking header again', async () => {
      const tool = createToolCall({ output: 'file contents', status: 'success' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button');
      await userEvent.click(header);
      expect(screen.getByTestId('tool-content')).toBeInTheDocument();
      await userEvent.click(header);
      expect(screen.queryByTestId('tool-content')).not.toBeInTheDocument();
    });

    it('shows tool input/output when expanded', async () => {
      const tool = createToolCall({
        input: { file_path: '/src/index.ts' },
        output: 'export const foo = "bar";',
        status: 'success',
      });
      render(<ToolCard tool={tool} />);
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/export const foo/)).toBeInTheDocument();
    });
  });

  describe('Timing tests', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows live elapsed timer while running', () => {
      const tool = createToolCall({
        status: 'running',
        startTime: Date.now() - 5000, // 5 seconds ago
      });
      render(<ToolCard tool={tool} />);
      // Timer should show elapsed time
      expect(screen.getByTestId('elapsed-timer')).toBeInTheDocument();
    });

    it('shows duration when completed (e.g., "2.3s")', () => {
      const tool = createToolCall({
        status: 'success',
        duration: 2300, // 2.3 seconds
      });
      render(<ToolCard tool={tool} />);
      expect(screen.getByText('2.3s')).toBeInTheDocument();
    });

    it('shows error indicator for failed tool', () => {
      const tool = createToolCall({
        status: 'error',
        output: 'File not found',
        duration: 100,
      });
      render(<ToolCard tool={tool} />);
      expect(screen.getByTestId('status-error')).toBeInTheDocument();
    });
  });

  describe('Content tests', () => {
    it('shows CodePreview with file content for Read tool', async () => {
      const tool = createToolCall({
        toolName: 'Read',
        input: { file_path: '/src/index.ts' },
        output: 'export const foo = "bar";',
        status: 'success',
      });
      render(<ToolCard tool={tool} />);
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByTestId('code-preview')).toBeInTheDocument();
    });

    it('shows CodePreview with file content for Write tool', async () => {
      const tool = createToolCall({
        toolName: 'Write',
        input: { file_path: '/src/new.ts', content: 'new file content' },
        output: 'File written',
        status: 'success',
      });
      render(<ToolCard tool={tool} />);
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByTestId('code-preview')).toBeInTheDocument();
    });

    it('shows output in scrollable container for Bash tool', async () => {
      const tool = createToolCall({
        toolName: 'Bash',
        input: { command: 'ls -la' },
        output: 'total 0\ndrwxr-xr-x  2 user user 40 Jan  1 00:00 .',
        status: 'success',
      });
      render(<ToolCard tool={tool} />);
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByTestId('bash-output')).toBeInTheDocument();
    });

    it('truncates code preview at ~10 lines with "show more" link', async () => {
      const longContent = Array(20).fill('line of code').join('\n');
      const tool = createToolCall({
        toolName: 'Read',
        output: longContent,
        status: 'success',
      });
      render(<ToolCard tool={tool} />);
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
    });

    it('expands to full content when "show more" is clicked', async () => {
      const longContent = Array(20).fill('line of code').join('\n');
      const tool = createToolCall({
        toolName: 'Read',
        output: longContent,
        status: 'success',
      });
      render(<ToolCard tool={tool} />);
      await userEvent.click(screen.getByRole('button', { name: /read/i }));
      await userEvent.click(screen.getByRole('button', { name: /show more/i }));
      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
    });
  });

  describe('Status tests', () => {
    it('running tool has blue border/accent', () => {
      const tool = createToolCall({ status: 'running' });
      render(<ToolCard tool={tool} />);
      const card = screen.getByTestId('tool-card');
      expect(card.className).toContain('border-blue');
    });

    it('success tool has green checkmark', () => {
      const tool = createToolCall({ status: 'success', duration: 1000 });
      render(<ToolCard tool={tool} />);
      expect(screen.getByTestId('status-success')).toBeInTheDocument();
    });

    it('error tool has red X and error message', async () => {
      const tool = createToolCall({
        status: 'error',
        output: 'Error: Permission denied',
        duration: 100,
      });
      render(<ToolCard tool={tool} />);
      expect(screen.getByTestId('status-error')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility tests', () => {
    it('has correct aria-expanded attribute', async () => {
      const tool = createToolCall({ status: 'success' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button');
      expect(header).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(header);
      expect(header).toHaveAttribute('aria-expanded', 'true');
    });

    it('supports keyboard navigation (Enter to toggle)', async () => {
      const tool = createToolCall({ status: 'success', output: 'content' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button');
      header.focus();
      await userEvent.keyboard('{Enter}');
      expect(header).toHaveAttribute('aria-expanded', 'true');
    });

    it('supports keyboard navigation (Space to toggle)', async () => {
      const tool = createToolCall({ status: 'success', output: 'content' });
      render(<ToolCard tool={tool} />);
      const header = screen.getByRole('button');
      header.focus();
      await userEvent.keyboard(' ');
      expect(header).toHaveAttribute('aria-expanded', 'true');
    });
  });
});

describe('ToolCardList', () => {
  it('renders list of ToolCard components', () => {
    const tools: ToolCall[] = [
      createToolCall({ toolId: 'tool-1', toolName: 'Read' }),
      createToolCall({ toolId: 'tool-2', toolName: 'Write' }),
    ];
    render(<ToolCardList tools={tools} />);
    expect(screen.getAllByTestId('tool-card')).toHaveLength(2);
  });

  it('groups by status (running first, then completed)', () => {
    const tools: ToolCall[] = [
      createToolCall({ toolId: 'completed', status: 'success', duration: 100 }),
      createToolCall({ toolId: 'running', status: 'running' }),
      createToolCall({ toolId: 'error', status: 'error', duration: 50 }),
    ];
    render(<ToolCardList tools={tools} />);
    const cards = screen.getAllByTestId('tool-card');
    // Running should be first
    expect(cards[0]).toHaveAttribute('data-tool-id', 'running');
  });
});
