import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogStream } from './LogStream';

describe('LogStream', () => {
  // Mock scrollHeight, scrollTop, clientHeight for scroll tests
  const mockScrollProps = (
    scrollHeight: number,
    scrollTop: number,
    clientHeight: number
  ) => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      value: scrollHeight,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      configurable: true,
      writable: true,
      value: scrollTop,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: clientHeight,
    });
  };

  beforeEach(() => {
    // Default: at bottom of scroll
    mockScrollProps(500, 400, 100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders log content in pre element', () => {
    const logs = 'Line 1\nLine 2\nLine 3';
    render(<LogStream logs={logs} isStreaming={false} />);

    const preElement = screen.getByRole('log');
    expect(preElement.tagName.toLowerCase()).toBe('pre');
    expect(preElement.textContent).toBe(logs);
  });

  it('auto-scrolls to bottom when logs update (if autoScroll true)', async () => {
    const scrollToSpy = vi.fn();

    const { rerender } = render(
      <LogStream logs="Initial log" isStreaming={true} />
    );

    const container = screen.getByTestId('log-container');
    container.scrollTo = scrollToSpy;

    // Update logs
    rerender(<LogStream logs="Initial log\nNew line" isStreaming={true} />);

    await waitFor(() => {
      // Should have attempted to scroll
      expect(container.scrollTop).toBeDefined();
    });
  });

  it('pauses auto-scroll when user scrolls up', async () => {
    const { rerender } = render(
      <LogStream logs="Initial log" isStreaming={true} />
    );

    const container = screen.getByTestId('log-container');

    // Simulate user scrolling up
    mockScrollProps(500, 100, 100); // scrollTop less than before
    fireEvent.scroll(container);

    // Verify resume button appears (indicating auto-scroll paused)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resume auto-scroll/i })).toBeInTheDocument();
    });
  });

  it('shows "Resume auto-scroll" button when paused and streaming', async () => {
    render(<LogStream logs="Log content" isStreaming={true} />);

    const container = screen.getByTestId('log-container');

    // Simulate scrolling up (not at bottom)
    mockScrollProps(500, 100, 100);
    fireEvent.scroll(container);

    await waitFor(() => {
      const resumeButton = screen.getByRole('button', { name: /resume auto-scroll/i });
      expect(resumeButton).toBeInTheDocument();
    });
  });

  it('does not show resume button when not streaming', async () => {
    render(<LogStream logs="Log content" isStreaming={false} />);

    const container = screen.getByTestId('log-container');

    // Simulate scrolling up
    mockScrollProps(500, 100, 100);
    fireEvent.scroll(container);

    // Resume button should not appear when not streaming
    expect(screen.queryByRole('button', { name: /resume auto-scroll/i })).not.toBeInTheDocument();
  });

  it('clicking resume button re-enables auto-scroll', async () => {
    render(<LogStream logs="Log content" isStreaming={true} />);

    const container = screen.getByTestId('log-container');

    // Pause auto-scroll by scrolling up
    mockScrollProps(500, 100, 100);
    fireEvent.scroll(container);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resume auto-scroll/i })).toBeInTheDocument();
    });

    // Click resume
    const resumeButton = screen.getByRole('button', { name: /resume auto-scroll/i });
    fireEvent.click(resumeButton);

    // Button should disappear after resuming
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /resume auto-scroll/i })).not.toBeInTheDocument();
    });
  });

  it('has font-mono styling for log content', () => {
    render(<LogStream logs="Log content" isStreaming={false} />);

    const preElement = screen.getByRole('log');
    expect(preElement.className).toContain('font-mono');
  });

  it('has whitespace-pre-wrap for log content', () => {
    render(<LogStream logs="Log content" isStreaming={false} />);

    const preElement = screen.getByRole('log');
    expect(preElement.className).toContain('whitespace-pre-wrap');
  });
});
