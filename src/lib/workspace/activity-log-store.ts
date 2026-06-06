"use client";

import type { ActivityLogEntry } from "@/components/pages/workspace-pages";
import type { Database, Json } from "@/types/database";
import { canUseSupabaseBrowserClient, createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseUuid } from "@/lib/supabase/ids";

type SaveTarget = "localStorage" | "supabase";
type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];
type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];

type InsertTable<T> = {
  insert: (payload: T) => Promise<{ error: Error | null }>;
};
type SelectTable<T> = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => {
      limit: (count: number) => Promise<{ data: T[] | null; error: Error | null }>;
    };
  };
};

export async function createActivityLogRecord(log: ActivityLogEntry, actorId?: string) {
  if (!canSaveToSupabase(actorId)) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const auditLogsTable = supabase.from("audit_logs") as unknown as InsertTable<AuditLogInsert>;
  const payload: AuditLogInsert = {
    actor_id: actorId,
    actor_name: log.actor,
    action: log.action,
    target_type: inferTargetType(log),
    target_id: isSupabaseUuid(log.targetId) ? log.targetId : null,
    target_label: log.target,
    after_data: {
      target: log.target,
      detail: log.detail ?? null,
      time: log.time,
    } as Json,
  };

  const { error } = await auditLogsTable.insert(payload);
  if (error) {
    console.warn("Supabase activity log insert failed. Keeping local record.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function loadActivityLogsFromSupabase(actorId?: string) {
  if (!canSaveToSupabase(actorId)) {
    return { logs: [], target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const auditLogsTable = supabase.from("audit_logs") as unknown as SelectTable<AuditLogRow>;
  const { data, error } = await auditLogsTable.select("*").order("created_at", { ascending: false }).limit(100);
  if (error) {
    console.warn("Supabase activity logs load failed. Keeping local records.", error);
    return { logs: [], target: "localStorage" as SaveTarget };
  }

  return {
    logs: (data ?? []).map(rowToActivityLog),
    target: "supabase" as SaveTarget,
  };
}

function rowToActivityLog(row: AuditLogRow): ActivityLogEntry {
  return {
    actor: row.actor_name ?? "ログインユーザー",
    action: row.action,
    target: row.target_label ?? row.target_id ?? "未設定",
    detail: readLogDetail(row.after_data),
    targetId: row.target_id ?? undefined,
    targetType: row.target_type,
    time: formatDateTimeForDisplay(row.created_at),
    supabaseId: row.id,
  };
}

function readLogDetail(value: Json | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const detail = (value as { detail?: Json }).detail;
  return typeof detail === "string" && detail ? detail : undefined;
}

function canSaveToSupabase(actorId?: string) {
  return canUseSupabaseBrowserClient() && isSupabaseUuid(actorId);
}

function inferTargetType(log: ActivityLogEntry) {
  if (log.targetType) return log.targetType;
  if (log.action.includes("課題")) return "issue";
  if (log.action.includes("タスク")) return "task";
  if (log.action.includes("承認") || log.action.includes("差し戻し")) return "approval";
  return "workspace";
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
