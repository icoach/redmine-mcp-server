#!/usr/bin/env node

/**
 * Simple integration test for Redmine MCP Server
 * Tests basic functionality without full MCP protocol overhead
 *
 * Usage: node test-integration.js
 *
 * Required environment variables:
 * - REDMINE_URL
 * - REDMINE_API_KEY
 * - TEST_PROJECT_ID (optional, will use default if available)
 */

import dotenv from "dotenv";
dotenv.config();

import { RedmineClient } from "./dist/redmine-api.js";

// Test configuration
const config = {
  url: process.env.REDMINE_URL,
  apiKey: process.env.REDMINE_API_KEY,
  timeout: parseInt(process.env.REDMINE_TIMEOUT_MS) || 30000,
  insecureTls: process.env.REDMINE_INSECURE_TLS === "true",
};

const testProjectId =
  process.env.TEST_PROJECT_ID || process.env.REDMINE_DEFAULT_PROJECT_ID;

if (!config.url || !config.apiKey) {
  console.error(
    "Missing required environment variables: REDMINE_URL, REDMINE_API_KEY"
  );
  process.exit(1);
}

class RedmineIntegrationTest {
  constructor() {
    this.client = new RedmineClient(config);
    this.testIssueId = null;
    this.results = [];
  }

  log(message) {
    console.log(`[TEST] ${message}`);
  }

  async runTest(name, testFn) {
    try {
      this.log(`Running: ${name}`);
      const result = await testFn();
      this.results.push({ name, passed: true });
      this.log(`✅ ${name} - PASSED`);
      return result;
    } catch (error) {
      this.results.push({ name, passed: false, error: error.message });
      this.log(`❌ ${name} - FAILED: ${error.message}`);
      throw error;
    }
  }

  async testConnection() {
    const projects = await this.client.getProjects();
    if (!projects.projects || !Array.isArray(projects.projects)) {
      throw new Error("Invalid projects response");
    }
    this.log(
      `Connected successfully. Found ${projects.projects.length} projects`
    );
    return projects;
  }

  async testMetadataRetrieval() {
    const [projects, trackers, statuses, users] = await Promise.all([
      this.client.getProjects(),
      this.client.getTrackers(),
      this.client.getIssueStatuses(),
      this.client.getUsers(),
    ]);

    let priorities = { issue_priorities: [] };
    try {
      priorities = await this.client.getIssuePriorities();
    } catch (error) {
      this.log(`Note: Priorities not available: ${error.message}`);
    }

    const counts = {
      projects: projects.projects.length,
      trackers: trackers.trackers.length,
      statuses: statuses.issue_statuses.length,
      users: users.users.length,
      priorities: priorities.issue_priorities.length,
    };

    this.log(`Metadata retrieved: ${JSON.stringify(counts)}`);
    return counts;
  }

  async testIssueOperations() {
    if (!testProjectId) {
      throw new Error("TEST_PROJECT_ID required for issue operations");
    }

    const subject = `Test Issue ${Date.now()}`;
    const description = "Created by integration test";

    // Create issue
    const createResult = await this.client.createIssue({
      project_id: parseInt(testProjectId),
      subject,
      description,
    });

    if (!createResult.issue || !createResult.issue.id) {
      throw new Error("Failed to create issue");
    }

    this.testIssueId = createResult.issue.id;
    this.log(`Created issue #${this.testIssueId}`);

    // Read issue
    const readResult = await this.client.getIssue(this.testIssueId);
    if (readResult.issue.subject !== subject) {
      throw new Error("Issue subject mismatch on read");
    }

    // Update issue
    const updatedSubject = subject + " (Updated)";
    await this.client.updateIssue(this.testIssueId, {
      subject: updatedSubject,
    });

    const updatedIssue = await this.client.getIssue(this.testIssueId);
    if (updatedIssue.issue.subject !== updatedSubject) {
      throw new Error("Issue update failed");
    }

    this.log(`Updated issue #${this.testIssueId}`);

    // Add note
    await this.client.addIssueNote(this.testIssueId, "Test note added");
    this.log(`Added note to issue #${this.testIssueId}`);

    // Search issues
    const searchResult = await this.client.searchIssues({
      project_id: parseInt(testProjectId),
      limit: 5,
    });

    if (!searchResult.issues || !Array.isArray(searchResult.issues)) {
      throw new Error("Search failed");
    }

    this.log(`Search found ${searchResult.issues.length} issues`);

    return this.testIssueId;
  }

  async testAttachment() {
    if (!this.testIssueId) {
      throw new Error("No test issue available for attachment");
    }

    const testContent = "Test file content";
    const binaryData = new Uint8Array(Buffer.from(testContent, "utf8"));

    // Upload binary data
    const uploadResult = await this.client.uploadBinary(binaryData);
    if (!uploadResult.upload || !uploadResult.upload.token) {
      throw new Error("Failed to upload binary data");
    }

    // Attach to issue
    const upload = {
      token: uploadResult.upload.token,
      filename: "test.txt",
      content_type: "text/plain",
      description: "Test attachment",
    };

    await this.client.addAttachment(this.testIssueId, [upload]);
    this.log(`Added attachment to issue #${this.testIssueId}`);
  }

  async testStatusTransition() {
    if (!this.testIssueId) {
      throw new Error("No test issue available for transition");
    }

    const statuses = await this.client.getIssueStatuses();
    if (statuses.issue_statuses.length === 0) {
      throw new Error("No statuses available");
    }

    const targetStatus = statuses.issue_statuses[0];
    await this.client.transitionIssue(
      this.testIssueId,
      targetStatus.id,
      "Status transition test"
    );
    this.log(
      `Transitioned issue #${this.testIssueId} to status: ${targetStatus.name}`
    );
  }

  async runAllTests() {
    this.log("Starting Redmine API integration tests...");

    try {
      await this.runTest("Connection Test", () => this.testConnection());
      await this.runTest("Metadata Retrieval", () =>
        this.testMetadataRetrieval()
      );

      if (testProjectId) {
        await this.runTest("Issue Operations", () =>
          this.testIssueOperations()
        );
        await this.runTest("Attachment Upload", () => this.testAttachment());
        await this.runTest("Status Transition", () =>
          this.testStatusTransition()
        );
      } else {
        this.log("⚠️  Skipping issue tests - TEST_PROJECT_ID not provided");
      }
    } catch (error) {
      this.log(`Test failed: ${error.message}`);
    }

    // Summary
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;

    this.log(`\n=== Test Summary ===`);
    this.log(`Passed: ${passed}/${total}`);

    if (this.testIssueId) {
      this.log(
        `Test issue created: #${this.testIssueId} (you may want to clean this up manually)`
      );
    }

    if (passed === total) {
      this.log("🎉 All tests passed!");
      return 0;
    } else {
      this.log("❌ Some tests failed");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          this.log(`  - ${r.name}: ${r.error}`);
        });
      return 1;
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new RedmineIntegrationTest();
  test
    .runAllTests()
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
      console.error("Integration test failed:", error);
      process.exit(1);
    });
}

export { RedmineIntegrationTest };
