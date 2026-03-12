/**
 * Frontend endpoint contract helpers.
 *
 * REST calls from the browser go through Next.js proxy routes to keep
 * auth handling and origin behavior consistent in all environments.
 */

export const API_PROXY_BASE = '/api/proxy';
const LOCAL_API_FALLBACK = 'http://localhost:4000';

/**
 * Direct backend URL for cross-origin channels (Socket.IO).
 */
export const SOCKET_BASE =
  process.env['NEXT_PUBLIC_SOCKET_URL'] ||
  process.env['NEXT_PUBLIC_API_URL'] ||
  LOCAL_API_FALLBACK;

/**
 * Same-origin health probe via proxy.
 */
export const HEALTH_SUMMARY_URL = `${API_PROXY_BASE}/health/summary`;
