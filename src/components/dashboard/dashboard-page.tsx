"use client";

import { PanelCard, PriorityBadge, ProgressBar, StatusBadge, colorMap } from "@/components/ui/dashboard-ui";
import {
  DashboardKpi,
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
import { canAccessNavItem, normalizeAppRole } from "@/lib/domain/permissions";
import type { MyTodoEntry, MyTodoPriority, MyTodoStatus } from "@/lib/workspace/my-todo-store";
import type { TeamsTodoEntry } from "@/lib/workspace/teams-todo-store";
import { DEFAULT_DEPARTMENTS, normalizeDepartmentList } from "@/lib/workspace/department-store";
import { AppRole } from "@/types/database";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  Clock3,
  Filter,
  Flag,
  GitBranch,
  ListChecks,
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
  myTodos?: MyTodoEntry[];
  teamsTodos?: TeamsTodoEntry[];
  departmentOptions?: string[];
  appRole?: AppRole;
  currentUserName?: string;
  currentUserId?: string;
  currentUserDepartment?: string;
};

export function DashboardPage({ onNavigate, createdTasks = [], createdIssues = [], myTodos = [], teamsTodos = [], departmentOptions = DEFAULT_DEPARTMENTS, appRole = "member", currentUserName = "", currentUserId, currentUserDepartment }: DashboardPageProps) {
  const todayLabel = useMemo(() => formatTodayLabel(), []);
  const todayKey = useMemo(() => formatHomeDateKeyFromDate(new Date()), []);
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const normalizedRole = normalizeAppRole(appRole);
  const canViewAll = normalizedRole === "owner" || normalizedRole === "admin";
  const canViewTeamSummary = canViewAll;
  const visibleCreatedTasks = useMemo(
    () => filterDashboardTasks(createdTasks, currentUserName, currentUserId, currentUserDepartment, appRole),
    [appRole, createdTasks, currentUserDepartment, currentUserId, currentUserName],
  );
  const visibleCreatedIssues = useMemo(
    () => canViewAll ? createdIssues : createdIssues.filter((issue) => isSamePersonName(issue.owner, currentUserName)),
    [canViewAll, createdIssues, currentUserName],
  );
  const homeTasks = useMemo(
    () => buildHomeTaskSource(visibleCreatedTasks, currentUserName, appRole),
    [appRole, currentUserName, visibleCreatedTasks],
  );
  const calendarItems = useMemo(
    () => buildHomeCalendarItems({
      tasks: homeTasks,
      myTodos,
      teamsTodos,
      currentUserName,
      currentUserId,
      currentUserDepartment,
      appRole,
    }),
    [appRole, currentUserDepartment, currentUserId, currentUserName, homeTasks, myTodos, teamsTodos],
  );
  const monthCells = useMemo(() => buildHomeMonthCells(cursorDate), [cursorDate]);
  const itemsByDate = useMemo(() => groupHomeItemsByDate(calendarItems), [calendarItems]);
  const selectedItems = itemsByDate.get(selectedDateKey) ?? [];
  const todayItems = itemsByDate.get(todayKey) ?? [];
  const monthPrefix = `${cursorDate.getFullYear()}-${String(cursorDate.getMonth() + 1).padStart(2, "0")}`;
  const monthItems = calendarItems.filter((item) => item.dateKey.startsWith(monthPrefix));
  const upcomingItems = getUpcomingHomeItems(calendarItems, todayKey, 6);
  const openTasks = homeTasks.filter((task) => !isHomeTaskDone(task));
  const readyForApprovalCount = homeTasks.filter((task) => task.progress >= 100 && task.status !== "done").length;
  const overdueItemCount = calendarItems.filter((item) => item.overdue).length;
  const monthLabel = `${cursorDate.getFullYear()}年 ${cursorDate.getMonth() + 1}月`;

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-xl border border-slate-900 bg-[#080F14] text-white shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <span className="inline-flex rounded-md bg-white/10 px-3 py-1 text-xs font-black text-white/85">HOME</span>
            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">今日の動きと予定をここで確認</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {todayLabel} / {currentUserName || "ログインユーザー"}{currentUserDepartment ? ` / ${currentUserDepartment}` : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[520px]">
            <HomeStatCard label="今日" value={todayItems.length} suffix="件" />
            <HomeStatCard label="未完了Task" value={openTasks.length} suffix="件" />
            <HomeStatCard label="承認申請可" value={readyForApprovalCount} suffix="件" tone="red" />
            <HomeStatCard label="期限超過" value={overdueItemCount} suffix="件" tone="red" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <HomeCalendarPanel
          monthLabel={monthLabel}
          monthCells={monthCells}
          itemsByDate={itemsByDate}
          selectedDateKey={selectedDateKey}
          todayKey={todayKey}
          monthItemsCount={monthItems.length}
          onSelectDate={setSelectedDateKey}
          onPreviousMonth={() => setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1))}
          onCurrentMonth={() => {
            const now = new Date();
            setCursorDate(now);
            setSelectedDateKey(formatHomeDateKeyFromDate(now));
          }}
          onNextMonth={() => setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1))}
          onNavigate={onNavigate}
        />
        <HomeDayAgendaPanel selectedDateKey={selectedDateKey} selectedItems={selectedItems} upcomingItems={upcomingItems} onNavigate={onNavigate} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <HomeTaskProgressPanel tasks={homeTasks} onNavigate={onNavigate} />
        <MyTodoDashboardPanel onNavigate={onNavigate} myTodos={myTodos} teamsTodos={teamsTodos} />
      </section>

      <KpiSummaryGrid onNavigate={onNavigate} createdTasks={visibleCreatedTasks} createdIssues={visibleCreatedIssues} appRole={appRole} />

      {canViewTeamSummary ? (
        <section className="grid gap-5 xl:grid-cols-3">
          <DueDateDonutCard />
          <DepartmentProgressCard onNavigate={onNavigate} createdTasks={visibleCreatedTasks} departmentOptions={departmentOptions} />
          <RecentActivityCard onNavigate={onNavigate} />
        </section>
      ) : null}

      {designMode ? <DesignSpecPanel /> : null}
    </div>
  );
}

