import { TaskPriority } from "@/lib/dashboard-demo-data";

export const priorityOrder: Record<TaskPriority, number> = {
  must: 0,
  should: 1,
  could: 2,
};

export function normalizePriority(priority: string): TaskPriority {
  const normalized = priority.trim().toLowerCase();
  if (normalized === "must") return "must";
  if (normalized === "could") return "could";
  return "should";
}

export function sortByPriorityAndDueDate<T extends { priority: TaskPriority; dueDate: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.dueDate.localeCompare(b.dueDate);
  });
}
