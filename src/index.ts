#!/usr/bin/env node
// Store MCP config values as fallbacks before loading .env
const MCP_REDMINE_URL = process.env.REDMINE_URL;
const MCP_REDMINE_API_KEY = process.env.REDMINE_API_KEY;

// Load environment variables from .env file with override
import dotenv from "dotenv";
import path from "path";

// Try to load .env from current working directory (user's project)
const envPath = path.join(process.cwd(), ".env");
const result = dotenv.config({ path: envPath, override: true });

// Optional: Log .env loading status (comment out in production if needed)
if (!result.error) {
  console.error(`[Redmine MCP] Loaded local .env from ${envPath}`);
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RedmineClient } from "./redmine-api.js";

// No CLI args processing needed

// Get configuration - prioritize .env, fallback to MCP config
const REDMINE_URL = process.env.REDMINE_URL || MCP_REDMINE_URL;
const REDMINE_API_KEY = process.env.REDMINE_API_KEY || MCP_REDMINE_API_KEY;
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
    parent_issue_id: z.number().optional(),
    fixed_version_id: z.number().optional(),
    category_id: z.number().optional(),
    estimated_hours: z.number().optional(),
    done_ratio: z.number().optional(),
    custom_fields: z
      .array(
        z.object({
          id: z.number(),
          value: z.union([z.string(), z.number(), z.array(z.string())]),
        })
      )
      .optional(),
    watcher_user_ids: z.array(z.number()).optional(),
    notes: z.string().optional(),
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
    parent_issue_id: z.number().optional(),
    fixed_version_id: z.number().optional(),
    category_id: z.number().optional(),
    estimated_hours: z.number().optional(),
    done_ratio: z.number().optional(),
    custom_fields: z
      .array(
        z.object({
          id: z.number(),
          value: z.union([z.string(), z.number(), z.array(z.string())]),
        })
      )
      .optional(),
    watcher_user_ids: z.array(z.number()).optional(),
    notes: z.string().optional(),
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

// Get project versions (milestones)
server.tool(
  "get_project_versions",
  { project_id: z.number() },
  async ({ project_id }) => {
    try {
      const response = await redmineClient.getProjectVersions(project_id);
      return {
        content: [
          { type: "text", text: JSON.stringify(response.versions, null, 2) },
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

// Get project categories
server.tool(
  "get_project_categories",
  { project_id: z.number() },
  async ({ project_id }) => {
    try {
      const response = await redmineClient.getProjectCategories(project_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.issue_categories, null, 2),
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
