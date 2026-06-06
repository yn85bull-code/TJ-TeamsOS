import {
  Activity,
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Flag,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LucideIcon,
  Mail,
  MessageCircle,
  PieChart,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

export type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export type KpiColor = "red" | "orange" | "purple" | "green" | "blue" | "gray";

export type DashboardKpi = {
  label: string;
  value: number;
  suffix?: string;
  diffLabel: string;
  color: KpiColor;
  icon: LucideIcon;
  progress: number;
};

export type TaskPriority = "must" | "should" | "could";
export type TaskStatus = "not_started" | "in_progress" | "approval_pending" | "done";

export type TaskSummary = {
  id: string;
  title: string;
  projectName: string;
  assigneeName: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
};

export type NotificationSummary = {
  id: string;
  type: "approval" | "ai" | "task" | "comment";
  title: string;
  subtitle: string;
  timeLabel: string;
  unread?: boolean;
};

export const navItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "issues", label: "Issues", icon: ClipboardList },
  { key: "tasks", label: "Tasks", icon: CheckCircle2 },
  { key: "approvals", label: "Approvals", icon: ShieldCheck, badge: 5 },
  { key: "teams", label: "Teams", icon: Users },
  { key: "tauros_ai", label: "TaurosAI", icon: Bot },
  { key: "ai", label: "AI Suggestions", icon: Sparkles, badge: 8 },
  { key: "reports", label: "Reports", icon: PieChart },
  { key: "logs", label: "Activity Logs", icon: Activity },
  { key: "settings", label: "Settings", icon: ListChecks },
];

export const kpis: DashboardKpi[] = [
  { label: "今日締切", value: 6, suffix: "件", diffLabel: "昨日比 +2", color: "red", icon: CalendarDays, progress: 48 },
  { label: "期限超過", value: 4, suffix: "件", diffLabel: "昨日比 +1", color: "red", icon: CircleAlert, progress: 42 },
  { label: "承認待ち", value: 7, suffix: "件", diffLabel: "昨日比 +3", color: "purple", icon: ShieldCheck, progress: 55 },
  { label: "高優先度", value: 9, suffix: "件", diffLabel: "昨日比 +2", color: "orange", icon: Flag, progress: 62 },
  { label: "未担当タスク", value: 3, suffix: "件", diffLabel: "昨日比 -1", color: "green", icon: Users, progress: 36 },
  { label: "AI提案候補", value: 5, suffix: "件", diffLabel: "昨日比 ±0", color: "blue", icon: Bot, progress: 44 },
];

export const myTasks: TaskSummary[] = [
  {
    id: "my-1",
    title: "営業研修資料の更新",
    projectName: "営業力強化プロジェクト",
    assigneeName: "山田太郎",
    dueDate: "05/31",
    priority: "must",
    status: "in_progress",
    progress: 60,
  },
  {
    id: "my-2",
    title: "新システム導入検討",
    projectName: "システム刷新PJ",
    assigneeName: "山田太郎",
    dueDate: "05/31",
    priority: "should",
    status: "approval_pending",
    progress: 30,
  },
  {
    id: "my-3",
    title: "顧客データ分析レポート",
    projectName: "データ活用PJ",
    assigneeName: "山田太郎",
    dueDate: "05/31",
    priority: "must",
    status: "in_progress",
    progress: 80,
  },
  {
    id: "my-4",
    title: "採用面談日程調整",
    projectName: "採用プロジェクト",
    assigneeName: "山田太郎",
    dueDate: "06/01",
    priority: "should",
    status: "not_started",
    progress: 0,
  },
  {
    id: "my-5",
    title: "販促促進キャンペーン計画",
    projectName: "マーケティングPJ",
    assigneeName: "山田太郎",
    dueDate: "06/02",
    priority: "could",
    status: "not_started",
    progress: 20,
  },
];

export const kanbanColumns: Array<{
  id: TaskStatus;
  title: string;
  count: number;
  tone: string;
  tasks: TaskSummary[];
  more: number;
}> = [
  {
    id: "not_started",
    title: "未着手",
    count: 12,
    tone: "bg-slate-50",
    more: 10,
    tasks: [
      { id: "k1", title: "営業マニュアル改訂", projectName: "営業部", assigneeName: "山田花子", dueDate: "05/28", priority: "should", status: "not_started", progress: 0 },
      { id: "k2", title: "オフィスレイアウト変更", projectName: "総務部", assigneeName: "佐藤一郎", dueDate: "06/05", priority: "could", status: "not_started", progress: 0 },
    ],
  },
  {
    id: "in_progress",
    title: "進行中",
    count: 18,
    tone: "bg-blue-50",
    more: 16,
    tasks: [
      { id: "k3", title: "新商品企画立案", projectName: "商品企画", assigneeName: "鈴木太郎", dueDate: "05/30", priority: "must", status: "in_progress", progress: 45 },
      { id: "k4", title: "予算編成2025", projectName: "財務部", assigneeName: "田中美咲", dueDate: "06/03", priority: "must", status: "in_progress", progress: 62 },
    ],
  },
  {
    id: "approval_pending",
    title: "承認待ち",
    count: 7,
    tone: "bg-orange-50",
    more: 5,
    tasks: [
      { id: "k5", title: "研修ルール策定", projectName: "人事部", assigneeName: "山田花子", dueDate: "05/29", priority: "should", status: "approval_pending", progress: 90 },
      { id: "k6", title: "システム導入契約", projectName: "情シス", assigneeName: "佐藤一郎", dueDate: "05/31", priority: "must", status: "approval_pending", progress: 85 },
    ],
  },
  {
    id: "done",
    title: "完了",
    count: 21,
    tone: "bg-emerald-50",
    more: 5,
    tasks: [
      { id: "k7", title: "顧客アンケート実施", projectName: "販売部", assigneeName: "鈴木太郎", dueDate: "05/20", priority: "could", status: "done", progress: 100 },
      { id: "k8", title: "4月売上報告", projectName: "販売部", assigneeName: "田中美咲", dueDate: "05/18", priority: "could", status: "done", progress: 100 },
    ],
  },
];

