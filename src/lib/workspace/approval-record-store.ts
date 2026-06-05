"use client";

import type { ApprovalHistoryEntry, ApprovalRequestEntry, SendbackTaskEntry } from "@/components/pages/workspace-pages";
import type { ApprovalStatus, Database } from "@/types/database";
import { canUseSupabaseBrowserClient, createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseUuid } from "@/lib/supabase/ids";

type SaveTarget = "localStorage" | "supabase";
type ApprovalRow = Database["public"]["Tables"]["approvals"]["Row"];
type ApprovalInsert = Database["public"]["Tables"]["approvals"]["Insert"];
type ApprovalUpdate = Database["public"]["Tables"]["approvals"]["Update"];

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

export async function createApprovalRecord(approval: ApprovalRequestEntry, requesterId?: string) {
  if (!canSaveToSupabase(requesterId)) {
    return { entry: approval, target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const approvalsTable = supabase.from("approvals") as unknown as InsertTable<ApprovalInsert>;
  const payload: ApprovalInsert = {
    requester_id: requesterId,
    approval_type: approval.type,
    target_title: approval.target,
    requester_name: approval.requester,
    reviewer_id: isSupabaseUuid(approval.reviewerId) ? approval.reviewerId : null,
    reviewer_name: approval.reviewerName ?? null,
    final_approver_id: isSupabaseUuid(approval.finalApproverId) ? approval.finalApproverId : null,
    final_approver_name: approval.finalApproverName ?? null,
    task_id: isSupabaseUuid(approval.taskSupabaseId) ? approval.taskSupabaseId : null,
    priority: toDbPriority(approval.priority),
    due_date: parseDisplayDate(approval.dueDate),
    due_date_label: approval.dueDate,
    issue_created_at_label: approval.issueCreatedAt ?? approval.requestedAt ?? null,
    body: approval.body ?? approval.target,
    status: "waiting_approval",
  };

  const { data, error } = await approvalsTable.insert(payload).select("id").single();
  if (error) {
    console.warn("Supabase approval insert failed. Keeping local record.", error);
    return { entry: approval, target: "localStorage" as SaveTarget };
  }

  return {
    entry: {
      ...approval,
      supabaseId: data.id,
      requesterId,
    },
    target: "supabase" as SaveTarget,
  };
}

export async function loadApprovalRecordsFromSupabase(profileId?: string) {
  if (!canSaveToSupabase(profileId)) {
    return { requests: [], histories: [], sendbacks: [], target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const approvalsTable = supabase.from("approvals") as unknown as SelectTable<ApprovalRow>;
  const { data, error } = await approvalsTable.select("*").order("created_at", { ascending: false });
  if (error) {
    console.warn("Supabase approvals load failed. Keeping local records.", error);
    return { requests: [], histories: [], sendbacks: [], target: "localStorage" as SaveTarget };
  }

  const rows = data ?? [];
  return {
    requests: rows.filter((row) => row.status === "waiting_approval" || row.status === "submitted").map(rowToRequest),
    histories: rows.filter((row) => row.status === "approved").map(rowToHistory),
    sendbacks: rows.filter((row) => row.status === "rejected_back").map(rowToSendback),
    target: "supabase" as SaveTarget,
  };
}

export async function updateApprovalDecision(approval: ApprovalRequestEntry, mode: "approve" | "sendback", comment: string, approverId?: string, approverName?: string) {
  const approvalId = approval.supabaseId ?? (isSupabaseUuid(approval.id) ? approval.id : undefined);
  if (!canSaveToSupabase(approverId) || !approvalId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const approvalsTable = supabase.from("approvals") as unknown as UpdateTable<ApprovalUpdate>;
  const timestamp = new Date().toISOString();
  const payload: ApprovalUpdate = mode === "approve"
    ? {
        approver_id: approverId,
        approver_name: approverName,
        approval_comment: comment,
        status: "approved",
        approved_at: timestamp,
      }
    : {
        approver_id: approverId,
        approver_name: approverName,
        rejected_reason: comment,
        status: "rejected_back",
        rejected_back_at: timestamp,
      };

  const { error } = await approvalsTable.update(payload).eq("id", approvalId);
  if (error) {
    console.warn("Supabase approval update failed. Keeping local record.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function updateApprovalReview(approval: ApprovalRequestEntry, comment: string, reviewerId?: string, reviewerName?: string) {
  const approvalId = approval.supabaseId ?? (isSupabaseUuid(approval.id) ? approval.id : undefined);
  if (!canSaveToSupabase(reviewerId) || !approvalId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const approvalsTable = supabase.from("approvals") as unknown as UpdateTable<ApprovalUpdate>;
  const { error } = await approvalsTable.update({
    reviewed_by: reviewerId,
    reviewed_by_name: reviewerName,
    review_comment: comment,
    reviewed_at: new Date().toISOString(),
  }).eq("id", approvalId);
  if (error) {
    console.warn("Supabase approval review update failed. Keeping local record.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

function rowToRequest(row: ApprovalRow): ApprovalRequestEntry {
  return {
    id: `APR-DB-${row.id.slice(0, 8)}`,
    type: row.approval_type,
    target: row.target_title || row.body,
    requester: row.requester_name ?? "ログインユーザー",
    requesterId: row.requester_id ?? undefined,
    reviewerId: row.reviewer_id ?? undefined,
    reviewerName: row.reviewer_name ?? undefined,
    reviewedById: row.reviewed_by ?? undefined,
    reviewedByName: row.reviewed_by_name ?? undefined,
    reviewedAt: row.reviewed_at ? formatDateTimeForDisplay(row.reviewed_at) : undefined,
    reviewComment: row.review_comment ?? undefined,
    finalApproverId: row.final_approver_id ?? undefined,
    finalApproverName: row.final_approver_name ?? undefined,
    priority: fromDbPriority(row.priority),
    dueDate: row.due_date_label ?? formatDateForDisplay(row.due_date),
    status: "承認待ち",
    taskId: row.task_id ? `task-db-${row.task_id}` : undefined,
    taskSupabaseId: row.task_id ?? undefined,
    requestedAt: formatDateTimeForDisplay(row.created_at),
    issueCreatedAt: row.issue_created_at_label ?? formatDateTimeForDisplay(row.created_at),
    body: row.body,
    supabaseId: row.id,
  };
}

function rowToHistory(row: ApprovalRow): ApprovalHistoryEntry {
  return {
    id: `APR-DB-${row.id.slice(0, 8)}`,
    type: row.approval_type,
    target: row.target_title || row.body,
    requester: row.requester_name ?? "ログインユーザー",
    approvedBy: row.approver_name ?? "承認者",
    approvedAt: formatDateTimeForDisplay(row.approved_at ?? row.updated_at),
    comment: row.approval_comment ?? "コメント未入力",
    issueCreatedAt: row.issue_created_at_label ?? formatDateTimeForDisplay(row.created_at),
    supabaseId: row.id,
  };
}

function rowToSendback(row: ApprovalRow): SendbackTaskEntry {
  return {
    id: row.task_id ? `task-db-${row.task_id}` : `sendback-db-${row.id}`,
    title: row.target_title || row.body,
    projectName: "差し戻し対応",
    assigneeName: row.requester_name ?? "ログインユーザー",
    dueDate: row.due_date_label ?? formatDateForDisplay(row.due_date),
    priority: fromDbPriority(row.priority),
    status: "in_progress",
    progress: 70,
    sendbackReason: row.rejected_reason ?? "コメント未入力",
    sentBackAt: formatDateTimeForDisplay(row.rejected_back_at ?? row.updated_at),
  };
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

function toDbPriority(priority: ApprovalRequestEntry["priority"]) {
  if (priority === "must") return "Must";
  if (priority === "should") return "Should";
  return "Could";
}

function fromDbPriority(priority: string): ApprovalRequestEntry["priority"] {
  const normalized = priority.toLowerCase();
  if (normalized === "must") return "must";
  if (normalized === "could") return "could";
  return "should";
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

export type { ApprovalStatus };