type HomeCalendarItemKind = "task" | "my_todo" | "team_todo";

type HomeCalendarItem = {
  id: string;
  kind: HomeCalendarItemKind;
  title: string;
  dateKey: string;
  routeKey: string;
  primaryMeta: string;
  secondaryMeta: string;
  description?: string;
  progress?: number;
  taskStatus?: TaskStatus;
  taskPriority?: TaskSummary["priority"];
  todoStatus?: MyTodoStatus;
  todoPriority?: MyTodoPriority;
  overdue?: boolean;
};

type HomeMonthCell = {
  dateKey: string;
  day: number;
  inCurrentMonth: boolean;
};

const homeWeekdays = ["日", "月", "火", "水", "木", "金", "土"];

const homeKindConfig: Record<HomeCalendarItemKind, { label: string; className: string; dotClassName: string }> = {
  task: { label: "Task", className: "bg-red-50 text-red-700 ring-red-200", dotClassName: "bg-[#D6001C]" },
  my_todo: { label: "MyToDo", className: "bg-blue-50 text-blue-700 ring-blue-200", dotClassName: "bg-blue-500" },
  team_todo: { label: "TeamToDo", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", dotClassName: "bg-emerald-500" },
};

function HomeStatCard({ label, value, suffix, tone = "default" }: { label: string; value: number; suffix: string; tone?: "default" | "red" }) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${tone === "red" ? "border-red-400/30 bg-red-500/10" : "border-white/10 bg-white/10"}`}>
      <p className="text-[11px] font-black text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-black leading-none text-white">
        {value}
        <span className="ml-1 text-xs font-bold text-slate-300">{suffix}</span>
      </p>
    </div>
  );
}

function HomeCalendarPanel({
  monthLabel,
  monthCells,
  itemsByDate,
  selectedDateKey,
  todayKey,
  monthItemsCount,
  onSelectDate,
  onPreviousMonth,
  onCurrentMonth,
  onNextMonth,
  onNavigate,
}: {
  monthLabel: string;
  monthCells: HomeMonthCell[];
  itemsByDate: Map<string, HomeCalendarItem[]>;
  selectedDateKey: string;
  todayKey: string;
  monthItemsCount: number;
  onSelectDate: (dateKey: string) => void;
  onPreviousMonth: () => void;
  onCurrentMonth: () => void;
  onNextMonth: () => void;
  onNavigate: (key: string) => void;
}) {
  return (
    <PanelCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#D6001C]">
            <CalendarDays size={18} />
            <p className="text-xs font-black uppercase">Home Calendar</p>
          </div>
          <h3 className="mt-2 text-xl font-black text-slate-950">{monthLabel}</h3>
          <p className="mt-1 text-sm text-slate-500">Task、MyToDo、TeamToDoを日付でまとめて確認します。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{monthItemsCount}件</span>
          <button className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C]" type="button" onClick={onPreviousMonth} aria-label="前月">
            <ChevronLeft size={17} />
          </button>
          <button className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-700 hover:bg-slate-200" type="button" onClick={onCurrentMonth}>
            今月
          </button>
          <button className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C]" type="button" onClick={onNextMonth} aria-label="次月">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {homeWeekdays.map((weekday) => (
          <div key={weekday} className="border-b border-slate-200 px-1 py-2 text-center text-xs font-black text-slate-500">
            {weekday}
          </div>
        ))}
        {monthCells.map((cell) => {
          const cellItems = itemsByDate.get(cell.dateKey) ?? [];
          const cellStats = getHomeCalendarStats(cellItems);
          return (
            <button
              key={cell.dateKey}
              className={`min-h-24 border-b border-r border-slate-200 p-2 text-left transition hover:bg-red-50/40 sm:min-h-28 ${
                cell.inCurrentMonth ? "bg-white" : "bg-slate-50 text-slate-400"
              } ${selectedDateKey === cell.dateKey ? "ring-2 ring-inset ring-[#D6001C]" : ""}`}
              type="button"
              onClick={() => onSelectDate(cell.dateKey)}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`grid size-7 place-items-center rounded-full text-xs font-black ${cell.dateKey === todayKey ? "bg-[#D6001C] text-white" : "text-slate-700"}`}>{cell.day}</span>
                {cellItems.length ? <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600">{cellItems.length}</span> : null}
              </div>
              {cellItems.length ? (
                <div className="mt-2 grid gap-1">
                  {cellStats.overdue ? <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-700">超過 {cellStats.overdue}</span> : null}
                  {cellItems.slice(0, 2).map((item) => {
                    const config = homeKindConfig[item.kind];
                    return (
                      <span key={`${cell.dateKey}-${item.kind}-${item.id}`} className="flex min-w-0 items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        <span className={`size-1.5 shrink-0 rounded-full ${config.dotClassName}`} />
                        <span className="truncate">{item.title}</span>
                      </span>
                    );
                  })}
                  {cellItems.length > 2 ? <span className="text-[10px] font-bold text-slate-400">+{cellItems.length - 2}件</span> : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C]" type="button" onClick={() => onNavigate("calendar")}>
          <CalendarDays size={16} />
          Calendarを開く
        </button>
        <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C]" type="button" onClick={() => onNavigate("tasks")}>
          <ListChecks size={16} />
          Taskへ移動
        </button>
      </div>
    </PanelCard>
  );
}

function HomeDayAgendaPanel({
  selectedDateKey,
  selectedItems,
  upcomingItems,
  onNavigate,
}: {
  selectedDateKey: string;
  selectedItems: HomeCalendarItem[];
  upcomingItems: HomeCalendarItem[];
  onNavigate: (key: string) => void;
}) {
  return (
    <div className="grid gap-5">
      <PanelCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#D6001C]">
              <Clock3 size={18} />
              <p className="text-xs font-black uppercase">Selected Day</p>
            </div>
            <h3 className="mt-2 text-lg font-black text-slate-950">{formatHomeDateLabel(selectedDateKey)}</h3>
            <p className="mt-1 text-sm text-slate-500">選択日の作業と期限</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{selectedItems.length}件</span>
        </div>
        <div className="mt-4 grid gap-3">
          {selectedItems.length ? selectedItems.map((item) => (
            <HomeCalendarItemCard key={`${item.kind}-${item.id}`} item={item} onNavigate={onNavigate} />
          )) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
              <p className="font-bold text-slate-800">この日の予定はありません</p>
              <p className="mt-1 text-sm text-slate-500">別の日を選ぶか、Task / MyToDoを追加してください。</p>
            </div>
          )}
        </div>
      </PanelCard>

      <PanelCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black text-slate-950">直近の予定</h3>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-[#D6001C]">{upcomingItems.length}件</span>
        </div>
        <div className="mt-4 grid gap-2">
          {upcomingItems.map((item) => {
            const config = homeKindConfig[item.kind];
            return (
              <button key={`upcoming-${item.kind}-${item.id}`} className="grid gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3 text-left hover:border-[#D6001C] hover:bg-white" type="button" onClick={() => onNavigate(item.routeKey)}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-black ring-1 ${config.className}`}>{config.label}</span>
                  <span className="text-xs font-bold text-slate-500">{formatHomeMonthDay(item.dateKey)}</span>
                </div>
                <p className="line-clamp-2 text-sm font-black text-slate-900">{item.title}</p>
                <p className="truncate text-xs font-bold text-slate-500">{item.primaryMeta}</p>
              </button>
            );
          })}
          {upcomingItems.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">直近の予定はありません。</p> : null}
        </div>
      </PanelCard>
    </div>
  );
}

