"use client";

import { demoUsers } from "@/lib/auth-demo-data";
import { normalizeAppRole } from "@/lib/domain/permissions";
import { canUseSupabaseBrowserClient, createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseUuid } from "@/lib/supabase/ids";
import { AppRole, Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type DepartmentRow = Database["public"]["Tables"]["departments"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type SelectTable<T> = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => Promise<{ data: T[] | null; error: Error | null }>;
  };
};
type UpdateTable<T> = {
  update: (payload: T) => {
    eq: (column: string, value: string) => Promise<{ error: Error | null }>;
  };
};

export type TeamProfileEntry = {
  id: string;
  displayName: string;
  email: string;
  departmentId?: string;
  departmentName: string;
  position: string;
  role: AppRole;
  roleLabel: string;
  isActive: boolean;
  source: "demo" | "supabase";
};

export type TeamUserInvitePayload = {
  displayName: string;
  email: string;
  departmentName: string;
  position?: string;
  role: AppRole;
};

export const OPERATIONAL_ROLE_OPTIONS: Array<{ value: AppRole; label: string; description: string }> = [
  { value: "owner", label: "Owner", description: "全権限・最終承認" },
  { value: "admin", label: "Admin", description: "設定・ユーザー管理" },
  { value: "department_manager", label: "Manager", description: "部門/チーム管理" },
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
      position: user.position,
      role,
      roleLabel: getRoleLabel(role),
      isActive: true,
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
  if (!canUseSupabaseBrowserClient() || !isSupabaseUuid(profileId)) {
    return { source: "demo" as const };
  }

  const supabase = createSupabaseBrowserClient();
  const profilesTable = supabase.from("profiles") as unknown as UpdateTable<ProfileUpdate>;
  const { error } = await profilesTable
    .update({ role: normalizeAppRole(role) })
    .eq("id", profileId);

  if (error) throw error;
  return { source: "supabase" as const };
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
    position: invitedProfile.position ?? payload.position ?? "未設定",
    role,
    roleLabel: getRoleLabel(role),
    isActive: invitedProfile.isActive ?? true,
    source: "supabase" as const,
  } satisfies TeamProfileEntry;
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
    position: position ?? fallback?.position ?? "未設定",
    role,
    roleLabel: getRoleLabel(role),
    isActive: profile.is_active,
    source: "supabase",
  };
}

function mapDisplayRoleToOperationalRole(role: string): AppRole {
  const normalizedRole = role.toLowerCase();
  if (normalizedRole === "owner") return "owner";
  if (normalizedRole === "admin") return "admin";
  if (normalizedRole === "manager" || normalizedRole === "approver") return "department_manager";
  return "member";
}
