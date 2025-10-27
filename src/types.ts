export interface RedmineIssue {
  id: number;
  project: {
    id: number;
    name: string;
  };
  tracker: {
    id: number;
    name: string;
  };
  status: {
    id: number;
    name: string;
  };
  priority: {
    id: number;
    name: string;
  };
  author: {
    id: number;
    name: string;
  };
  assigned_to?: {
    id: number;
    name: string;
  };
  subject: string;
  description: string;
  start_date: string;
  due_date?: string;
  done_ratio: number;
  created_on: string;
  updated_on: string;
}

export interface RedmineProject {
  id: number;
  name: string;
  identifier: string;
  description: string;
  status: number;
}

export interface RedmineTracker {
  id: number;
  name: string;
}

export interface RedmineStatus {
  id: number;
  name: string;
}

export interface RedmineUser {
  id: number;
  login: string;
  firstname: string;
  lastname: string;
  name: string;
}

export interface RedminePriority {
  id: number;
  name: string;
}

export interface RedmineUpload {
  token: string;
  filename?: string;
  content_type?: string;
  description?: string;
}

export interface RedmineAttachment {
  id: number;
  filename: string;
  filesize: number;
  content_type: string;
  description?: string;
  author: {
    id: number;
    name: string;
  };
  created_on: string;
}

export interface CreateIssueParams {
  project_id: number;
  subject: string;
  description?: string;
  tracker_id?: number;
  status_id?: number;
  priority_id?: number;
  assigned_to_id?: number;
  start_date?: string;
  due_date?: string;
  parent_issue_id?: number;
  fixed_version_id?: number;
  category_id?: number;
  estimated_hours?: number;
  done_ratio?: number;
  custom_fields?: CustomField[];
  watcher_user_ids?: number[];
  notes?: string;
}

export interface UpdateIssueParams {
  subject?: string;
  description?: string;
  tracker_id?: number;
  status_id?: number;
  priority_id?: number;
  assigned_to_id?: number;
  start_date?: string;
  due_date?: string;
  parent_issue_id?: number;
  fixed_version_id?: number;
  category_id?: number;
  estimated_hours?: number;
  done_ratio?: number;
  custom_fields?: CustomField[];
  watcher_user_ids?: number[];
  notes?: string;
}

export interface SearchIssuesParams {
  project_id?: number;
  status_id?: number;
  tracker_id?: number;
  assigned_to_id?: number;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface RedmineConfig {
  url: string;
  apiKey: string;
  timeout?: number;
  insecureTls?: boolean;
}

export interface CustomField {
  id: number;
  value: string | string[] | number;
}

export interface RedmineVersion {
  id: number;
  name: string;
  description?: string;
  status: string;
  due_date?: string;
  sharing: string;
  created_on: string;
  updated_on: string;
}

export interface RedmineCategory {
  id: number;
  name: string;
  assigned_to?: {
    id: number;
    name: string;
  };
}
