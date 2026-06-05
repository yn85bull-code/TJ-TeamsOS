import { AuthUser, demoUsers } from "@/lib/auth-demo-data";
import { mapDemoRoleToAppRole } from "@/lib/domain/permissions";
import { AppRole, Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const roleLabels: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  executive: "Executive",
  department_manager: "Manager",
  team_manager: "Team Manager",
  member: "Editor",
  viewer: "Viewer",
};

export function profileToAuthUser(profile: ProfileRow): AuthUser {
  const fallback = demoUsers.find((user) => user.email.toLowerCase() === profile.email?.toLowerCase());
  const displayName = profile.display_name || fallback?.name || "ログインユーザー";

  return {
    id: profile.id,
    name: displayName,
    email: profile.email ?? fallback?.email ?? "",
    department: fallback?.department ?? "未設定",
    position: fallback?.position ?? "未設定",
    role: roleLabels[profile.role],
    appRole: profile.role,
    initial: displayName.slice(0, 1),
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
