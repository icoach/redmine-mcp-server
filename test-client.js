// test-client.js
// Simple test client for the Redmine MCP server with HTTP/SSE transport

import fetch from "node-fetch";
import { EventSource } from "eventsource";

const SERVER_URL = "http://localhost:8000";

async function testMcpServer() {
  console.log("Testing Redmine MCP Server...");

  // Check server status
  try {
    const statusResponse = await fetch(`${SERVER_URL}/status`);
    const status = await statusResponse.json();
    console.log("Server status:", status);
  } catch (error) {
    console.error("Failed to get server status:", error.message);
    console.error("Make sure the MCP server is running!");
    process.exit(1);
  }

  // Connect to SSE
  console.log("Connecting to SSE endpoint...");

  // First make a request to get the connection ID from headers
  const sseResponse = await fetch(`${SERVER_URL}/sse`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
    },
  });

  const connectionId = sseResponse.headers.get("x-connection-id");
  console.log(`Received connection ID from headers: ${connectionId}`);

  if (!connectionId) {
    console.error("Failed to get connection ID");
    process.exit(1);
  }

  // Now set up the EventSource
  const eventSource = new EventSource(`${SERVER_URL}/sse`);

  // Set up event handlers
  eventSource.onopen = () => {
    console.log("SSE connection opened");

    // We need to initialize the MCP connection first
    setTimeout(() => {
      initializeConnection();
    }, 1000);
  };

  eventSource.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received message:", message);

      // Check for initialization success
      if (message.result && message.result.capabilities) {
        console.log("MCP connection initialized successfully");
        console.log("Available capabilities:", message.result.capabilities);

        // Now we can call a tool
        callTool("list_projects", {});
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  };

  eventSource.onerror = (error) => {
    console.error("SSE error:", error);
    eventSource.close();
    process.exit(1);
  };

  // Function to initialize the MCP connection
  async function initializeConnection() {
    console.log("Initializing MCP connection...");

    try {
      const response = await fetch(`${SERVER_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Connection-Id": connectionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            client: {
              name: "test-client",
              version: "1.0.0",
            },
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
          },
          id: "1",
        }),
      });

      // We don't need to read the response here as it will come through the SSE channel
    } catch (error) {
      console.error("Error initializing connection:", error.message);
    }
  }

  // Function to call a tool
  async function callTool(toolName, args) {
    console.log(`Calling tool: ${toolName} with args:`, args);

    try {
      const response = await fetch(`${SERVER_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Connection-Id": connectionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "callTool",
          params: {
            name: toolName,
            arguments: args,
          },
          id: "2",
        }),
      });

      // We don't need to read the response here as it will come through the SSE channel
    } catch (error) {
      console.error("Error calling tool:", error.message);
    }
  }

  // Keep the script running to receive SSE events
  console.log("Test client running. Press Ctrl+C to exit.");
}

testMcpServer().catch((error) => {
  console.error("Test failed:", error);
});
