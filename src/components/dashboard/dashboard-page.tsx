"use client";

import { PanelCard, PriorityBadge, ProgressBar, StatusBadge, colorMap } from "@/components/ui/dashboard-ui";
import {
  DashboardKpi,
  NotificationSummary,
  TaskStatus,
  TaskSummary,
  aiRoadmap,
  designMode,
  dueDateChartData,
  kanbanColumns,
  myTasks,
  notifications,
  pageDemo,
  recentActivities,
} from "@/lib/dashboard-demo-data";
import { DEFAULT_DEPARTMENTS, normalizeDepartmentList } from "@/lib/workspace/department-store";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Circle,
  CircleAlert,
  CircleDot,
  Filter,
  Flag,
  Mail,
  ShieldCheck,
  Smartphone,
  TabletSmartphone,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type DashboardPageProps = {
  onNavigate: (key: string) => void;
  createdTasks?: TaskSummary[];
  createdIssues?: Array<{ owner: string }>;
  departmentOptions?: string[];
};

export function DashboardPage({ onNavigate, createdTasks = [], createdIssues = [], departmentOptions = DEFAULT_DEPARTMENTS }: DashboardPageProps) {
  const todayLabel = useMemo(() => formatTodayLabel(), []);

  return (
    <div className="grid gap-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-bold text-slate-500">今日の日付</p>
          <p className="mt-1 text-lg font-black text-slate-950">{todayLabel}</p>
        </div>
        <span className="rounded-md bg-red-50 px-3 py-1 text-xs font-bold text-[#D6001C]">HOME</span>
      </section>

      <KpiSummaryGrid onNavigate={onNavigate} createdTasks={createdTasks} createdIssues={createdIssues} />

      <section className="grid gap-5 xl:grid-cols-[1.05fr_1.35fr_0.75fr]">
        <MyTasksPanel onNavigate={onNavigate} />
        <TeamKanban onNavigate={onNavigate} />
        <ImportantNotificationsPanel onNavigate={onNavigate} />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <DueDateDonutCard />
        <DepartmentProgressCard onNavigate={onNavigate} createdTasks={createdTasks} departmentOptions={departmentOptions} />
        <RecentActivityCard onNavigate={onNavigate} />
      </section>

      <AiRoadmapCard />
      {designMode ? <DesignSpecPanel /> : null}
    </div>
  );
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

export function KpiSummaryGrid({ onNavigate, createdTasks = [], createdIssues = [] }: DashboardPageProps) {
  const dashboardKpis = useMemo(() => buildDashboardKpis(createdTasks ?? [], createdIssues ?? []), [createdTasks, createdIssues]);
  const kpiTargets: Record<string, string> = {
    今日締切: "tasks",
    期限超過: "tasks",
    承認待ち: "approvals",
    高優先度: "tasks",
    未担当課題: "issues",
    AI提案候補: "ai",
  };

  return (
    <section>
      <p className="mb-2 text-xs font-bold text-slate-500">KPIはタスク・承認・通知のデモデータから自動集計</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {dashboardKpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} onClick={() => onNavigate(kpiTargets[kpi.label] ?? "dashboard")} />
        ))}
      </div>
    </section>
  );
}

function buildDashboardKpis(createdTasks: TaskSummary[] = [], createdIssues: Array<{ owner: string }> = []): DashboardKpi[] {
  const openCreatedTasks = createdTasks.filter((task) => task.status !== "done" && task.progress < 100);
  const shownTasks = [...myTasks, ...openCreatedTasks, ...kanbanColumns.flatMap((column) => column.tasks)];
  const hiddenKanbanTaskCount = kanbanColumns.reduce((sum, column) => sum + column.more, 0);
  const totalKanbanTaskCount = kanbanColumns.reduce((sum, column) => sum + column.count, 0);
  const todayDue = (dueDateChartData[0]?.value ?? 0) + openCreatedTasks.filter((task) => task.dueDate === "05/31").length;
  const overdue = shownTasks.filter((task) => task.status !== "done" && task.dueDate <= "05/31").length;
  const approvalWaiting = kanbanColumns.find((column) => column.id === "approval_pending")?.count ?? 0;
  const mustPriority = shownTasks.filter((task) => task.priority === "must").length + Math.round(hiddenKanbanTaskCount / 7);
  const unassignedIssues = pageDemo.issues.filter((issue, index) => index === 0 || issue.owner.includes("未")).length + createdIssues.filter((issue) => issue.owner.includes("未")).length;
  const aiCandidates = notifications.filter((item) => item.type === "ai").length + pageDemo.inbox.length + 1;

  return [
    { label: "今日締切", value: todayDue, suffix: "件", diffLabel: "締切データから集計", color: "red", icon: CalendarDays, progress: Math.min(todayDue * 8, 100) },
    { label: "期限超過", value: overdue, suffix: "件", diffLabel: "未完了タスクから集計", color: "red", icon: CircleAlert, progress: Math.min(overdue * 12, 100) },
    { label: "承認待ち", value: approvalWaiting, suffix: "件", diffLabel: "承認フローから集計", color: "purple", icon: ShieldCheck, progress: Math.min(approvalWaiting * 8, 100) },
    { label: "高優先度", value: mustPriority, suffix: "件", diffLabel: "Mustタスクから集計", color: "orange", icon: Flag, progress: Math.min(mustPriority * 10, 100) },
    { label: "未担当課題", value: unassignedIssues, suffix: "件", diffLabel: "担当未設定の課題", color: "green", icon: Users, progress: Math.min(unassignedIssues * 18, 100) },
    { label: "AI提案候補", value: aiCandidates, suffix: "件", diffLabel: "受信・通知から集計", color: "blue", icon: Bot, progress: Math.min((aiCandidates / Math.max(totalKanbanTaskCount, 1)) * 100, 100) },
  ];
}

