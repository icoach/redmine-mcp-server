#!/usr/bin/env node

/**
 * Comprehensive test suite for Redmine MCP Server API endpoints
 * Tests each endpoint in isolation following development best practices
 *
 * Usage: node tests/api-endpoints.test.js
 *
 * Required environment variables:
 * - REDMINE_URL
 * - REDMINE_API_KEY
 * - MCP_API_KEY
 * - REDMINE_DEFAULT_PROJECT_ID (optional)
 * - TEST_PROJECT_ID (for tests)
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "../dist/index.js");

// Test configuration
const TEST_CONFIG = {
  timeout: 10000,
  testProjectId:
    process.env.TEST_PROJECT_ID || process.env.REDMINE_DEFAULT_PROJECT_ID,
  testIssueSubject: "MCP Test Issue " + Date.now(),
};

// Validation
if (!TEST_CONFIG.testProjectId) {
  console.error(
    "TEST_PROJECT_ID or REDMINE_DEFAULT_PROJECT_ID required for testing"
  );
  process.exit(1);
}

class MCPTestClient {
  constructor() {
    this.requestId = 0;
    this.process = null;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.process = spawn(
        "node",
        [serverPath, "--api-key", process.env.MCP_API_KEY],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: process.env,
        }
      );

      this.process.stderr.on("data", (data) => {
        console.error(`Server stderr: ${data}`);
      });

      setTimeout(resolve, 1000); // Give server time to start
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  async callTool(name, arguments = {}) {
    if (!this.process) {
      throw new Error("Server not started");
    }

    const requestId = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: {
        name,
        arguments,
      },
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to ${name}`));
      }, TEST_CONFIG.timeout);

      const onData = (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          if (response.id === requestId) {
            this.process.stdout.removeListener("data", onData);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (err) {
          reject(err);
        }
      };

      this.process.stdout.on("data", onData);
      this.process.stdin.write(JSON.stringify(request) + "\n");
    });
  }
}

// Test suite
class RedmineMCPTests {
  constructor() {
    this.client = new MCPTestClient();
    this.testIssueId = null;
    this.testResults = [];
  }

  log(message) {
    console.log(`[TEST] ${message}`);
  }

  logResult(testName, passed, error = null) {
    const result = { testName, passed, error };
    this.testResults.push(result);
    const status = passed ? "✅ PASS" : "❌ FAIL";
    this.log(`${status}: ${testName}${error ? ` - ${error.message}` : ""}`);
  }

  async runTest(testName, testFn) {
    try {
      await testFn();
      this.logResult(testName, true);
    } catch (error) {
      this.logResult(testName, false, error);
    }
  }

  async testListProjects() {
    const result = await this.client.callTool("list_projects");
    if (!result.content || !result.content[0] || !result.content[0].text) {
      throw new Error("Invalid response format");
    }

    const projects = JSON.parse(result.content[0].text);
    if (!Array.isArray(projects)) {
      throw new Error("Projects should be an array");
    }

    this.log(`Found ${projects.length} projects`);
  }

  async testListTrackersStatuses() {
    const result = await this.client.callTool("list_trackers_statuses");
    const data = JSON.parse(result.content[0].text);

    if (!Array.isArray(data.trackers) || !Array.isArray(data.statuses)) {
      throw new Error("Invalid trackers/statuses format");
    }

    this.log(
      `Found ${data.trackers.length} trackers, ${data.statuses.length} statuses`
    );
  }

  async testGetMetadata() {
    const result = await this.client.callTool("get_metadata");
    const metadata = JSON.parse(result.content[0].text);

    const requiredFields = ["projects", "trackers", "statuses", "users"];
    for (const field of requiredFields) {
      if (!Array.isArray(metadata[field])) {
        throw new Error(`Metadata missing or invalid ${field}`);
      }
    }

    this.log(`Metadata includes: ${Object.keys(metadata).join(", ")}`);
  }

  async testCreateIssue() {
    const result = await this.client.callTool("create_issue", {
      project_id: parseInt(TEST_CONFIG.testProjectId),
      subject: TEST_CONFIG.testIssueSubject,
      description: "Test issue created by MCP test suite",
    });

    const issue = JSON.parse(result.content[0].text);
    if (!issue.id || !issue.subject) {
      throw new Error("Invalid issue creation response");
    }

    this.testIssueId = issue.id;
    this.log(`Created test issue #${issue.id}`);
  }

  async testReadIssue() {
    if (!this.testIssueId) {
      throw new Error("No test issue available");
    }

    const result = await this.client.callTool("read_issue", {
      issue_id: this.testIssueId,
    });

    const issue = JSON.parse(result.content[0].text);
    if (issue.id !== this.testIssueId) {
      throw new Error("Issue ID mismatch");
    }

    if (issue.subject !== TEST_CONFIG.testIssueSubject) {
      throw new Error("Issue subject mismatch");
    }

    this.log(`Read issue #${issue.id}: ${issue.subject}`);
  }

  async testUpdateIssue() {
    if (!this.testIssueId) {
      throw new Error("No test issue available");
    }

    const updatedSubject = TEST_CONFIG.testIssueSubject + " (UPDATED)";
    const result = await this.client.callTool("update_issue", {
      issue_id: this.testIssueId,
      subject: updatedSubject,
      description: "Updated description",
    });

    const issue = JSON.parse(result.content[0].text);
    if (issue.subject !== updatedSubject) {
      throw new Error("Issue update failed");
    }

    this.log(`Updated issue #${issue.id}`);
  }

  async testAddIssueNote() {
    if (!this.testIssueId) {
      throw new Error("No test issue available");
    }

    const testNote = `Test note added at ${new Date().toISOString()}`;
    const result = await this.client.callTool("add_issue_note", {
      issue_id: this.testIssueId,
      notes: testNote,
    });

    const issue = JSON.parse(result.content[0].text);
    if (issue.id !== this.testIssueId) {
      throw new Error("Issue note addition failed");
    }

    this.log(`Added note to issue #${issue.id}`);
  }

  async testFindIssues() {
    const result = await this.client.callTool("find_issues", {
      project_id: parseInt(TEST_CONFIG.testProjectId),
      limit: 5,
    });

    const searchResult = JSON.parse(result.content[0].text);
    if (!Array.isArray(searchResult.issues)) {
      throw new Error("Invalid search result format");
    }

    this.log(
      `Found ${searchResult.issues.length} issues (total: ${searchResult.total_count})`
    );
  }

  async testTransitionIssue() {
    if (!this.testIssueId) {
      throw new Error("No test issue available");
    }

    // Get available statuses first
    const statusResult = await this.client.callTool("list_trackers_statuses");
    const statusData = JSON.parse(statusResult.content[0].text);

    if (statusData.statuses.length === 0) {
      throw new Error("No statuses available for transition test");
    }

    // Use the first available status
    const targetStatus = statusData.statuses[0];
    const result = await this.client.callTool("transition_issue", {
      issue_id: this.testIssueId,
      status_id: targetStatus.id,
      notes: "Status transition test",
    });

    const issue = JSON.parse(result.content[0].text);
    this.log(`Transitioned issue #${issue.id} to status: ${targetStatus.name}`);
  }

  async testAddAttachment() {
    if (!this.testIssueId) {
      throw new Error("No test issue available");
    }

    // Create a simple text file as base64
    const testContent = "This is a test attachment created by MCP test suite";
    const base64Content = Buffer.from(testContent, "utf8").toString("base64");

    const result = await this.client.callTool("add_attachment", {
      issue_id: this.testIssueId,
      filename: "test-attachment.txt",
      data_base64: base64Content,
      content_type: "text/plain",
      description: "Test attachment",
    });

    const issue = JSON.parse(result.content[0].text);
    this.log(`Added attachment to issue #${issue.id}`);
  }

  async runAllTests() {
    this.log("Starting Redmine MCP Server test suite...");

    try {
      await this.client.start();
      this.log("Server started successfully");

      // Metadata and listing tests
      await this.runTest("list_projects", () => this.testListProjects());
      await this.runTest("list_trackers_statuses", () =>
        this.testListTrackersStatuses()
      );
      await this.runTest("get_metadata", () => this.testGetMetadata());

      // Issue lifecycle tests
      await this.runTest("create_issue", () => this.testCreateIssue());
      await this.runTest("read_issue", () => this.testReadIssue());
      await this.runTest("update_issue", () => this.testUpdateIssue());
      await this.runTest("add_issue_note", () => this.testAddIssueNote());
      await this.runTest("find_issues", () => this.testFindIssues());
      await this.runTest("transition_issue", () => this.testTransitionIssue());
      await this.runTest("add_attachment", () => this.testAddAttachment());
    } finally {
      await this.client.stop();
      this.log("Server stopped");
    }

    // Print summary
    const passed = this.testResults.filter((r) => r.passed).length;
    const total = this.testResults.length;

    this.log(`\nTest Results: ${passed}/${total} passed`);

    if (passed === total) {
      this.log("🎉 All tests passed!");
      return 0;
    } else {
      this.log("❌ Some tests failed");
      return 1;
    }
  }
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new RedmineMCPTests();
  tests
    .runAllTests()
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
      console.error("Test suite failed:", error);
      process.exit(1);
    });
}

export { RedmineMCPTests, MCPTestClient };
