"use client";

import type { Database } from "@/types/database";
import { canUseSupabaseBrowserClient, createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseUuid } from "@/lib/supabase/ids";

export type MyTodoPriority = "high" | "medium" | "low";
export type MyTodoStatus = "not_started" | "in_progress" | "on_hold" | "done";

export type MyTodoEntry = {
  id: string;
  userId: string;
  title: string;
  memo: string;
  dueDate: string;
  priority: MyTodoPriority;
  status: MyTodoStatus;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  deletedAt?: string;
  supabaseId?: string;
};

type SaveTarget = "localStorage" | "supabase";
type MyTodoRow = Database["public"]["Tables"]["my_todos"]["Row"];
type MyTodoInsert = Database["public"]["Tables"]["my_todos"]["Insert"];
type MyTodoUpdate = Database["public"]["Tables"]["my_todos"]["Update"];

type InsertTable<T> = {
  insert: (payload: T) => {
    select: (columns: string) => {
      single: () => Promise<{ data: { id: string }; error: Error | null }>;
    };
  };
};

type SelectOwnTable<T> = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      is: (column: string, value: null) => {
        order: (column: string, options: { ascending: boolean }) => Promise<{ data: T[] | null; error: Error | null }>;
      };
    };
  };
};

type UpdateOwnTable<T> = {
  update: (payload: T) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>;
    };
  };
};

