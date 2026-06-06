import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { AppRole, Database } from "@/types/database";

export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type DepartmentRow = Database["public"]["Tables"]["departments"]["Row"];
type DepartmentInsert = Database["public"]["Tables"]["departments"]["Insert"];
type SelectByIdTable<T> = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      single: () => Promise<{ data: T | null; error: Error | null }>;
    };
  };
};
type DepartmentUpsertTable = {
  upsert: (payload: DepartmentInsert, options: { onConflict: string }) => {
    select: (columns: string) => {
      single: () => Promise<{ data: DepartmentRow | null; error: Error | null }>;
    };
  };
};
type ProfileUpsertTable = {
  upsert: (payload: ProfileInsert, options: { onConflict: string }) => {
    select: (columns: string) => {
      single: () => Promise<{ data: ProfileRow | null; error: Error | null }>;
    };
  };
};

const allowedInviteRoles: AppRole[] = ["admin", "department_manager", "member"];

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const displayName = normalizeText(payload.displayName);
    const email = normalizeEmail(payload.email);
    const departmentName = normalizeText(payload.departmentName);
    const position = normalizeText(payload.position) || "未設定";
    const role = normalizeInviteRole(payload.role);

    if (!displayName || !email || !departmentName || !role) {
      return NextResponse.json({ error: "名前、メール、部門、権限を確認してください。" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ error: "ログイン情報を確認できません。本ログイン後に実行してください。" }, { status: 401 });
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

    const profilesSelect = serviceClient.from("profiles") as unknown as SelectByIdTable<ProfileRow>;
    const { data: requesterProfile, error: profileError } = await profilesSelect
      .select("id, role")
      .eq("id", requesterData.user.id)
      .single();

    if (profileError || requesterProfile?.role !== "owner") {
      return NextResponse.json({ error: "ユーザー招待はOwnerのみ実行できます。" }, { status: 403 });
    }

    const invited = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: {
        display_name: displayName,
        department_name: departmentName,
        position,
        role,
      },
      redirectTo: getInviteRedirectUrl(),
    });

    if (invited.error || !invited.data.user) {
      return NextResponse.json({ error: invited.error?.message ?? "招待メールの送信に失敗しました。" }, { status: 400 });
    }

    const departmentsTable = serviceClient.from("departments") as unknown as DepartmentUpsertTable;
    const { data: department, error: departmentError } = await departmentsTable
      .upsert({ name: departmentName, description: `${departmentName} 部門` }, { onConflict: "name" })
      .select("*")
      .single();

    if (departmentError || !department) {
      return NextResponse.json({ error: "部門情報の登録に失敗しました。" }, { status: 500 });
    }

    const profilesTable = serviceClient.from("profiles") as unknown as ProfileUpsertTable;
    const { data: profile, error: upsertError } = await profilesTable
      .upsert({
        id: invited.data.user.id,
        display_name: displayName,
        email,
        role,
        department_id: department.id,
        is_active: true,
      }, { onConflict: "id" })
      .select("*")
      .single();

    if (upsertError || !profile) {
      return NextResponse.json({ error: "プロフィール登録に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        departmentId: profile.department_id,
        departmentName: department.name,
        position,
        role: profile.role,
        isActive: profile.is_active,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "招待処理でエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: message.includes("service_role") ? 500 : 400 });
  }
}

function normalizeInviteRole(role: unknown): AppRole | undefined {
  if (typeof role !== "string") return undefined;
  return allowedInviteRoles.includes(role as AppRole) ? role as AppRole : undefined;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
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

function getInviteRedirectUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return undefined;

  const url = new URL(appUrl);
  url.searchParams.set("auth", "invite");
  return url.toString();
}
