"use client";

import { TaskRecord } from "@/components/pages/workspace-pages";
import { canUseSupabaseBrowserClient, createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseUuid } from "@/lib/supabase/ids";

const STORAGE_KEY = "tauros-teamos.task-records.v1";

export type TaskRecordMap = Record<string, TaskRecord>;

export function loadLocalTaskRecords(fallback: TaskRecordMap): TaskRecordMap {
  if (typeof window === "undefined") return fallback;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const saved = JSON.parse(raw) as TaskRecordMap;
    return mergeTaskRecords(fallback, saved);
  } catch {
    return fallback;
  }
}

export function saveLocalTaskRecords(records: TaskRecordMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export async function saveTaskRecord(taskId: string, record: TaskRecord, statusOverride?: "completed") {
  saveLocalTaskRecords({ ...loadLocalTaskRecords({}), [taskId]: record });

  if (!canUseSupabaseBrowserClient() || !isSupabaseUuid(taskId)) {
    return { target: "localStorage" as const };
  }

  const supabase = createSupabaseBrowserClient();
  const taskTable = supabase.from("tasks") as ReturnType<typeof supabase.from> & {
    update: (payload: { progress: number; body: string; status: string; completed_at?: string | null }) => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>;
    };
  };
  const status = statusOverride ?? (record.progress >= 95 ? "waiting_approval" : record.progress > 0 ? "in_progress" : "not_started");
  const { error } = await taskTable
    .update({
      progress: record.progress,
      body: record.nextActionMemo ?? record.todoMemo,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) throw error;
  return { target: "supabase" as const };
}

function mergeTaskRecords(fallback: TaskRecordMap, saved: TaskRecordMap): TaskRecordMap {
  const merged = { ...fallback };
  for (const [taskId, record] of Object.entries(saved)) {
    if (!record || typeof record.progress !== "number" || !Array.isArray(record.updates)) continue;
    merged[taskId] = {
      ...fallback[taskId],
      ...record,
      updates: record.updates,
    };
  }
  return merged;
}
