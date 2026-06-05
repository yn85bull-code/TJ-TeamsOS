"use client";

import type { Database } from "@/types/database";
import { canUseSupabaseBrowserClient, createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseUuid } from "@/lib/supabase/ids";

export type AppNotificationEntry = {
  id: string;
  title: string;
  detail: string;
  time: string;
  target: string;
  notificationType?: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  recipientId?: string;
  actorId?: string;
  actorName?: string;
  readAt?: string;
  supabaseId?: string;
};

type SaveTarget = "localStorage" | "supabase";
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
type NotificationUpdate = Database["public"]["Tables"]["notifications"]["Update"];

type InsertTable<T> = {
  insert: (payload: T) => {
    select: (columns: string) => {
      single: () => Promise<{ data: { id: string; created_at: string } | null; error: Error | null }>;
    };
  };
};
type SelectTable<T> = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => {
      limit: (count: number) => Promise<{ data: T[] | null; error: Error | null }>;
    };
  };
};
type UpdateTable<T> = {
  update: (payload: T) => {
    eq: (column: string, value: string) => Promise<{ error: Error | null }>;
  };
};

export async function createNotificationRecord(notification: AppNotificationEntry, actorId?: string) {
  const recipientId = notification.recipientId;
  if (!recipientId || !canSaveToSupabase(recipientId)) {
    return { entry: notification, target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const notificationsTable = supabase.from("notifications") as unknown as InsertTable<NotificationInsert>;
  const effectiveActorId = actorId ?? notification.actorId;
  const dbActorId = effectiveActorId && isSupabaseUuid(effectiveActorId) ? effectiveActorId : null;
  const payload: NotificationInsert = {
    recipient_id: recipientId,
    actor_id: dbActorId,
    actor_name: notification.actorName ?? null,
    notification_type: notification.notificationType ?? notification.targetType ?? "workspace",
    title: notification.title,
    body: notification.detail,
    target_type: notification.targetType ?? notification.target,
    target_id: isSupabaseUuid(notification.targetId) ? notification.targetId : null,
    target_label: notification.targetLabel ?? notification.title,
    read_at: notification.readAt ?? null,
  };

  const { data, error } = await notificationsTable.insert(payload).select("id, created_at").single();
  if (error || !data) {
    console.warn("Supabase notification insert failed. Keeping local notification.", error);
    return { entry: notification, target: "localStorage" as SaveTarget };
  }

  return {
    entry: {
      ...notification,
      id: data.id,
      supabaseId: data.id,
      time: formatDateTimeForDisplay(data.created_at),
    },
    target: "supabase" as SaveTarget,
  };
}

export async function loadNotificationsFromSupabase(profileId?: string) {
  if (!canSaveToSupabase(profileId)) {
    return { notifications: [], target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const notificationsTable = supabase.from("notifications") as unknown as SelectTable<NotificationRow>;
  const { data, error } = await notificationsTable.select("*").order("created_at", { ascending: false }).limit(50);
  if (error) {
    console.warn("Supabase notifications load failed. Keeping local notifications.", error);
    return { notifications: [], target: "localStorage" as SaveTarget };
  }

  return {
    notifications: (data ?? []).map(rowToNotification),
    target: "supabase" as SaveTarget,
  };
}

export async function markNotificationReadRecord(notification: AppNotificationEntry, profileId?: string) {
  const notificationId = notification.supabaseId ?? (isSupabaseUuid(notification.id) ? notification.id : undefined);
  if (!canSaveToSupabase(profileId) || !notificationId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const notificationsTable = supabase.from("notifications") as unknown as UpdateTable<NotificationUpdate>;
  const { error } = await notificationsTable.update({ read_at: notification.readAt ?? new Date().toISOString() }).eq("id", notificationId);
  if (error) {
    console.warn("Supabase notification read update failed. Keeping local state.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function markNotificationsReadRecord(notifications: AppNotificationEntry[], profileId?: string) {
  await Promise.all(notifications.map((notification) => markNotificationReadRecord(notification, profileId)));
}

function rowToNotification(row: NotificationRow): AppNotificationEntry {
  return {
    id: row.id,
    title: row.title,
    detail: row.body ?? row.target_label ?? "",
    time: formatDateTimeForDisplay(row.created_at),
    target: toNavigationTarget(row.target_type, row.notification_type),
    notificationType: row.notification_type,
    targetType: row.target_type ?? undefined,
    targetId: row.target_id ?? undefined,
    targetLabel: row.target_label ?? undefined,
    recipientId: row.recipient_id,
    actorId: row.actor_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    readAt: row.read_at ?? undefined,
    supabaseId: row.id,
  };
}

function toNavigationTarget(targetType: string | null, notificationType: string) {
  const key = targetType ?? notificationType;
  if (key.includes("approval")) return "approvals";
  if (key.includes("task")) return "tasks";
  if (key.includes("issue")) return "issues";
  if (key.includes("ai")) return "ai";
  if (key.includes("log")) return "logs";
  return "dashboard";
}

function canSaveToSupabase(profileId?: string) {
  return canUseSupabaseBrowserClient() && isSupabaseUuid(profileId);
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
