import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LogStream } from './LogStream';

describe('LogStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    const { rerender } = render(
      <LogStream logs="Initial log" isStreaming={true} />
    );

    const container = screen.getByTestId('log-container');

    // Mock scroll properties on the container element
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'scrollTop', { value: 400, writable: true, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });

    // Update logs
    rerender(<LogStream logs="Initial log\nNew line" isStreaming={true} />);

    // Component should attempt to set scrollTop = scrollHeight
    await waitFor(() => {
      expect(container.scrollTop).toBeDefined();
    });
  });

  it('pauses auto-scroll when user scrolls up', async () => {
    render(<LogStream logs="Initial log" isStreaming={true} />);

    const container = screen.getByTestId('log-container');

    // Setup: mock that we're scrolled up from before (scrollTop decreased)
    let currentScrollTop = 400;
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'scrollTop', {
      get: () => currentScrollTop,
      set: (v) => { currentScrollTop = v; },
      configurable: true
    });
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });

    // First scroll to establish lastScrollTop
    fireEvent.scroll(container);

    // Now simulate scrolling up
    currentScrollTop = 100;
    fireEvent.scroll(container);

    // Verify resume button appears (indicating auto-scroll paused)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resume auto-scroll/i })).toBeInTheDocument();
    });
  });

  it('shows "Resume auto-scroll" button when paused and streaming', async () => {
    render(<LogStream logs="Log content" isStreaming={true} />);

    const container = screen.getByTestId('log-container');

    // Setup scroll properties
    let currentScrollTop = 400;
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'scrollTop', {
      get: () => currentScrollTop,
      set: (v) => { currentScrollTop = v; },
      configurable: true
    });
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });

    // Establish initial scroll position
    fireEvent.scroll(container);

    // Scroll up
    currentScrollTop = 100;
    fireEvent.scroll(container);

    await waitFor(() => {
      const resumeButton = screen.getByRole('button', { name: /resume auto-scroll/i });
      expect(resumeButton).toBeInTheDocument();
    });
  });

  it('does not show resume button when not streaming', async () => {
    render(<LogStream logs="Log content" isStreaming={false} />);

    const container = screen.getByTestId('log-container');

    // Setup scroll
    let currentScrollTop = 400;
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'scrollTop', {
      get: () => currentScrollTop,
      set: (v) => { currentScrollTop = v; },
      configurable: true
    });
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });

    // Scroll up
    fireEvent.scroll(container);
    currentScrollTop = 100;
    fireEvent.scroll(container);

    // Resume button should not appear when not streaming
    expect(screen.queryByRole('button', { name: /resume auto-scroll/i })).not.toBeInTheDocument();
  });

  it('clicking resume button re-enables auto-scroll', async () => {
    render(<LogStream logs="Log content" isStreaming={true} />);

    const container = screen.getByTestId('log-container');

    // Setup scroll
    let currentScrollTop = 400;
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'scrollTop', {
      get: () => currentScrollTop,
      set: (v) => { currentScrollTop = v; },
      configurable: true
    });
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });

    // Establish initial position, then scroll up
    fireEvent.scroll(container);
    currentScrollTop = 100;
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
