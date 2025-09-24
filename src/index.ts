#!/usr/bin/env node
// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RedmineClient } from "./redmine-api.js";

// CLI args and required MCP API key
const args = process.argv.slice(2);
const getArgValue = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : undefined;
};

const SERVER_API_KEY = process.env.MCP_API_KEY || getArgValue("--api-key");

if (!SERVER_API_KEY) {
  console.error(
    "Missing required MCP API key. Provide via --api-key or MCP_API_KEY env."
  );
  process.exit(1);
}

// Get configuration
const REDMINE_URL = process.env.REDMINE_URL;
const REDMINE_API_KEY = process.env.REDMINE_API_KEY;
const DEFAULT_PROJECT_ID_RAW = process.env.REDMINE_DEFAULT_PROJECT_ID;
const DEFAULT_PROJECT_ID =
  DEFAULT_PROJECT_ID_RAW !== undefined && DEFAULT_PROJECT_ID_RAW !== ""
    ? Number(DEFAULT_PROJECT_ID_RAW)
    : undefined;

if (
  DEFAULT_PROJECT_ID_RAW !== undefined &&
  DEFAULT_PROJECT_ID_RAW !== "" &&
  Number.isNaN(DEFAULT_PROJECT_ID)
) {
  console.error(
    "REDMINE_DEFAULT_PROJECT_ID must be a valid number if provided"
  );
  process.exit(1);
}

if (!REDMINE_URL || !REDMINE_API_KEY) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const redmineClient = new RedmineClient({
  url: REDMINE_URL,
  apiKey: REDMINE_API_KEY,
});

// Create MCP server
const server = new McpServer({
  name: "redmine-server",
  version: "1.0.0",
});

// Essential tools

server.tool(
  "create_issue",
  {
    project_id: z.number().optional(),
    subject: z.string(),
    description: z.string().optional(),
    tracker_id: z.number().optional(),
    status_id: z.number().optional(),
    priority_id: z.number().optional(),
    assigned_to_id: z.number().optional(),
    start_date: z.string().optional(),
    due_date: z.string().optional(),
  },
  async (_params) => {
    try {
      const params: any = { ..._params };

      if (params.project_id === undefined || params.project_id === null) {
        if (DEFAULT_PROJECT_ID !== undefined) {
          params.project_id = DEFAULT_PROJECT_ID;
        } else {
          return {
            content: [
              {
                type: "text",
                text: "Missing required project_id. Set REDMINE_DEFAULT_PROJECT_ID or pass project_id explicitly.",
              },
            ],
            isError: true,
          };
        }
      }

      const response = await redmineClient.createIssue(params);
      return {
        content: [
          { type: "text", text: JSON.stringify(response.issue, null, 2) },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "update_issue",
  {
    issue_id: z.number(),
    subject: z.string().optional(),
    description: z.string().optional(),
    tracker_id: z.number().optional(),
    status_id: z.number().optional(),
    priority_id: z.number().optional(),
    assigned_to_id: z.number().optional(),
    start_date: z.string().optional(),
    due_date: z.string().optional(),
  },
  async ({ issue_id, ...params }) => {
    try {
      await redmineClient.updateIssue(issue_id, params);
      const updatedIssue = await redmineClient.getIssue(issue_id);
      return {
        content: [
          { type: "text", text: JSON.stringify(updatedIssue.issue, null, 2) },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// List projects
server.tool("list_projects", {}, async () => {
  try {
    const response = await redmineClient.getProjects();
    return {
      content: [
        { type: "text", text: JSON.stringify(response.projects, null, 2) },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

// List trackers and statuses
server.tool("list_trackers_statuses", {}, async () => {
  try {
    const [trackersResponse, statusesResponse] = await Promise.all([
      redmineClient.getTrackers(),
      redmineClient.getIssueStatuses(),
    ]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              trackers: trackersResponse.trackers,
              statuses: statusesResponse.issue_statuses,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

// Read issue
server.tool("read_issue", { issue_id: z.number() }, async ({ issue_id }) => {
  try {
    const response = await redmineClient.getIssue(issue_id);
    return {
      content: [
        { type: "text", text: JSON.stringify(response.issue, null, 2) },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

// Add issue note
server.tool(
  "add_issue_note",
  { issue_id: z.number(), notes: z.string() },
  async ({ issue_id, notes }) => {
    try {
      await redmineClient.addIssueNote(issue_id, notes);
      const updatedIssue = await redmineClient.getIssue(issue_id);
      return {
        content: [
          { type: "text", text: JSON.stringify(updatedIssue.issue, null, 2) },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Transition issue
server.tool(
  "transition_issue",
  {
    issue_id: z.number(),
    status_id: z.number(),
    notes: z.string().optional(),
  },
  async ({ issue_id, status_id, notes }) => {
    try {
      await redmineClient.transitionIssue(issue_id, status_id, notes);
      const updatedIssue = await redmineClient.getIssue(issue_id);
      return {
        content: [
          { type: "text", text: JSON.stringify(updatedIssue.issue, null, 2) },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Find issues
server.tool(
  "find_issues",
  {
    project_id: z.number().optional(),
    status_id: z.number().optional(),
    tracker_id: z.number().optional(),
    assigned_to_id: z.number().optional(),
    query: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  },
  async (params) => {
    try {
      const response = await redmineClient.searchIssues(params);
      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Add attachment
server.tool(
  "add_attachment",
  {
    issue_id: z.number(),
    filename: z.string(),
    data_base64: z.string(),
    content_type: z.string().optional(),
    description: z.string().optional(),
  },
  async ({ issue_id, filename, data_base64, content_type, description }) => {
    try {
      // Decode base64 data
      const binaryData = new Uint8Array(Buffer.from(data_base64, "base64"));

      // Upload binary data
      const uploadResponse = await redmineClient.uploadBinary(binaryData);

      // Attach to issue
      const upload = {
        token: uploadResponse.upload.token,
        filename,
        content_type,
        description,
      };

      await redmineClient.addAttachment(issue_id, [upload]);
      const updatedIssue = await redmineClient.getIssue(issue_id);

      return {
        content: [
          { type: "text", text: JSON.stringify(updatedIssue.issue, null, 2) },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Get metadata
server.tool("get_metadata", {}, async () => {
  try {
    const [
      projectsResponse,
      trackersResponse,
      statusesResponse,
      usersResponse,
    ] = await Promise.all([
      redmineClient.getProjects(),
      redmineClient.getTrackers(),
      redmineClient.getIssueStatuses(),
      redmineClient.getUsers(),
    ]);

    // Try to get priorities, but don't fail if not available
    let prioritiesResponse;
    try {
      prioritiesResponse = await redmineClient.getIssuePriorities();
    } catch (error) {
      prioritiesResponse = { issue_priorities: [] };
    }

    const metadata = {
      projects: projectsResponse.projects,
      trackers: trackersResponse.trackers,
      statuses: statusesResponse.issue_statuses,
      users: usersResponse.users,
      priorities: prioritiesResponse.issue_priorities,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(metadata, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

// Setup stdio transport and connect MCP server
const transport = new StdioServerTransport();
server.connect(transport);
