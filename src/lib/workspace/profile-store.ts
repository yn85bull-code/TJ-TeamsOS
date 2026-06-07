"use client";

import { demoUsers } from "@/lib/auth-demo-data";
import { normalizeAppRole } from "@/lib/domain/permissions";
import { canUseSupabaseBrowserClient, createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseUuid } from "@/lib/supabase/ids";
import { AppRole, Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type DepartmentRow = Database["public"]["Tables"]["departments"]["Row"];
type SelectTable<T> = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => Promise<{ data: T[] | null; error: Error | null }>;
  };
};

export type TeamProfileEntry = {
  id: string;
  displayName: string;
  email: string;
  departmentId?: string;
  departmentName: string;
  organization: string;
  position: string;
  role: AppRole;
  roleLabel: string;
  isActive: boolean;
  employmentStatus: string;
  joinedAt?: string;
  avatarUrl?: string;
  source: "demo" | "supabase";
};

export type TeamUserInvitePayload = {
  displayName: string;
  email: string;
  departmentName: string;
  position?: string;
  role: AppRole;
};

export type TeamProfileUpdatePayload = {
  profileId: string;
  role?: AppRole;
  departmentName?: string;
  position?: string;
  isActive?: boolean;
  employmentStatus?: string;
};

export type TeamUserAuthAction = "resend_invite" | "send_password_reset";

export const OPERATIONAL_ROLE_OPTIONS: Array<{ value: AppRole; label: string; description: string }> = [
  { value: "owner", label: "Owner", description: "全権限・最終承認" },
  { value: "admin", label: "Admin", description: "設定・ユーザー管理" },
  { value: "department_manager", label: "Manager", description: "部門/チーム管理" },
  { value: "leader", label: "Leader", description: "拠点・現場リード" },
  { value: "member", label: "Member", description: "作業担当" },
];

export function getRoleLabel(role: AppRole) {
  const normalizedRole = normalizeAppRole(role);
  return OPERATIONAL_ROLE_OPTIONS.find((option) => option.value === normalizedRole)?.label ?? "Member";
}

export function demoUsersToProfiles(): TeamProfileEntry[] {
  return demoUsers.map((user) => {
    const role = mapDisplayRoleToOperationalRole(user.role);
    return {
      id: user.id,
      displayName: user.name,
      email: user.email,
      departmentName: user.department,
      organization: user.department,
      position: user.position,
      role,
      roleLabel: getRoleLabel(role),
      isActive: true,
      employmentStatus: "在籍中",
      source: "demo",
    };
  });
}

export async function loadTeamProfilesFromSupabase() {
  if (!canUseSupabaseBrowserClient()) {
    return { source: "demo" as const, profiles: demoUsersToProfiles() };
  }

  const supabase = createSupabaseBrowserClient();
  const profilesTable = supabase.from("profiles") as unknown as SelectTable<ProfileRow>;
  const departmentsTable = supabase.from("departments") as unknown as SelectTable<DepartmentRow>;
  const [profileResult, departmentResult] = await Promise.all([
    profilesTable
      .select("*")
      .order("display_name", { ascending: true }),
    departmentsTable
      .select("*")
      .order("name", { ascending: true }),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (departmentResult.error) throw departmentResult.error;

  const departmentRows = (departmentResult.data ?? []) as DepartmentRow[];
  const profileRows = (profileResult.data ?? []) as ProfileRow[];
  const departmentsById = new Map(departmentRows.map((department) => [department.id, department]));
  const profiles = profileRows.map((profile) => profileRowToEntry(profile, departmentsById));
  return { source: "supabase" as const, profiles };
}

export async function updateProfileRoleInSupabase(profileId: string, role: AppRole) {
  return updateTeamProfileInSupabase({ profileId, role: normalizeAppRole(role) });
}

export async function updateProfileDepartmentAndPositionInSupabase(
  profileId: string,
  payload: Pick<TeamProfileUpdatePayload, "departmentName" | "position">,
) {
  return updateTeamProfileInSupabase({ profileId, ...payload });
}

export async function updateProfileEmploymentStatusInSupabase(
  profileId: string,
  payload: Pick<TeamProfileUpdatePayload, "isActive" | "employmentStatus">,
) {
  return updateTeamProfileInSupabase({ profileId, ...payload });
}

export async function uploadProfileAvatarFileInSupabase(profileId: string, file: File) {
  if (!canUseSupabaseBrowserClient() || !isSupabaseUuid(profileId)) {
    return { source: "demo" as const };
  }

  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("本ログイン後にプロフィール画像を登録してください。");
  }

  const formData = new FormData();
  formData.append("profileId", profileId);
  formData.append("avatar", file);

  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "プロフィール画像の登録に失敗しました。");
  }

  const uploadedProfile = result.profile as Partial<TeamProfileEntry> | undefined;
  if (!uploadedProfile?.id) {
    return { source: "supabase" as const, profile: undefined };
  }

  const role = normalizeAppRole((uploadedProfile.role ?? "member") as AppRole);
  return {
    source: "supabase" as const,
    profile: {
      id: uploadedProfile.id,
      displayName: uploadedProfile.displayName ?? "未設定ユーザー",
      email: uploadedProfile.email ?? "",
      departmentId: uploadedProfile.departmentId,
      departmentName: uploadedProfile.departmentName ?? "未設定",
      organization: uploadedProfile.organization ?? uploadedProfile.departmentName ?? "未設定",
      position: uploadedProfile.position ?? "未設定",
      role,
      roleLabel: getRoleLabel(role),
      isActive: uploadedProfile.isActive ?? true,
      employmentStatus: uploadedProfile.employmentStatus ?? "在籍中",
      joinedAt: uploadedProfile.joinedAt,
      avatarUrl: uploadedProfile.avatarUrl,
      source: "supabase" as const,
    } satisfies TeamProfileEntry,
  };
}