function HomeCalendarItemCard({ item, onNavigate }: { item: HomeCalendarItem; onNavigate: (key: string) => void }) {
  const config = homeKindConfig[item.kind];
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-black ring-1 ${config.className}`}>{config.label}</span>
          <h4 className="mt-3 break-words font-black text-slate-950">{item.title}</h4>
          <p className="mt-2 text-sm text-slate-500">{item.primaryMeta}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{item.secondaryMeta}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {item.taskPriority ? <PriorityBadge priority={item.taskPriority} /> : null}
          {item.taskStatus ? <StatusBadge status={item.taskStatus} /> : null}
          {item.todoPriority ? <MyTodoPriorityBadge priority={item.todoPriority} /> : null}
          {item.todoStatus ? <MyTodoStatusBadge status={item.todoStatus} /> : null}
        </div>
      </div>
      {typeof item.progress === "number" ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>進捗</span>
            <span>{item.progress}%</span>
          </div>
          <div className="mt-2">
            <ProgressBar value={item.progress} />
          </div>
        </div>
      ) : null}
      {item.description ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{item.description}</p> : null}
      <button className="mt-4 h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white hover:bg-red-700" type="button" onClick={() => onNavigate(item.routeKey)}>
        関連ページへ移動
      </button>
    </article>
  );
}

function HomeTaskProgressPanel({ tasks, onNavigate }: { tasks: TaskSummary[]; onNavigate: (key: string) => void }) {
  const taskCards = getHomeTaskCards(tasks);
  const activeTasks = taskCards.filter((task) => !isHomeTaskDone(task));
  const averageProgress = taskCards.length ? Math.round(taskCards.reduce((sum, task) => sum + clampDashboardProgress(task.progress), 0) / taskCards.length) : 0;

  return (
    <PanelCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-950">タスク進捗管理</h3>
          <p className="mt-1 text-sm text-slate-500">担当・登録・所属で見えるTaskを、期限が近い順に表示します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">平均 {averageProgress}%</span>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-[#D6001C]">未完了 {activeTasks.length}件</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {taskCards.map((task) => (
          <HomeTaskProgressCard key={task.id} task={task} onNavigate={onNavigate} />
        ))}
        {taskCards.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-5 text-sm font-semibold text-slate-500">表示できるTaskはありません。</p>
        ) : null}
      </div>

      <button className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-800" type="button" onClick={() => onNavigate("tasks")}>
        すべてのタスクを見る
        <ArrowRight size={15} />
      </button>
    </PanelCard>
  );
}

function HomeTaskProgressCard({ task, onNavigate }: { task: TaskSummary; onNavigate: (key: string) => void }) {
  const readyForApproval = task.progress >= 100 && task.status !== "done";
  const dueDateKey = parseHomeDateKey(task.dueDate);
  const overdue = Boolean(dueDateKey && isHomeDateOverdue(dueDateKey, isHomeTaskDone(task)));

  return (
    <article className={`rounded-lg border p-4 ${readyForApproval ? "border-red-200 bg-red-50/40" : overdue ? "border-red-100 bg-white" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-black text-slate-950">{task.title}</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-500">{task.projectName}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>現在の進捗</span>
          <span className={readyForApproval ? "text-[#D6001C]" : "text-slate-700"}>{task.progress}%</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={task.progress} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2">
        <span>期限: <strong className={overdue ? "text-[#D6001C]" : "text-slate-700"}>{formatHomeTaskDueLabel(task.dueDate)}</strong></span>
        <span className="truncate">担当: <strong className="text-slate-700">{getHomeTaskAssigneeLabel(task)}</strong></span>
      </div>
      {readyForApproval ? <p className="mt-3 rounded-lg bg-white p-2 text-xs font-black text-[#D6001C]">進捗100%。承認申請へ進めます。</p> : null}
      <button className="mt-4 h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C]" type="button" onClick={() => onNavigate("tasks")}>
        Taskを開く
      </button>
    </article>
  );
}

