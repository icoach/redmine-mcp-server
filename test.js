// Test script for Redmine MCP server
// Set environment variables
process.env.REDMINE_URL = "https://example.redmine.org"; // Replace with a test URL
process.env.REDMINE_API_KEY = "test-api-key"; // Replace with a test API key

// Import and start the server
import "./dist/index.js";
