import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodePreview, getLanguageFromPath } from './CodePreview';

describe('CodePreview', () => {
  it('renders code content', () => {
    render(<CodePreview content="const foo = 'bar';" />);
    expect(screen.getByText("const foo = 'bar';")).toBeInTheDocument();
  });

  it('displays language badge when not plaintext', () => {
    render(<CodePreview content="code" language="typescript" />);
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('does not show language badge for plaintext', () => {
    render(<CodePreview content="code" language="plaintext" />);
    expect(screen.queryByText('plaintext')).not.toBeInTheDocument();
  });

  it('truncates content beyond maxLines', () => {
    const longContent = Array(20).fill('line of code').join('\n');
    render(<CodePreview content={longContent} maxLines={5} />);
    const displayedLines = screen.getByRole('code').textContent?.split('\n').length;
    expect(displayedLines).toBe(5);
  });

  it('shows "show more" button when truncated', () => {
    const longContent = Array(20).fill('line').join('\n');
    render(<CodePreview content={longContent} maxLines={5} />);
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('expands to full content when "show more" is clicked', async () => {
    const longContent = Array(20).fill('line').join('\n');
    render(<CodePreview content={longContent} maxLines={5} />);
    await userEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
    const displayedLines = screen.getByRole('code').textContent?.split('\n').length;
    expect(displayedLines).toBe(20);
  });

  it('collapses content when "show less" is clicked', async () => {
    const longContent = Array(20).fill('line').join('\n');
    render(<CodePreview content={longContent} maxLines={5} />);
    await userEvent.click(screen.getByRole('button', { name: /show more/i }));
    await userEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('does not show toggle when content fits within maxLines', () => {
    const shortContent = 'line 1\nline 2\nline 3';
    render(<CodePreview content={shortContent} maxLines={10} />);
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
  });
});

describe('getLanguageFromPath', () => {
  it('detects TypeScript from .ts extension', () => {
    expect(getLanguageFromPath('/src/index.ts')).toBe('typescript');
  });

  it('detects TypeScript from .tsx extension', () => {
    expect(getLanguageFromPath('/src/App.tsx')).toBe('typescript');
  });

  it('detects JavaScript from .js extension', () => {
    expect(getLanguageFromPath('script.js')).toBe('javascript');
  });

  it('detects Python from .py extension', () => {
    expect(getLanguageFromPath('main.py')).toBe('python');
  });

  it('detects Bash from .sh extension', () => {
    expect(getLanguageFromPath('install.sh')).toBe('bash');
  });

  it('returns plaintext for unknown extensions', () => {
    expect(getLanguageFromPath('readme.xyz')).toBe('plaintext');
  });

  it('handles files without extension', () => {
    expect(getLanguageFromPath('Makefile')).toBe('plaintext');
  });

  it('handles paths with multiple dots', () => {
    expect(getLanguageFromPath('my.component.tsx')).toBe('typescript');
  });
});
