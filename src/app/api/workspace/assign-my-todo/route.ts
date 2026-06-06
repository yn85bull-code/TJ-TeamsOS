import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { AppRole, Database, MyTodoPriority, MyTodoStatus } from "@/types/database";

export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type DepartmentRow = Database["public"]["Tables"]["departments"]["Row"];
type MyTodoInsert = Database["public"]["Tables"]["my_todos"]["Insert"];

type SelectByIdTable<T> = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      single: () => Promise<{ data: T | null; error: Error | null }>;
    };
  };
};

type MyTodoInsertTable = {
  insert: (payload: MyTodoInsert) => {
    select: (columns: string) => {
      single: () => Promise<{ data: { id: string }; error: Error | null }>;
    };
  };
};

const assignmentRoles: AppRole[] = ["owner", "admin", "department_manager", "team_manager", "leader"];
const allowedPriorities: MyTodoPriority[] = ["high", "medium", "low"];
const allowedStatuses: MyTodoStatus[] = ["not_started", "in_progress", "on_hold", "done"];

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const assigneeId = normalizeText(payload.assigneeId);
    const title = normalizeText(payload.title);
    const memo = normalizeText(payload.memo);
    const dueDate = normalizeText(payload.dueDate);
    const priority = normalizePriority(payload.priority);
    const status = normalizeStatus(payload.status);
    const sourceTeamsTodoId = normalizeText(payload.sourceTeamsTodoId);
    const assignedByName = normalizeText(payload.assignedByName);

    if (!assigneeId || !title || !priority || !status) {
      return NextResponse.json({ error: "指名先、タイトル、優先度、ステータスを確認してください。" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ error: "ログイン情報を確認できません。" }, { status: 401 });
    }

    const { url, publishableKey, serviceRoleKey } = getSupabaseServerEnv();
    const serviceClient = createClient<Database>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authClient = createClient<Database>(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: requesterData, error: requesterError } = await authClient.auth.getUser(accessToken);
    if (requesterError || !requesterData.user) {
      return NextResponse.json({ error: "ログインユーザーを確認できません。" }, { status: 401 });
    }

    const profilesTable = serviceClient.from("profiles") as unknown as SelectByIdTable<ProfileRow>;
    const departmentsTable = serviceClient.from("departments") as unknown as SelectByIdTable<DepartmentRow>;
    const [{ data: requesterProfile }, { data: assigneeProfile }] = await Promise.all([
      profilesTable.select("*").eq("id", requesterData.user.id).single(),
      profilesTable.select("*").eq("id", assigneeId).single(),
    ]);

    if (!requesterProfile || !requesterProfile.is_active || !assignmentRoles.includes(requesterProfile.role)) {
      return NextResponse.json({ error: "所属ToDoの指名はOwner/Admin/Manager/Leaderのみ実行できます。" }, { status: 403 });
    }
    if (!assigneeProfile || !assigneeProfile.is_active) {
      return NextResponse.json({ error: "指名先ユーザーが見つからない、または停止中です。" }, { status: 404 });
    }

    const [requesterDepartment, assigneeDepartment] = await Promise.all([
      loadDepartmentName(departmentsTable, requesterProfile.department_id),
      loadDepartmentName(departmentsTable, assigneeProfile.department_id),
    ]);
    const requesterOrganization = getProfileOrganization(requesterProfile, requesterDepartment);
    const assigneeOrganization = getProfileOrganization(assigneeProfile, assigneeDepartment);
    if (requesterOrganization !== assigneeOrganization) {
      return NextResponse.json({ error: "所属外ユーザーのMyToDoへは登録できません。" }, { status: 403 });
    }

    const myTodosTable = serviceClient.from("my_todos") as unknown as MyTodoInsertTable;
    const insertPayload: MyTodoInsert = {
      user_id: assigneeId,
      title,
      memo,
      due_date: dueDate || null,
      priority,
      status,
      source_type: "teams_todo",
      source_teams_todo_id: sourceTeamsTodoId || null,
      assigned_by: requesterData.user.id,
      assigned_by_name: assignedByName || requesterProfile.display_name,
      completed_at: status === "done" ? new Date().toISOString() : null,
    };
    const { data: todo, error } = await myTodosTable.insert(insertPayload).select("id").single();
    if (error || !todo) {
      return NextResponse.json({ error: error?.message ?? "指名先MyToDoの登録に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({ todo: { id: todo.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "所属ToDoの指名処理でエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: message.includes("service_role") ? 500 : 400 });
  }
}

async function loadDepartmentName(table: SelectByIdTable<DepartmentRow>, departmentId: string | null) {
  if (!departmentId) return "";
  const { data } = await table.select("id, name").eq("id", departmentId).single();
  return data?.name ?? "";
}

function getProfileOrganization(profile: ProfileRow, departmentName: string) {
  return profile.organization || profile.department || departmentName || "未設定";
}

function normalizePriority(value: unknown): MyTodoPriority | undefined {
  return typeof value === "string" && allowedPriorities.includes(value as MyTodoPriority)
    ? value as MyTodoPriority
    : undefined;
}

function normalizeStatus(value: unknown): MyTodoStatus | undefined {
  return typeof value === "string" && allowedStatuses.includes(value as MyTodoStatus)
    ? value as MyTodoStatus
    : undefined;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSupabaseServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error("Supabase service_role設定が未完了です。NEXT_PUBLIC_SUPABASE_URL、publishable key、SUPABASE_SERVICE_ROLE_KEYを確認してください。");
  }

  return { url, publishableKey, serviceRoleKey };
}
