export const DEPARTMENTS_STORAGE_KEY = "tauros-teamos.departments.v1";

export const DEFAULT_DEPARTMENTS = ["営業部", "買取部", "販売部", "総務部", "システム部"];

export function normalizeDepartmentList(departments: string[]) {
  const cleaned = departments
    .map((department) => department.trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}
