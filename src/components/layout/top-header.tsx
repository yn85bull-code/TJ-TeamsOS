"use client";

import { Bell, CheckCircle2, ChevronDown, CircleHelp, LogOut, Plus, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import { navItems } from "@/lib/dashboard-demo-data";
import { AuthUser } from "@/lib/auth-demo-data";
import type { AppNotificationEntry } from "@/lib/workspace/notification-store";
import { useMemo, useState } from "react";

const descriptions: Record<string, string> = {
  dashboard: "チーム全体の状況、期限、承認、AI提案をリアルタイムに確認します。",
  issues: "課題を親として登録し、タスク化と承認申請まで管理します。",
  tasks: "担当タスクの進捗、ToDoメモ、承認申請の状態を確認します。",
  approvals: "承認待ちの申請を確認し、コメント付きで承認・差し戻しします。",
  teams: "部門、役職、メンバー、権限ランクを管理します。",
  ai: "Gmail、LINE、サイボウズ、AI提案候補を人間承認前に確認します。",
  reports: "将来の出力用レポート領域です。現状はダッシュボード集計を優先します。",
  logs: "誰が、いつ、何を変更したかを監査ログとして確認します。",
  settings: "通知、権限、外部連携、AI連携、承認ルールを管理します。",
};

const navLabels: Record<string, string> = {
  dashboard: "Dashboard",
  issues: "Issues",
  tasks: "Tasks",
  approvals: "Approvals",
  teams: "Teams",
  ai: "AI Suggestions",
  reports: "Reports",
  logs: "Activity Logs",
  settings: "Settings",
};

const searchIndex = [
  { title: "期限超過タスク", subtitle: "タスク一覧で期限超過を確認", target: "tasks" },
  { title: "承認待ち申請", subtitle: "承認ページで最終確認", target: "approvals" },
  { title: "AI提案候補", subtitle: "Gmail / LINE / サイボウズ連携候補", target: "ai" },
  { title: "課題一覧", subtitle: "課題からタスク化・承認申請へ進める", target: "issues" },
  { title: "権限設定", subtitle: "権限ランクとメンバー権限を管理", target: "settings" },
  { title: "アクティビティログ", subtitle: "操作履歴と監査ログを確認", target: "logs" },
];

const demoHeaderNotifications: AppNotificationEntry[] = [
  { id: "h1", title: "研修ルール策定の承認待ち", detail: "山田花子さんから申請", time: "2026/06/03 09:20", target: "approvals" },
  { id: "h2", title: "メールからタスク候補", detail: "AI Secretaryが候補を作成", time: "2026/06/03 10:40", target: "ai" },
  { id: "h3", title: "進捗報告が更新されました", detail: "営業研修資料の更新", time: "2026/06/03 11:10", target: "tasks" },
];

const headerNotifications = demoHeaderNotifications;

export function TopHeader({
  title,
  activeKey,
  user,
  canCreate,
  onSelect,
  onCreate,
  onLogout,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}: {
  title: string;
  activeKey: string;
  user: AuthUser;
  canCreate: boolean;
  onSelect: (key: string) => void;
  onCreate: () => void;
  onLogout: () => void;
  notifications?: AppNotificationEntry[];
  onMarkNotificationRead?: (notification: AppNotificationEntry) => void;
  onMarkAllNotificationsRead?: (notifications: AppNotificationEntry[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [openPanel, setOpenPanel] = useState<"notifications" | "help" | "account" | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const notificationItems = notifications ?? demoHeaderNotifications;
  const unreadCount = notificationItems.filter((item) => !isNotificationRead(item, readNotificationIds)).length;
  const displayTitle = navLabels[activeKey] ?? title;
  const searchResults = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return searchIndex.slice(0, 4);
    return searchIndex.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(keyword));
  }, [query]);

  const selectPanel = (panel: "notifications" | "help" | "account") => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const navigate = (key: string) => {
    onSelect(key);
    setOpenPanel(null);
    setSearchFocused(false);
    setQuery("");
  };

  const markNotificationRead = (notification: AppNotificationEntry) => {
    setReadNotificationIds((ids) => [...new Set([...ids, notification.id])]);
    onMarkNotificationRead?.(notification);
    navigate(notification.target);
  };

  const markAllNotificationsRead = () => {
    setReadNotificationIds((ids) => [...new Set([...ids, ...notificationItems.map((item) => item.id)])]);
    onMarkAllNotificationsRead?.(notificationItems);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur lg:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{displayTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{descriptions[activeKey] ?? "Tauros TeamOSの状態を確認できます。"}</p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end xl:min-w-0">
          <div className="relative w-full md:w-[380px] xl:min-w-[320px]">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#D6001C] focus:ring-4 focus:ring-red-100"
                placeholder="検索（タスク・課題・メンバー・設定など）"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => {
                  setSearchFocused(true);
                  setOpenPanel(null);
                }}
                onClick={() => {
                  setSearchFocused(true);
                  setOpenPanel(null);
                }}
              />
            </label>
            {query || searchFocused ? (
              <div className="absolute right-0 top-12 z-30 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-2 py-1 text-xs font-bold text-slate-500">検索候補</p>
                <div className="grid gap-1">
                  {searchResults.map((item) => (
                    <button key={item.title} className="rounded-lg px-3 py-2 text-left hover:bg-slate-50" type="button" onClick={() => navigate(item.target)}>
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
                    </button>
                  ))}
                  {searchResults.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">該当する候補がありません</p> : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative flex shrink-0 items-center gap-2">
            <button className="relative grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#D6001C]" type="button" onClick={() => selectPanel("notifications")} aria-label="通知">
              <Bell size={18} />
              {unreadCount ? <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#D6001C] text-[10px] font-bold text-white">{unreadCount}</span> : null}
            </button>
            <button className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#D6001C]" type="button" onClick={() => selectPanel("help")} aria-label="ヘルプ">
              <CircleHelp size={18} />
            </button>
            <button className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 shadow-sm hover:border-[#D6001C]" type="button" onClick={() => selectPanel("account")} aria-label="アカウントメニュー">
              <div className="grid size-8 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">{user.initial}</div>
              <div className="text-left text-sm">
                <p className="font-semibold leading-4">{user.name}</p>
                <p className="text-[11px] text-slate-500">{user.position} / {user.role}</p>
              </div>
              <ChevronDown size={16} className="text-slate-500" />
            </button>
            <button
              className="inline-flex h-11 min-w-[136px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              type="button"
              disabled={!canCreate}
              title={canCreate ? "新規作成" : "この権限では新規作成できません"}
              onClick={onCreate}
            >
              <Plus size={16} />
              新規作成
            </button>

            {openPanel === "notifications" ? (
              <HeaderPanel className="right-[172px]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">通知</h3>
                  <button className="text-xs font-bold text-[#D6001C]" type="button" onClick={markAllNotificationsRead}>すべて既読</button>
                </div>
                <div className="mt-3 grid gap-2">
                  {notificationItems.map((item) => {
                    const unread = !isNotificationRead(item, readNotificationIds);
                    return (
                      <button key={item.id} className="rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50" type="button" onClick={() => markNotificationRead(item)}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900">{item.title}</p>
                          {unread ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#D6001C]">未読</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                        <p className="mt-2 font-mono text-[11px] font-semibold text-slate-500">{item.time}</p>
                      </button>
                    );
                  })}
                  {notificationItems.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-500">通知はありません</p>
                  ) : null}
                </div>
              </HeaderPanel>
            ) : null}

            {false && openPanel === "notifications" ? (
              <HeaderPanel className="right-[172px]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">通知</h3>
                  <button className="text-xs font-bold text-[#D6001C]" type="button" onClick={() => setReadNotificationIds(headerNotifications.map((item) => item.id))}>すべて既読</button>
                </div>
                <div className="mt-3 grid gap-2">
                  {headerNotifications.map((item) => {
                    const unread = !readNotificationIds.includes(item.id);
                    return (
                      <button key={item.id} className="rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50" type="button" onClick={() => navigate(item.target)}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900">{item.title}</p>
                          {unread ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#D6001C]">未読</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                        <p className="mt-2 font-mono text-[11px] font-semibold text-slate-500">{item.time}</p>
                      </button>
                    );
                  })}
                </div>
              </HeaderPanel>
            ) : null}

            {openPanel === "help" ? (
              <HeaderPanel className="right-[122px]">
                <h3 className="font-bold">ヘルプ</h3>
                <div className="mt-3 grid gap-3 text-sm">
                  <HelpItem title="最終承認は人間が行う" body="AI提案や返信案は下書きとして保持し、承認前に自動登録・送信しません。" />
                  <HelpItem title="権限はログインユーザー単位" body="Supabase AuthのユーザーIDに部門・役職・権限ランクを紐づける想定です。" />
                  <HelpItem title="外部連携は段階実装" body="Gmail、LINE、サイボウズはOAuth/API接続後、設定画面でON/OFF管理します。" />
                </div>
                <button className="mt-4 h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700" type="button" onClick={() => navigate("settings")}>設定を見る</button>
              </HeaderPanel>
            ) : null}

            {openPanel === "account" ? (
              <HeaderPanel className="right-[62px]">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full bg-slate-200 font-bold">{user.initial}</div>
                  <div>
                    <h3 className="font-bold">{user.name}</h3>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <AccountRow icon={<UserRound size={16} />} label="所属" value={`${user.department} / ${user.position}`} />
                  <AccountRow icon={<ShieldCheck size={16} />} label="権限" value={user.role} />
                  <AccountRow icon={<CheckCircle2 size={16} />} label="ログイン" value={user.authSource === "supabase" ? "Supabase Auth" : "デモ"} />
                </div>
                <div className="mt-4 grid gap-2">
                  <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700" type="button" onClick={() => navigate("settings")}><Settings size={15} />アカウント設定</button>
                  <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C]" type="button" onClick={onLogout}><LogOut size={15} />ログアウト</button>
                </div>
              </HeaderPanel>
            ) : null}
          </div>
        </div>
      </div>
      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeKey;
          const label = navLabels[item.key] ?? item.label;
          return (
            <button
              key={item.key}
              aria-label={label}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-bold ${
                active ? "bg-[#D6001C] text-white" : "bg-slate-100 text-slate-700"
              }`}
              type="button"
              onClick={() => onSelect(item.key)}
            >
              <Icon size={16} />
              {label}
              {item.badge ? <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/20" : "bg-[#D6001C] text-white"}`}>{item.badge}</span> : null}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function HeaderPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`absolute top-12 z-30 w-[330px] rounded-xl border border-slate-200 bg-white p-4 shadow-xl ${className}`}>{children}</div>;
}

function isNotificationRead(notification: AppNotificationEntry, readNotificationIds: string[]) {
  return Boolean(notification.readAt) || readNotificationIds.includes(notification.id);
}

function HelpItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
    </div>
  );
}

function AccountRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
      <span className="flex items-center gap-2 text-slate-500">{icon}{label}</span>
      <strong className="text-right text-slate-900">{value}</strong>
    </div>
  );
}