function buildHomeTaskSource(createdTasks: TaskSummary[], currentUserName: string, appRole: AppRole) {
  const normalizedRole = normalizeAppRole(appRole);
  const demoTasks = normalizedRole === "owner" || normalizedRole === "admin"
    ? [...myTasks, ...kanbanColumns.flatMap((column) => column.tasks)]
    : myTasks.filter((task) => isSamePersonName(task.assigneeName, currentUserName));
  const taskMap = new Map<string, TaskSummary>();
  [...createdTasks, ...demoTasks].forEach((task) => {
    if ((task as DashboardTaskScopeEntry).deletedAt) return;
    taskMap.set(task.id, task);
  });
  return [...taskMap.values()];
}

function buildHomeCalendarItems({
  tasks,
  myTodos,
  teamsTodos,
  currentUserName,
  currentUserId,
  currentUserDepartment,
  appRole,
}: {
  tasks: TaskSummary[];
  myTodos: MyTodoEntry[];
  teamsTodos: TeamsTodoEntry[];
  currentUserName: string;
  currentUserId?: string;
  currentUserDepartment?: string;
  appRole: AppRole;
}) {
  const taskItems = tasks
    .filter((task) => !(task as DashboardTaskScopeEntry).deletedAt)
    .map(homeTaskToCalendarItem)
    .filter(isHomeCalendarItem);
  const myTodoItems = myTodos
    .filter((todo) => !todo.deletedAt && isHomeMyTodoRelatedToCurrentUser(todo, currentUserName, currentUserId))
    .map(homeMyTodoToCalendarItem)
    .filter(isHomeCalendarItem);
  const teamTodoItems = teamsTodos
    .filter((todo) => !todo.deletedAt && isHomeTeamsTodoRelatedToCurrentUser(todo, currentUserName, currentUserId, currentUserDepartment, appRole))
    .map(homeTeamTodoToCalendarItem)
    .filter(isHomeCalendarItem);

  return [...taskItems, ...myTodoItems, ...teamTodoItems]
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey) || getHomeKindRank(left.kind) - getHomeKindRank(right.kind));
}

function homeTaskToCalendarItem(task: TaskSummary): HomeCalendarItem | null {
  const dateKey = parseHomeDateKey(task.dueDate);
  if (!dateKey) return null;
  const scopedTask = task as DashboardTaskScopeEntry;
  const createdBy = scopedTask.createdByName ? ` / 登録者: ${scopedTask.createdByName}` : "";
  return {
    id: task.id,
    kind: "task",
    title: task.title,
    dateKey,
    routeKey: "tasks",
    primaryMeta: `${task.projectName} / 担当: ${getHomeTaskAssigneeLabel(task)}${createdBy}`,
    secondaryMeta: `期限 ${formatHomeDateLabel(dateKey)}`,
    description: "進捗報告、ToDoメモ、承認申請はTaskページで更新します。",
    progress: clampDashboardProgress(task.progress),
    taskStatus: task.status,
    taskPriority: task.priority,
    overdue: isHomeDateOverdue(dateKey, isHomeTaskDone(task)),
  };
}