export function getDefaultMyTodos(userId: string, userName: string): MyTodoEntry[] {
  const now = formatMyTodoDateTime(new Date());
  return [
    {
      id: `local-${userId}-todo-1`,
      userId,
      title: "今日中に確認するメモを整理",
      memo: "細かい確認事項をMyToDoで管理します。承認フローには流しません。",
      dueDate: "2026-06-06",
      priority: "high",
      status: "not_started",
      createdByName: userName,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `local-${userId}-todo-2`,
      userId,
      title: "次回MTGで聞くことをメモ",
      memo: "課題化する前の個人メモ。",
      dueDate: "2026-06-09",
      priority: "medium",
      status: "in_progress",
      createdByName: userName,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export async function loadMyTodos(userId?: string, userName = "ログインユーザー") {
  if (!userId) return { todos: [], target: "localStorage" as SaveTarget };
  const localTodos = loadLocalMyTodos(userId, getDefaultMyTodos(userId, userName));

  if (!canUseSupabaseBrowserClient() || !isSupabaseUuid(userId)) {
    return { todos: localTodos, target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const myTodosTable = supabase.from("my_todos") as unknown as SelectOwnTable<MyTodoRow>;
  const { data, error } = await myTodosTable
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true });

  if (error) {
    console.warn("Supabase MyToDo load failed. Keeping local records.", error);
    return { todos: localTodos, target: "localStorage" as SaveTarget };
  }

  return {
    todos: (data ?? []).map(rowToMyTodoEntry),
    target: "supabase" as SaveTarget,
  };
}

export async function createMyTodoRecord(todo: MyTodoEntry, userId?: string) {
  const scopedUserId = userId ?? todo.userId;
  const scopedTodo = { ...todo, userId: scopedUserId };
  saveLocalMyTodo(scopedTodo);

  if (!canSaveToSupabase(scopedUserId)) {
    return { entry: scopedTodo, target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: MyTodoInsert = {
    user_id: scopedUserId,
    title: scopedTodo.title,
    memo: scopedTodo.memo,
    due_date: scopedTodo.dueDate || null,
    priority: scopedTodo.priority,
    status: scopedTodo.status,
    completed_at: scopedTodo.completedAt ?? null,
  };
  const myTodosTable = supabase.from("my_todos") as unknown as InsertTable<MyTodoInsert>;
  const { data, error } = await myTodosTable.insert(payload).select("id").single();

  if (error) {
    console.warn("Supabase MyToDo insert failed. Keeping local record.", error);
    return { entry: scopedTodo, target: "localStorage" as SaveTarget };
  }

  const savedTodo = { ...scopedTodo, supabaseId: data.id };
  saveLocalMyTodo(savedTodo);
  return { entry: savedTodo, target: "supabase" as SaveTarget };
}

export async function updateMyTodoRecord(todo: MyTodoEntry, userId?: string) {
  saveLocalMyTodo(todo);
  const scopedUserId = userId ?? todo.userId;
  const todoId = todo.supabaseId ?? (isSupabaseUuid(todo.id) ? todo.id : undefined);
  if (!canSaveToSupabase(scopedUserId) || !todoId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const payload: MyTodoUpdate = {
    title: todo.title,
    memo: todo.memo,
    due_date: todo.dueDate || null,
    priority: todo.priority,
    status: todo.status,
    completed_at: todo.completedAt ?? null,
    updated_at: new Date().toISOString(),
  };
  const myTodosTable = supabase.from("my_todos") as unknown as UpdateOwnTable<MyTodoUpdate>;
  const { error } = await myTodosTable.update(payload).eq("id", todoId).eq("user_id", scopedUserId);

  if (error) {
    console.warn("Supabase MyToDo update failed. Keeping local record.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export async function softDeleteMyTodoRecord(todo: MyTodoEntry, userId?: string) {
  const deletedTodo = { ...todo, deletedAt: formatMyTodoDateTime(new Date()) };
  saveLocalMyTodo(deletedTodo);
  const scopedUserId = userId ?? todo.userId;
  const todoId = todo.supabaseId ?? (isSupabaseUuid(todo.id) ? todo.id : undefined);
  if (!canSaveToSupabase(scopedUserId) || !todoId) {
    return { target: "localStorage" as SaveTarget };
  }

  const supabase = createSupabaseBrowserClient();
  const myTodosTable = supabase.from("my_todos") as unknown as UpdateOwnTable<MyTodoUpdate>;
  const { error } = await myTodosTable
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", todoId)
    .eq("user_id", scopedUserId);

  if (error) {
    console.warn("Supabase MyToDo delete failed. Keeping local record.", error);
    return { target: "localStorage" as SaveTarget };
  }

  return { target: "supabase" as SaveTarget };
}

export function loadLocalMyTodos(userId: string, fallback: MyTodoEntry[] = []) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(getMyTodoStorageKey(userId));
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidMyTodoEntry) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocalMyTodo(todo: MyTodoEntry) {
  if (typeof window === "undefined") return;
  const currentTodos = loadLocalMyTodos(todo.userId, []);
  const nextTodos = [todo, ...currentTodos.filter((item) => item.id !== todo.id && item.supabaseId !== todo.supabaseId)];
  window.localStorage.setItem(getMyTodoStorageKey(todo.userId), JSON.stringify(nextTodos));
}

function getMyTodoStorageKey(userId: string) {
  return `tauros-teamos.my-todos.v1.${userId}`;
}

function rowToMyTodoEntry(row: MyTodoRow): MyTodoEntry {
  return {
    id: row.id,
    supabaseId: row.id,
    userId: row.user_id,
    title: row.title,
    memo: row.memo ?? "",
    dueDate: row.due_date ?? "",
    priority: row.priority,
    status: row.status,
    createdByName: "ログインユーザー",
    createdAt: formatMyTodoDateTime(new Date(row.created_at)),
    updatedAt: formatMyTodoDateTime(new Date(row.updated_at)),
    completedAt: row.completed_at ? formatMyTodoDateTime(new Date(row.completed_at)) : undefined,
    deletedAt: row.deleted_at ? formatMyTodoDateTime(new Date(row.deleted_at)) : undefined,
  };
}

function canSaveToSupabase(userId?: string) {
  return Boolean(userId && isSupabaseUuid(userId) && canUseSupabaseBrowserClient());
}

function isValidMyTodoEntry(value: unknown): value is MyTodoEntry {
  if (!value || typeof value !== "object") return false;
  const todo = value as Partial<MyTodoEntry>;
  return Boolean(todo.id && todo.userId && todo.title && todo.priority && todo.status);
}

export function formatMyTodoDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}
