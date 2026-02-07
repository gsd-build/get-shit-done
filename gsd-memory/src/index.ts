#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';

import { search } from './tools/search.js';
import { findDecisions } from './tools/decisions.js';
import { findPatterns } from './tools/patterns.js';
import { findPitfalls } from './tools/pitfalls.js';
import { findStack } from './tools/stack.js';
import { register, status as registerStatus, unregister } from './tools/register.js';
import { index, indexAll } from './tools/index-tool.js';
import { getStatus } from './tools/status.js';

// Define available tools
const tools: Tool[] = [
  {
    name: 'gsd_memory_search',
    description: 'Search across all registered GSD projects for content matching a query. Returns enriched results with project, phase, and document type context.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        project: {
          type: 'string',
          description: 'Optional: limit search to a specific project'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'gsd_memory_decisions',
    description: 'Find decisions made across GSD projects. Searches KEY-DECISIONS from SUMMARY.md frontmatter and Key Decisions tables from PROJECT.md.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional: filter decisions by keyword'
        },
        project: {
          type: 'string',
          description: 'Optional: limit to a specific project'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: filter by tags'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)'
        }
      }
    }
  },
  {
    name: 'gsd_memory_patterns',
    description: 'Find patterns established across GSD projects. Extracts PATTERNS-ESTABLISHED from SUMMARY.md frontmatter.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional: filter patterns by keyword'
        },
        project: {
          type: 'string',
          description: 'Optional: limit to a specific project'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: filter by tags'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)'
        }
      }
    }
  },
  {
    name: 'gsd_memory_pitfalls',
    description: 'Find documented pitfalls from RESEARCH.md files. Includes what went wrong, causes, and prevention strategies.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional: filter pitfalls by keyword'
        },
        project: {
          type: 'string',
          description: 'Optional: limit to a specific project'
        },
        domain: {
          type: 'string',
          description: 'Optional: filter by technology domain'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)'
        }
      }
    }
  },
  {
    name: 'gsd_memory_stack',
    description: 'Find tech stack entries across GSD projects. Extracts from SUMMARY.md (tech-stack.added) and RESEARCH.md (standard stack tables).',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional: filter by library name or purpose'
        },
        project: {
          type: 'string',
          description: 'Optional: limit to a specific project'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 100)'
        }
      }
    }
  },
  {
    name: 'gsd_memory_register',
    description: 'Register a project with GSD memory. Creates a QMD collection if QMD is available.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the project root (must contain .planning directory)'
        },
        name: {
          type: 'string',
          description: 'Optional: project name (defaults to directory name)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'gsd_memory_index',
    description: 'Trigger indexing/update for a project. Updates QMD collection if available, otherwise marks project as indexed for grep fallback.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name to index'
        },
        path: {
          type: 'string',
          description: 'Alternative: project path to index'
        }
      }
    }
  },
  {
    name: 'gsd_memory_status',
    description: 'Show status of GSD memory system: QMD availability, registered projects, document counts.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Create server instance
const server = new Server(
  {
    name: 'gsd-memory',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'gsd_memory_search':
        result = await search({
          query: args?.query as string,
          project: args?.project as string | undefined,
          limit: args?.limit as number | undefined
        });
        break;

      case 'gsd_memory_decisions':
        result = await findDecisions({
          query: args?.query as string | undefined,
          project: args?.project as string | undefined,
          tags: args?.tags as string[] | undefined,
          limit: args?.limit as number | undefined
        });
        break;

      case 'gsd_memory_patterns':
        result = await findPatterns({
          query: args?.query as string | undefined,
          project: args?.project as string | undefined,
          tags: args?.tags as string[] | undefined,
          limit: args?.limit as number | undefined
        });
        break;

      case 'gsd_memory_pitfalls':
        result = await findPitfalls({
          query: args?.query as string | undefined,
          project: args?.project as string | undefined,
          domain: args?.domain as string | undefined,
          limit: args?.limit as number | undefined
        });
        break;

      case 'gsd_memory_stack':
        result = await findStack({
          query: args?.query as string | undefined,
          project: args?.project as string | undefined,
          limit: args?.limit as number | undefined
        });
        break;

      case 'gsd_memory_register':
        result = await register({
          path: args?.path as string,
          name: args?.name as string | undefined
        });
        break;

      case 'gsd_memory_index':
        if (args?.project || args?.path) {
          result = await index({
            project: args?.project as string | undefined,
            path: args?.path as string | undefined
          });
        } else {
          result = await indexAll();
        }
        break;

      case 'gsd_memory_status':
        result = await getStatus();
        break;

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`
            }
          ],
          isError: true
        };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GSD Memory MCP server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