function homeMyTodoToCalendarItem(todo: MyTodoEntry): HomeCalendarItem | null {
  const dateKey = parseHomeDateKey(todo.dueDate);
  if (!dateKey) return null;
  return {
    id: todo.id,
    kind: "my_todo",
    title: todo.title,
    dateKey,
    routeKey: "my_todo",
    primaryMeta: `MyToDo / 登録者: ${todo.createdByName}`,
    secondaryMeta: `期限 ${formatHomeDateLabel(dateKey)}`,
    description: todo.memo,
    todoStatus: todo.status,
    todoPriority: todo.priority,
    overdue: isHomeDateOverdue(dateKey, todo.status === "done"),
  };
}

function homeTeamTodoToCalendarItem(todo: TeamsTodoEntry): HomeCalendarItem | null {
  const dateKey = parseHomeDateKey(todo.dueDate);
  if (!dateKey) return null;
  return {
    id: todo.id,
    kind: "team_todo",
    title: todo.title,
    dateKey,
    routeKey: "my_todo",
    primaryMeta: `${todo.targetOrganization} / 指名先: ${todo.assigneeName ?? "未指名"}`,
    secondaryMeta: `配布元: ${todo.createdByName}`,
    description: todo.memo,
    todoStatus: todo.status,
    todoPriority: todo.priority,
    overdue: isHomeDateOverdue(dateKey, todo.status === "done"),
  };
}

function isHomeCalendarItem(item: HomeCalendarItem | null): item is HomeCalendarItem {
  return Boolean(item);
}

function isHomeMyTodoRelatedToCurrentUser(todo: MyTodoEntry, currentUserName: string, currentUserId?: string) {
  if (currentUserId && todo.userId === currentUserId) return true;
  return isSamePersonName(todo.createdByName, currentUserName);
}

function isHomeTeamsTodoRelatedToCurrentUser(todo: TeamsTodoEntry, currentUserName: string, currentUserId: string | undefined, currentUserDepartment: string | undefined, appRole: AppRole) {
  if (currentUserId && [todo.assigneeId, todo.createdById].includes(currentUserId)) return true;
  if ([todo.assigneeName, todo.createdByName].some((name) => isSamePersonName(name, currentUserName))) return true;
  return canViewHomeDepartmentWork(appRole) && isSameDepartmentLabel(todo.targetOrganization, currentUserDepartment);
}

function canViewHomeDepartmentWork(appRole: AppRole) {
  const normalizedRole = normalizeAppRole(appRole);
  return ["owner", "admin", "executive", "department_manager", "team_manager"].includes(normalizedRole);
}

function groupHomeItemsByDate(items: HomeCalendarItem[]) {
  return items.reduce((map, item) => {
    const current = map.get(item.dateKey) ?? [];
    current.push(item);
    map.set(item.dateKey, current);
    return map;
  }, new Map<string, HomeCalendarItem[]>());
}

function getHomeCalendarStats(items: HomeCalendarItem[]) {
  return items.reduce(
    (stats, item) => {
      if (item.kind === "task") stats.task += 1;
      if (item.kind === "my_todo" || item.kind === "team_todo") stats.todo += 1;
      if (item.overdue) stats.overdue += 1;
      return stats;
    },
    { task: 0, todo: 0, overdue: 0 },
  );
}

function getUpcomingHomeItems(items: HomeCalendarItem[], todayKey: string, limit: number) {
  return items
    .filter((item) => item.dateKey >= todayKey)
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey) || getHomeKindRank(left.kind) - getHomeKindRank(right.kind))
    .slice(0, limit);
}

function getHomeTaskCards(tasks: TaskSummary[]) {
  return [...tasks]
    .filter((task) => !(task as DashboardTaskScopeEntry).deletedAt)
    .sort((left, right) => {
      const overdueDiff = Number(isHomeTaskOverdue(right)) - Number(isHomeTaskOverdue(left));
      if (overdueDiff !== 0) return overdueDiff;
      const dueDiff = getHomeDateTime(left.dueDate) - getHomeDateTime(right.dueDate);
      if (dueDiff !== 0) return dueDiff;
      return getHomePriorityRank(right.priority) - getHomePriorityRank(left.priority);
    })
    .slice(0, 6);
}

function getHomeTaskAssigneeLabel(task: TaskSummary) {
  const scopedTask = task as DashboardTaskScopeEntry;
  if (scopedTask.assigneePerson && scopedTask.assigneePerson !== "未選択") return scopedTask.assigneePerson;
  if (scopedTask.responsiblePerson) return scopedTask.responsiblePerson;
  return task.assigneeName || "未設定";
}

function isHomeTaskDone(task: TaskSummary) {
  return task.status === "done" || task.progress >= 100;
}

function isHomeTaskOverdue(task: TaskSummary) {
  const dateKey = parseHomeDateKey(task.dueDate);
  return Boolean(dateKey && isHomeDateOverdue(dateKey, isHomeTaskDone(task)));
}

function getHomePriorityRank(priority: TaskSummary["priority"]) {
  if (priority === "must") return 3;
  if (priority === "should") return 2;
  return 1;
}

function getHomeKindRank(kind: HomeCalendarItemKind) {
  const rank: Record<HomeCalendarItemKind, number> = {
    task: 1,
    team_todo: 2,
    my_todo: 3,
  };
  return rank[kind];
}

