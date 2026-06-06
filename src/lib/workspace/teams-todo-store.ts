"use client";

import type { Database } from "@/types/database";
import { canUseSupabaseBrowserClient, createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseUuid } from "@/lib/supabase/ids";
import { formatMyTodoDateTime, type MyTodoPriority, type MyTodoStatus } from "@/lib/workspace/my-todo-store";

export type TeamsTodoEntry = {
  id: string;
  title: string;
  memo: string;
  dueDate: string;
  priority: MyTodoPriority;
  status: MyTodoStatus;
  targetOrganization: string;
  assigneeId?: string;
  assigneeName?: string;
  assignedMyTodoId?: string;
  assignedAt?: string;
  createdById?: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  deletedAt?: string;
  supabaseId?: string;
};

type SaveTarget = "localStorage" | "supabase";
type TeamsTodoRow = Database["public"]["Tables"]["teams_todos"]["Row"];
type TeamsTodoInsert = Database["public"]["Tables"]["teams_todos"]["Insert"];
type TeamsTodoUpdate = Database["public"]["Tables"]["teams_todos"]["Update"];

type InsertTable<T> = {
  insert: (payload: T) => {
    select: (columns: string) => {
      single: () => Promise<{ data: { id: string }; error: Error | null }>;
    };
  };
};

type SelectOwnOrganizationTable<T> = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      is: (column: string, value: null) => {
        order: (column: string, options: { ascending: boolean }) => Promise<{ data: T[] | null; error: Error | null }>;
      };
    };
  };
};

type UpdateOwnOrganizationTable<T> = {
  update: (payload: T) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>;
    };
  };
};

