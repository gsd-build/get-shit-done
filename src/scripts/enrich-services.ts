#!/usr/bin/env node

import { findServiceWithConfidence } from '../matching';

/**
 * CLI script for enriching service names with ownership information.
 * Usage: enrich-services <service-name>
 *
 * Outputs JSON with:
 * - found: boolean indicating if match was found
 * - repository: URL if matched
 * - local_path: Local path if matched
 * - confidence: Match confidence score
 */
async function main() {
  // Read service name from command line argument
  const serviceName = process.argv[2];

  if (!serviceName) {
    console.error('Usage: enrich-services <service-name>');
    process.exit(1);
  }

  try {
    // Find matching service with confidence
    const match = await findServiceWithConfidence(serviceName);

    if (match) {
      // Output JSON for the agent to parse
      console.log(JSON.stringify({
        found: true,
        repository: match.repository || null,
        local_path: match.local_path || null,
        confidence: match.matchConfidence
      }));
    } else {
      console.log(JSON.stringify({ found: false }));
    }
  } catch (error) {
    // If any error occurs, output not found
    console.log(JSON.stringify({ found: false }));
  }
}

// Execute the main function
main().catch(() => {
  // Silently fail with not found on any uncaught errors
  console.log(JSON.stringify({ found: false }));
});