function buildHomeMonthCells(cursorDate: Date): HomeMonthCell[] {
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return {
      dateKey: formatHomeDateKeyFromDate(date),
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
    };
  });
}

function formatHomeDateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseHomeDateKey(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.normalize("NFKC").trim();
  const isoDate = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) return `${isoDate[1]}-${padDatePart(isoDate[2])}-${padDatePart(isoDate[3])}`;
  const yearSlashDate = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (yearSlashDate) return `${yearSlashDate[1]}-${padDatePart(yearSlashDate[2])}-${padDatePart(yearSlashDate[3])}`;
  const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})/);
  if (slashDate) return `${new Date().getFullYear()}-${padDatePart(slashDate[1])}-${padDatePart(slashDate[2])}`;
  return undefined;
}

function padDatePart(value: string) {
  return value.padStart(2, "0");
}

function formatHomeDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  return `${year}/${month}/${day}`;
}

function formatHomeMonthDay(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  if (!month || !day) return dateKey;
  return `${month}/${day}`;
}

function formatHomeTaskDueLabel(dueDate: string) {
  const dateKey = parseHomeDateKey(dueDate);
  return dateKey ? formatHomeMonthDay(dateKey) : dueDate || "期限なし";
}

function isHomeDateOverdue(dateKey: string, done: boolean) {
  if (done) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateKey}T00:00:00`);
  return Number.isFinite(target.getTime()) && target.getTime() < today.getTime();
}

function getHomeDateTime(dueDate: string) {
  const dateKey = parseHomeDateKey(dueDate);
  if (!dateKey) return Number.MAX_SAFE_INTEGER;
  const time = new Date(`${dateKey}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

type DashboardTaskScopeEntry = TaskSummary & {
  createdById?: string;
  createdByName?: string;
  responsiblePerson?: string;
  assigneePerson?: string;
  deletedAt?: string;
};

function filterDashboardTasks(tasks: TaskSummary[], currentUserName: string, currentUserId: string | undefined, currentUserDepartment: string | undefined, appRole: AppRole) {
  const normalizedRole = normalizeAppRole(appRole);
  if (normalizedRole === "owner" || normalizedRole === "admin") return tasks;

  return tasks.filter((task) => {
    const scopedTask = task as DashboardTaskScopeEntry;
    if (isDashboardTaskRelated(scopedTask, currentUserName, currentUserId)) return true;
    return normalizedRole === "department_manager" && isSameDepartmentLabel(scopedTask.projectName, currentUserDepartment);
  });
}

function isDashboardTaskRelated(task: DashboardTaskScopeEntry, currentUserName: string, currentUserId?: string) {
  if (task.createdById && currentUserId && task.createdById === currentUserId) return true;
  return [task.createdByName, task.assigneeName, task.responsiblePerson, task.assigneePerson].some((name) => isSamePersonName(name, currentUserName));
}

function isSamePersonName(left: string | undefined, right: string | undefined) {
  const normalizedLeft = normalizePersonName(left);
  const normalizedRight = normalizePersonName(right);
  return Boolean(normalizedLeft && normalizedRight && (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)));
}

function normalizePersonName(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, "");
}

function isSameDepartmentLabel(left: string | undefined, right: string | undefined) {
  const normalizedLeft = normalizeDepartmentName(left ?? "");
  const normalizedRight = normalizeDepartmentName(right ?? "");
  return Boolean(normalizedLeft && normalizedRight && (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)));
}

export function KpiSummaryGrid({ onNavigate, createdTasks = [], createdIssues = [], appRole = "member" }: DashboardPageProps) {
  const normalizedRole = normalizeAppRole(appRole);
  const includeDemoTotals = normalizedRole === "owner" || normalizedRole === "admin";
  const dashboardKpis = useMemo(() => buildDashboardKpis(createdTasks ?? [], createdIssues ?? [], includeDemoTotals), [createdTasks, createdIssues, includeDemoTotals]);
  const kpiTargets: Record<string, string> = {
    今日締切: "tasks",
    期限超過: "tasks",
    承認待ち: "approvals",
    高優先度: "tasks",
    未担当Project: "issues",
    AI提案候補: "ai",
  };

  return (
    <section>
      <p className="mb-2 text-xs font-bold text-slate-500">KPIはタスク・承認・通知のデモデータから自動集計</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {dashboardKpis
          .filter((kpi) => canAccessNavItem(appRole, kpiTargets[kpi.label] ?? "dashboard"))
          .map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} onClick={() => onNavigate(kpiTargets[kpi.label] ?? "dashboard")} />
          ))}
      </div>
    </section>
  );
}