export function KpiCard({ kpi, onClick }: { kpi: DashboardKpi; onClick: () => void }) {
  const Icon = kpi.icon;
  const colors = colorMap[kpi.color];
  return (
    <button className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#D6001C] hover:shadow-md" type="button" onClick={onClick}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-bold text-slate-900">{kpi.label}</p>
        <div className={`grid size-8 place-items-center rounded-full ${colors.soft} ${colors.text}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="mt-5 flex items-end gap-1">
        <strong className={`text-4xl font-black leading-none ${colors.text}`}>{kpi.value}</strong>
        <span className="pb-1 text-sm font-semibold text-slate-600">{kpi.suffix}</span>
      </div>
      <p className="mt-4 text-xs text-slate-500">{kpi.diffLabel}</p>
      <div className="mt-3">
        <ProgressBar value={kpi.progress} tone={colors.bar} />
      </div>
    </button>
  );
}

export function MyTasksPanel({ onNavigate }: DashboardPageProps) {
  const [activeFilter, setActiveFilter] = useState<"today" | "week" | "overdue">("today");
  const taskFilters: Array<{ key: "today" | "week" | "overdue"; label: string; tasks: TaskSummary[] }> = [
    { key: "today", label: "今日", tasks: myTasks.filter((task) => task.dueDate === "05/31") },
    { key: "week", label: "今週", tasks: myTasks },
    { key: "overdue", label: "期限超過", tasks: myTasks.filter((task) => task.status !== "done" && task.dueDate <= "05/31") },
  ];
  const activeTasks = taskFilters.find((filter) => filter.key === activeFilter)?.tasks ?? myTasks;

  return (
    <PanelCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">自分のタスク</h3>
      </div>
      <div className="mt-4 flex gap-5 border-b border-slate-100 text-sm font-semibold">
        {taskFilters.map((tab) => (
          <button
            key={tab.key}
            className={`pb-3 ${activeFilter === tab.key ? "border-b-2 border-[#D6001C] text-[#D6001C]" : "text-slate-500 hover:text-slate-800"}`}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
          >
            {tab.label}
            <span className="ml-1 text-[11px]">({tab.tasks.length})</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {activeTasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
        {activeTasks.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">該当するタスクはありません。</p> : null}
      </div>
      <button className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-800" type="button" onClick={() => onNavigate("tasks")}>
        すべてのタスクを見る
        <ArrowRight size={15} />
      </button>
    </PanelCard>
  );
}

export function TaskRow({ task }: { task: TaskSummary }) {
  return (
    <article className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-3 rounded-lg py-1">
      <Circle className={task.progress > 50 ? "text-[#D6001C]" : "text-slate-300"} size={16} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{task.projectName}</p>
          </div>
          <span className="shrink-0 text-right text-xs font-bold text-slate-700">{task.progress}%</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-[#D6001C]">{task.dueDate}</span>
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="mt-2">
          <ProgressBar value={task.progress} />
        </div>
      </div>
    </article>
  );
}

export function TeamKanban({ onNavigate }: DashboardPageProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const statusFilters: Array<{ key: "all" | TaskStatus; label: string }> = [
    { key: "all", label: "すべて" },
    { key: "not_started", label: "未着手" },
    { key: "in_progress", label: "進行中" },
    { key: "approval_pending", label: "承認待ち" },
    { key: "done", label: "完了" },
  ];
  const visibleColumns = statusFilter === "all" ? kanbanColumns : kanbanColumns.filter((column) => column.id === statusFilter);

  return (
    <PanelCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">チーム進捗（カンバン）</h3>
        <button className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600" type="button" onClick={() => setFilterOpen((open) => !open)}>
          <Filter size={14} />
          フィルター
        </button>
      </div>
      {filterOpen ? (
        <div className="mt-4 flex flex-wrap gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
          {statusFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${statusFilter === filter.key ? "bg-[#D6001C] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
              onClick={() => setStatusFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2 min-[1900px]:grid-cols-4">
        {visibleColumns.map((column) => (
          <div key={column.id} className={`min-w-0 rounded-xl p-3 ${column.tone}`}>
            <div className="mb-3 flex items-center justify-between text-sm font-bold">
              <span>{column.title}</span>
              <span>{column.count}</span>
            </div>
            <div className="grid gap-3">
              {column.tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              <button className="whitespace-nowrap rounded-lg bg-white/70 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-[#D6001C]" type="button" onClick={() => onNavigate("tasks")}>
                + {column.more}件のタスク
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-800" type="button" onClick={() => onNavigate("tasks")}>
        すべてのタスクを見る
        <ArrowRight size={15} />
      </button>
    </PanelCard>
  );
}

export function TaskCard({ task }: { task: TaskSummary }) {
  return (
    <article className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
      <p className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-900">{task.title}</p>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-2 text-xs text-slate-500">
        <span className="min-w-0 truncate">{task.assigneeName}</span>
        <span className="shrink-0 font-semibold">{task.dueDate}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
      </div>
    </article>
  );
}

export function ImportantNotificationsPanel({ onNavigate }: DashboardPageProps) {
  const groups = [
    { title: "承認待ち", count: notifications.filter((item) => item.type === "approval").length, items: notifications.filter((item) => item.type === "approval") },
    { title: "AI提案候補", count: notifications.filter((item) => item.type === "ai").length, items: notifications.filter((item) => item.type === "ai") },
    { title: "重要な通知", count: notifications.filter((item) => item.type === "comment" || item.type === "task").length, items: notifications.filter((item) => item.type === "comment" || item.type === "task") },
  ];

  return (
    <PanelCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">重要な通知</h3>
        <button className="text-xs font-bold text-slate-700" type="button" onClick={() => onNavigate("ai")}>
          すべて見る
        </button>
      </div>
      <div className="mt-4 grid gap-5">
        {groups.map((group) => (
          <section key={group.title}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">{group.title}</h4>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-[#D6001C]">{group.count}件</span>
            </div>
            <div className="grid gap-2">
              {group.items.map((item) => (
                <NotificationItem key={item.id} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PanelCard>
  );
}

export function NotificationItem({ item, onNavigate }: { item: NotificationSummary; onNavigate: (key: string) => void }) {
  const target = item.type === "approval" ? "approvals" : item.type === "ai" ? "ai" : item.type === "task" ? "tasks" : "logs";
  return (
    <button className="flex gap-3 rounded-lg p-2 text-left transition hover:bg-slate-50" type="button" onClick={() => onNavigate(target)}>
      <CircleDot className={item.unread ? "mt-1 text-[#D6001C]" : "mt-1 text-slate-300"} size={13} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.title}</p>
        <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
      </div>
      <span className="shrink-0 text-[11px] font-semibold text-slate-500">{item.timeLabel}</span>
    </button>
  );
}

export function DueDateDonutCard() {
  const total = dueDateChartData.reduce((sum, item) => sum + item.value, 0);
  const labels = ["今日", "今週", "来週", "今月以降", "期限未定"];

  return (
    <PanelCard className="p-5">
      <h3 className="font-bold">期限別タスク件数</h3>
      <div className="mt-4 grid grid-cols-[160px_1fr] items-center gap-4">
        <div className="relative h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dueDateChartData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}>
                {dueDateChartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-xs text-slate-500">計</p>
              <p className="text-2xl font-black">{total}</p>
              <p className="text-xs text-slate-500">件</p>
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          {dueDateChartData.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: item.fill }} />
                {labels[index] ?? item.name}
              </span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}

type DepartmentProgressItem = {
  department: string;
  progress: number;
  taskCount: number;
};

const DEPARTMENT_ALIAS_GROUPS = [
  ["営業部", "営業本部", "営業"],
  ["買取部", "買取営業"],
  ["販売部", "販売"],
  ["総務部", "総務", "管理本部"],
  ["システム部", "情シス", "システム推進"],
];

export function DepartmentProgressCard({ onNavigate, createdTasks = [], departmentOptions = DEFAULT_DEPARTMENTS }: DashboardPageProps) {
  const progressItems = useMemo(
    () => buildDepartmentProgress(
      departmentOptions,
      [...myTasks, ...createdTasks, ...kanbanColumns.flatMap((column) => column.tasks)],
    ),
    [createdTasks, departmentOptions],
  );
  const countedTaskTotal = progressItems.reduce((sum, item) => sum + item.taskCount, 0);

  return (
    <PanelCard className="p-5">
      <h3 className="font-bold">部門別進捗率</h3>
      <p className="mt-1 text-xs font-semibold text-slate-500">集計元: タスク進捗率を部門別に平均化（{countedTaskTotal}件）</p>
      <div className="mt-5 grid gap-4">
        {progressItems.map((item) => (
          <div key={item.department} className="grid grid-cols-[88px_1fr_72px] items-center gap-3 text-sm">
            <span className="truncate font-semibold text-slate-700">{item.department}</span>
            <ProgressBar value={item.progress} tone={item.progress >= 75 ? "bg-emerald-500" : item.progress >= 60 ? "bg-orange-400" : "bg-[#D6001C]"} />
            <strong className="text-right text-slate-700">{item.taskCount ? `${item.progress}%` : "対象なし"}</strong>
          </div>
        ))}
      </div>
      <button className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-800" type="button" onClick={() => onNavigate("settings")}>
        部門設定を開く
        <ArrowRight size={15} />
      </button>
    </PanelCard>
  );
}

function buildDepartmentProgress(departments: string[], tasks: TaskSummary[]): DepartmentProgressItem[] {
  const normalizedDepartments = normalizeDepartmentList(departments.length ? departments : DEFAULT_DEPARTMENTS);
  const progressMap = new Map(normalizedDepartments.map((department) => [department, [] as number[]]));

  tasks.forEach((task) => {
    const department = resolveDepartmentName(task.projectName, normalizedDepartments);
    if (!department) return;
    progressMap.get(department)?.push(clampDashboardProgress(task.progress));
  });

  return normalizedDepartments.map((department) => {
    const values = progressMap.get(department) ?? [];
    const progress = values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;
    return { department, progress, taskCount: values.length };
  });
}

function resolveDepartmentName(value: string, departments: string[]) {
  const normalizedValue = normalizeDepartmentName(value);
  const departmentByName = new Map(departments.map((department) => [normalizeDepartmentName(department), department]));
  const exactDepartment = departmentByName.get(normalizedValue);
  if (exactDepartment) return exactDepartment;

  const aliasGroup = DEPARTMENT_ALIAS_GROUPS.find((group) =>
    group.some((alias) => normalizeDepartmentName(alias) === normalizedValue),
  );
  if (!aliasGroup) return undefined;

  return departments.find((department) =>
    aliasGroup.some((alias) => normalizeDepartmentName(alias) === normalizeDepartmentName(department)),
  );
}

function normalizeDepartmentName(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function clampDashboardProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function RecentActivityCard({ onNavigate }: DashboardPageProps) {
  const activityLabels = [
    "新システム導入検討のタスクが更新されました",
    "システム導入契約が承認されました",
    "研修資料の更新にコメントされました",
    "販売促進キャンペーン計画がタスク化されました",
  ];

  return (
    <PanelCard className="p-5">
      <h3 className="font-bold">最近の更新</h3>
      <div className="mt-5 grid gap-4">
        {recentActivities.map((activity, index) => (
          <div key={activity.text} className="flex items-start justify-between gap-3 text-sm">
            <p className="text-slate-700">{activityLabels[index] ?? activity.text}</p>
            <span className="shrink-0 text-xs font-semibold text-slate-500">{activity.time}</span>
          </div>
        ))}
      </div>
      <button className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-800" type="button" onClick={() => onNavigate("logs")}>
        すべての更新を見る
        <ArrowRight size={15} />
      </button>
    </PanelCard>
  );
}

export function AiRoadmapCard() {
  return (
    <PanelCard className="p-5">
      <h3 className="font-bold text-[#D6001C]">今後の拡張予定（AI Secretary連携）</h3>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        {aiRoadmap.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-center gap-4">
              <div className="grid gap-2 text-center">
                <div className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200">
                  <Icon size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-700">{step.label}</span>
              </div>
              {index < aiRoadmap.length - 1 ? <ArrowRight size={16} className="hidden text-slate-400 sm:block" /> : null}
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}

export function DesignSpecPanel() {
  return (
    <PanelCard className="p-5">
      <h3 className="font-bold">Design Mode</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-sm font-bold">カラー</p>
          <div className="mt-2 flex gap-2">
            {["#D6001C", "#080F14", "#111827", "#6B7280", "#F3F4F6", "#FFFFFF"].map((color) => (
              <span key={color} className="size-8 rounded border border-slate-200" style={{ background: color }} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold">レスポンシブ</p>
          <div className="mt-2 flex gap-2 text-slate-600">
            <Mail />
            <TabletSmartphone />
            <Smartphone />
          </div>
        </div>
        <div>
          <p className="text-sm font-bold">本番では非表示</p>
          <p className="mt-2 text-sm text-slate-500">designModeフラグで出し分けます。</p>
        </div>
      </div>
    </PanelCard>
  );
}
