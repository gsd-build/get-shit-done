import { getRequirementsAsNDJSON } from '../storage/message-queue.js';

/**
 * Resource definition for requirements
 */
export const REQUIREMENTS_RESOURCE_DEF = {
  uri: 'telegram://requirements/new',
  name: 'New Requirements from Telegram',
  description: 'JSONL stream of new requirement messages from user',
  mimeType: 'application/x-ndjson'
};

/**
 * Resource read handler for requirements
 * @param uri Resource URI to read
 * @returns MCP resource response with JSONL content
 */
export async function readRequirementsResource(uri: string) {
  if (uri !== 'telegram://requirements/new') {
    throw new Error(`Unknown resource: ${uri}`);
  }

  const content = await getRequirementsAsNDJSON();

  return {
    contents: [{
      uri,
      mimeType: 'application/x-ndjson',
      text: content
    }]
  };
}
