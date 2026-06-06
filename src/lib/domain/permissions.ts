import { AppRole } from "@/types/database";

export type PermissionAction = "create" | "read" | "update" | "delete" | "approve" | "manage";
export type PermissionResource = "issues" | "tasks" | "approvals" | "teams" | "settings" | "ai_suggestions" | "reports" | "logs";

const roleRank: Record<AppRole, number> = {
  owner: 100,
  admin: 90,
  executive: 80,
  department_manager: 70,
  team_manager: 60,
  member: 40,
  viewer: 10,
};

const approvalRoles: AppRole[] = ["owner"];
const managementRoles: AppRole[] = ["owner", "admin"];

export function normalizeAppRole(role: AppRole): AppRole {
  if (role === "executive" || role === "team_manager") return "department_manager";
  if (role === "viewer") return "member";
  return role;
}

export function can(role: AppRole, resource: PermissionResource, action: PermissionAction) {
  const normalizedRole = normalizeAppRole(role);

  if (action === "read") return roleRank[normalizedRole] >= roleRank.member;
  if (action === "approve") return resource === "approvals" && approvalRoles.includes(normalizedRole);
  if (action === "manage") return managementRoles.includes(normalizedRole);
  if (action === "delete") return managementRoles.includes(normalizedRole);
  if (resource === "settings" || resource === "teams") return managementRoles.includes(normalizedRole);
  return roleRank[normalizedRole] >= roleRank.member;
}

export function mapDemoRoleToAppRole(role: string): AppRole {
  const normalized = role.toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin") return "admin";
  if (normalized === "manager") return "department_manager";
  if (normalized === "member") return "member";
  if (normalized === "approver") return "department_manager";
  if (normalized === "editor") return "member";
  if (normalized === "viewer") return "member";
  return "member";
}
