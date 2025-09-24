# Redmine MCP Server

A Model Context Protocol (MCP) server that provides comprehensive integration with Redmine, enabling AI assistants to interact with your Redmine instance through a clean, validated API.

## ⚠️ Beta Period Notice

**This MCP server is currently free during the beta period.** After the beta period concludes, this service will transition to a paid model. Enjoy full access to all features while we refine and improve the service based on your feedback.

## Features

- **Complete Issue Lifecycle**: Create, read, update, transition issues
- **Rich Metadata**: Access projects, trackers, statuses, users, and priorities
- **Search & Filter**: Find issues with flexible search parameters
- **Attachments**: Upload and attach files to issues  
- **Notes & Comments**: Add notes and comments to issues
- **Status Transitions**: Change issue status with optional notes
- **Strong Validation**: Zod schemas ensure data integrity
- **Error Handling**: Clear, structured error messages
- **NPX Ready**: Install and run via `npx @icoach/redmine-mcp-server`

## Quick Start

### NPX Installation (Recommended)

```bash
npx @icoach/redmine-mcp-server --api-key YOUR_MCP_API_KEY
```

### MCP Configuration

Add this to your MCP configuration:

```json
{
  "mcpServers": {
    "redmine": {
      "command": "npx", 
      "args": ["@icoach/redmine-mcp-server@latest", "--api-key", "YOUR_MCP_API_KEY"],
      "env": {
        "REDMINE_URL": "https://your-redmine-instance.com",
        "REDMINE_API_KEY": "YOUR_REDMINE_API_KEY",
        "REDMINE_DEFAULT_PROJECT_ID": "123"
      },
      "autoApprove": ["read_issue", "list_projects", "list_trackers_statuses", "get_metadata"]
    }
  }
}
```

## Environment Variables

### Required
- `REDMINE_URL`: Your Redmine instance URL
- `REDMINE_API_KEY`: Your Redmine API key  
- `MCP_API_KEY`: MCP server API key (or use `--api-key` flag)

### Optional  
- `REDMINE_DEFAULT_PROJECT_ID`: Default project for issue creation
- `REDMINE_TIMEOUT_MS`: Request timeout in milliseconds (default: 30000)
- `REDMINE_INSECURE_TLS`: Allow insecure TLS connections (default: false)
- `LOG_LEVEL`: Logging level (for future use)

## Available Tools

### Issue Operations

#### `read_issue`
Get detailed information about a specific issue.
```json
{
  "issue_id": 123
}
```

#### `create_issue`
Create a new issue in Redmine.
```json
{
  "project_id": 1,
  "subject": "Issue title", 
  "description": "Issue description",
  "tracker_id": 1,
  "status_id": 1,
  "priority_id": 2,
  "assigned_to_id": 5,
  "start_date": "2024-01-01",
  "due_date": "2024-01-31"
}
```
Note: If `project_id` is omitted, `REDMINE_DEFAULT_PROJECT_ID` must be set.

#### `update_issue`
Update an existing issue's properties.
```json
{
  "issue_id": 123,
  "subject": "Updated title",
  "description": "Updated description", 
  "tracker_id": 2,
  "status_id": 2,
  "priority_id": 3,
  "assigned_to_id": 6,
  "start_date": "2024-02-01",
  "due_date": "2024-02-28"
}
```

#### `add_issue_note`
Add a note/comment to an existing issue.
```json
{
  "issue_id": 123,
  "notes": "This is a comment on the issue"
}
```

#### `transition_issue` 
Change an issue's status (with optional note).
```json
{
  "issue_id": 123,
  "status_id": 3,
  "notes": "Marking as resolved"
}
```

#### `find_issues`
Search for issues with flexible filtering.
```json
{
  "project_id": 1,
  "status_id": 1, 
  "tracker_id": 1,
  "assigned_to_id": 5,
  "query": "search text",
  "limit": 10,
  "offset": 0
}
```

#### `add_attachment`
Upload and attach a file to an issue.
```json
{
  "issue_id": 123,
  "filename": "document.pdf",
  "data_base64": "base64-encoded-file-data",
  "content_type": "application/pdf",
  "description": "Important document"
}
```

### Metadata & Reference Data

#### `list_projects`
Get all available projects.

#### `list_trackers_statuses` 
Get all trackers and issue statuses in one call.

#### `get_metadata`
Get comprehensive metadata including projects, trackers, statuses, users, and priorities.

## Development

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd redmine-mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Redmine details
   ```

4. Build and test:
   ```bash
   npm run build
   npm test
   ```

5. Run in development mode:
   ```bash
   npm run dev -- --api-key YOUR_KEY
   ```

### Testing

Run integration tests:
```bash
npm test
```

Run full MCP protocol tests:
```bash  
npm run test:full
```

### Building for Distribution

```bash
npm run build
npm pack  # Creates tarball for testing
npm publish --access public  # Publishes to npm
```

## Technical Details

- **Architecture**: Stdio-based MCP server using official SDK
- **Language**: TypeScript compiled to ESM modules  
- **Validation**: Zod schemas for all tool parameters
- **Error Handling**: Structured error responses with HTTP status codes
- **Transport**: Standard stdio transport for maximum compatibility
- **Node.js**: Requires Node.js 18+ for modern fetch() and ESM support

## Contributing

1. Fork the repository
2. Create a feature branch  
3. Make changes with tests
4. Submit a pull request

## License

ISC License - see LICENSE file for details.