function buildDashboardKpis(createdTasks: TaskSummary[] = [], createdIssues: Array<{ owner: string }> = [], includeDemoTotals = true): DashboardKpi[] {
  const openCreatedTasks = createdTasks.filter((task) => task.status !== "done" && task.progress < 100);
  const shownTasks = includeDemoTotals ? [...myTasks, ...openCreatedTasks, ...kanbanColumns.flatMap((column) => column.tasks)] : openCreatedTasks;
  const hiddenKanbanTaskCount = includeDemoTotals ? kanbanColumns.reduce((sum, column) => sum + column.more, 0) : 0;
  const totalKanbanTaskCount = includeDemoTotals ? kanbanColumns.reduce((sum, column) => sum + column.count, 0) : Math.max(openCreatedTasks.length, 1);
  const todayDue = (includeDemoTotals ? (dueDateChartData[0]?.value ?? 0) : 0) + openCreatedTasks.filter((task) => task.dueDate === "05/31").length;
  const overdue = shownTasks.filter((task) => task.status !== "done" && task.dueDate <= "05/31").length;
  const approvalWaiting = includeDemoTotals ? kanbanColumns.find((column) => column.id === "approval_pending")?.count ?? 0 : openCreatedTasks.filter((task) => task.status === "approval_pending").length;
  const mustPriority = shownTasks.filter((task) => task.priority === "must").length + Math.round(hiddenKanbanTaskCount / 7);
  const unassignedIssues = (includeDemoTotals ? pageDemo.issues.filter((issue, index) => index === 0 || issue.owner.includes("未")).length : 0) + createdIssues.filter((issue) => issue.owner.includes("未")).length;
  const aiCandidates = includeDemoTotals ? notifications.filter((item) => item.type === "ai").length + pageDemo.inbox.length + 1 : notifications.filter((item) => item.type === "ai").length;

  return [
    { label: "今日締切", value: todayDue, suffix: "件", diffLabel: "締切データから集計", color: "red", icon: CalendarDays, progress: Math.min(todayDue * 8, 100) },
    { label: "期限超過", value: overdue, suffix: "件", diffLabel: "未完了タスクから集計", color: "red", icon: CircleAlert, progress: Math.min(overdue * 12, 100) },
    { label: "承認待ち", value: approvalWaiting, suffix: "件", diffLabel: "承認フローから集計", color: "purple", icon: ShieldCheck, progress: Math.min(approvalWaiting * 8, 100) },
    { label: "高優先度", value: mustPriority, suffix: "件", diffLabel: "Mustタスクから集計", color: "orange", icon: Flag, progress: Math.min(mustPriority * 10, 100) },
    { label: "未担当Project", value: unassignedIssues, suffix: "件", diffLabel: "担当未設定のProject", color: "green", icon: Users, progress: Math.min(unassignedIssues * 18, 100) },
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

export function ImplementationRoadmapCard({ onNavigate, appRole = "member" }: DashboardPageProps) {
  const projectTodoTarget = canAccessNavItem(appRole, "issues") ? "issues" : "my_todo";
  const roadmapItems = [
    {
      phase: "Priority 1",
      title: "Project / Task / ToDo",
      description: "まず本来のProjectからTask処理、MyToDo/TeamToDoを実装の中心にします。",
      target: projectTodoTarget,
      status: "実装優先",
      icon: Flag,
    },
    {
      phase: "Priority 2",
      title: "TaurosAI",
      description: "社内ナレッジ、マニュアル、FAQ、業務ルールの質問精度を高めます。",
      target: "tauros_ai",
      status: "順次改修",
      icon: Bot,
    },
    {
      phase: "Future",
      title: "Calendar",
      description: "TeamOSを基幹にして、Google Calendar同期を後から追加します。",
      target: "calendar",
      status: "今後実装予定",
      icon: CalendarDays,
    },
    {
      phase: "Future",
      title: "Workflow",
      description: "申請、添付、複数承認、条件分岐、差し戻しを段階的に作ります。",
      target: "workflow",
      status: "今後実装予定",
      icon: GitBranch,
    },
    {
      phase: "Future",
      title: "AI Suggestions / 通知",
      description: "Gmail、LINE、予定、申請通知をAI提案として整理します。",
      target: "ai",
      status: "順次改修",
      icon: Mail,
    },
  ].filter((item) => canAccessNavItem(appRole, item.target));

  return (
    <PanelCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-950">実装ロードマップ</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">Dashboard / Calendar / Workflowは土台を置き、まずProject・Task・ToDoを固めます。</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">今後実装予定を含む</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {roadmapItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.title} className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-[#D6001C] hover:shadow-sm" type="button" onClick={() => onNavigate(item.target)}>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-black text-[#D6001C]">{item.phase}</span>
                <Icon className="text-slate-500" size={17} />
              </div>
              <h4 className="mt-3 text-sm font-black text-slate-950">{item.title}</h4>
              <p className="mt-2 min-h-16 text-xs leading-5 text-slate-500">{item.description}</p>
              <span className="mt-3 inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{item.status}</span>
            </button>
          );
        })}
      </div>
    </PanelCard>
  );
}