export function getDefaultTeamsTodos(organization: string, createdByName: string, createdById?: string): TeamsTodoEntry[] {
  const now = formatMyTodoDateTime(new Date());
  return [
    {
      id: `local-${normalizeOrganizationKey(organization)}-team-todo-1`,
      title: `${organization}で共有する確認事項`,
      memo: "課題化する前の所属共有ToDoです。承認フローには流しません。",
      dueDate: "2026-06-10",
      priority: "high",
      status: "not_started",
      targetOrganization: organization,
      createdById,
      createdByName,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export async function loadTeamsTodos(organization?: string, userId?: string, userName = "ログインユーザー") {
  if (!organization) return { todos: [], target: "localStorage" as SaveTarget };
  const localTodos = loadLocalTeamsTodos(organization, getDefaultTeamsTodos(organization, userName, userId));

  if (!canUseSupabaseBrowserClient() || !userId || !isSupabaseUuid(userId)) {
    return { todos: localTodos, target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const teamsTodosTable = supabase.from("teams_todos") as unknown as SelectOwnOrganizationTable<TeamsTodoRow>;
  const { data, error } = await teamsTodosTable
    .select("*")
    .eq("target_organization", organization)
    .is("deleted_at", null)
    .order("due_date", { ascending: true });

  if (error) {
    console.warn("Supabase TeamToDo load failed. Keeping local records.", error);
    return { todos: localTodos, target: "localStorage" as SaveTarget };
  }

  return {
    todos: (data ?? []).map(rowToTeamsTodoEntry),
    target: "supabase" as SaveTarget,
  };
}

export async function createTeamsTodoRecord(todo: TeamsTodoEntry, userId?: string) {
  saveLocalTeamsTodo(todo);

  if (!canSaveToSupabase(userId)) {
    return { entry: todo, target: "localStorage" as SaveTarget };
  }

  const payload: TeamsTodoInsert = {
    title: todo.title,
    memo: todo.memo,
    due_date: todo.dueDate || null,
    priority: todo.priority,
    status: todo.status,
    target_organization: todo.targetOrganization,
    created_by: userId,
    created_by_name: todo.createdByName,
    completed_at: todo.completedAt ?? null,
  };
  if (todo.assigneeId) payload.assignee_id = todo.assigneeId;
  if (todo.assigneeName) payload.assignee_name = todo.assigneeName;
  if (todo.assignedMyTodoId) payload.assigned_my_todo_id = todo.assignedMyTodoId;
  if (todo.assignedAt) payload.assigned_at = toSupabaseTimestamp(todo.assignedAt);
  const supabase = createSupabaseBrowserClient();
  const teamsTodosTable = supabase.from("teams_todos") as unknown as InsertTable<TeamsTodoInsert>;
  const { data, error } = await teamsTodosTable.insert(payload).select("id").single();

  if (error) {
    console.warn("Supabase TeamToDo insert failed. Keeping local record.", error);
    return { entry: todo, target: "localStorage" as SaveTarget };
  }

  const savedTodo = { ...todo, supabaseId: data.id };
  saveLocalTeamsTodo(savedTodo);
  return { entry: savedTodo, target: "supabase" as SaveTarget };
}

export async function updateTeamsTodoRecord(todo: TeamsTodoEntry, userId?: string) {
  saveLocalTeamsTodo(todo);
  const todoId = todo.supabaseId ?? (isSupabaseUuid(todo.id) ? todo.id : undefined);
  if (!canSaveToSupabase(userId) || !todoId) {
    return { target: "localStorage" as SaveTarget };
  }

  const payload: TeamsTodoUpdate = {
    title: todo.title,
    memo: todo.memo,
    due_date: todo.dueDate || null,
    priority: todo.priority,
    status: todo.status,
    target_organization: todo.targetOrganization,
    completed_at: todo.completedAt ?? null,
    updated_at: new Date().toISOString(),
  };
  if (todo.assigneeId) payload.assignee_id = todo.assigneeId;
  if (todo.assigneeName) payload.assignee_name = todo.assigneeName;
  if (todo.assignedMyTodoId) payload.assigned_my_todo_id = todo.assignedMyTodoId;
  if (todo.assignedAt) payload.assigned_at = toSupabaseTimestamp(todo.assignedAt);
  const supabase = createSupabaseBrowserClient();
  const teamsTodosTable = supabase.from("teams_todos") as unknown as UpdateOwnOrganizationTable<TeamsTodoUpdate>;
  const { error } = await teamsTodosTable.update(payload).eq("id", todoId).eq("target_organization", todo.targetOrganization);

  if (error) {
    console.warn("Supabase TeamToDo update failed. Keeping local record.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function softDeleteTeamsTodoRecord(todo: TeamsTodoEntry, userId?: string) {
  const deletedTodo = { ...todo, deletedAt: formatMyTodoDateTime(new Date()) };
  saveLocalTeamsTodo(deletedTodo);
  const todoId = todo.supabaseId ?? (isSupabaseUuid(todo.id) ? todo.id : undefined);
  if (!canSaveToSupabase(userId) || !todoId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const teamsTodosTable = supabase.from("teams_todos") as unknown as UpdateOwnOrganizationTable<TeamsTodoUpdate>;
  const { error } = await teamsTodosTable
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", todoId)
    .eq("target_organization", todo.targetOrganization);

  if (error) {
    console.warn("Supabase TeamToDo delete failed. Keeping local record.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export function loadLocalTeamsTodos(organization: string, fallback: TeamsTodoEntry[] = []) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(getTeamsTodoStorageKey(organization));
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidTeamsTodoEntry) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocalTeamsTodo(todo: TeamsTodoEntry) {
  if (typeof window === "undefined") return;
  const currentTodos = loadLocalTeamsTodos(todo.targetOrganization, []);
  const nextTodos = [todo, ...currentTodos.filter((item) => item.id !== todo.id && item.supabaseId !== todo.supabaseId)];
  window.localStorage.setItem(getTeamsTodoStorageKey(todo.targetOrganization), JSON.stringify(nextTodos));
}

function getTeamsTodoStorageKey(organization: string) {
  return `tauros-teamos.teams-todos.v1.${normalizeOrganizationKey(organization)}`;
}

function normalizeOrganizationKey(organization: string) {
  return organization.trim().toLowerCase().replace(/\s+/g, "-") || "unknown";
}

function rowToTeamsTodoEntry(row: TeamsTodoRow): TeamsTodoEntry {
  return {
    id: row.id,
    supabaseId: row.id,
    title: row.title,
    memo: row.memo ?? "",
    dueDate: row.due_date ?? "",
    priority: row.priority,
    status: row.status,
    targetOrganization: row.target_organization,
    assigneeId: row.assignee_id ?? undefined,
    assigneeName: row.assignee_name ?? undefined,
    assignedMyTodoId: row.assigned_my_todo_id ?? undefined,
    assignedAt: row.assigned_at ? formatMyTodoDateTime(new Date(row.assigned_at)) : undefined,
    createdById: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? "ログインユーザー",
    createdAt: formatMyTodoDateTime(new Date(row.created_at)),
    updatedAt: formatMyTodoDateTime(new Date(row.updated_at)),
    completedAt: row.completed_at ? formatMyTodoDateTime(new Date(row.completed_at)) : undefined,
    deletedAt: row.deleted_at ? formatMyTodoDateTime(new Date(row.deleted_at)) : undefined,
  };
}

function canSaveToSupabase(userId?: string) {
  return Boolean(userId && isSupabaseUuid(userId) && canUseSupabaseBrowserClient());
}

function toSupabaseTimestamp(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isValidTeamsTodoEntry(value: unknown): value is TeamsTodoEntry {
  if (!value || typeof value !== "object") return false;
  const todo = value as Partial<TeamsTodoEntry>;
  return Boolean(todo.id && todo.title && todo.priority && todo.status && todo.targetOrganization);
}
