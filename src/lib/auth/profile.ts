import { AuthUser, demoUsers } from "@/lib/auth-demo-data";
import { mapDemoRoleToAppRole, normalizeAppRole } from "@/lib/domain/permissions";
import { AppRole, Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const roleLabels: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  executive: "Manager",
  department_manager: "Manager",
  team_manager: "Leader",
  leader: "Leader",
  member: "Member",
  viewer: "Member",
};

export function profileToAuthUser(profile: ProfileRow): AuthUser {
  const fallback = demoUsers.find((user) => user.email.toLowerCase() === profile.email?.toLowerCase());
  const displayName = profile.display_name || fallback?.name || "ログインユーザー";
  const appRole = normalizeAppRole(profile.role);

  return {
    id: profile.id,
    name: displayName,
    email: profile.email ?? fallback?.email ?? "",
    department: profile.organization ?? fallback?.department ?? "未設定",
    position: profile.position ?? fallback?.position ?? "未設定",
    role: roleLabels[appRole],
    appRole,
    initial: displayName.slice(0, 1),
    avatarUrl: profile.avatar_url ?? fallback?.avatarUrl,
    authSource: "supabase",
  };
}

export function makeDemoAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    appRole: user.appRole ?? mapDemoRoleToAppRole(user.role),
    authSource: "demo",
  };
}
