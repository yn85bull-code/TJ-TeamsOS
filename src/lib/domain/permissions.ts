import { AppRole } from "@/types/database";

export type PermissionAction = "create" | "read" | "update" | "delete" | "approve" | "manage";
export type PermissionResource = "issues" | "tasks" | "my_todo" | "teams_todo" | "approvals" | "teams" | "settings" | "ai_suggestions" | "tauros_ai" | "knowledge" | "reports" | "logs";

const roleRank: Record<AppRole, number> = {
  owner: 100,
  admin: 90,
  executive: 80,
  department_manager: 70,
  team_manager: 60,
  leader: 60,
  member: 40,
  viewer: 10,
};

const approvalRoles: AppRole[] = ["owner", "admin"];
const managementRoles: AppRole[] = ["owner", "admin"];
const deleteRoles: AppRole[] = ["owner"];
const taurosAiManagementRoles: AppRole[] = ["owner", "admin"];
const teamsTodoCreatorRoles: AppRole[] = ["owner", "admin", "department_manager", "leader"];

export function normalizeAppRole(role: AppRole): AppRole {
  if (role === "executive") return "admin";
  if (role === "team_manager") return "leader";
  if (role === "viewer") return "member";
  return role;
}

export function can(role: AppRole, resource: PermissionResource, action: PermissionAction) {
  const normalizedRole = normalizeAppRole(role);

  if (resource === "tauros_ai" && action === "read") return true;
  if (resource === "my_todo") return roleRank[normalizedRole] >= roleRank.member;
  if (resource === "teams_todo") {
    if (action === "read") return roleRank[normalizedRole] >= roleRank.member;
    if (action === "create") return teamsTodoCreatorRoles.includes(normalizedRole);
    if (action === "update" || action === "delete") return teamsTodoCreatorRoles.includes(normalizedRole);
  }
  if (resource === "knowledge") {
    if (action === "read") return roleRank[normalizedRole] >= roleRank.member;
    if (action === "create" || action === "update" || action === "manage") return taurosAiManagementRoles.includes(normalizedRole);
    if (action === "delete") return normalizedRole === "owner";
  }
  if (action === "read") return roleRank[normalizedRole] >= roleRank.member;
  if (action === "approve") return resource === "approvals" && approvalRoles.includes(normalizedRole);
  if (action === "manage") return managementRoles.includes(normalizedRole);
  if (action === "delete") return deleteRoles.includes(normalizedRole);
  if (resource === "settings" || resource === "teams") return managementRoles.includes(normalizedRole);
  return roleRank[normalizedRole] >= roleRank.member;
}

export function canAccessNavItem(role: AppRole, key: string) {
  const normalizedRole = normalizeAppRole(role);

  if (key === "tauros_ai" || key === "my_todo") return true;

  if (normalizedRole === "owner" || normalizedRole === "admin") return true;

  if (normalizedRole === "department_manager" || normalizedRole === "leader") {
    return ["dashboard", "issues", "tasks", "my_todo", "approvals", "teams", "ai", "tauros_ai"].includes(key);
  }

  return ["dashboard", "issues", "tasks", "my_todo", "ai", "tauros_ai"].includes(key);
}

export function getTaurosAiPermissionFlags(role: AppRole) {
  const normalizedRole = normalizeAppRole(role);
  const canManageKnowledge = taurosAiManagementRoles.includes(normalizedRole);

  return {
    can_access_tauros_ai: true,
    can_manage_tauros_ai_knowledge: canManageKnowledge,
    can_view_knowledge: true,
    can_create_knowledge: canManageKnowledge,
    can_edit_knowledge: canManageKnowledge,
    can_delete_knowledge: normalizedRole === "owner",
    can_view_knowledge_chat_logs: canManageKnowledge,
    can_manage_knowledge_visibility: canManageKnowledge,
  };
}

export function mapDemoRoleToAppRole(role: string): AppRole {
  const normalized = role.toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin") return "admin";
  if (normalized === "manager") return "department_manager";
  if (normalized === "leader") return "leader";
  if (normalized === "member") return "member";
  if (normalized === "approver") return "department_manager";
  if (normalized === "editor") return "member";
  if (normalized === "viewer") return "member";
  return "member";
}
