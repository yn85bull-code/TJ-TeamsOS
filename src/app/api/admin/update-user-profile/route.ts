import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { AppRole, Database } from "@/types/database";

export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
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
type ProfileUpdateTable = {
  update: (payload: ProfileUpdate) => {
    eq: (column: string, value: string) => {
      select: (columns: string) => {
        single: () => Promise<{ data: ProfileRow | null; error: Error | null }>;
      };
    };
  };
};

const allowedManagedRoles: AppRole[] = ["admin", "department_manager", "leader", "member"];

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const profileId = normalizeText(payload.profileId);
    const hasRole = hasOwn(payload, "role");
    const hasDepartmentName = hasOwn(payload, "departmentName");
    const hasPosition = hasOwn(payload, "position");
    const hasIsActive = hasOwn(payload, "isActive");
    const hasEmploymentStatus = hasOwn(payload, "employmentStatus");
    const role = hasRole ? normalizeManagedRole(payload.role) : undefined;
    const departmentName = hasDepartmentName ? normalizeText(payload.departmentName) : undefined;
    const position = hasPosition ? normalizeText(payload.position) || "未設定" : undefined;
    const isActive = hasIsActive ? Boolean(payload.isActive) : undefined;
    const employmentStatus = hasEmploymentStatus ? normalizeText(payload.employmentStatus) : undefined;

    if (!profileId) {
      return NextResponse.json({ error: "更新対象のユーザーを確認してください。" }, { status: 400 });
    }
    if (hasRole && !role) {
      return NextResponse.json({ error: "Owner以外へ変更できる権限はAdmin / Manager / Leader / Memberです。" }, { status: 400 });
    }
    if (hasDepartmentName && !departmentName) {
      return NextResponse.json({ error: "部門を選択してください。" }, { status: 400 });
    }
    if (hasEmploymentStatus && !employmentStatus) {
      return NextResponse.json({ error: "状態を選択してください。" }, { status: 400 });
    }
    if (!hasRole && !hasDepartmentName && !hasPosition && !hasIsActive && !hasEmploymentStatus) {
      return NextResponse.json({ error: "更新内容を指定してください。" }, { status: 400 });
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
    const { data: requesterProfile, error: requesterProfileError } = await profilesSelect
      .select("id, role")
      .eq("id", requesterData.user.id)
      .single();

    if (requesterProfileError || !["owner", "admin"].includes(requesterProfile?.role ?? "")) {
      return NextResponse.json({ error: "ユーザー情報の変更はOwner/Adminのみ実行できます。" }, { status: 403 });
    }

    const { data: targetProfile, error: targetProfileError } = await profilesSelect
      .select("*")
      .eq("id", profileId)
      .single();

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: "更新対象のユーザーが見つかりません。" }, { status: 404 });
    }

    const updatePayload: ProfileUpdate = {};
    let department: DepartmentRow | null = null;
    if (role) {
      if (targetProfile.role === "owner") {
        return NextResponse.json({ error: "Ownerの権限ランクは固定です。" }, { status: 400 });
      }
      updatePayload.role = role;
    }

    if (departmentName) {
      const departmentsTable = serviceClient.from("departments") as unknown as DepartmentUpsertTable;
      const departmentResult = await departmentsTable
        .upsert({ name: departmentName, description: `${departmentName} 部門` }, { onConflict: "name" })
        .select("*")
        .single();
      if (departmentResult.error || !departmentResult.data) {
        return NextResponse.json({ error: "部門情報の登録に失敗しました。" }, { status: 500 });
      }
      department = departmentResult.data;
      updatePayload.department_id = department.id;
      updatePayload.organization = departmentName;
      updatePayload.department = departmentName;
    }

    if (hasPosition) {
      updatePayload.position = position;
    }
    if (hasIsActive) {
      updatePayload.is_active = isActive;
    }
    if (hasEmploymentStatus) {
      updatePayload.employment_status = employmentStatus;
    }

    const profilesTable = serviceClient.from("profiles") as unknown as ProfileUpdateTable;
    let positionSaved = true;
    let { data: profile, error: updateError } = await profilesTable
      .update(updatePayload)
      .eq("id", profileId)
      .select("*")
      .single();

    if (updateError && hasPosition && isMissingPositionColumnError(updateError)) {
      const payloadWithoutPosition = { ...updatePayload };
      delete payloadWithoutPosition.position;
      if (Object.keys(payloadWithoutPosition).length === 0) {
        return NextResponse.json({
          error: "役職の保存にはSupabaseで add_profile_position_20260606.sql を実行してください。",
          positionSaved: false,
        }, { status: 400 });
      }

      const retryResult = await profilesTable
        .update(payloadWithoutPosition)
        .eq("id", profileId)
        .select("*")
        .single();
      profile = retryResult.data;
      updateError = retryResult.error;
      positionSaved = false;
    }

    if (updateError || !profile) {
      return NextResponse.json({ error: "ユーザー情報の更新に失敗しました。" }, { status: 500 });
    }

    let responseDepartmentName = department?.name ?? departmentName;
    if (!responseDepartmentName && profile.department_id) {
      const departmentsSelect = serviceClient.from("departments") as unknown as SelectByIdTable<DepartmentRow>;
      const departmentResult = await departmentsSelect
        .select("id, name")
        .eq("id", profile.department_id)
        .single();
      responseDepartmentName = departmentResult.data?.name;
    }

    return NextResponse.json({
      positionSaved,
      profile: {
        id: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        departmentId: profile.department_id,
        departmentName: responseDepartmentName,
        organization: profile.organization ?? responseDepartmentName,
        position: positionSaved ? profile.position : targetProfile.position,
        role: profile.role,
        isActive: profile.is_active,
        employmentStatus: profile.employment_status ?? (profile.is_active ? "在籍中" : "停止中"),
        joinedAt: profile.joined_at,
        avatarUrl: profile.avatar_url,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ユーザー情報更新でエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: message.includes("service_role") ? 500 : 400 });
  }
}

function hasOwn(payload: unknown, key: string) {
  return typeof payload === "object" && payload !== null && Object.prototype.hasOwnProperty.call(payload, key);
}

function isMissingPositionColumnError(error: Error) {
  return error.message.includes("position") && error.message.includes("profiles");
}

function normalizeManagedRole(role: unknown): AppRole | undefined {
  if (typeof role !== "string") return undefined;
  return allowedManagedRoles.includes(role as AppRole) ? role as AppRole : undefined;
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
