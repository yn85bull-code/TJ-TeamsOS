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

export function can(role: AppRole, resource: PermissionResource, action: PermissionAction) {
  if (action === "read") return roleRank[role] >= roleRank.viewer;
  if (action === "approve") return resource === "approvals" && approvalRoles.includes(role);
  if (action === "manage") return managementRoles.includes(role);
  if (action === "delete") return managementRoles.includes(role);
  if (resource === "settings" || resource === "teams") return managementRoles.includes(role);
  if (role === "viewer") return false;
  return roleRank[role] >= roleRank.member;
}

export function mapDemoRoleToAppRole(role: string): AppRole {
  const normalized = role.toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin") return "admin";
  if (normalized === "approver") return "department_manager";
  if (normalized === "editor") return "member";
  return "viewer";
}
