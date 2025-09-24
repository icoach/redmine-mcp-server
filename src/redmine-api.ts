import {
  RedmineIssue,
  RedmineProject,
  RedmineTracker,
  RedmineStatus,
  RedmineUser,
  RedminePriority,
  RedmineUpload,
  CreateIssueParams,
  UpdateIssueParams,
  SearchIssuesParams,
  RedmineConfig,
} from "./types.js";

export class RedmineClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;
  private insecureTls: boolean;

  constructor(config: RedmineConfig) {
    this.baseUrl = config.url.endsWith("/") ? config.url : `${config.url}/`;
    this.headers = {
      "X-Redmine-API-Key": config.apiKey,
      "Content-Type": "application/json",
    };
    this.timeout = config.timeout || 30000; // 30s default
    this.insecureTls = config.insecureTls || false;
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT",
    data?: any,
    customHeaders?: Record<string, string>,
    rawBody?: boolean
  ): Promise<T> {
    try {
      console.error(`[API] ${method} request to endpoint: ${endpoint}`);

      const url = `${this.baseUrl}${endpoint}`;
      const headers = { ...this.headers, ...customHeaders };

      const response = await fetch(url, {
        method,
        headers,
        body: rawBody ? data : data ? JSON.stringify(data) : undefined,
        // @ts-ignore - Node.js specific signal handling
        signal: AbortSignal.timeout
          ? AbortSignal.timeout(this.timeout)
          : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      } else {
        return response.text() as any;
      }
    } catch (error: any) {
      console.error(`[Error] API request failed: ${this.baseUrl}${endpoint}`);
      console.error(`[Error] ${error.message}`);
      throw error;
    }
  }

  // Issues
  async getIssue(id: number): Promise<{ issue: RedmineIssue }> {
    return this.request(`issues/${id}.json`, "GET");
  }

  async createIssue(
    params: CreateIssueParams
  ): Promise<{ issue: RedmineIssue }> {
    return this.request("issues.json", "POST", { issue: params });
  }

  async updateIssue(id: number, params: UpdateIssueParams): Promise<void> {
    return this.request(`issues/${id}.json`, "PUT", { issue: params });
  }

  async searchIssues(params: SearchIssuesParams): Promise<{
    issues: RedmineIssue[];
    total_count: number;
    offset: number;
    limit: number;
  }> {
    const queryParams = Object.entries(params)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join("&");

    return this.request(`issues.json?${queryParams}`, "GET");
  }

  // Projects
  async getProjects(): Promise<{ projects: RedmineProject[] }> {
    return this.request("projects.json", "GET");
  }

  // Trackers
  async getTrackers(): Promise<{ trackers: RedmineTracker[] }> {
    return this.request("trackers.json", "GET");
  }

  // Issue Statuses
  async getIssueStatuses(): Promise<{ issue_statuses: RedmineStatus[] }> {
    return this.request("issue_statuses.json", "GET");
  }

  // Users
  async getUsers(): Promise<{ users: RedmineUser[] }> {
    return this.request("users.json", "GET");
  }

  // Issue Priorities
  async getIssuePriorities(): Promise<{ issue_priorities: RedminePriority[] }> {
    return this.request("enumerations/issue_priorities.json", "GET");
  }

  // Binary Upload for attachments
  async uploadBinary(data: Uint8Array): Promise<{ upload: RedmineUpload }> {
    return this.request(
      "uploads.json",
      "POST",
      data,
      { "Content-Type": "application/octet-stream" },
      true
    );
  }

  // Add note to issue
  async addIssueNote(issueId: number, notes: string): Promise<void> {
    return this.request(`issues/${issueId}.json`, "PUT", { issue: { notes } });
  }

  // Transition issue (change status)
  async transitionIssue(
    issueId: number,
    statusId: number,
    notes?: string
  ): Promise<void> {
    const issue: any = { status_id: statusId };
    if (notes) {
      issue.notes = notes;
    }
    return this.request(`issues/${issueId}.json`, "PUT", { issue });
  }

  // Add attachment to issue
  async addAttachment(
    issueId: number,
    uploads: RedmineUpload[]
  ): Promise<void> {
    return this.request(`issues/${issueId}.json`, "PUT", {
      issue: { uploads },
    });
  }
}