export function MyTasksPanel({ onNavigate, createdTasks = [], currentUserName = "", appRole = "member" }: DashboardPageProps) {
  const [activeFilter, setActiveFilter] = useState<"today" | "week" | "overdue">("today");
  const normalizedRole = normalizeAppRole(appRole);
  const canViewDemoTasks = normalizedRole === "owner" || normalizedRole === "admin";
  const canOpenTasksPage = canAccessNavItem(appRole, "tasks");
  const relatedDemoTasks = canViewDemoTasks ? myTasks : myTasks.filter((task) => isSamePersonName(task.assigneeName, currentUserName));
  const relatedTasks = [...relatedDemoTasks, ...createdTasks];
  const taskFilters: Array<{ key: "today" | "week" | "overdue"; label: string; tasks: TaskSummary[] }> = [
    { key: "today", label: "今日", tasks: relatedTasks.filter((task) => task.dueDate === "05/31") },
    { key: "week", label: "今週", tasks: relatedTasks },
    { key: "overdue", label: "期限超過", tasks: relatedTasks.filter((task) => task.status !== "done" && task.dueDate <= "05/31") },
  ];
  const activeTasks = taskFilters.find((filter) => filter.key === activeFilter)?.tasks ?? relatedTasks;

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
      {canOpenTasksPage ? (
        <button className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-800" type="button" onClick={() => onNavigate("tasks")}>
          すべてのタスクを見る
          <ArrowRight size={15} />
        </button>
      ) : null}
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

export function MyTodoDashboardPanel({ onNavigate, myTodos = [], teamsTodos = [] }: DashboardPageProps) {
  const dashboardTodos = useMemo(() => getDashboardMyTodos(myTodos), [myTodos]);
  const dashboardTeamsTodos = useMemo(() => getDashboardTeamsTodos(teamsTodos), [teamsTodos]);

  return (
    <PanelCard className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold">ToDo</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">MyToDo / TeamToDoの確認</p>
        </div>
        <button className="text-xs font-bold text-slate-700" type="button" onClick={() => onNavigate("my_todo")}>
          管理する
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">MyToDo</p>
        {dashboardTodos.map((todo) => (
          <button key={todo.id} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-[#D6001C] hover:bg-white" type="button" onClick={() => onNavigate("my_todo")}>
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-sm font-bold text-slate-900">{todo.title}</p>
              <MyTodoPriorityBadge priority={todo.priority} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <span>{formatDashboardMyTodoDueDate(todo.dueDate)}</span>
              <MyTodoStatusBadge status={todo.status} />
            </div>
          </button>
        ))}
        {dashboardTodos.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">未完了のMyToDoはありません。</p> : null}
        <p className="mt-3 text-[11px] font-black uppercase tracking-wide text-slate-400">TeamToDo</p>
        {dashboardTeamsTodos.map((todo) => (
          <button key={todo.id} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-[#D6001C] hover:bg-white" type="button" onClick={() => onNavigate("my_todo")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="line-clamp-2 text-sm font-bold text-slate-900">{todo.title}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">{todo.targetOrganization}</p>
                {todo.assigneeName ? <p className="mt-1 text-[11px] font-black text-emerald-700">指名先 {todo.assigneeName}</p> : null}
              </div>
              <MyTodoPriorityBadge priority={todo.priority} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <span>{formatDashboardMyTodoDueDate(todo.dueDate)}</span>
              <MyTodoStatusBadge status={todo.status} />
            </div>
          </button>
        ))}
        {dashboardTeamsTodos.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">未完了のTeamToDoはありません。</p> : null}
      </div>
    </PanelCard>
  );
}

function getDashboardTeamsTodos(teamsTodos: TeamsTodoEntry[]) {
  return teamsTodos
    .filter((todo) => !todo.deletedAt && todo.status !== "done")
    .sort((left, right) => {
      const priorityDiff = getMyTodoPriorityRank(right.priority) - getMyTodoPriorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return getMyTodoDueTime(left.dueDate) - getMyTodoDueTime(right.dueDate);
    })
    .slice(0, 6);
}

function getDashboardMyTodos(myTodos: MyTodoEntry[]) {
  return myTodos
    .filter((todo) => !todo.deletedAt && todo.status !== "done")
    .sort((left, right) => {
      const priorityDiff = getMyTodoPriorityRank(right.priority) - getMyTodoPriorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return getMyTodoDueTime(left.dueDate) - getMyTodoDueTime(right.dueDate);
    })
    .slice(0, 6);
}

function getMyTodoPriorityRank(priority: MyTodoPriority) {
  return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

function getMyTodoDueTime(dueDate: string) {
  if (!dueDate) return Number.MAX_SAFE_INTEGER;
  const time = new Date(`${dueDate}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function formatDashboardMyTodoDueDate(dueDate: string) {
  if (!dueDate) return "期限なし";
  const [year, month, day] = dueDate.split("-");
  if (!year || !month || !day) return dueDate;
  return `${month}/${day}`;
}

function MyTodoPriorityBadge({ priority }: { priority: MyTodoPriority }) {
  const config = priority === "high"
    ? { label: "高", className: "bg-red-50 text-red-700 ring-red-200" }
    : priority === "medium"
      ? { label: "中", className: "bg-orange-50 text-orange-700 ring-orange-200" }
      : { label: "低", className: "bg-slate-100 text-slate-700 ring-slate-200" };
  return <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-black ring-1 ${config.className}`}>{config.label}</span>;
}

function MyTodoStatusBadge({ status }: { status: MyTodoStatus }) {
  const label = status === "not_started" ? "未着手" : status === "in_progress" ? "進行中" : status === "on_hold" ? "保留" : "完了";
  const className = status === "done" ? "bg-emerald-50 text-emerald-700" : status === "on_hold" ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700";
  return <span className={`rounded px-2 py-0.5 text-[11px] ${className}`}>{label}</span>;
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
    "販売促進キャンペーン計画がTask化されました",
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
