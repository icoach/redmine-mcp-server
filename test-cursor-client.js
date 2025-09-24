// test-cursor-client.js
// Test script to simulate how a client like Cursor connects to MCP

import fetch from "node-fetch";
import { EventSource } from "eventsource";

const SERVER_URL = "http://localhost:8000";

async function testCursorConnection() {
  console.log("Testing connection to Redmine MCP Server for Cursor...");

  try {
    // First check server status
    console.log("Checking server status...");
    const statusResponse = await fetch(`${SERVER_URL}/status`);
    const status = await statusResponse.json();
    console.log("Server status:", status);

    // Connect to SSE endpoint
    console.log("Connecting to SSE endpoint...");
    const eventSource = new EventSource(`${SERVER_URL}/sse`);

    eventSource.onopen = () => {
      console.log("SSE connection opened");
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log("SSE connection closed");
      }
    };

    let connectionId = null;

    // Handle messages
    eventSource.onmessage = async (event) => {
      try {
        console.log("Raw event data:", event.data);
        const message = JSON.parse(event.data);
        console.log("Parsed message:", message);

        if (message.type === "connection") {
          connectionId = message.connectionId;
          console.log("Retrieved connection ID:", connectionId);

          // Now initialize the MCP connection
          try {
            await initializeMcpConnection(connectionId);
          } catch (error) {
            console.error("Initialization error:", error);
          }
        } else if (message.result && message.result.capabilities) {
          console.log("MCP connection successfully initialized");
          console.log(
            "Available capabilities:",
            Object.keys(message.result.capabilities)
          );

          // Test a tool
          try {
            await callTool(connectionId, "list_projects", {});
          } catch (error) {
            console.error("Error calling tool:", error);
          }
        } else if (message.result) {
          console.log("Tool call result:", message.result);
        } else if (message.error) {
          console.error("Error from server:", message.error);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    // Keep the process running
    console.log("Test client running. Press Ctrl+C to exit.");
  } catch (error) {
    console.error("Connection test failed:", error.message);
  }
}

async function initializeMcpConnection(connectionId) {
  console.log("Initializing MCP connection with ID:", connectionId);

  const requestBody = {
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      client: {
        name: "cursor-test",
        version: "1.0.0",
      },
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
    id: "1",
  };

  console.log(
    "Sending initialize request:",
    JSON.stringify(requestBody, null, 2)
  );

  try {
    const response = await fetch(`${SERVER_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Connection-Id": connectionId,
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Initialize response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("Error initializing connection:", text);
    } else {
      const responseData = await response.text();
      console.log("Initialize response body:", responseData);
    }
  } catch (error) {
    console.error("Failed to initialize MCP connection:", error.message);
    throw error;
  }
}

async function callTool(connectionId, toolName, args) {
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

    console.log("Tool call response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("Error calling tool:", text);
    } else {
      const responseData = await response.text();
      console.log("Tool call response body:", responseData);
    }
  } catch (error) {
    console.error("Failed to call tool:", error.message);
    throw error;
  }
}

testCursorConnection().catch((error) => {
  console.error("Test failed:", error);
});
