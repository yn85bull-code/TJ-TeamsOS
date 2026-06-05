"use client";

import type { CreatedIssueEntry, CreatedTaskEntry } from "@/components/pages/workspace-pages";
import type { Database, WorkStatus } from "@/types/database";
import { canUseSupabaseBrowserClient, createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseUuid } from "@/lib/supabase/ids";

type SaveTarget = "localStorage" | "supabase";
type IssueInsert = Database["public"]["Tables"]["issues"]["Insert"];
type IssueUpdate = Database["public"]["Tables"]["issues"]["Update"];
type IssueRow = Database["public"]["Tables"]["issues"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type InsertTable<T> = {
  insert: (payload: T) => {
    select: (columns: string) => {
      single: () => Promise<{ data: { id: string }; error: Error | null }>;
    };
  };
};
type UpdateTable<T> = {
  update: (payload: T) => {
    eq: (column: string, value: string) => Promise<{ error: Error | null }>;
  };
};
type SelectTable<T> = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => Promise<{ data: T[] | null; error: Error | null }>;
  };
};

export async function loadCreatedRecordsFromSupabase(profileId?: string, currentUserName = "ログインユーザー") {
  if (!canSaveToSupabase(profileId)) {
    return { issues: [], deletedIssues: [], tasks: [], deletedTasks: [], target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const issuesTable = supabase.from("issues") as unknown as SelectTable<IssueRow>;
  const tasksTable = supabase.from("tasks") as unknown as SelectTable<TaskRow>;
  const [issueResult, taskResult] = await Promise.all([
    issuesTable.select("*").order("created_at", { ascending: false }),
    tasksTable.select("*").order("created_at", { ascending: false }),
  ]);

  if (issueResult.error || taskResult.error) {
    console.warn("Supabase workspace load failed. Keeping local records.", issueResult.error ?? taskResult.error);
    return { issues: [], deletedIssues: [], tasks: [], deletedTasks: [], target: "localStorage" as SaveTarget };
  }

  return {
    issues: (issueResult.data ?? []).filter((issue) => !issue.deleted_at).map((issue) => issueRowToEntry(issue, currentUserName)),
    deletedIssues: (issueResult.data ?? []).filter((issue) => issue.deleted_at).map((issue) => issueRowToEntry(issue, currentUserName)),
    tasks: (taskResult.data ?? []).filter((task) => !task.deleted_at).map((task) => taskRowToEntry(task, currentUserName)),
    deletedTasks: (taskResult.data ?? []).filter((task) => task.deleted_at).map((task) => taskRowToEntry(task, currentUserName)),
    target: "supabase" as SaveTarget,
  };
}

export async function createIssueRecord(issue: CreatedIssueEntry, profileId?: string) {
  if (!canSaveToSupabase(profileId)) {
    return { entry: issue, target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: IssueInsert = {
    title: issue.title,
    category1: issue.category1,
    category2: issue.category2,
    priority: issue.priority,
    department_name: issue.department,
    as_is: issue.asIs,
    assignee_name: issue.owner,
    created_by: profileId,
    due_date: parseDisplayDate(issue.due),
    status: mapIssueStatus(issue.status),
    visibility: "team",
  };

  const issuesTable = supabase.from("issues") as unknown as InsertTable<IssueInsert>;
  const { data, error } = await issuesTable.insert(payload).select("id").single();
  if (error) {
    console.warn("Supabase issue insert failed. Keeping local record.", error);
    return { entry: issue, target: "localStorage" as SaveTarget };
  }

  return {
    entry: {
      ...issue,
      supabaseId: data.id,
      createdById: profileId,
    },
    target: "supabase" as SaveTarget,
  };
}

export async function updateIssueRecord(issue: CreatedIssueEntry) {
  const issueId = issue.supabaseId ?? (isSupabaseUuid(issue.id) ? issue.id : undefined);
  if (!canSaveToSupabase(issue.createdById) || !issueId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: IssueUpdate = {
    title: issue.title,
    category1: issue.category1,
    category2: issue.category2,
    priority: issue.priority,
    department_name: issue.department,
    as_is: issue.asIs,
    assignee_name: issue.owner,
    due_date: parseDisplayDate(issue.due),
    status: mapIssueStatus(issue.status),
  };

  const issuesTable = supabase.from("issues") as unknown as UpdateTable<IssueUpdate>;
  const { error } = await issuesTable.update(payload).eq("id", issueId);
  if (error) {
    console.warn("Supabase issue update failed. Keeping local record.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function softDeleteIssueRecord(issue: CreatedIssueEntry, profileId?: string) {
  const issueId = issue.supabaseId ?? (isSupabaseUuid(issue.id) ? issue.id : undefined);
  if (!canSaveToSupabase(profileId) || !issueId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: IssueUpdate = {
    deleted_at: new Date().toISOString(),
    deleted_by: profileId,
  };
  const issuesTable = supabase.from("issues") as unknown as UpdateTable<IssueUpdate>;
  const { error } = await issuesTable.update(payload).eq("id", issueId);
  if (error) {
    console.warn("Supabase issue soft delete failed. Keeping local state.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function restoreIssueRecord(issue: CreatedIssueEntry, profileId?: string) {
  const issueId = issue.supabaseId ?? (isSupabaseUuid(issue.id) ? issue.id : undefined);
  if (!canSaveToSupabase(profileId) || !issueId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: IssueUpdate = {
    deleted_at: null,
    deleted_by: null,
  };
  const issuesTable = supabase.from("issues") as unknown as UpdateTable<IssueUpdate>;
  const { error } = await issuesTable.update(payload).eq("id", issueId);
  if (error) {
    console.warn("Supabase issue restore failed. Keeping local state.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function createTaskRecord(task: CreatedTaskEntry, profileId?: string) {
  if (!canSaveToSupabase(profileId)) {
    return { entry: task, target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: TaskInsert = {
    issue_id: isSupabaseUuid(task.sourceIssueSupabaseId) ? task.sourceIssueSupabaseId : null,
    title: task.title,
    project_name: task.projectName,
    assignee_name: task.assigneeName,
    created_by: profileId,
    due_date: parseDisplayDate(task.dueDate),
    priority: toDbPriority(task.priority),
    status: mapTaskStatus(task.status),
    progress: task.progress,
    source_type: task.sourceType ?? "direct",
    source_issue_label: task.sourceIssueId,
    issue_created_at_label: task.issueCreatedAt,
    taskized_at_label: task.taskizedAt,
    responsible_person: task.responsiblePerson,
    assignee_person: task.assigneePerson,
    visibility: "team",
  };

  const tasksTable = supabase.from("tasks") as unknown as InsertTable<TaskInsert>;
  const { data, error } = await tasksTable.insert(payload).select("id").single();
  if (error) {
    console.warn("Supabase task insert failed. Keeping local record.", error);
    return { entry: task, target: "localStorage" as SaveTarget };
  }

  return {
    entry: {
      ...task,
      supabaseId: data.id,
      createdById: profileId,
    },
    target: "supabase" as SaveTarget,
  };
}

export async function updateTaskRecord(task: CreatedTaskEntry) {
  const taskId = task.supabaseId ?? (isSupabaseUuid(task.id) ? task.id : undefined);
  if (!canSaveToSupabase(task.createdById) || !taskId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: TaskUpdate = {
    title: task.title,
    project_name: task.projectName,
    assignee_name: task.assigneeName,
    due_date: parseDisplayDate(task.dueDate),
    priority: toDbPriority(task.priority),
    status: mapTaskStatus(task.status),
    source_type: task.sourceType ?? "direct",
    source_issue_label: task.sourceIssueId,
    issue_created_at_label: task.issueCreatedAt,
    taskized_at_label: task.taskizedAt,
    responsible_person: task.responsiblePerson,
    assignee_person: task.assigneePerson,
  };

  const tasksTable = supabase.from("tasks") as unknown as UpdateTable<TaskUpdate>;
  const { error } = await tasksTable.update(payload).eq("id", taskId);
  if (error) {
    console.warn("Supabase task update failed. Keeping local record.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function softDeleteTaskRecord(task: CreatedTaskEntry, profileId?: string) {
  const taskId = task.supabaseId ?? (isSupabaseUuid(task.id) ? task.id : undefined);
  if (!canSaveToSupabase(profileId) || !taskId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: TaskUpdate = {
    deleted_at: new Date().toISOString(),
    deleted_by: profileId,
  };
  const tasksTable = supabase.from("tasks") as unknown as UpdateTable<TaskUpdate>;
  const { error } = await tasksTable.update(payload).eq("id", taskId);
  if (error) {
    console.warn("Supabase task soft delete failed. Keeping local state.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function restoreTaskRecord(task: CreatedTaskEntry, profileId?: string) {
  const taskId = task.supabaseId ?? (isSupabaseUuid(task.id) ? task.id : undefined);
  if (!canSaveToSupabase(profileId) || !taskId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: TaskUpdate = {
    deleted_at: null,
    deleted_by: null,
  };
  const tasksTable = supabase.from("tasks") as unknown as UpdateTable<TaskUpdate>;
  const { error } = await tasksTable.update(payload).eq("id", taskId);
  if (error) {
    console.warn("Supabase task restore failed. Keeping local state.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

function canSaveToSupabase(profileId?: string) {
  return canUseSupabaseBrowserClient() && isSupabaseUuid(profileId);
}

function parseDisplayDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slashDate = value.match(/^(\d{2})\/(\d{2})$/);
  if (!slashDate) return null;
  return `${new Date().getFullYear()}-${slashDate[1]}-${slashDate[2]}`;
}

function mapIssueStatus(status: string): WorkStatus {
  if (status.includes("完")) return "completed";
  if (status.includes("承")) return "waiting_approval";
  if (status.includes("進")) return "in_progress";
  return "not_started";
}

function mapTaskStatus(status: CreatedTaskEntry["status"]): WorkStatus {
  if (status === "done") return "completed";
  if (status === "approval_pending") return "waiting_approval";
  if (status === "in_progress") return "in_progress";
  return "not_started";
}

function issueRowToEntry(issue: IssueRow, currentUserName: string): CreatedIssueEntry {
  return {
    id: `ISS-DB-${issue.id.slice(0, 8)}`,
    title: issue.title,
    department: issue.department_name ?? "未設定",
    owner: issue.assignee_name ?? "未設定",
    priority: normalizeDbPriority(issue.priority),
    status: workStatusToIssueStatus(issue.status),
    due: formatDateForDisplay(issue.due_date),
    createdAt: formatDateTimeForDisplay(issue.created_at),
    category1: issue.category1 ?? "事業課題",
    category2: issue.category2 ?? "顕在課題",
    asIs: issue.as_is ?? "",
    supabaseId: issue.id,
    createdById: issue.created_by ?? undefined,
    createdByName: issue.created_by ? currentUserName : undefined,
    updatedAt: formatDateTimeForDisplay(issue.updated_at),
    deletedAt: issue.deleted_at ? formatDateTimeForDisplay(issue.deleted_at) : undefined,
    deletedById: issue.deleted_by ?? undefined,
  };
}

function taskRowToEntry(task: TaskRow, currentUserName: string): CreatedTaskEntry {
  return {
    id: `task-db-${task.id}`,
    title: task.title,
    projectName: task.project_name ?? "未設定",
    assigneeName: task.assignee_name ?? "未設定",
    dueDate: formatDateForDisplay(task.due_date),
    priority: fromDbPriority(task.priority),
    status: workStatusToTaskStatus(task.status),
    progress: task.progress,
    sourceType: task.source_type === "issue" ? "issue" : "direct",
    sourceIssueId: task.source_issue_label ?? "直接登録",
    sourceIssueSupabaseId: task.issue_id ?? undefined,
    issueCreatedAt: task.issue_created_at_label ?? formatDateTimeForDisplay(task.created_at),
    taskizedAt: task.taskized_at_label ?? formatDateTimeForDisplay(task.created_at),
    responsiblePerson: task.responsible_person ?? task.assignee_name ?? "未設定",
    assigneePerson: task.assignee_person ?? task.assignee_name ?? "未設定",
    supabaseId: task.id,
    createdById: task.created_by ?? undefined,
    createdByName: task.created_by ? currentUserName : undefined,
    updatedAt: formatDateTimeForDisplay(task.updated_at),
    deletedAt: task.deleted_at ? formatDateTimeForDisplay(task.deleted_at) : undefined,
    deletedById: task.deleted_by ?? undefined,
  };
}

function workStatusToIssueStatus(status: WorkStatus) {
  if (status === "completed") return "完了";
  if (status === "waiting_approval") return "承認待ち";
  if (status === "in_progress") return "進行中";
  return "未着手";
}

function workStatusToTaskStatus(status: WorkStatus): CreatedTaskEntry["status"] {
  if (status === "completed") return "done";
  if (status === "waiting_approval") return "approval_pending";
  if (status === "in_progress") return "in_progress";
  return "not_started";
}

function normalizeDbPriority(priority: string) {
  const normalized = priority.toLowerCase();
  if (normalized === "must") return "Must";
  if (normalized === "could") return "Could";
  return "Should";
}

function fromDbPriority(priority: string): CreatedTaskEntry["priority"] {
  const normalized = priority.toLowerCase();
  if (normalized === "must") return "must";
  if (normalized === "could") return "could";
  return "should";
}

function toDbPriority(priority: CreatedTaskEntry["priority"]) {
  if (priority === "must") return "Must";
  if (priority === "should") return "Should";
  return "Could";
}

function formatDateForDisplay(value: string | null) {
  if (!value) return "未設定";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTimeForDisplay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}
