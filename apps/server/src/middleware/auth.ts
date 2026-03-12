/**
 * Simple HTTP Basic Authentication middleware
 *
 * Enabled when AUTH_USERNAME and AUTH_PASSWORD environment variables are set.
 * Skips authentication for health check endpoint.
 */

import type { Request, Response, NextFunction } from 'express';

const AUTH_USERNAME = process.env['AUTH_USERNAME'];
const AUTH_PASSWORD = process.env['AUTH_PASSWORD'];

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  return Boolean(AUTH_USERNAME && AUTH_PASSWORD);
}

/**
 * HTTP Basic Authentication middleware
 */
export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if not enabled
  if (!isAuthEnabled()) {
    return next();
  }

  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="GSD Labs"');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials ?? '', 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="GSD Labs"');
    res.status(401).json({ error: 'Invalid credentials' });
  } catch {
    res.setHeader('WWW-Authenticate', 'Basic realm="GSD Labs"');
    res.status(401).json({ error: 'Invalid authentication header' });
  }
}
