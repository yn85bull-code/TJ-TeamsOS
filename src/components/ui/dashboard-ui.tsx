import { KpiColor, TaskPriority, TaskStatus } from "@/lib/dashboard-demo-data";

const priorityMap: Record<TaskPriority, { label: string; className: string }> = {
  must: { label: "Must", className: "bg-red-50 text-red-700 ring-red-200" },
  should: { label: "Should", className: "bg-orange-50 text-orange-700 ring-orange-200" },
  could: { label: "Could", className: "bg-slate-100 text-slate-700 ring-slate-200" },
};

const statusMap: Record<TaskStatus, { label: string; className: string }> = {
  not_started: { label: "未着手", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  in_progress: { label: "進行中", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  approval_pending: { label: "承認待ち", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  done: { label: "完了", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

export const colorMap: Record<KpiColor, { text: string; bg: string; bar: string; soft: string }> = {
  red: { text: "text-[#D6001C]", bg: "bg-[#D6001C]", bar: "bg-[#D6001C]", soft: "bg-red-50" },
  orange: { text: "text-orange-500", bg: "bg-orange-500", bar: "bg-orange-500", soft: "bg-orange-50" },
  purple: { text: "text-indigo-500", bg: "bg-indigo-500", bar: "bg-indigo-500", soft: "bg-indigo-50" },
  green: { text: "text-emerald-500", bg: "bg-emerald-500", bar: "bg-emerald-500", soft: "bg-emerald-50" },
  blue: { text: "text-blue-500", bg: "bg-blue-500", bar: "bg-blue-500", soft: "bg-blue-50" },
  gray: { text: "text-slate-500", bg: "bg-slate-500", bar: "bg-slate-500", soft: "bg-slate-100" },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = priorityMap[priority];
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${config.className}`}>{config.label}</span>;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config = statusMap[status];
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${config.className}`}>{config.label}</span>;
}

export function ProgressBar({ value, tone = "bg-[#D6001C]" }: { value: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function PanelCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 max-w-full rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}