export async function updateTeamProfileInSupabase(payload: TeamProfileUpdatePayload) {
  if (!canUseSupabaseBrowserClient() || !isSupabaseUuid(payload.profileId)) {
    return { source: "demo" as const, positionSaved: true };
  }

  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("本ログイン後にユーザー情報を変更できます。");
  }

  const response = await fetch("/api/admin/update-user-profile", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "ユーザー情報の更新に失敗しました。");
  }

  const updatedProfile = result.profile as Partial<TeamProfileEntry> | undefined;
  const role = normalizeAppRole((updatedProfile?.role ?? payload.role ?? "member") as AppRole);
  return {
    source: "supabase" as const,
    positionSaved: result.positionSaved !== false,
    profile: updatedProfile?.id
      ? {
        id: updatedProfile.id,
        displayName: updatedProfile.displayName ?? "未設定ユーザー",
        email: updatedProfile.email ?? "",
        departmentId: updatedProfile.departmentId,
        departmentName: updatedProfile.departmentName ?? payload.departmentName ?? "未設定",
        organization: updatedProfile.organization ?? updatedProfile.departmentName ?? payload.departmentName ?? "未設定",
        position: updatedProfile.position ?? payload.position ?? "未設定",
        role,
        roleLabel: getRoleLabel(role),
        isActive: updatedProfile.isActive ?? true,
        employmentStatus: updatedProfile.employmentStatus ?? "在籍中",
        joinedAt: updatedProfile.joinedAt,
        avatarUrl: updatedProfile.avatarUrl,
        source: "supabase" as const,
      } satisfies TeamProfileEntry
      : undefined,
  };
}

export async function inviteTeamUser(payload: TeamUserInvitePayload) {
  if (!canUseSupabaseBrowserClient()) {
    throw new Error("Supabase接続情報が未設定です。");
  }

  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("本ログイン後に招待できます。");
  }

  const response = await fetch("/api/admin/invite-user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "招待に失敗しました。");
  }

  const invitedProfile = result.profile as Partial<TeamProfileEntry> | undefined;
  if (!invitedProfile?.id || !invitedProfile.displayName || !invitedProfile.email) {
    return undefined;
  }

  const role = normalizeAppRole((invitedProfile.role ?? payload.role) as AppRole);
  return {
    id: invitedProfile.id,
    displayName: invitedProfile.displayName,
    email: invitedProfile.email,
    departmentId: invitedProfile.departmentId,
    departmentName: invitedProfile.departmentName ?? payload.departmentName,
    organization: invitedProfile.organization ?? invitedProfile.departmentName ?? payload.departmentName,
    position: invitedProfile.position ?? payload.position ?? "未設定",
    role,
    roleLabel: getRoleLabel(role),
    isActive: invitedProfile.isActive ?? true,
    employmentStatus: invitedProfile.employmentStatus ?? "在籍中",
    joinedAt: invitedProfile.joinedAt,
    avatarUrl: invitedProfile.avatarUrl,
    source: "supabase" as const,
  } satisfies TeamProfileEntry;
}

export async function runTeamUserAuthActionInSupabase(profileId: string, action: TeamUserAuthAction) {
  if (!canUseSupabaseBrowserClient() || !isSupabaseUuid(profileId)) {
    return { source: "demo" as const, message: "デモ表示では認証メール操作は実行されません。" };
  }

  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("本ログイン後に認証メール操作を実行できます。");
  }

  const response = await fetch("/api/admin/user-auth-action", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId, action }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "認証メール操作に失敗しました。");
  }

  return {
    source: "supabase" as const,
    message: typeof result.message === "string" ? result.message : "認証メール操作を実行しました。",
  };
}

function profileRowToEntry(profile: ProfileRow, departmentsById: Map<string, DepartmentRow>): TeamProfileEntry {
  const fallback = demoUsers.find((user) => user.email.toLowerCase() === profile.email?.toLowerCase());
  const role = normalizeAppRole(profile.role);
  const department = profile.department_id ? departmentsById.get(profile.department_id) : undefined;
  const position = typeof profile.position === "string" && profile.position.trim()
    ? profile.position.trim()
    : undefined;

  return {
    id: profile.id,
    displayName: profile.display_name || fallback?.name || "未設定ユーザー",
    email: profile.email ?? fallback?.email ?? "",
    departmentId: profile.department_id ?? undefined,
    departmentName: department?.name ?? fallback?.department ?? "未設定",
    organization: profile.organization ?? department?.name ?? fallback?.department ?? "未設定",
    position: position ?? fallback?.position ?? "未設定",
    role,
    roleLabel: getRoleLabel(role),
    isActive: profile.is_active,
    employmentStatus: profile.employment_status ?? (profile.is_active ? "在籍中" : "停止中"),
    joinedAt: profile.joined_at ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    source: "supabase",
  };
}

function mapDisplayRoleToOperationalRole(role: string): AppRole {
  const normalizedRole = role.toLowerCase();
  if (normalizedRole === "owner") return "owner";
  if (normalizedRole === "admin") return "admin";
  if (normalizedRole === "manager" || normalizedRole === "approver") return "department_manager";
  if (normalizedRole === "leader") return "leader";
  return "member";
}
