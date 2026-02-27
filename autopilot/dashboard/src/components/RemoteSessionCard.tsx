// RemoteSessionCard: Prominent banner showing Claude Code remote session URL with copy button.
// Reads remoteSessionUrl from Zustand store, renders nothing if session is disabled (null).
// Follows TunnelBanner pattern with blue color scheme for visual distinction.

import { useState } from 'react';
import { useDashboardStore } from '../store/index.js';

export function RemoteSessionCard() {
  const remoteSessionUrl = useDashboardStore((s) => s.remoteSessionUrl);
  const [copied, setCopied] = useState(false);

  // If remoteSessionUrl is null, render nothing (no card)
  if (!remoteSessionUrl) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(remoteSessionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API failed -- non-fatal
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Terminal icon (styled text) */}
        <span className="text-blue-500 text-lg font-mono flex-shrink-0 mt-0.5">&gt;_</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-blue-900 mb-1">
            Claude Code remote session
          </div>
          <a
            href={remoteSessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-700 hover:text-blue-900 underline break-all"
          >
            {remoteSessionUrl}
          </a>
          <div className="text-xs text-blue-600 mt-1">
            Ask Claude questions about your project from any device
          </div>
        </div>
      </div>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
      >
        {copied ? 'Copied!' : 'Copy URL'}
      </button>
    </div>
  );
}