export const notifications: NotificationSummary[] = [
  { id: "n1", type: "approval", title: "研修ルール策定", subtitle: "山田花子さんからの申請", timeLabel: "2026/06/03 09:20", unread: true },
  { id: "n2", type: "approval", title: "システム導入契約", subtitle: "佐藤一郎さんからの申請", timeLabel: "2026/06/03 10:05", unread: true },
  { id: "n3", type: "ai", title: "メールからタスク候補", subtitle: "新規引合からの問い合わせ", timeLabel: "2026/06/03 10:40", unread: true },
  { id: "n4", type: "comment", title: "返信案の承認", subtitle: "クレーム対応メール", timeLabel: "2026/06/03 11:10" },
  { id: "n5", type: "task", title: "会議アジェンダ案", subtitle: "営業会議（6/5）", timeLabel: "2026/06/03 11:35" },
];

export const dueDateChartData = [
  { name: "今日", value: 6, fill: "#D6001C" },
  { name: "今週", value: 18, fill: "#F59E0B" },
  { name: "来週", value: 12, fill: "#94A3B8" },
  { name: "今月以降", value: 25, fill: "#10B981" },
  { name: "期限未定", value: 7, fill: "#A3A3A3" },
];

export const departmentProgress = [
  { department: "営業部", progress: 75 },
  { department: "買取部", progress: 62 },
  { department: "販売部", progress: 48 },
  { department: "総務部", progress: 70 },
  { department: "システム部", progress: 85 },
];

export const recentActivities = [
  { text: "新システム導入検討のタスクが更新されました", time: "2026/06/03 09:20" },
  { text: "システム導入契約が承認されました", time: "2026/06/03 10:05" },
  { text: "研修資料の更新にコメントされました", time: "2026/06/03 10:40" },
  { text: "販促促進キャンペーン計画がタスク化されました", time: "2026/06/03 11:10" },
];

export const aiRoadmap = [
  { label: "Gmail連携", icon: Mail },
  { label: "LINE連携", icon: MessageCircle },
  { label: "サイボウズ連携", icon: Inbox },
  { label: "AI要約・分類", icon: Sparkles },
  { label: "タスク候補化", icon: CheckCircle2 },
  { label: "人間承認", icon: Users },
  { label: "TeamOSへ登録", icon: ClipboardList },
];

export const designMode = false;

export const pageDemo = {
  inbox: [
    { source: "Gmail", title: "見積回答の確認依頼", summary: "先方が本日中の回答を希望。AIが返信案を作成済み。", status: "要確認" },
    { source: "LINE", title: "現場到着遅延の連絡", summary: "担当者より15分遅延。顧客共有の候補あり。", status: "返信案" },
    { source: "サイボウズ", title: "経費精算の承認通知", summary: "交通費精算 12,840円。規定内の候補です。", status: "承認待ち" },
  ],
  issues: [
    { id: "ISS-001", title: "MVV共有と判断基準の統一", department: "ALL", owner: "未設定", priority: "Should", status: "未着手", due: "06/30", createdAt: "2026/06/03 09:00" },
    { id: "ISS-002", title: "買取営業の研修ルール徹底", department: "買取営業", owner: "佐藤", priority: "Should", status: "進行中", due: "06/14", createdAt: "2026/06/03 09:30" },
    { id: "ISS-003", title: "USB/端末管理による情報漏洩対策", department: "情シス", owner: "鈴木", priority: "Must", status: "承認待ち", due: "06/10", createdAt: "2026/06/03 10:00" },
  ],
  approvals: [
    { id: "APR-001", type: "重要タスクの実施承認", target: "USB/端末管理", requester: "鈴木", priority: "must", dueDate: "06/10", status: "承認待ち", sourceIssueId: "ISS-003" },
    { id: "APR-002", type: "課題の完了承認", target: "回送ナンバー管理ルール", requester: "高橋", priority: "should", dueDate: "06/14", status: "申請中", sourceIssueId: "ISS-002" },
    { id: "APR-003", type: "返信承認", target: "見積回答メール", requester: "AI Secretary", priority: "must", dueDate: "06/04", status: "承認待ち", sourceIssueId: "ISS-001" },
  ],
  teams: [
    { team: "営業本部", department: "営業", manager: "山田 太郎", members: 12 },
    { team: "管理本部", department: "総務・労務・財務", manager: "田中 美咲", members: 8 },
    { team: "システム推進", department: "情シス", manager: "鈴木 太郎", members: 5 },
  ],
  logs: [
    { actor: "山田 太郎", action: "Statusを承認待ちに変更", target: "USB/端末管理", time: "2026/06/03 09:20" },
    { actor: "佐藤 一郎", action: "コメントを追加", target: "研修ルール策定", time: "2026/06/03 10:05" },
    { actor: "AI Secretary", action: "タスク候補を作成", target: "見積回答メール", time: "2026/06/03 10:40" },
  ],
};
