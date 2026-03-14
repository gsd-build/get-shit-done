/**
 * Frontend endpoint contract helpers.
 *
 * REST calls from the browser go through Next.js proxy routes to keep
 * auth handling and origin behavior consistent in all environments.
 */

export const API_PROXY_BASE = '/api/proxy';
const LOCAL_API_FALLBACK = 'http://localhost:4000';

/**
 * Same-origin health probe via proxy.
 */
export const HEALTH_SUMMARY_URL = `${API_PROXY_BASE}/health/summary`;

/**
 * Resolve Socket.IO backend URL per runtime environment.
 * Production fallback is current browser origin (never localhost).
 */
export function resolveSocketBase(): string {
  if (process.env['NEXT_PUBLIC_SOCKET_URL']) {
    return process.env['NEXT_PUBLIC_SOCKET_URL'];
  }
  if (process.env['NEXT_PUBLIC_API_URL']) {
    return process.env['NEXT_PUBLIC_API_URL'];
  }
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    const isLocalHost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

    // In local dev, Next.js runs on 3000 while API/socket runs on 4000.
    if (isLocalHost && (port === '3000' || port === '3001' || port === '3002')) {
      return `http://${hostname}:4000`;
    }

    return window.location.origin;
  }
  return LOCAL_API_FALLBACK;
}
