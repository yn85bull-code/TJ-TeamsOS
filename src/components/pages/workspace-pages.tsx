"use client";

import { PanelCard, PriorityBadge, ProgressBar, StatusBadge } from "@/components/ui/dashboard-ui";
import { can, getTaurosAiPermissionFlags } from "@/lib/domain/permissions";
import { normalizePriority, sortByPriorityAndDueDate } from "@/lib/domain/priority";
import { departmentProgress, kanbanColumns, myTasks, pageDemo, TaskPriority, TaskStatus, TaskSummary } from "@/lib/dashboard-demo-data";
import { loadLocalTaskRecords, saveLocalTaskRecords, saveTaskRecord } from "@/lib/tasks/task-record-store";
import { DEFAULT_DEPARTMENTS, normalizeDepartmentList } from "@/lib/workspace/department-store";
import { OPERATIONAL_ROLE_OPTIONS, TeamProfileEntry, demoUsersToProfiles, getRoleLabel, inviteTeamUser, loadTeamProfilesFromSupabase, updateProfileDepartmentAndPositionInSupabase, updateProfileRoleInSupabase } from "@/lib/workspace/profile-store";
import { AppRole } from "@/types/database";
import { BookOpen, Bot, Building2, ClipboardList, Clock, Database, FileText, Inbox, ListChecks, LockKeyhole, Search, Send, ShieldCheck, Trash2, Upload, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type NavigateHandler = {
  onNavigate?: (key: string) => void;
  onAddLog?: (log: ActivityLogEntry) => void;
  onCreateTask?: (task: CreatedTaskEntry) => void;
  onUpdateIssue?: (issue: CreatedIssueEntry) => void;
  onUpdateTask?: (task: CreatedTaskEntry) => void;
  onDeleteIssue?: (issue: CreatedIssueEntry) => void;
  onRestoreIssue?: (issue: CreatedIssueEntry) => void;
  createdIssues?: CreatedIssueEntry[];
  currentUserName?: string;
  currentUserId?: string;
  currentUserDepartment?: string;
  appRole?: AppRole;
  departmentOptions?: string[];
};

export type ActivityLogEntry = {
  id?: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
  time: string;
  targetId?: string;
  targetType?: string;
  supabaseId?: string;
};

export type ApprovalHistoryEntry = {
  id: string;
  type: string;
  target: string;
  requester: string;
  reviewerName?: string;
  finalApproverName?: string;
  approvedBy: string;
  approvedAt: string;
  comment: string;
  issueCreatedAt: string;
  supabaseId?: string;
};

export type ApprovalRequestEntry = {
  id: string;
  type: string;
  target: string;
  requester: string;
  requesterId?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewComment?: string;
  finalApproverId?: string;
  finalApproverName?: string;
  priority: TaskPriority;
  dueDate: string;
  status: string;
  sourceIssueId?: string;
  taskId?: string;
  taskSupabaseId?: string;
  requestedAt?: string;
  issueCreatedAt?: string;
  body?: string;
  supabaseId?: string;
};

export type ApprovalReviewerOption = {
  id: string;
  name: string;
  role: string;
};

export type SendbackTaskEntry = TaskSummary & {
  sendbackReason: string;
  sentBackAt: string;
};

export type CreatedTaskEntry = TaskSummary & {
  sourceType?: "issue" | "direct";
  sourceIssueId: string;
  sourceIssueSupabaseId?: string;
  issueCreatedAt: string;
  taskizedAt: string;
  responsiblePerson: string;
  assigneePerson: string;
  supabaseId?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedById?: string;
};

export type CreatedIssueEntry = {
  id: string;
  title: string;
  department: string;
  owner: string;
  priority: string;
  status: string;
  due: string;
  createdAt: string;
  category1: string;
  category2: string;
  asIs: string;
  toBe?: string;
  supabaseId?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedById?: string;
};

export type TaskUpdate = {
  at: string;
  memo: string;
  progress: number;
  achievementMemo?: string;
  nextActionMemo?: string;
};

export type TaskRecord = {
  progress: number;
  todoMemo: string;
  achievementMemo?: string;
  nextActionMemo?: string;
  updates: TaskUpdate[];
  approvalToBe?: string;
  approvalRequestedAt?: string;
};

type TaskAction = {
  taskId: string;
  mode: "progress" | "approval";
} | null;

type ApprovalAction = {
  approvalId: string;
  mode: "review" | "approve" | "sendback";
} | null;

function useAutoScrollPanel(trigger: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!trigger || typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      ref.current?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [trigger]);

  return ref;
}

type ApprovalsPageProps = NavigateHandler & {
  approvalRequests?: ApprovalRequestEntry[];
  resolvedApprovalIds?: string[];
  onResolveApproval?: (approval: ApprovalRequestEntry, mode: "approve" | "sendback", comment: string) => void;
  onReviewApproval?: (approval: ApprovalRequestEntry, comment: string) => void;
  onSendBackTask?: (task: SendbackTaskEntry) => void;
  approvalHistory?: ApprovalHistoryEntry[];
  onRecordApproval?: (entry: ApprovalHistoryEntry) => void;
};

export function IssuesPage({ onNavigate, onAddLog, onCreateTask, onUpdateIssue, onDeleteIssue, onRestoreIssue, createdIssues = [], currentUserName = "山田 太郎", currentUserId, currentUserDepartment, appRole = "member", departmentOptions = DEFAULT_DEPARTMENTS }: NavigateHandler) {
  const [actionMessage, setActionMessage] = useState("課題を選んで、詳細確認・タスク化・削除を行えます。");
  const [deletedIssueIds, setDeletedIssueIds] = useState<string[]>([]);
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null);
  const [editIssueId, setEditIssueId] = useState<string | null>(null);
  const [taskizeIssueId, setTaskizeIssueId] = useState<string | null>(null);
  const [deleteIssueId, setDeleteIssueId] = useState<string | null>(null);
  const [panelScrollToken, setPanelScrollToken] = useState(0);
  const [responsiblePerson, setResponsiblePerson] = useState("山田 太郎");
  const [assigneePerson, setAssigneePerson] = useState("未選択");
  const flowSteps = ["課題登録", "タスク振り分け", "担当者が実行", "完了報告", "承認後に完了"];
  const activeCreatedIssues = useMemo(() => createdIssues.filter((issue) => !issue.deletedAt), [createdIssues]);
  const deletedCreatedIssues = useMemo(() => createdIssues.filter((issue) => issue.deletedAt), [createdIssues]);
  const allIssues = useMemo(() => [...activeCreatedIssues, ...pageDemo.issues], [activeCreatedIssues]);
  const visibleIssues = allIssues
    .filter((issue) => !deletedIssueIds.includes(issue.id))
    .filter((issue) => canViewIssueForUser(issue, currentUserName, currentUserId, currentUserDepartment, appRole));
  const detailIssue = detailIssueId ? allIssues.find((issue) => issue.id === detailIssueId) : undefined;
  const editIssue = editIssueId ? createdIssues.find((issue) => issue.id === editIssueId) : undefined;
  const taskizeIssue = taskizeIssueId ? allIssues.find((issue) => issue.id === taskizeIssueId) : undefined;
  const pendingDeleteIssue = deleteIssueId ? allIssues.find((issue) => issue.id === deleteIssueId) : undefined;
  const memberOptions = useMemo(
    () => uniquePersonOptions(["未選択", currentUserName, "山田 太郎", "山田 花子", "佐藤 一郎", "鈴木 太郎", "田中 美咲", "高橋 健"]),
    [currentUserName],
  );
  const canDeleteIssues = can(appRole, "issues", "delete");
  const detailPanelRef = useAutoScrollPanel(detailIssueId ? `${detailIssueId}-${panelScrollToken}` : null);
  const editPanelRef = useAutoScrollPanel(editIssueId ? `${editIssueId}-${panelScrollToken}` : null);
  const deletePanelRef = useAutoScrollPanel(deleteIssueId ? `${deleteIssueId}-${panelScrollToken}` : null);
  const taskizePanelRef = useAutoScrollPanel(taskizeIssueId ? `${taskizeIssueId}-${panelScrollToken}` : null);

  const requestPanelScroll = () => {
    setPanelScrollToken((token) => token + 1);
  };

  const openDetail = (issueId: string) => {
    setDetailIssueId(issueId);
    setEditIssueId(null);
    setTaskizeIssueId(null);
    setDeleteIssueId(null);
    setActionMessage(`${issueId} の詳細を表示しています。下の登録内容を確認してください。`);
    requestPanelScroll();
  };

  const openEdit = (issueId: string) => {
    setEditIssueId(issueId);
    setDetailIssueId(null);
    setTaskizeIssueId(null);
    setDeleteIssueId(null);
    setActionMessage(`${issueId} の編集画面を表示しています。下の入力欄から変更してください。`);
    requestPanelScroll();
  };

  const openTaskize = (issueId: string) => {
    setTaskizeIssueId(issueId);
    setResponsiblePerson(currentUserName || "山田 太郎");
    setAssigneePerson("未選択");
    setDetailIssueId(null);
    setEditIssueId(null);
    setDeleteIssueId(null);
    setActionMessage(`${issueId} のタスク化準備中です。担当責任者と担当者を選択してください。`);
    requestPanelScroll();
  };

  const confirmTaskize = () => {
    if (!taskizeIssue) return;
    const assignees = [responsiblePerson, assigneePerson].filter((person) => person !== "未選択");
    const uniqueAssignees = [...new Set(assignees)];
    const timestamp = formatDateTime(new Date());
    setActionMessage(`${taskizeIssue.id} をタスク化しました。発生日: ${taskizeIssue.createdAt}。担当: ${uniqueAssignees.join(" / ")}。2名選任時は2名とも担当者として運用します。`);
    onCreateTask?.({
      id: `task-${taskizeIssue.id}`,
      title: taskizeIssue.title,
      projectName: taskizeIssue.department,
      assigneeName: uniqueAssignees.join(" / ") || responsiblePerson,
      dueDate: taskizeIssue.due,
      priority: normalizePriority(taskizeIssue.priority),
      status: "not_started",
      progress: 0,
      sourceType: "issue",
      sourceIssueId: taskizeIssue.id,
      sourceIssueSupabaseId: getIssueSupabaseId(taskizeIssue),
      issueCreatedAt: taskizeIssue.createdAt,
      taskizedAt: timestamp,
      responsiblePerson,
      assigneePerson,
      createdByName: currentUserName,
    });
    onAddLog?.({
      actor: currentUserName,
      action: `課題をタスク化。発生日: ${taskizeIssue.createdAt} / 担当責任者: ${responsiblePerson} / 担当者: ${assigneePerson}`,
      target: taskizeIssue.title,
      time: timestamp,
    });
    setTaskizeIssueId(null);
    onNavigate?.("tasks");
  };

  const openDeleteConfirm = (issueId: string) => {
    setDeleteIssueId(issueId);
    setDetailIssueId(null);
    setEditIssueId(null);
    setTaskizeIssueId(null);
    setActionMessage(`${issueId} はまだ削除されていません。下の確認アナウンスを読んで、必要な場合だけ削除を確定してください。`);
    requestPanelScroll();
  };

  const confirmDeleteIssue = () => {
    if (!pendingDeleteIssue) return;
    const createdIssue = getCreatedIssue(pendingDeleteIssue);
    setDeletedIssueIds((ids) => [...new Set([...ids, pendingDeleteIssue.id])]);
    setActionMessage(`${pendingDeleteIssue.id} を一覧から削除しました。削除操作はアクティビティログに記録されています。`);
    if (createdIssue) {
      onDeleteIssue?.({
        ...createdIssue,
        deletedAt: formatDateTime(new Date()),
        deletedById: currentUserId,
      });
    }
    if (!createdIssue) {
      onAddLog?.({
        actor: currentUserName,
        action: "課題を一覧から削除",
        target: pendingDeleteIssue.title,
        targetId: getIssueSupabaseId(pendingDeleteIssue),
        targetType: "issue",
        time: formatDateTime(new Date()),
      });
    }
    setDeleteIssueId(null);
  };

  const restoreIssue = (issue: CreatedIssueEntry) => {
    const { deletedAt: _deletedAt, deletedById: _deletedById, ...restoredIssue } = issue;
    setDeletedIssueIds((ids) => ids.filter((id) => id !== issue.id));
    onRestoreIssue?.(restoredIssue);
    setActionMessage(`${issue.id} を復元しました。課題一覧に戻しています。`);
  };

  return (
    <PageFrame title="課題" lead="課題を親として登録し、その中からタスクを振り分けます。タスク完了後に承認申請し、承認されて初めて完了扱いにします。">
      <PanelCard className="p-5">
        <h3 className="font-bold">基本フロー</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {flowSteps.map((step, index) => (
            <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="grid size-7 place-items-center rounded-full bg-[#D6001C] text-xs font-black text-white">{index + 1}</span>
              <p className="mt-3 text-sm font-bold text-slate-900">{step}</p>
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">課題一覧</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">{actionMessage}</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input className="h-10 rounded-lg border border-slate-200 pl-9 pr-3 text-sm" placeholder="課題を検索" />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">課題</th>
                <th className="p-3">部門</th>
                <th className="p-3">登録者</th>
                <th className="p-3">優先度</th>
                <th className="p-3">Status</th>
                <th className="p-3">期限</th>
                <th className="w-[300px] whitespace-nowrap p-3">次の操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleIssues.map((issue) => {
                const createdIssue = getCreatedIssue(issue);
                const canEditThisIssue = createdIssue ? canEditCreatedIssue(createdIssue, currentUserName, appRole, currentUserId) : false;
                const canTaskizeThisIssue = createdIssue ? canEditThisIssue : canViewAllWork(appRole);
                return (
                  <tr key={issue.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                    <td className="p-3 font-mono text-xs text-slate-500">{issue.id}</td>
                    <td className="p-3 font-semibold">{issue.title}</td>
                    <td className="p-3">{issue.department}</td>
                    <td className="p-3">{issue.owner}</td>
                    <td className="p-3"><IssuePriorityBadge priority={issue.priority} /></td>
                    <td className="p-3"><IssueStatusBadge status={issue.status} /></td>
                    <td className="p-3 font-bold text-[#D6001C]">{issue.due}</td>
                    <td className="min-w-[300px] p-3">
                      <div className="flex flex-nowrap gap-2 whitespace-nowrap">
                        <button className="inline-flex h-10 min-w-[56px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C]" type="button" onClick={() => openDetail(issue.id)}>
                          詳細
                        </button>
                        {createdIssue ? (
                          <button
                            className="inline-flex h-10 min-w-[56px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300"
                            type="button"
                            disabled={!canEditThisIssue}
                            onClick={() => openEdit(createdIssue.id)}
                          >
                            編集
                          </button>
                        ) : null}
                        <button className="inline-flex h-10 min-w-[80px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300" type="button" disabled={!canTaskizeThisIssue} onClick={() => openTaskize(issue.id)}>
                          タスク化
                        </button>
                        <button className="inline-flex h-10 min-w-[56px] items-center justify-center whitespace-nowrap rounded-lg bg-slate-800 px-3 text-xs font-bold text-white hover:bg-slate-950 disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canDeleteIssues} onClick={() => openDeleteConfirm(issue.id)}>
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleIssues.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-sm text-slate-500" colSpan={8}>表示中の課題はありません。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {deletedCreatedIssues.length > 0 ? (
        <PanelCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">削除済み課題</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">論理削除された課題です。必要な場合は復元できます。</p>
            </div>
            <span className="rounded bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{deletedCreatedIssues.length}件</span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">課題</th>
                  <th className="p-3">部門</th>
                  <th className="p-3">削除日時</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {deletedCreatedIssues.map((issue) => (
                  <tr key={`deleted-${issue.id}`} className="border-b border-slate-100">
                    <td className="p-3 font-mono text-xs text-slate-500">{issue.id}</td>
                    <td className="p-3 font-semibold">{issue.title}</td>
                    <td className="p-3">{issue.department}</td>
                    <td className="p-3 font-mono text-xs text-slate-600">{issue.deletedAt ?? "未設定"}</td>
                    <td className="p-3">
                      <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300" type="button" disabled={!canDeleteIssues} onClick={() => restoreIssue(issue)}>
                        復元
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      ) : null}

      {detailIssue ? (
        <div ref={detailPanelRef} className="scroll-mt-24">
          <PanelCard className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#D6001C]">登録内容</p>
                <h3 className="mt-1 font-bold">{detailIssue.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{detailIssue.id} / {detailIssue.department} / 期限 {detailIssue.due} / 登録日時 {detailIssue.createdAt}</p>
              </div>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" type="button" onClick={() => setDetailIssueId(null)}>閉じる</button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <DetailBox label="課題分類大区分" value={getIssueCategory1(detailIssue)} />
              <DetailBox label="課題分類小区分" value={getIssueCategory2(detailIssue)} />
              <DetailBox label="登録者" value={detailIssue.owner} />
              <DetailBox label="登録日時 / 発生日" value={detailIssue.createdAt} />
              <DetailBox label="As-Is" value={getIssueAsIsValue(detailIssue)} />
              <DetailBox label="To-Be" value={getIssueToBe(detailIssue)} />
            </div>
          </PanelCard>
        </div>
      ) : null}

      {editIssue ? (
        <div ref={editPanelRef} className="scroll-mt-24">
          <IssueEditPanel
            issue={editIssue}
            departmentOptions={departmentOptions}
            onCancel={() => setEditIssueId(null)}
            onSave={(issue) => {
              onUpdateIssue?.(issue);
              setEditIssueId(null);
              setActionMessage(`${issue.id} を更新しました。更新日時: ${issue.updatedAt}`);
            }}
          />
        </div>
      ) : null}

      {pendingDeleteIssue ? (
        <div ref={deletePanelRef} className="scroll-mt-24">
          <PanelCard className="border-red-200 bg-red-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#D6001C]">削除前の確認アナウンス</p>
                <h3 className="mt-1 font-bold text-slate-950">{pendingDeleteIssue.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  この操作を確定すると、課題一覧から非表示になります。間違って押した場合はキャンセルしてください。削除を確定した場合も、操作履歴はアクティビティログに残ります。
                </p>
                <p className="mt-2 text-xs font-bold text-slate-500">対象ID: {pendingDeleteIssue.id} / 登録日時: {pendingDeleteIssue.createdAt}</p>
              </div>
              <button className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600" type="button" onClick={() => setDeleteIssueId(null)}>
                閉じる
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white hover:bg-red-700" type="button" onClick={confirmDeleteIssue}>
                削除を確定
              </button>
              <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" type="button" onClick={() => setDeleteIssueId(null)}>
                キャンセル
              </button>
            </div>
          </PanelCard>
        </div>
      ) : null}

      {taskizeIssue ? (
        <div ref={taskizePanelRef} className="scroll-mt-24">
          <PanelCard className="border-[#D6001C]/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#D6001C]">タスク化</p>
              <h3 className="mt-1 font-bold">{taskizeIssue.title}</h3>
              <p className="mt-2 text-sm text-slate-500">担当責任者と担当者を最大2名まで選択できます。2名選任時は2名とも担当者として運用します。</p>
              <p className="mt-2 text-xs font-bold text-slate-500">発生日: {taskizeIssue.createdAt}</p>
            </div>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" type="button" onClick={() => setTaskizeIssueId(null)}>閉じる</button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              担当責任者
              <select className="h-10 rounded-lg border border-slate-200 px-3 font-normal" value={responsiblePerson} onChange={(event) => setResponsiblePerson(event.target.value)}>
                {memberOptions.filter((person) => person !== "未選択").map((person) => <option key={person}>{person}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              担当者
              <select className="h-10 rounded-lg border border-slate-200 px-3 font-normal" value={assigneePerson} onChange={(event) => setAssigneePerson(event.target.value)}>
                {memberOptions.map((person) => <option key={person}>{person}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white" type="button" onClick={confirmTaskize}>担当を確定してタスク化</button>
            <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700" type="button" onClick={() => setTaskizeIssueId(null)}>キャンセル</button>
          </div>
          </PanelCard>
        </div>
      ) : null}
    </PageFrame>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function IssueEditPanel({
  issue,
  departmentOptions = DEFAULT_DEPARTMENTS,
  onCancel,
  onSave,
}: {
  issue: CreatedIssueEntry;
  departmentOptions?: string[];
  onCancel: () => void;
  onSave: (issue: CreatedIssueEntry) => void;
}) {
  const [title, setTitle] = useState(issue.title);
  const [department, setDepartment] = useState(issue.department);
  const [owner, setOwner] = useState(issue.owner);
  const [priority, setPriority] = useState(issue.priority);
  const [status, setStatus] = useState(issue.status);
  const [due, setDue] = useState(issue.due);
  const [category1, setCategory1] = useState(issue.category1);
  const [category2, setCategory2] = useState(issue.category2);
  const [asIs, setAsIs] = useState(issue.asIs);
  const [toBe, setToBe] = useState(issue.toBe ?? "");
  const departments = useMemo(
    () => normalizeDepartmentList([...departmentOptions, issue.department]),
    [departmentOptions, issue.department],
  );
  const canSave = Boolean(title.trim() && department.trim() && owner.trim() && due.trim() && asIs.trim() && toBe.trim());

  return (
    <PanelCard className="border-[#D6001C]/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[#D6001C]">課題編集</p>
          <h3 className="mt-1 font-bold">{issue.id}</h3>
          <p className="mt-2 text-xs font-bold text-slate-500">登録者: {issue.createdByName ?? "現在のユーザー"} / 登録日時: {issue.createdAt}</p>
        </div>
        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" type="button" onClick={onCancel}>
          閉じる
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          タイトル
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          部門
          <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={department} onChange={(event) => setDepartment(event.target.value)}>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          登録者
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={owner} onChange={(event) => setOwner(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          期限
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={due} onChange={(event) => setDue(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          優先度
          <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option>Must</option>
            <option>Should</option>
            <option>Could</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          ステータス
          <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>未着手</option>
            <option>進行中</option>
            <option>承認待ち</option>
            <option>完了</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          課題分類大区分
          <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={category1} onChange={(event) => setCategory1(event.target.value)}>
            <option>事業課題</option>
            <option>組織課題</option>
            <option>業務課題</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          課題分類小区分
          <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={category2} onChange={(event) => setCategory2(event.target.value)}>
            <option>顕在課題</option>
            <option>潜在課題</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700 lg:col-span-2">
          As-Is
          <textarea className="min-h-28 rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={asIs} onChange={(event) => setAsIs(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700 lg:col-span-2">
          To-Be
          <textarea className="min-h-28 rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={toBe} onChange={(event) => setToBe(event.target.value)} />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          type="button"
          disabled={!canSave}
          onClick={() => {
            onSave({
              ...issue,
              title: title.trim(),
              department: department.trim(),
              owner: owner.trim(),
              priority,
              status,
              due: due.trim(),
              category1,
              category2,
              asIs: asIs.trim(),
              toBe: toBe.trim(),
              updatedAt: formatDateTime(new Date()),
            });
          }}
        >
          変更を保存
        </button>
        <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700" type="button" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </PanelCard>
  );
}

function getIssueAsIs(issueId: string) {
  if (issueId === "ISS-001") return "部門ごとの判断基準が揃っておらず、現場判断にばらつきが出ている。";
  if (issueId === "ISS-002") return "買取営業の研修ルールが徹底されておらず、対応品質に差が出ている。";
  return "USBや端末の管理ルールが曖昧で、情報漏洩リスクが残っている。";
}

type IssueListEntry = CreatedIssueEntry | (typeof pageDemo.issues)[number];

function getCreatedIssue(issue: IssueListEntry) {
  return "category1" in issue && "asIs" in issue ? issue : undefined;
}

function getIssueSupabaseId(issue: IssueListEntry) {
  return "supabaseId" in issue ? issue.supabaseId : undefined;
}

function canEditCreatedIssue(issue: CreatedIssueEntry, currentUserName: string, appRole: AppRole, currentUserId?: string) {
  return canEditCreatedRecord(issue, currentUserName, appRole, "issues", currentUserId);
}

function canEditCreatedTask(task: CreatedTaskEntry, currentUserName: string, appRole: AppRole, currentUserId?: string) {
  if (!can(appRole, "tasks", "update")) return false;
  if (canViewAllWork(appRole)) return true;
  return isTaskRelatedToCurrentUser(task, currentUserName, currentUserId);
}

function canViewAllWork(appRole: AppRole) {
  return can(appRole, "tasks", "manage");
}

function canViewDepartmentWork(appRole: AppRole) {
  return normalizeOperationalRole(appRole) === "department_manager";
}

function canViewIssueForUser(issue: IssueListEntry, currentUserName: string, currentUserId: string | undefined, currentUserDepartment: string | undefined, appRole: AppRole) {
  if (canViewAllWork(appRole)) return true;
  if (canViewDepartmentWork(appRole) && isSameDepartmentLabel(issue.department, currentUserDepartment)) return true;
  if ("createdById" in issue && issue.createdById && currentUserId && issue.createdById === currentUserId) return true;
  if ("createdByName" in issue && isSamePersonName(issue.createdByName, currentUserName)) return true;
  return isSamePersonName(issue.owner, currentUserName);
}

function isTaskVisibleForUser(task: TaskSummary | CreatedTaskEntry | SendbackTaskEntry, currentUserName: string, currentUserId: string | undefined, currentUserDepartment: string | undefined, appRole: AppRole) {
  if (canViewAllWork(appRole)) return true;
  if (canViewDepartmentWork(appRole) && isSameDepartmentLabel(task.projectName, currentUserDepartment)) return true;
  return isTaskRelatedToCurrentUser(task, currentUserName, currentUserId);
}

function isTaskRelatedToCurrentUser(task: TaskSummary | CreatedTaskEntry | SendbackTaskEntry, currentUserName: string, currentUserId?: string) {
  if ("createdById" in task && task.createdById && currentUserId && task.createdById === currentUserId) return true;
  if ("createdByName" in task && isSamePersonName(task.createdByName, currentUserName)) return true;
  return isTaskAssigneeOrResponsible(task, currentUserName);
}

function canWorkOnTask(task: TaskSummary | CreatedTaskEntry | SendbackTaskEntry, currentUserName: string, _currentUserId: string | undefined, appRole: AppRole) {
  if (canViewAllWork(appRole)) return true;
  return isTaskRelatedToCurrentUser(task, currentUserName, _currentUserId);
}

function canRequestApprovalForTask(task: TaskSummary | CreatedTaskEntry | SendbackTaskEntry, currentUserName: string, currentUserId?: string) {
  return isTaskRelatedToCurrentUser(task, currentUserName, currentUserId);
}

function isTaskAssigneeOrResponsible(task: TaskSummary | CreatedTaskEntry | SendbackTaskEntry, currentUserName: string) {
  const responsiblePerson = "responsiblePerson" in task ? task.responsiblePerson : undefined;
  const assigneePerson = "assigneePerson" in task ? task.assigneePerson : undefined;
  return [task.assigneeName, responsiblePerson, assigneePerson].some((name) => isSamePersonName(name, currentUserName));
}

function getApprovalRequestDisabledReason(task: TaskSummary | CreatedTaskEntry | SendbackTaskEntry, progress: number, currentUserName: string, currentUserId?: string) {
  if (progress < 100) return "進捗100%で承認申請できます";
  if (!canRequestApprovalForTask(task, currentUserName, currentUserId)) return "承認申請は登録者または担当者のみ送信できます";
  return undefined;
}

function uniquePersonOptions(options: string[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const normalized = normalizePersonName(option);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function normalizeOperationalRole(role: AppRole): AppRole {
  if (role === "executive" || role === "team_manager") return "department_manager";
  if (role === "viewer") return "member";
  return role;
}

function canEditCreatedRecord(
  record: { createdById?: string; createdByName?: string },
  currentUserName: string,
  appRole: AppRole,
  resource: "issues" | "tasks",
  currentUserId?: string,
) {
  if (!can(appRole, resource, "update")) return false;
  if (can(appRole, resource, "manage")) return true;
  if (record.createdById && currentUserId) return record.createdById === currentUserId;
  return !record.createdByName || record.createdByName === currentUserName;
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
  const normalizedLeft = normalizeDepartmentLabel(left);
  const normalizedRight = normalizeDepartmentLabel(right);
  return Boolean(normalizedLeft && normalizedRight && (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)));
}

function normalizeDepartmentLabel(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, "").replace(/部門$/, "").replace(/本部$/, "部");
}

function getIssueCategory1(issue: IssueListEntry) {
  if ("category1" in issue && typeof issue.category1 === "string") return issue.category1;
  if (issue.id === "ISS-001") return "組織課題";
  if (issue.id === "ISS-002") return "業務課題";
  return "事業課題";
}

function getIssueCategory2(issue: IssueListEntry) {
  if ("category2" in issue && typeof issue.category2 === "string") return issue.category2;
  return issue.id === "ISS-003" ? "潜在課題" : "顕在課題";
}

function getIssueAsIsValue(issue: IssueListEntry) {
  if ("asIs" in issue && typeof issue.asIs === "string") return issue.asIs;
  return getIssueAsIs(issue.id);
}

function getIssueToBe(issue: IssueListEntry) {
  if ("toBe" in issue && typeof issue.toBe === "string") return issue.toBe || "未入力";
  if ("supabaseId" in issue || "asIs" in issue) return "未入力";
  if (issue.id === "ISS-001") return "MVVと判断基準が共有され、部門をまたいでも同じ基準で判断できる状態。";
  if (issue.id === "ISS-002") return "研修ルールが標準化され、新人・既存メンバーが同じ手順で対応できる状態。";
  if (issue.id === "ISS-003") return "端末利用とデータ持ち出しルールが明確になり、監査可能な状態。";
  return "未入力";
}

function IssuePriorityBadge({ priority }: { priority: string }) {
  const normalized = priority.toLowerCase();
  const config =
    normalized === "must"
      ? { label: "Must", className: "bg-red-50 text-red-700 ring-red-200" }
      : normalized === "should"
        ? { label: "Should", className: "bg-orange-50 text-orange-700 ring-orange-200" }
        : { label: "Could", className: "bg-slate-100 text-slate-700 ring-slate-200" };

  return <span className={`inline-flex min-w-16 justify-center rounded-md px-2 py-1 text-xs font-black ring-1 ${config.className}`}>{config.label}</span>;
}

function IssueStatusBadge({ status }: { status: string }) {
  const config = getIssueStatusConfig(status);
  return <span className={`inline-flex min-w-20 justify-center rounded-md px-2 py-1 text-xs font-black ring-1 ${config.className}`}>{config.label}</span>;
}

function getIssueStatusConfig(status: string) {
  if (status.includes("未")) return { label: "未着手", className: "bg-slate-100 text-slate-700 ring-slate-200" };
  if (status.includes("進")) return { label: "進行中", className: "bg-blue-50 text-blue-700 ring-blue-200" };
  if (status.includes("承")) return { label: "承認待ち", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
  if (status.includes("完")) return { label: "完了", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  return { label: status, className: "bg-slate-100 text-slate-700 ring-slate-200" };
}

function sortTasksByPriority(tasks: TaskSummary[]) {
  return sortByPriorityAndDueDate(tasks);
}

const teamTaskSummaries: TaskSummary[] = kanbanColumns.flatMap((column) => column.tasks);
const sendbackTaskSummaries: TaskSummary[] = [
  {
    id: "sendback-1",
    title: "見積回答メールのTo-Be追記",
    projectName: "AI Secretary対応",
    assigneeName: "山田 太郎",
    dueDate: "06/04",
    priority: "should",
    status: "in_progress",
    progress: 55,
  },
];

export function TasksPage({
  appRole = "member",
  requesterName = "山田 太郎",
  currentUserName = requesterName,
  currentUserId,
  currentUserDepartment,
  sendbackTasks = [],
  createdTasks = [],
  preferredView,
  onCreateApproval,
  onUpdateTask,
  onDeleteTask,
  onRestoreTask,
  approvalReviewerOptions = [],
  finalApprover,
}: {
  appRole?: AppRole;
  requesterName?: string;
  currentUserName?: string;
  currentUserId?: string;
  currentUserDepartment?: string;
  sendbackTasks?: SendbackTaskEntry[];
  createdTasks?: CreatedTaskEntry[];
  preferredView?: "mine" | "team" | "approval" | "sendback";
  onCreateApproval?: (approval: ApprovalRequestEntry) => void;
  onUpdateTask?: (task: CreatedTaskEntry) => void;
  onDeleteTask?: (task: CreatedTaskEntry) => void;
  onRestoreTask?: (task: CreatedTaskEntry) => void;
  approvalReviewerOptions?: ApprovalReviewerOption[];
  finalApprover?: ApprovalReviewerOption;
}) {
  const activeCreatedTasks = useMemo(() => createdTasks.filter((task) => !task.deletedAt), [createdTasks]);
  const deletedCreatedTasks = useMemo(() => createdTasks.filter((task) => task.deletedAt), [createdTasks]);
  const allSendbackTasks = useMemo(() => [...sendbackTasks, ...sendbackTaskSummaries], [sendbackTasks]);
  const canViewTeamWork = canViewAllWork(appRole);
  const allTaskSummaries = useMemo(() => {
    const baseMyTasks = canViewTeamWork ? myTasks : myTasks.filter((task) => isTaskVisibleForUser(task, currentUserName, currentUserId, currentUserDepartment, appRole));
    const baseTeamTasks = canViewTeamWork ? teamTaskSummaries : teamTaskSummaries.filter((task) => isTaskVisibleForUser(task, currentUserName, currentUserId, currentUserDepartment, appRole));
    const visibleCreatedTasks = canViewTeamWork ? activeCreatedTasks : activeCreatedTasks.filter((task) => isTaskVisibleForUser(task, currentUserName, currentUserId, currentUserDepartment, appRole));
    const visibleSendbackTasks = canViewTeamWork ? allSendbackTasks : allSendbackTasks.filter((task) => isTaskVisibleForUser(task, currentUserName, currentUserId, currentUserDepartment, appRole));
    return [...baseMyTasks, ...visibleCreatedTasks, ...baseTeamTasks, ...visibleSendbackTasks];
  }, [activeCreatedTasks, allSendbackTasks, appRole, canViewTeamWork, currentUserDepartment, currentUserId, currentUserName]);
  const myTaskSummaries = useMemo(
    () => allTaskSummaries.filter((task) => isTaskRelatedToCurrentUser(task, currentUserName, currentUserId)),
    [allTaskSummaries, currentUserId, currentUserName],
  );
  const initialRecords = useMemo(() => buildInitialTaskRecords(allTaskSummaries), [allTaskSummaries]);
  const [taskRecords, setTaskRecords] = useState<Record<string, TaskRecord>>(initialRecords);
  const openTaskSummaries = useMemo(
    () => allTaskSummaries.filter((task) => !isCompletedTaskForList(task, taskRecords)),
    [allTaskSummaries, taskRecords],
  );
  const openMyTaskSummaries = useMemo(
    () => myTaskSummaries.filter((task) => !isCompletedTaskForList(task, taskRecords)),
    [myTaskSummaries, taskRecords],
  );
  const approvalTaskSummaries = useMemo(
    () => openTaskSummaries.filter((task) => isApprovalTaskForList(task, taskRecords)),
    [openTaskSummaries, taskRecords],
  );
  const [saveMessage, setSaveMessage] = useState("進捗報告と承認申請は、このブラウザに保存されます。Supabase接続後はDB保存に切り替わります。");
  const [activeAction, setActiveAction] = useState<TaskAction>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [taskPanelScrollToken, setTaskPanelScrollToken] = useState(0);
  const [taskView, setTaskView] = useState<"mine" | "team" | "approval" | "sendback">("mine");
  const activeTask = activeAction ? openTaskSummaries.find((task) => task.id === activeAction.taskId) : undefined;
  const activeRecord = activeTask ? getTaskRecord(taskRecords, activeTask) : undefined;
  const editTask = editTaskId ? activeCreatedTasks.find((task) => task.id === editTaskId) : undefined;
  const pendingDeleteTask = deleteTaskId ? activeCreatedTasks.find((task) => task.id === deleteTaskId) : undefined;
  const visibleTasks = sortTasksByPriority(
    taskView === "mine"
      ? openMyTaskSummaries
      : taskView === "team"
        ? openTaskSummaries
        : taskView === "approval"
          ? approvalTaskSummaries
          : allSendbackTasks,
  );
  const sendbackTaskDetails = useMemo(
    () => Object.fromEntries(sendbackTasks.map((task) => [task.id, task])),
    [sendbackTasks],
  );
  const createdTaskDetails = useMemo(
    () => Object.fromEntries(activeCreatedTasks.map((task) => [task.id, task])),
    [activeCreatedTasks],
  );
  const taskTabs = [
    { key: "mine", label: "自分のタスク", count: openMyTaskSummaries.length },
    { key: "team", label: "チームタスク", count: openTaskSummaries.length },
    { key: "approval", label: "承認待ちタスク", count: approvalTaskSummaries.length },
    { key: "sendback", label: "差し戻しタスク", count: allSendbackTasks.length },
  ] as const;
  const canUpdateTasks = can(appRole, "tasks", "update");
  const canDeleteTasks = can(appRole, "tasks", "delete");
  const canCreateApprovals = can(appRole, "approvals", "create");
  const taskActionPanelRef = useAutoScrollPanel(activeAction ? `${activeAction.taskId}-${activeAction.mode}-${taskPanelScrollToken}` : null);
  const taskEditPanelRef = useAutoScrollPanel(editTaskId ? `${editTaskId}-${taskPanelScrollToken}` : null);
  const taskDeletePanelRef = useAutoScrollPanel(deleteTaskId ? `${deleteTaskId}-${taskPanelScrollToken}` : null);

  useEffect(() => {
    setTaskRecords(loadLocalTaskRecords(initialRecords));
  }, [initialRecords]);

  useEffect(() => {
    if (preferredView) setTaskView(preferredView);
  }, [preferredView]);

  const requestTaskPanelScroll = () => {
    setTaskPanelScrollToken((token) => token + 1);
  };

  const openAction = (taskId: string, mode: "progress" | "approval") => {
    const task = allTaskSummaries.find((item) => item.id === taskId);
    if (!task) return;

    if (mode === "progress" && !canWorkOnTask(task, currentUserName, currentUserId, appRole)) {
      setSaveMessage("進捗報告は登録者・担当者、または管理権限のあるユーザーのみ実行できます。");
      return;
    }

    if (mode === "approval") {
      const record = task ? getTaskRecord(taskRecords, task) : taskRecords[taskId];
      if (!record || record.progress < 100) {
        setSaveMessage("承認申請は進捗100%になってから送信できます。先に進捗報告で100%にしてください。");
        return;
      }
      if (!canRequestApprovalForTask(task, currentUserName, currentUserId)) {
        setSaveMessage("承認申請は登録者または担当者のみ送信できます。");
        return;
      }
    }
    setActiveAction({ taskId, mode });
    setEditTaskId(null);
    setDeleteTaskId(null);
    requestTaskPanelScroll();
  };

  const openEditTask = (taskId: string) => {
    setEditTaskId(taskId);
    setActiveAction(null);
    setDeleteTaskId(null);
    setSaveMessage(`${taskId} の編集画面を表示しています。下の入力欄から変更してください。`);
    requestTaskPanelScroll();
  };

  const openDeleteTask = (taskId: string) => {
    setDeleteTaskId(taskId);
    setEditTaskId(null);
    setActiveAction(null);
    setSaveMessage(`${taskId} はまだ削除されていません。下の確認アナウンスを読んで、必要な場合だけ削除を確定してください。`);
    requestTaskPanelScroll();
  };

  const saveProgress = (taskId: string, achievementMemo: string, nextActionMemo: string, progress: number) => {
    const timestamp = formatDateTime(new Date());
    const task = allTaskSummaries.find((item) => item.id === taskId);
    const persistenceTaskId = createdTaskDetails[taskId]?.supabaseId ?? taskId;
    setTaskRecords((records) => {
      const currentRecord = task ? getTaskRecord(records, task) : records[taskId];
      if (!currentRecord) return records;
      const nextRecord = {
        ...currentRecord,
        progress,
        todoMemo: nextActionMemo,
        achievementMemo,
        nextActionMemo,
        updates: [
          {
            at: timestamp,
            memo: buildProgressMemo(achievementMemo, nextActionMemo),
            achievementMemo,
            nextActionMemo,
            progress,
          },
          ...currentRecord.updates,
        ],
      };
      const nextRecords = { ...records, [taskId]: nextRecord };
      saveLocalTaskRecords(nextRecords);
      void saveTaskRecord(persistenceTaskId, nextRecord)
        .then((result) => setSaveMessage(result.target === "supabase" ? "進捗報告をSupabaseに保存しました。" : "進捗報告をこのブラウザに保存しました。"))
        .catch((error) => setSaveMessage(error instanceof Error ? `保存エラー: ${error.message}` : "保存エラーが発生しました。"));
      return nextRecords;
    });
    setActiveAction(null);
  };

  const requestApproval = (taskId: string, toBe: string, reviewer?: ApprovalReviewerOption) => {
    const timestamp = formatDateTime(new Date());
    const task = allTaskSummaries.find((item) => item.id === taskId);
    const persistenceTaskId = createdTaskDetails[taskId]?.supabaseId ?? taskId;
    const isResubmission = taskView === "sendback" || Boolean(sendbackTaskDetails[taskId]);
    const currentRecordBeforeRequest = task ? getTaskRecord(taskRecords, task) : taskRecords[taskId];
    if (!task || !canRequestApprovalForTask(task, currentUserName, currentUserId)) {
      setSaveMessage("承認申請は登録者または担当者のみ送信できます。");
      return;
    }
    if (!currentRecordBeforeRequest || currentRecordBeforeRequest.progress < 100) {
      setSaveMessage("承認申請は進捗100%になってから送信できます。先に進捗報告で100%にしてください。");
      return;
    }
    setTaskRecords((records) => {
      const currentRecord = task ? getTaskRecord(records, task) : records[taskId];
      if (!currentRecord) return records;
      if (currentRecord.progress < 100) {
        setSaveMessage("承認申請は進捗100%になってから送信できます。先に進捗報告で100%にしてください。");
        return records;
      }
      const nextRecord = {
        ...currentRecord,
        progress: currentRecord.progress,
        approvalToBe: toBe,
        approvalRequestedAt: timestamp,
        updates: [{ at: timestamp, memo: `承認申請: 完了後の状態 ${toBe}`, progress: currentRecord.progress }, ...currentRecord.updates],
      };
      const nextRecords = { ...records, [taskId]: nextRecord };
      saveLocalTaskRecords(nextRecords);
      void saveTaskRecord(persistenceTaskId, nextRecord)
        .then((result) => setSaveMessage(result.target === "supabase" ? "承認申請をSupabaseに保存しました。" : "承認申請をこのブラウザに保存しました。"))
        .catch((error) => setSaveMessage(error instanceof Error ? `保存エラー: ${error.message}` : "保存エラーが発生しました。"));
      return nextRecords;
    });
    if (task) {
      const createdTaskDetail = createdTaskDetails[task.id];
      onCreateApproval?.({
        id: `APR-TASK-${Date.now()}`,
        type: isResubmission ? "タスク再承認" : "タスク完了承認",
        target: task.title,
        requester: requesterName,
        requesterId: currentUserId,
        reviewerId: reviewer?.id,
        reviewerName: reviewer?.name,
        finalApproverId: finalApprover?.id,
        finalApproverName: finalApprover?.name,
        priority: task.priority,
        dueDate: task.dueDate,
        status: "承認待ち",
        taskId: task.id,
        taskSupabaseId: createdTaskDetail?.supabaseId,
        requestedAt: timestamp,
        issueCreatedAt: createdTaskDetail?.issueCreatedAt,
        body: toBe,
      });
    }
    setActiveAction(null);
  };

  const deleteTask = (task: CreatedTaskEntry) => {
    const deletedTask = {
      ...task,
      deletedAt: formatDateTime(new Date()),
      deletedById: currentUserId,
    };
    onDeleteTask?.(deletedTask);
    setEditTaskId(null);
    setActiveAction(null);
    setDeleteTaskId(null);
    setSaveMessage(`${task.title} を削除済みにしました。削除済みタスクから復元できます。`);
  };

  const restoreTask = (task: CreatedTaskEntry) => {
    const { deletedAt: _deletedAt, deletedById: _deletedById, ...restoredTask } = task;
    onRestoreTask?.(restoredTask);
    setSaveMessage(`${task.title} を復元しました。チームタスクに戻しています。`);
  };

  return (
    <PageFrame title="タスク" lead="自分のタスクだけでなく、権限に応じてチーム全体・承認待ち・差し戻しタスクも確認できます。">
      <PanelCard className="p-4">
        <div className="flex flex-wrap gap-2">
          {taskTabs.map((tab) => (
            <button
              key={tab.key}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${taskView === tab.key ? "bg-[#D6001C] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              type="button"
              onClick={() => setTaskView(tab.key)}
            >
              {tab.label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${taskView === tab.key ? "bg-white/20" : "bg-white"}`}>{tab.count}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">本実装ではログインユーザーの権限ランクにより、見えるタスク範囲を制御します。</p>
        <p className="mt-1 text-xs font-bold leading-5 text-[#D6001C]">{saveMessage}</p>
      </PanelCard>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTasks.map((task) => {
          const record = getTaskRecord(taskRecords, task);
          const status = getTaskStatus(record.progress);
          const latestUpdate = record.updates[0];
          const achievementMemo = getTaskAchievementMemo(record);
          const nextActionMemo = getTaskNextActionMemo(record);
          const sendbackDetail = sendbackTaskDetails[task.id];
          const createdTaskDetail = createdTaskDetails[task.id];
          const canEditThisTask = createdTaskDetail ? canEditCreatedTask(createdTaskDetail, currentUserName, appRole, currentUserId) : false;
          const canUpdateThisTask = canUpdateTasks && canWorkOnTask(task, currentUserName, currentUserId, appRole);
          const canRequestThisApproval = canCreateApprovals && record.progress >= 100 && canRequestApprovalForTask(task, currentUserName, currentUserId);
          const taskRegistrant = createdTaskDetail?.createdByName;
          const taskResponsiblePerson = createdTaskDetail?.responsiblePerson || task.assigneeName;
          const taskAssigneePerson =
            createdTaskDetail?.assigneePerson && createdTaskDetail.assigneePerson !== "未選択"
              ? createdTaskDetail.assigneePerson
              : task.assigneeName;

          return (
            <PanelCard key={task.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{task.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{task.projectName}</p>
                </div>
                <PriorityBadge priority={task.priority} />
              </div>

              <div className="mt-4 grid gap-2 border-y border-slate-100 py-3 text-xs text-slate-600">
                {taskRegistrant ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-500">登録者</span>
                    <strong className="text-right text-slate-800">{taskRegistrant}</strong>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-500">担当責任者</span>
                  <strong className="text-right text-slate-800">{taskResponsiblePerson}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-500">担当者</span>
                  <strong className="text-right text-slate-800">{taskAssigneePerson}</strong>
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">現在の進捗</p>
                    <strong className="text-2xl text-slate-950">{record.progress}%</strong>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div className="mt-3">
                  <ProgressBar value={record.progress} />
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">最終更新: {latestUpdate.at}</p>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">期限</span>
                  <strong className="text-[#D6001C]">{task.dueDate}</strong>
                </div>
                <div className="grid gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-500">今回の達成内容</p>
                    <p className="mt-1 rounded-lg border border-slate-100 bg-white p-3 text-sm leading-6 text-slate-700">{achievementMemo || "まだ達成内容は記録されていません。"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">次にやること</p>
                    <p className="mt-1 rounded-lg border border-slate-100 bg-white p-3 text-sm leading-6 text-slate-700">{nextActionMemo || "次の作業内容を整理してください。"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-bold text-slate-500">進捗履歴</p>
                <div className="mt-2 grid gap-2">
                  {record.updates.slice(0, 2).map((update, index) => (
                    <div key={`${task.id}-${update.at}-${update.progress}-${index}`} className="rounded-lg border border-slate-100 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <strong>{update.progress}%</strong>
                        <span className="text-slate-500">{update.at}</span>
                      </div>
                      {update.achievementMemo || update.nextActionMemo ? (
                        <div className="mt-1 grid gap-1 leading-5 text-slate-600">
                          {update.achievementMemo ? <p><span className="font-bold text-slate-700">達成内容:</span> {update.achievementMemo}</p> : null}
                          {update.nextActionMemo ? <p><span className="font-bold text-slate-700">次にやること:</span> {update.nextActionMemo}</p> : null}
                        </div>
                      ) : (
                        <p className="mt-1 leading-5 text-slate-600">{update.memo}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {record.approvalRequestedAt ? (
                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-800">
                  <strong>承認申請済み</strong>
                  <p className="mt-1">申請日時: {record.approvalRequestedAt}</p>
                  <p className="mt-1">完了後の状態: {record.approvalToBe}</p>
                </div>
              ) : null}

              {createdTaskDetail ? (
                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <strong>{createdTaskDetail.sourceType === "direct" ? "新規タスク登録" : "課題からタスク化"}</strong>
                  <p className="mt-1">{createdTaskDetail.sourceType === "direct" ? "登録" : `元課題: ${createdTaskDetail.sourceIssueId}`} / 発生日: {createdTaskDetail.issueCreatedAt}</p>
                  <p className="mt-1 font-bold">タスク化日時: {createdTaskDetail.taskizedAt}</p>
                </div>
              ) : null}

              {sendbackDetail ? (
                <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-3 text-xs text-orange-800">
                  <strong>差し戻し理由</strong>
                  <p className="mt-1 leading-5">{sendbackDetail.sendbackReason}</p>
                  <p className="mt-1 font-bold">差し戻し日時: {sendbackDetail.sentBackAt}</p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {createdTaskDetail ? (
                  <button
                    className="inline-flex h-9 min-w-[56px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300"
                    type="button"
                    disabled={!canEditThisTask}
                    onClick={() => openEditTask(createdTaskDetail.id)}
                  >
                    編集
                  </button>
                ) : null}
                <button className="inline-flex h-9 min-w-[96px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300" type="button" disabled={!canUpdateThisTask} onClick={() => openAction(task.id, "progress")}>
                  進捗報告
                </button>
                <button className="inline-flex h-9 min-w-[96px] items-center justify-center whitespace-nowrap rounded-lg bg-[#D6001C] px-3 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canRequestThisApproval} title={getApprovalRequestDisabledReason(task, record.progress, currentUserName, currentUserId)} onClick={() => openAction(task.id, "approval")}>
                  承認申請
                </button>
                {createdTaskDetail ? (
                  <button className="inline-flex h-9 min-w-[56px] items-center justify-center whitespace-nowrap rounded-lg bg-slate-800 px-3 text-xs font-bold text-white hover:bg-slate-950 disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canDeleteTasks} onClick={() => openDeleteTask(createdTaskDetail.id)}>
                    削除
                  </button>
                ) : null}
              </div>
              {record.progress < 100 ? (
                <p className="mt-2 text-xs font-bold text-slate-500">承認申請は進捗100%になってから送信できます。</p>
              ) : null}
              {record.progress >= 100 && !canRequestApprovalForTask(task, currentUserName, currentUserId) ? (
                <p className="mt-2 text-xs font-bold text-slate-500">承認申請は登録者または担当者のみ送信できます。</p>
              ) : null}
            </PanelCard>
          );
        })}
      </div>

      {editTask ? (
        <div ref={taskEditPanelRef} className="scroll-mt-24">
          <TaskEditPanel
            task={editTask}
            onCancel={() => setEditTaskId(null)}
            onSave={(task) => {
              onUpdateTask?.(task);
              setEditTaskId(null);
              setSaveMessage(`${task.title} を更新しました。更新日時: ${task.updatedAt}`);
            }}
          />
        </div>
      ) : null}

      {pendingDeleteTask ? (
        <div ref={taskDeletePanelRef} className="scroll-mt-24">
          <PanelCard className="border-red-200 bg-red-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#D6001C]">削除前の確認アナウンス</p>
                <h3 className="mt-1 font-bold text-slate-950">{pendingDeleteTask.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  この操作を確定すると、タスク一覧から非表示になります。間違って押した場合はキャンセルしてください。削除を確定した場合も、削除済みタスクから復元できます。
                </p>
                <p className="mt-2 text-xs font-bold text-slate-500">対象ID: {pendingDeleteTask.id} / タスク化日時: {pendingDeleteTask.taskizedAt}</p>
              </div>
              <button className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600" type="button" onClick={() => setDeleteTaskId(null)}>
                閉じる
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white hover:bg-red-700" type="button" onClick={() => deleteTask(pendingDeleteTask)}>
                削除を確定
              </button>
              <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" type="button" onClick={() => setDeleteTaskId(null)}>
                キャンセル
              </button>
            </div>
          </PanelCard>
        </div>
      ) : null}

      {deletedCreatedTasks.length > 0 ? (
        <PanelCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">削除済みタスク</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">論理削除されたタスクです。必要な場合は復元できます。</p>
            </div>
            <span className="rounded bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{deletedCreatedTasks.length}件</span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">タスク</th>
                  <th className="p-3">部門 / プロジェクト</th>
                  <th className="p-3">担当者</th>
                  <th className="p-3">削除日時</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {deletedCreatedTasks.map((task) => (
                  <tr key={`deleted-${task.id}`} className="border-b border-slate-100">
                    <td className="p-3 font-mono text-xs text-slate-500">{task.id}</td>
                    <td className="p-3 font-semibold">{task.title}</td>
                    <td className="p-3">{task.projectName}</td>
                    <td className="p-3">{task.assigneeName}</td>
                    <td className="p-3 font-mono text-xs text-slate-600">{task.deletedAt ?? "未設定"}</td>
                    <td className="p-3">
                      <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300" type="button" disabled={!canDeleteTasks} onClick={() => restoreTask(task)}>
                        復元
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      ) : null}

      {activeTask && activeRecord ? (
        <div ref={taskActionPanelRef} className="scroll-mt-24">
          <TaskActionPanel
            mode={activeAction?.mode ?? "progress"}
            taskTitle={activeTask.title}
            currentProgress={activeRecord.progress}
            currentMemo={activeRecord.todoMemo}
            currentAchievementMemo={getTaskAchievementMemo(activeRecord)}
            currentNextActionMemo={getTaskNextActionMemo(activeRecord)}
            onCancel={() => setActiveAction(null)}
            onSaveProgress={(achievementMemo, nextActionMemo, progress) => saveProgress(activeTask.id, achievementMemo, nextActionMemo, progress)}
            onRequestApproval={(toBe, reviewer) => requestApproval(activeTask.id, toBe, reviewer)}
            approvalReviewerOptions={approvalReviewerOptions}
            finalApprover={finalApprover}
          />
        </div>
      ) : null}
    </PageFrame>
  );
}

function TaskEditPanel({
  task,
  onCancel,
  onSave,
}: {
  task: CreatedTaskEntry;
  onCancel: () => void;
  onSave: (task: CreatedTaskEntry) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [projectName, setProjectName] = useState(task.projectName);
  const [assigneeName, setAssigneeName] = useState(task.assigneeName);
  const [dueDate, setDueDate] = useState(() => toDateInputValue(task.dueDate));
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const canSave = Boolean(title.trim() && projectName.trim() && assigneeName.trim() && dueDate.trim());

  return (
    <PanelCard className="border-[#D6001C]/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[#D6001C]">タスク編集</p>
          <h3 className="mt-1 font-bold">{task.id}</h3>
          <p className="mt-2 text-xs font-bold text-slate-500">登録者: {task.createdByName ?? "現在のユーザー"} / 登録日時: {task.taskizedAt}</p>
        </div>
        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" type="button" onClick={onCancel}>
          閉じる
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          タイトル
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          部門 / プロジェクト
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          担当者
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={assigneeName} onChange={(event) => setAssigneeName(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          期限
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          優先度
          <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
            <option value="must">Must</option>
            <option value="should">Should</option>
            <option value="could">Could</option>
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          type="button"
          disabled={!canSave}
          onClick={() => {
            onSave({
              ...task,
              title: title.trim(),
              projectName: projectName.trim(),
              assigneeName: assigneeName.trim(),
              assigneePerson: assigneeName.trim(),
              dueDate: formatDateInputForDisplay(dueDate),
              priority,
              updatedAt: formatDateTime(new Date()),
            });
          }}
        >
          変更を保存
        </button>
        <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700" type="button" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </PanelCard>
  );
}

function TaskActionPanel({
  mode,
  taskTitle,
  currentProgress,
  currentMemo,
  currentAchievementMemo,
  currentNextActionMemo,
  onCancel,
  onSaveProgress,
  onRequestApproval,
  approvalReviewerOptions = [],
  finalApprover,
}: {
  mode: "progress" | "approval";
  taskTitle: string;
  currentProgress: number;
  currentMemo: string;
  currentAchievementMemo: string;
  currentNextActionMemo: string;
  onCancel: () => void;
  onSaveProgress: (achievementMemo: string, nextActionMemo: string, progress: number) => void;
  onRequestApproval: (toBe: string, reviewer?: ApprovalReviewerOption) => void;
  approvalReviewerOptions?: ApprovalReviewerOption[];
  finalApprover?: ApprovalReviewerOption;
}) {
  const [achievementMemo, setAchievementMemo] = useState(currentAchievementMemo);
  const [nextActionMemo, setNextActionMemo] = useState(currentNextActionMemo || currentMemo);
  const [progress, setProgress] = useState(currentProgress);
  const [toBe, setToBe] = useState("");
  const [reviewerId, setReviewerId] = useState(approvalReviewerOptions[0]?.id ?? "");
  const selectedReviewer = approvalReviewerOptions.find((reviewer) => reviewer.id === reviewerId) ?? approvalReviewerOptions[0];
  const canRequestApproval = currentProgress >= 100 && Boolean(toBe.trim());

  return (
    <PanelCard className="border-[#D6001C]/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[#D6001C]">{mode === "progress" ? "進捗報告" : "承認申請"}</p>
          <h3 className="mt-1 font-bold">{taskTitle}</h3>
        </div>
        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" type="button" onClick={onCancel}>
          閉じる
        </button>
      </div>

      {mode === "progress" ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              今の達成内容
              <textarea
                className="min-h-28 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700 outline-none focus:border-[#D6001C]"
                placeholder="ここまで完了した内容、確認済みのこと、成果物などを入力"
                value={achievementMemo}
                onChange={(event) => setAchievementMemo(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              次にやること
              <textarea
                className="min-h-28 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700 outline-none focus:border-[#D6001C]"
                placeholder="次の作業、未完了項目、確認待ち、依頼事項などを入力"
                value={nextActionMemo}
                onChange={(event) => setNextActionMemo(event.target.value)}
              />
            </label>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              タスク進捗
              <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" max={100} min={0} type="number" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
            </label>
            <ProgressBar value={progress} />
            <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white" type="button" onClick={() => onSaveProgress(achievementMemo.trim(), nextActionMemo.trim(), clampProgress(progress))}>
              進捗報告を保存
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {currentProgress < 100 ? (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm font-bold text-orange-800">
              承認申請は進捗100%になってから送信できます。先に進捗報告で100%にしてください。
            </div>
          ) : null}
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              確認承認者
              <select
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#D6001C]"
                value={reviewerId}
                onChange={(event) => setReviewerId(event.target.value)}
              >
                {approvalReviewerOptions.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>{reviewer.name} / {reviewer.role}</option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-red-100 bg-white p-3 text-sm">
              <p className="text-xs font-bold text-slate-500">最終決裁者</p>
              <p className="mt-1 font-black text-[#D6001C]">{finalApprover ? `${finalApprover.name} / Owner` : "Owner固定"}</p>
            </div>
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            完了後の状態
            <textarea className="min-h-32 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700 outline-none focus:border-[#D6001C]" placeholder="完了後にどのような状態になったかを入力" value={toBe} onChange={(event) => setToBe(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canRequestApproval} onClick={() => onRequestApproval(toBe.trim(), selectedReviewer)}>
              承認申請を送る
            </button>
            <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700" type="button" onClick={onCancel}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </PanelCard>
  );
}

function buildInitialTaskRecords(tasks: TaskSummary[] = myTasks) {
  return Object.fromEntries(
    tasks.map((task, index) => [
      task.id,
      createInitialTaskRecord(task, index),
    ]),
  ) as Record<string, TaskRecord>;
}

function getTaskRecord(records: Record<string, TaskRecord>, task: TaskSummary) {
  return records[task.id] ?? createInitialTaskRecord(task);
}

function getTaskAchievementMemo(record: TaskRecord) {
  return record.achievementMemo ?? record.updates[0]?.achievementMemo ?? "";
}

function getTaskNextActionMemo(record: TaskRecord) {
  return record.nextActionMemo ?? record.updates[0]?.nextActionMemo ?? record.todoMemo ?? "";
}

function buildProgressMemo(achievementMemo: string, nextActionMemo: string) {
  const achievement = achievementMemo.trim();
  const nextAction = nextActionMemo.trim();
  if (achievement && nextAction) return `達成内容: ${achievement} / 次にやること: ${nextAction}`;
  return achievement || nextAction || "進捗内容を更新しました。";
}

function isCompletedTaskForList(task: TaskSummary, _records: Record<string, TaskRecord>) {
  return task.status === "done";
}

function isApprovalTaskForList(task: TaskSummary, records: Record<string, TaskRecord>) {
  const record = records[task.id];
  return !isCompletedTaskForList(task, records) && (task.status === "approval_pending" || Boolean(record?.approvalRequestedAt));
}

function createInitialTaskRecord(task: TaskSummary, index = 0): TaskRecord {
  const progress = clampProgress(task.progress);
  const todoMemo = getInitialTodoMemo(index);
  return {
    progress,
    todoMemo,
    achievementMemo: "",
    nextActionMemo: todoMemo,
    updates: [
      {
        at: getInitialUpdateTime(index),
        memo: todoMemo,
        progress,
        nextActionMemo: todoMemo,
      },
    ],
  };
}

function getInitialTodoMemo(index: number) {
  const memos = [
    "資料構成は作成済み。残りは営業部レビューと不足項目の追記。",
    "要件整理中。見積条件と導入範囲の確認が残っています。",
    "集計データは取得済み。分析コメントと提出用の整形が残っています。",
    "候補者への確認待ち。面談枠の再調整が必要です。",
    "企画案の骨子を作成済み。費用対効果の確認が残っています。",
  ];
  return memos[index] ?? "次の作業内容を整理中です。";
}

function getInitialUpdateTime(index: number) {
  const times = ["2026/06/03 09:20", "2026/06/03 10:05", "2026/06/03 10:40", "2026/06/03 11:10", "2026/06/03 11:35"];
  return times[index] ?? "2026/06/03 09:00";
}

function getTaskStatus(progress: number): TaskStatus {
  if (progress >= 100) return "done";
  if (progress >= 90) return "approval_pending";
  if (progress > 0) return "in_progress";
  return "not_started";
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function toDateInputValue(value: string) {
  const normalized = normalizeDateText(value);
  const isoDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return normalized;

  const yearSlashDate = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (yearSlashDate) return `${yearSlashDate[1]}-${padDatePart(yearSlashDate[2])}-${padDatePart(yearSlashDate[3])}`;

  const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashDate) return `${new Date().getFullYear()}-${padDatePart(slashDate[1])}-${padDatePart(slashDate[2])}`;

  return "";
}

function formatDateInputForDisplay(value: string) {
  const dateInput = toDateInputValue(value);
  if (!dateInput) return normalizeDateText(value);
  const [, month, day] = dateInput.split("-");
  return `${month}/${day}`;
}

function normalizeDateText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[年月.-]/g, "/")
    .replace(/日/g, "")
    .replace(/\s+/g, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/g, "");
}

function padDatePart(value: string) {
  return value.padStart(2, "0");
}

function formatDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function getApprovalIssueCreatedAt(sourceIssueId?: string) {
  return pageDemo.issues.find((issue) => issue.id === sourceIssueId)?.createdAt ?? "未設定";
}

function getApprovalCreatedAt(approval: ApprovalRequestEntry) {
  return approval.issueCreatedAt ?? approval.requestedAt ?? getApprovalIssueCreatedAt(approval.sourceIssueId);
}

export function ApprovalsPage({
  onNavigate,
  approvalRequests = [],
  resolvedApprovalIds = [],
  onResolveApproval,
  onReviewApproval,
  onSendBackTask,
  approvalHistory = [],
  onRecordApproval,
  appRole,
  currentUserId,
  currentUserName = "山田 太郎",
}: ApprovalsPageProps) {
  const [activeAction, setActiveAction] = useState<ApprovalAction>(null);
  const [approvalView, setApprovalView] = useState<"pending" | "approved">("pending");
  const [resultMessage, setResultMessage] = useState("承認または差し戻しを選び、コメントを残して処理します。");
  const allApprovals = useMemo<ApprovalRequestEntry[]>(
    () => [
      ...approvalRequests,
      ...pageDemo.approvals.map((approval) => ({
        ...approval,
        priority: approval.priority as TaskPriority,
      })),
    ],
    [approvalRequests],
  );
  const pendingApprovals = allApprovals.filter((approval) => !resolvedApprovalIds.includes(approval.id));
  const activeApproval = activeAction ? allApprovals.find((approval) => approval.id === activeAction.approvalId) : undefined;
  const approvalTabs = [
    { key: "pending", label: "承認待ち", count: pendingApprovals.length },
    { key: "approved", label: "承認済み", count: approvalHistory.length },
  ] as const;
  const canApproveRequests = can(appRole ?? "member", "approvals", "approve");
  const approvalActionPanelRef = useAutoScrollPanel(activeAction ? `${activeAction.approvalId}-${activeAction.mode}` : null);

  const completeApprovalAction = (comment: string) => {
    if (!activeAction || !activeApproval) return;

    if (activeAction.mode === "review") {
      if (!canReviewApproval(activeApproval, currentUserId, appRole ?? "member")) return;
      onReviewApproval?.(activeApproval, comment);
      setResultMessage(`${activeApproval.id} を確認済みにしました。コメント: ${comment}`);
      setActiveAction(null);
      return;
    }

    if (activeAction.mode === "sendback") {
      if (!canSendBackApproval(activeApproval, currentUserId, appRole ?? "member")) return;
      onResolveApproval?.(activeApproval, "sendback", comment);
      setResultMessage(`${activeApproval.id} を差し戻しました。コメント: ${comment}`);
      if (activeApproval.taskId) {
        onSendBackTask?.({
          id: activeApproval.taskId,
          title: activeApproval.target,
          projectName: "差し戻し対応",
          assigneeName: activeApproval.requester,
          dueDate: activeApproval.dueDate,
          priority: activeApproval.priority,
          status: "in_progress",
          progress: 70,
          sendbackReason: comment,
          sentBackAt: formatDateTime(new Date()),
        });
      }
      setActiveAction(null);
      onNavigate?.("tasks");
      return;
    }

    if (!canFinalizeApproval(activeApproval, currentUserId, appRole ?? "member")) return;
    if (!activeApproval.reviewedAt) {
      setResultMessage(`${activeApproval.id} は確認承認者の確認待ちです。確認済み後に最終決裁できます。`);
      setActiveAction(null);
      return;
    }

    onResolveApproval?.(activeApproval, "approve", comment);
    onRecordApproval?.({
      id: activeApproval.id,
      type: activeApproval.type,
      target: activeApproval.target,
      requester: activeApproval.requester,
      reviewerName: activeApproval.reviewerName,
      finalApproverName: activeApproval.finalApproverName,
      approvedBy: currentUserName,
      approvedAt: formatDateTime(new Date()),
      comment,
      issueCreatedAt: getApprovalCreatedAt(activeApproval),
      supabaseId: activeApproval.supabaseId,
    });
    setResultMessage(`${activeApproval.id} を承認しました。コメント: ${comment}`);
    setApprovalView("approved");
    setActiveAction(null);
  };

  return (
    <PageFrame title="承認" lead="タスク完了報告や重要対応を確認し、承認・差し戻しを行います。承認済み履歴もこのページで閲覧できます。">
      <PanelCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">承認一覧</h3>
            <p className="mt-1 text-sm text-slate-500">{resultMessage}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {approvalTabs.map((tab) => (
              <button
                key={tab.key}
                className={`rounded-lg px-4 py-2 text-sm font-bold ${approvalView === tab.key ? "bg-[#D6001C] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                type="button"
                onClick={() => setApprovalView(tab.key)}
              >
                {tab.label}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${approvalView === tab.key ? "bg-white/20" : "bg-white"}`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
      </PanelCard>

      {approvalView === "pending" ? <div className="grid gap-4">
        {pendingApprovals.map((approval) => (
          <PanelCard key={approval.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-500">{approval.type}</p>
                <h3 className="mt-1 font-bold">{approval.target}</h3>
                <p className="mt-2 text-sm font-bold text-slate-700">
                  確認状況: {approval.reviewedAt ? `確認済み ${approval.reviewedAt}` : "確認待ち"}
                </p>
                {approval.reviewComment ? <p className="mt-1 text-xs text-slate-500">確認コメント: {approval.reviewComment}</p> : null}
                <p className="mt-2 text-sm text-slate-500">申請者 {approval.requester}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">確認承認者 {approval.reviewerName ?? "未設定"} / 最終決裁 {approval.finalApproverName ?? "Owner"}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">発生日 {getApprovalCreatedAt(approval)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <PriorityBadge priority={approval.priority as TaskPriority} />
                <span className="rounded bg-red-50 px-3 py-1 text-xs font-bold text-[#D6001C]">期日 {approval.dueDate}</span>
                <span className="rounded bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{approval.status}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300" type="button" disabled={!canReviewApproval(approval, currentUserId, appRole ?? "member") || Boolean(approval.reviewedAt)} onClick={() => setActiveAction({ approvalId: approval.id, mode: "review" })}>確認済みにする</button>
              <button className="h-9 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canApproveRequests || !canFinalizeApproval(approval, currentUserId, appRole ?? "member")} onClick={() => setActiveAction({ approvalId: approval.id, mode: "approve" })}>最終承認</button>
              <button className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300" type="button" disabled={!canSendBackApproval(approval, currentUserId, appRole ?? "member")} onClick={() => setActiveAction({ approvalId: approval.id, mode: "sendback" })}>差し戻し</button>
            </div>
          </PanelCard>
        ))}
      </div> : null}

      {approvalView === "pending" && pendingApprovals.length === 0 ? (
        <PanelCard className="p-6 text-center">
          <h3 className="font-bold">承認待ちはありません</h3>
          <p className="mt-2 text-sm text-slate-500">新しい承認申請が入るとここに表示されます。</p>
        </PanelCard>
      ) : null}

      {approvalView === "approved" ? (
        <div className="grid gap-4">
          {approvalHistory.map((approval) => (
            <PanelCard key={`${approval.id}-${approval.approvedAt}`} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500">{approval.type}</p>
                  <h3 className="mt-1 font-bold">{approval.target}</h3>
                  <p className="mt-2 text-sm text-slate-500">申請者 {approval.requester} / 承認者 {approval.approvedBy}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">確認承認者 {approval.reviewerName ?? "未設定"} / 最終決裁 {approval.finalApproverName ?? approval.approvedBy}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">発生日 {approval.issueCreatedAt} / 承認日時 {approval.approvedAt}</p>
                </div>
                <span className="rounded bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">承認済み</span>
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-500">承認コメント</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{approval.comment}</p>
              </div>
            </PanelCard>
          ))}
          {approvalHistory.length === 0 ? (
            <PanelCard className="p-6 text-center">
              <h3 className="font-bold">承認済み履歴はまだありません</h3>
              <p className="mt-2 text-sm text-slate-500">承認ボタンから処理したものが、発生日付きでここに残ります。</p>
            </PanelCard>
          ) : null}
        </div>
      ) : null}

      {activeApproval && activeAction ? (
        <div ref={approvalActionPanelRef} className="scroll-mt-24">
          <ApprovalCommentPanel
            approvalTarget={activeApproval.target}
            mode={activeAction.mode}
            onCancel={() => setActiveAction(null)}
            onSubmit={completeApprovalAction}
          />
        </div>
      ) : null}
    </PageFrame>
  );
}

function canFinalizeApproval(approval: ApprovalRequestEntry, currentUserId?: string, appRole: AppRole = "member") {
  return canMakeFinalApprovalDecision(approval, currentUserId, appRole);
}

function canSendBackApproval(approval: ApprovalRequestEntry, currentUserId?: string, appRole: AppRole = "member") {
  return canReviewApproval(approval, currentUserId, appRole) || canMakeFinalApprovalDecision(approval, currentUserId, appRole);
}

function canReviewApproval(approval: ApprovalRequestEntry, currentUserId?: string, appRole: AppRole = "member") {
  if (!currentUserId) return false;
  if (approval.reviewerId && approval.reviewerId === currentUserId) return true;
  return appRole === "owner" || appRole === "admin";
}

function canMakeFinalApprovalDecision(approval: ApprovalRequestEntry, currentUserId?: string, appRole: AppRole = "member") {
  if (!currentUserId) return false;
  if (appRole === "admin") return true;
  if (appRole !== "owner") return false;
  return !approval.finalApproverId || approval.finalApproverId === currentUserId;
}

function getApprovalActionLabel(mode: "review" | "approve" | "sendback") {
  if (mode === "review") return "確認コメント";
  if (mode === "approve") return "最終承認コメント";
  return "差し戻しコメント";
}

function getApprovalActionButtonLabel(mode: "review" | "approve" | "sendback") {
  if (mode === "review") return "コメント付きで確認済みにする";
  if (mode === "approve") return "コメント付きで最終承認";
  return "コメント付きで差し戻し";
}

function ApprovalCommentPanel({
  approvalTarget,
  mode,
  onCancel,
  onSubmit,
}: {
  approvalTarget: string;
  mode: "review" | "approve" | "sendback";
  onCancel: () => void;
  onSubmit: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  const actionTitle = mode === "review" ? "確認" : mode === "approve" ? "承認" : "差し戻し";
  const commentRequired = mode === "sendback";
  const canSubmit = !commentRequired || Boolean(comment.trim());
  const placeholder = mode === "review"
    ? "確認した内容や補足コメントを入力"
    : mode === "approve"
      ? "承認理由や確認した内容を入力"
      : "戻す理由と修正してほしい内容を入力";

  return (
    <PanelCard className="border-[#D6001C]/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[#D6001C]">{actionTitle}</p>
          <h3 className="mt-1 font-bold">{approvalTarget}</h3>
        </div>
        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" type="button" onClick={onCancel}>
          閉じる
        </button>
      </div>

      <label className="mt-5 grid gap-2 text-sm font-bold text-slate-700">
        {getApprovalActionLabel(mode)}
        <textarea
          className="min-h-28 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700 outline-none focus:border-[#D6001C]"
          placeholder={placeholder}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit(comment.trim() || "コメント未入力")}
        >
          {getApprovalActionButtonLabel(mode)}
        </button>
        <button className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700" type="button" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </PanelCard>
  );
}

const teamMembers = [
  { department: "営業部", position: "Owner", name: "楢原悠太郎", permission: "Owner" },
  { department: "営業部", position: "本部長", name: "山田 太郎", permission: "Admin" },
  { department: "営業部", position: "課長", name: "山田 花子", permission: "Manager" },
  { department: "買取部", position: "主任", name: "佐藤 一郎", permission: "Manager" },
  { department: "販売部", position: "リーダー", name: "鈴木 太郎", permission: "Admin" },
  { department: "総務部", position: "担当", name: "田中 美咲", permission: "Member" },
  { department: "システム部", position: "管理者", name: "高橋 健", permission: "Admin" },
];

function PermissionBadge({ rank }: { rank: string }) {
  const config =
    rank === "Owner"
      ? "bg-red-50 text-red-700 ring-red-200"
      : rank === "Admin"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
        : rank === "Manager"
          ? "bg-orange-50 text-orange-700 ring-orange-200"
          : rank === "Member"
            ? "bg-blue-50 text-blue-700 ring-blue-200"
            : "bg-slate-100 text-slate-700 ring-slate-200";

  return <span className={`inline-flex min-w-20 justify-center rounded-md px-2 py-1 text-xs font-black ring-1 ${config}`}>{rank}</span>;
}

export function TeamsPage() {
  return (
    <PageFrame title="チーム" lead="部門名、役職名、名前、権限ランクをメンバー単位で管理します。">
      <PanelCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">メンバー権限一覧</h3>
            <p className="mt-1 text-sm text-slate-500">ログインユーザーに紐づく権限ランクで、閲覧・編集・承認の範囲を制御します。</p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Users size={18} /></div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-3">部門名</th>
                <th className="p-3">役職名</th>
                <th className="p-3">名前</th>
                <th className="p-3">権限ランク</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => (
                <tr key={`${member.department}-${member.name}`} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <td className="p-3 font-semibold">{member.department}</td>
                  <td className="p-3">{member.position}</td>
                  <td className="p-3 font-bold text-slate-900">{member.name}</td>
                  <td className="p-3"><PermissionBadge rank={member.permission} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <div className="grid gap-4 xl:grid-cols-3">
        {pageDemo.teams.map((team) => (
          <PanelCard key={team.team} className="p-5">
            <h3 className="font-bold">{team.team}</h3>
            <p className="mt-1 text-sm text-slate-500">{team.department}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">責任者</p><strong>{team.manager}</strong></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">人数</p><strong>{team.members}名</strong></div>
            </div>
          </PanelCard>
        ))}
      </div>
    </PageFrame>
  );
}

type TaurosKnowledgeItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  visibilityType: "company" | "owner_only" | "admin" | "manager" | "department" | "role";
  allowedRoles: AppRole[];
  allowedDepartments: string[];
  updatedAt: string;
  fileName?: string;
};

type TaurosAiMessage = {
  id: string;
  sender: "ai" | "user";
  text: string;
  referencedKnowledgeIds?: string[];
};

const taurosAiCategories = ["全社", "営業", "業務", "規程・ルール", "マニュアル", "FAQ"];

const taurosAiFaqs = [
  "納車許可の条件は？",
  "MOTA案件の対応フローは？",
  "買取キャンセルの処理方法は？",
  "入社時に必要なものは？",
  "AA出品の流れは？",
  "書類確認の手順は？",
];

const taurosAiSeedKnowledge: TaurosKnowledgeItem[] = [
  {
    id: "kn-001",
    title: "納車管理マニュアル",
    category: "マニュアル",
    description: "納車許可、書類確認、入金確認の基本条件。",
    content: "納車許可は、入金確認、必要書類の回収、車両状態の最終確認、担当責任者の確認が揃ってから行います。",
    visibilityType: "company",
    allowedRoles: ["owner", "admin", "department_manager", "member"],
    allowedDepartments: [],
    updatedAt: "2026/06/06",
    fileName: "納車管理マニュアル.pdf",
  },
  {
    id: "kn-002",
    title: "MOTA案件対応フロー",
    category: "営業",
    description: "MOTA流入後の初動、架電、査定、追客の手順。",
    content: "MOTA案件は初動連絡、査定日程調整、査定結果入力、追客メモ更新の順に対応します。対応漏れ防止のため、進捗をTeamOSに残します。",
    visibilityType: "department",
    allowedRoles: ["owner", "admin", "department_manager", "member"],
    allowedDepartments: ["営業部", "営業本部"],
    updatedAt: "2026/06/06",
    fileName: "MOTA対応フロー.docx",
  },
  {
    id: "kn-003",
    title: "買取キャンセル処理FAQ",
    category: "業務",
    description: "キャンセル時の確認、返金、社内共有の流れ。",
    content: "買取キャンセル時は、キャンセル理由、契約状況、入出金の有無を確認し、責任者へ共有します。返金や書類返却がある場合は履歴を残します。",
    visibilityType: "manager",
    allowedRoles: ["owner", "admin", "department_manager"],
    allowedDepartments: ["買取部", "買取販売営業"],
    updatedAt: "2026/06/06",
  },
  {
    id: "kn-004",
    title: "入社手続きFAQ",
    category: "FAQ",
    description: "入社時に必要な書類、アカウント準備、初日対応。",
    content: "入社時は本人確認書類、雇用契約、口座情報、緊急連絡先、社内アカウント、貸与物の確認を行います。",
    visibilityType: "company",
    allowedRoles: ["owner", "admin", "department_manager", "member"],
    allowedDepartments: [],
    updatedAt: "2026/06/06",
  },
  {
    id: "kn-005",
    title: "経理・支払い確認ルール",
    category: "規程・ルール",
    description: "支払い、請求、経理確認に関する管理者向けルール。",
    content: "経理・支払い情報はAdmin以上が確認します。Memberには回答せず、必要な場合は上長または管理者へ確認します。",
    visibilityType: "admin",
    allowedRoles: ["owner", "admin"],
    allowedDepartments: ["経理"],
    updatedAt: "2026/06/06",
  },
];

export function TaurosAiPage({
  appRole = "member",
  currentUserDepartment = "営業部",
}: {
  appRole?: AppRole;
  currentUserDepartment?: string;
  currentUserName?: string;
}) {
  const flags = getTaurosAiPermissionFlags(appRole);
  const localIdCounterRef = useRef(0);
  const [activeTab, setActiveTab] = useState<"chat" | "knowledge">("chat");
  const [activeCategory, setActiveCategory] = useState("全社");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<TaurosAiMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "こんにちは。TaurosAIです。社内ナレッジ、業務ルール、マニュアル、FAQについて質問してください。",
      referencedKnowledgeIds: ["kn-001", "kn-002"],
    },
  ]);
  const [knowledgeItems, setKnowledgeItems] = useState<TaurosKnowledgeItem[]>(taurosAiSeedKnowledge);
  const [draftKnowledge, setDraftKnowledge] = useState({
    title: "",
    category: "FAQ",
    description: "",
    content: "",
    visibilityType: "company" as TaurosKnowledgeItem["visibilityType"],
  });

  const visibleKnowledge = knowledgeItems.filter((item) =>
    canViewTaurosKnowledge(item, appRole, currentUserDepartment),
  );
  const filteredKnowledge = visibleKnowledge.filter((item) =>
    activeCategory === "全社" ? true : item.category === activeCategory,
  );
  const lastReferencedIds = [...messages].reverse().find((message) => message.referencedKnowledgeIds?.length)?.referencedKnowledgeIds ?? [];
  const referencedKnowledge = visibleKnowledge.filter((item) => lastReferencedIds.includes(item.id));
  const canManageKnowledge = flags.can_manage_tauros_ai_knowledge;
  const canDeleteKnowledge = flags.can_delete_knowledge;
  const recentQuestions = messages.filter((message) => message.sender === "user").slice(-5).reverse();

  const askTaurosAi = (text: string) => {
    const normalizedQuestion = text.trim();
    if (!normalizedQuestion) return;

    const matchedKnowledge = findTaurosKnowledgeMatches(normalizedQuestion, filteredKnowledge);
    const blockedSensitive = isTaurosAiSensitiveQuestion(normalizedQuestion) && !can(appRole, "knowledge", "manage");
    const answer = blockedSensitive
      ? "この情報は現在の権限では閲覧できません。必要な場合は上長または管理者へ確認してください。"
      : matchedKnowledge.length
        ? `この回答は、【${matchedKnowledge[0].title}】をもとに回答しています。\n\n${matchedKnowledge[0].content}\n\n本格実装では、登録済みナレッジを検索して参照元付きで回答します。`
        : "登録されているナレッジ内では確認できません。管理者へナレッジ追加を依頼してください。";

    localIdCounterRef.current += 1;
    const messageIdBase = localIdCounterRef.current;
    const userMessage: TaurosAiMessage = {
      id: `user-local-${messageIdBase}`,
      sender: "user",
      text: normalizedQuestion,
    };
    const aiMessage: TaurosAiMessage = {
      id: `ai-local-${messageIdBase}`,
      sender: "ai",
      text: answer,
      referencedKnowledgeIds: matchedKnowledge.map((item) => item.id),
    };

    setMessages((items) => [...items, userMessage, aiMessage]);
    setQuestion("");
  };

  const addDraftKnowledge = () => {
    if (!canManageKnowledge || !draftKnowledge.title.trim() || !draftKnowledge.content.trim()) return;
    localIdCounterRef.current += 1;
    const newKnowledge: TaurosKnowledgeItem = {
      id: `kn-local-${localIdCounterRef.current}`,
      title: draftKnowledge.title.trim(),
      category: draftKnowledge.category,
      description: draftKnowledge.description.trim() || "説明未設定",
      content: draftKnowledge.content.trim(),
      visibilityType: draftKnowledge.visibilityType,
      allowedRoles: getDefaultAllowedRoles(draftKnowledge.visibilityType),
      allowedDepartments: draftKnowledge.visibilityType === "department" ? [currentUserDepartment] : [],
      updatedAt: "2026/06/06",
    };
    setKnowledgeItems((items) => [newKnowledge, ...items]);
    setDraftKnowledge({ title: "", category: "FAQ", description: "", content: "", visibilityType: "company" });
  };

  return (
    <PageFrame title="TaurosAI" lead="社内ナレッジ、業務ルール、マニュアル、FAQをAIに質問できる社内AIアシスタントです。">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg bg-slate-100 p-1">
          <button className={`h-10 rounded-md px-4 text-sm font-black ${activeTab === "chat" ? "bg-white text-[#D6001C] shadow-sm" : "text-slate-600"}`} type="button" onClick={() => setActiveTab("chat")}>
            チャット
          </button>
          {canManageKnowledge ? (
            <button className={`h-10 rounded-md px-4 text-sm font-black ${activeTab === "knowledge" ? "bg-white text-[#D6001C] shadow-sm" : "text-slate-600"}`} type="button" onClick={() => setActiveTab("knowledge")}>
              ナレッジ管理
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
          <LockKeyhole size={15} className="text-[#D6001C]" />
          {canManageKnowledge ? "Admin以上: ナレッジ管理可" : "閲覧・質問のみ"}
        </div>
      </div>

      {activeTab === "chat" ? (
        <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
          <PanelCard className="p-4">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-[#D6001C]" />
              <h3 className="font-black">カテゴリ</h3>
            </div>
            <div className="mt-4 grid gap-2">
              {taurosAiCategories.map((category) => {
                const active = activeCategory === category;
                return (
                  <button key={category} className={`flex h-9 items-center justify-between rounded-lg px-3 text-sm font-bold ${active ? "bg-[#D6001C] text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`} type="button" onClick={() => setActiveCategory(category)}>
                    {category}
                    <span className={`text-[11px] ${active ? "text-white/80" : "text-slate-400"}`}>
                      {category === "全社" ? visibleKnowledge.length : visibleKnowledge.filter((item) => item.category === category).length}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-500" />
                <h4 className="text-sm font-black">最近の質問</h4>
              </div>
              <div className="mt-3 grid gap-2">
                {recentQuestions.length ? recentQuestions.map((message) => (
                  <button key={message.id} className="rounded-lg bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-100" type="button" onClick={() => setQuestion(message.text)}>
                    {message.text}
                  </button>
                )) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs font-bold text-slate-500">まだ質問履歴はありません。</p>
                )}
              </div>
            </div>
          </PanelCard>

          <PanelCard className="flex min-h-[620px] flex-col p-0">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-[#D6001C] text-white">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-black">TaurosAI Chat</h3>
                  <p className="text-xs font-bold text-slate-500">回答範囲: {currentUserDepartment} / {getRoleDisplayLabel(appRole)}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">MVP土台</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-lg px-4 py-3 text-sm leading-6 ${message.sender === "user" ? "bg-[#D6001C] text-white" : "bg-slate-50 text-slate-800"}`}>
                    {message.text.split("\n").map((line) => (
                      <p key={`${message.id}-${line}`}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 p-4">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {taurosAiFaqs.map((faq) => (
                  <button key={faq} className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C]" type="button" onClick={() => askTaurosAi(faq)}>
                    {faq}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_96px]">
                <textarea className="min-h-16 resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#D6001C]" placeholder="社内ナレッジについて質問してください..." value={question} onChange={(event) => setQuestion(event.target.value)} />
                <button className="inline-flex h-16 items-center justify-center gap-2 rounded-lg bg-[#D6001C] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!question.trim()} onClick={() => askTaurosAi(question)}>
                  <Send size={16} />
                  送信
                </button>
              </div>
            </div>
          </PanelCard>

          <PanelCard className="p-4">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-[#D6001C]" />
              <h3 className="font-black">参照元</h3>
            </div>
            <div className="mt-4 grid gap-3">
              {referencedKnowledge.length ? referencedKnowledge.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{item.category} / 更新日 {item.updatedAt}</p>
                  {item.fileName ? <p className="mt-2 text-xs text-slate-500">参照ファイル: {item.fileName}</p> : null}
                </div>
              )) : (
                <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs font-bold text-slate-500">質問後に参照元が表示されます。</p>
              )}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <Database size={17} className="text-slate-500" />
                <h4 className="text-sm font-black">関連ナレッジ</h4>
              </div>
              <div className="mt-3 grid gap-2">
                {filteredKnowledge.slice(0, 5).map((item) => (
                  <div key={`related-${item.id}`} className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-xs font-black text-slate-800">{item.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </PanelCard>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <PanelCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black">ナレッジ一覧</h3>
                <p className="mt-1 text-sm text-slate-500">登録済みの社内ナレッジを管理します。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{knowledgeItems.length}件</span>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="p-3">タイトル</th>
                    <th className="p-3">カテゴリ</th>
                    <th className="p-3">公開範囲</th>
                    <th className="p-3">更新日</th>
                    <th className="p-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {knowledgeItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="p-3">
                        <p className="font-black text-slate-950">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                      </td>
                      <td className="p-3 font-bold text-slate-700">{item.category}</td>
                      <td className="p-3">
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{getKnowledgeVisibilityLabel(item.visibilityType)}</span>
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-500">{item.updatedAt}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700" type="button">編集</button>
                          <button className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300" type="button" disabled={!canDeleteKnowledge} onClick={() => setKnowledgeItems((items) => items.filter((current) => current.id !== item.id))}>
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelCard>

          <PanelCard className="p-5">
            <div className="flex items-center gap-2">
              <Upload size={18} className="text-[#D6001C]" />
              <h3 className="font-black">ナレッジ登録</h3>
            </div>
            <div className="mt-4 grid gap-3">
              <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#D6001C]" placeholder="タイトル" value={draftKnowledge.title} onChange={(event) => setDraftKnowledge((draft) => ({ ...draft, title: event.target.value }))} />
              <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#D6001C]" value={draftKnowledge.category} onChange={(event) => setDraftKnowledge((draft) => ({ ...draft, category: event.target.value }))}>
                {taurosAiCategories.filter((category) => category !== "全社").map((category) => (
                  <option key={`knowledge-category-${category}`} value={category}>{category}</option>
                ))}
              </select>
              <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#D6001C]" value={draftKnowledge.visibilityType} onChange={(event) => setDraftKnowledge((draft) => ({ ...draft, visibilityType: event.target.value as TaurosKnowledgeItem["visibilityType"] }))}>
                <option value="company">全社公開</option>
                <option value="admin">Admin以上</option>
                <option value="manager">Manager以上</option>
                <option value="department">部門限定</option>
              </select>
              <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#D6001C]" placeholder="説明文" value={draftKnowledge.description} onChange={(event) => setDraftKnowledge((draft) => ({ ...draft, description: event.target.value }))} />
              <textarea className="min-h-32 rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#D6001C]" placeholder="本文テキスト" value={draftKnowledge.content} onChange={(event) => setDraftKnowledge((draft) => ({ ...draft, content: event.target.value }))} />
              <label className="grid min-h-24 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 text-center text-xs font-bold text-slate-500">
                PDF / Excel / CSV / Word / テキストファイル
                <input className="hidden" type="file" />
              </label>
              <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!draftKnowledge.title.trim() || !draftKnowledge.content.trim()} onClick={addDraftKnowledge}>
                下書き追加
              </button>
            </div>
          </PanelCard>
        </section>
      )}
    </PageFrame>
  );
}

function canViewTaurosKnowledge(item: TaurosKnowledgeItem, appRole: AppRole, currentUserDepartment: string) {
  const normalizedRole = appRole === "executive" || appRole === "team_manager" ? "department_manager" : appRole === "viewer" ? "member" : appRole;
  if (normalizedRole === "owner") return true;
  if (item.visibilityType === "owner_only") return false;
  if (normalizedRole === "admin") return true;
  if (item.visibilityType === "company") return true;
  if (item.visibilityType === "manager") return normalizedRole === "department_manager" && (item.allowedDepartments.length === 0 || item.allowedDepartments.includes(currentUserDepartment));
  if (item.visibilityType === "department") return item.allowedDepartments.includes(currentUserDepartment) && item.allowedRoles.includes(normalizedRole);
  if (item.visibilityType === "role") return item.allowedRoles.includes(normalizedRole);
  return false;
}

function findTaurosKnowledgeMatches(question: string, knowledgeItems: TaurosKnowledgeItem[]) {
  const normalizedQuestion = question.toLowerCase();
  const keywordMatches = knowledgeItems.filter((item) =>
    `${item.title} ${item.category} ${item.description} ${item.content}`.toLowerCase().includes(normalizedQuestion)
      || normalizedQuestion.split(/\s+/).some((keyword) => keyword && `${item.title} ${item.description} ${item.content}`.toLowerCase().includes(keyword)),
  );

  if (keywordMatches.length) return keywordMatches.slice(0, 3);
  if (question.includes("納車")) return knowledgeItems.filter((item) => item.title.includes("納車")).slice(0, 3);
  if (question.toLowerCase().includes("mota")) return knowledgeItems.filter((item) => item.title.includes("MOTA")).slice(0, 3);
  if (question.includes("キャンセル")) return knowledgeItems.filter((item) => item.title.includes("キャンセル")).slice(0, 3);
  if (question.includes("入社")) return knowledgeItems.filter((item) => item.title.includes("入社")).slice(0, 3);
  return [];
}

function isTaurosAiSensitiveQuestion(question: string) {
  return ["経理", "支払い", "請求", "人事情報", "採用", "役員", "経営資料", "KPI"].some((keyword) => question.includes(keyword));
}

function getDefaultAllowedRoles(visibilityType: TaurosKnowledgeItem["visibilityType"]): AppRole[] {
  if (visibilityType === "admin") return ["owner", "admin"];
  if (visibilityType === "manager") return ["owner", "admin", "department_manager"];
  return ["owner", "admin", "department_manager", "member"];
}

function getKnowledgeVisibilityLabel(visibilityType: TaurosKnowledgeItem["visibilityType"]) {
  if (visibilityType === "admin") return "Admin以上";
  if (visibilityType === "manager") return "Manager以上";
  if (visibilityType === "department") return "部門限定";
  return "全社公開";
}

function getRoleDisplayLabel(role: AppRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "department_manager" || role === "team_manager" || role === "executive") return "Manager";
  return "Member";
}

export function AiSuggestionsPage() {
  const suggestionTitles = ["メールからタスク候補", "返信案の承認待ち", "会議アジェンダ案"];
  const [processedSuggestions, setProcessedSuggestions] = useState<Record<string, "approved" | "held">>({});
  const [actionMessage, setActionMessage] = useState("AI提案は人間が承認するまで正式登録されません。");
  const updateSuggestion = (title: string, status: "approved" | "held") => {
    setProcessedSuggestions((items) => ({ ...items, [title]: status }));
    setActionMessage(status === "approved" ? `${title} を承認して登録候補にしました。` : `${title} を保留にしました。`);
  };

  return (
    <PageFrame title="AIによる提案" lead="Gmail、LINE、サイボウズ通知、AI要約、返信案、タスク候補をここに集約します。人間承認前の受け皿です。">
      <PanelCard className="p-4">
        <p className="text-sm font-bold text-slate-700">{actionMessage}</p>
      </PanelCard>
      <div className="grid gap-4 xl:grid-cols-3">
        {pageDemo.inbox.map((item) => (
          <PanelCard key={item.title} className="p-5">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{item.source}</span>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#D6001C]">{item.status}</span>
            </div>
            <h3 className="mt-4 font-bold">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.summary}</p>
            {processedSuggestions[item.title] ? (
              <p className={`mt-4 rounded-lg px-3 py-2 text-xs font-bold ${processedSuggestions[item.title] === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {processedSuggestions[item.title] === "approved" ? "承認済み / 登録候補" : "保留中"}
              </p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button className="h-9 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:bg-slate-300" type="button" disabled={processedSuggestions[item.title] === "approved"} onClick={() => updateSuggestion(item.title, "approved")}>承認して登録</button>
              <button className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 disabled:text-slate-300" type="button" disabled={processedSuggestions[item.title] === "held"} onClick={() => updateSuggestion(item.title, "held")}>保留</button>
            </div>
          </PanelCard>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {suggestionTitles.map((title, index) => (
          <PanelCard key={title} className="p-5">
            <Bot className="text-blue-500" />
            <h3 className="mt-4 font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">AI提案は承認されるまで正式なTeamOSタスクには登録されません。</p>
            <span className="mt-4 inline-flex rounded bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">信頼度 {88 - index * 7}%</span>
          </PanelCard>
        ))}
      </div>
    </PageFrame>
  );
}

export function ReportsPage() {
  const csvReports = [
    {
      key: "tasks",
      title: "タスク一覧CSV",
      description: "タスク名、プロジェクト、担当者、期限、優先度、Status、進捗率を出力します。",
      rows: myTasks.map((task) => ({
        id: task.id,
        title: task.title,
        project: task.projectName,
        assignee: task.assigneeName,
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        progress: `${task.progress}%`,
      })),
    },
    {
      key: "departments",
      title: "部門別進捗CSV",
      description: "部門名と進捗率を出力します。経営確認や週次共有に使う想定です。",
      rows: departmentProgress.map((item) => ({
        department: item.department,
        progress: `${item.progress}%`,
      })),
    },
    {
      key: "approvals",
      title: "承認状況CSV",
      description: "承認ID、種別、対象、申請者、Statusを出力します。",
      rows: pageDemo.approvals.map((approval) => ({
        id: approval.id,
        type: approval.type,
        target: approval.target,
        requester: approval.requester,
        status: approval.status,
      })),
    },
  ];

  return (
    <PageFrame title="報告書" lead="現時点ではCSV出力機能を搭載しています。必要なデータを選んでダウンロードできます。">
      <div className="grid gap-4 xl:grid-cols-3">
        {csvReports.map((report) => (
          <PanelCard key={report.key} className="p-5">
            <h3 className="font-bold">{report.title}</h3>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{report.description}</p>
            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">出力件数</span>
              <strong className="ml-2 text-slate-950">{report.rows.length}件</strong>
            </div>
            <button
              className="mt-5 h-10 w-full rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white hover:bg-red-700"
              type="button"
              onClick={() => downloadCsv(`tauros-${report.key}-20260603.csv`, report.rows)}
            >
              CSV出力
            </button>
          </PanelCard>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PanelCard className="p-5">
          <h3 className="font-bold">部門別進捗</h3>
          <div className="mt-5 grid gap-4">
            {departmentProgress.map((item) => (
              <div key={item.department} className="grid grid-cols-[80px_1fr_44px] items-center gap-3 text-sm">
                <span>{item.department}</span>
                <ProgressBar value={item.progress} />
                <strong>{item.progress}%</strong>
              </div>
            ))}
          </div>
        </PanelCard>
        <PanelCard className="p-5">
          <h3 className="font-bold">カンバン状況</h3>
          <div className="mt-5 grid gap-3">
            {kanbanColumns.map((column) => (
              <div key={column.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="font-semibold">{column.title}</span>
                <strong>{column.count}件</strong>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </PageFrame>
  );
}

function downloadCsv(filename: string, rows: Array<Record<string, string>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? "")).join(",")),
  ].join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string) {
  const needsQuote = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export function ActivityLogsPage({ activityLogs = [] }: { activityLogs?: ActivityLogEntry[] }) {
  const logs: ActivityLogEntry[] = [...activityLogs, ...pageDemo.logs];
  return (
    <PageFrame title="アクティビティログ" lead="誰が、いつ、何を変更したかを監査ログとして確認します。">
      <PanelCard className="p-5">
        <div className="mb-4 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-[160px_1fr_180px_150px]">
          <strong>実行者</strong>
          <strong>操作内容</strong>
          <strong>対象</strong>
          <strong>日時</strong>
        </div>
        <div className="grid gap-3">
          {logs.map((log, index) => (
            <div key={getActivityLogKey(log, index)} className="grid gap-2 rounded-lg border border-slate-100 p-4 md:grid-cols-[160px_1fr_180px_150px] md:items-center">
              <strong>{log.actor}</strong>
              <div>
                <span className="font-semibold text-slate-900">{log.action}</span>
                {log.detail ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{log.detail}</p>
                ) : null}
              </div>
              <span className="text-slate-500">{log.target}</span>
              <span className="font-mono text-xs font-semibold text-slate-600">{log.time}</span>
            </div>
          ))}
        </div>
      </PanelCard>
    </PageFrame>
  );
}

function getActivityLogKey(log: ActivityLogEntry, index: number) {
  return log.supabaseId ?? log.id ?? `${log.actor}-${log.action}-${log.target}-${log.time}-${index}`;
}

export function SettingsPage({
  departments = DEFAULT_DEPARTMENTS,
  onAddDepartment,
  onDeleteDepartment,
  currentUserId,
  currentUserName = "山田 太郎",
  currentAuthSource = "demo",
  appRole = "member",
}: {
  departments?: string[];
  onAddDepartment?: (name: string) => void;
  onDeleteDepartment?: (name: string) => void;
  currentUserId?: string;
  currentUserName?: string;
  currentAuthSource?: "demo" | "supabase";
  appRole?: AppRole;
} = {}) {
  const canManageSettings = can(appRole, "settings", "manage");
  const canChangeUserRoles = appRole === "owner";
  const settingDetails = [
    {
      key: "users",
      label: "ユーザー設定",
      icon: Users,
      status: "操作可能",
      lead: "ログインユーザーの氏名、所属部門、役職、権限ランクを管理します。",
      items: ["氏名・メールアドレス", "所属部門・役職", "Owner固定", "権限変更はOwnerのみ"],
    },
    {
      key: "permissions",
      label: "権限設定",
      icon: ShieldCheck,
      status: "操作可能",
      lead: "権限ランクを追加し、メンバーごとに閲覧・編集・管理範囲を制御します。",
      items: ["Owner: 全権限・最終承認", "Admin: 管理者", "Manager: 部門/チーム管理", "Member: 作業担当"],
    },
    {
      key: "notifications",
      label: "通知設定",
      icon: Inbox,
      status: "今後実装予定",
      lead: "タスク更新、承認申請、差し戻し、AI提案の通知先と通知条件を設定します。",
      items: ["アプリ内通知", "メール通知", "LINE通知", "重要度別の通知ON/OFF"],
    },
    {
      key: "integrations",
      label: "外部連携設定",
      icon: ClipboardList,
      status: "今後実装予定",
      lead: "Gmail、LINE、サイボウズなど外部サービスとの接続を管理します。",
      items: ["Gmail OAuth接続", "LINE公式アカウント連携", "サイボウズAPI連携", "連携エラー履歴"],
    },
    {
      key: "ai",
      label: "AI連携設定",
      icon: Bot,
      status: "今後実装予定",
      lead: "AI Secretaryが要約、分類、返信案、タスク候補化を行う範囲を設定します。",
      items: ["メール・LINEの要約", "課題/タスク候補の自動分類", "返信案の作成", "人間承認後のみ登録"],
    },
    {
      key: "departments",
      label: "部門設定",
      icon: Building2,
      status: "操作可能",
      lead: "課題登録と部門別進捗率で使う部門マスタを管理します。",
      items: ["課題登録の部門選択", "部門別進捗率の集計対象", "部門名の追加・削除", "表記ゆれ防止"],
    },
    {
      key: "approvalRules",
      label: "承認ルール設定",
      icon: ListChecks,
      status: "デモ表示中",
      lead: "承認が必要な条件、承認者、差し戻し時の戻し先を設定します。",
      items: ["Mustタスクは承認必須", "部門長承認", "差し戻し時はタスクへ戻す", "承認コメント必須"],
    },
  ] as const;
  const [activeSettingKey, setActiveSettingKey] = useState<(typeof settingDetails)[number]["key"]>("users");
  const [permissionRanks, setPermissionRanks] = useState([
    { rank: "Owner", description: "全権限。会社・全データ・権限設定を管理し、最終承認を行えます。" },
    { rank: "Admin", description: "管理者。部門横断の設定、メンバー管理、運用メンテナンスができます。" },
    { rank: "Manager", description: "部門/チーム管理。担当部門やチームの課題・タスクを管理できます。" },
    { rank: "Member", description: "作業担当。課題・タスクの登録と進捗更新ができます。" },
  ]);
  const [newRank, setNewRank] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDepartment, setInviteDepartment] = useState(DEFAULT_DEPARTMENTS[0]);
  const [invitePosition, setInvitePosition] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("member");
  const [inviteStatus, setInviteStatus] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [profiles, setProfiles] = useState<TeamProfileEntry[]>(demoUsersToProfiles());
  const [profileDrafts, setProfileDrafts] = useState<Record<string, { departmentName: string; position: string }>>({});
  const [profileStatus, setProfileStatus] = useState<"loading" | "ready" | "error">("loading");
  const [profileMessage, setProfileMessage] = useState("");
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const normalizedDepartments = normalizeDepartmentList(departments.length ? departments : DEFAULT_DEPARTMENTS);
  const activeSetting = settingDetails.find((setting) => setting.key === activeSettingKey) ?? settingDetails[1];
  const ActiveIcon = activeSetting.icon;

  useEffect(() => {
    if (!normalizedDepartments.includes(inviteDepartment)) {
      setInviteDepartment(normalizedDepartments[0] ?? DEFAULT_DEPARTMENTS[0]);
    }
  }, [inviteDepartment, normalizedDepartments]);

  useEffect(() => {
    let cancelled = false;
    setProfileStatus("loading");
    setProfileMessage("");
    void loadTeamProfilesFromSupabase()
      .then((result) => {
        if (cancelled) return;
        setProfiles(result.profiles.length ? result.profiles : demoUsersToProfiles());
        setProfileStatus("ready");
        setProfileMessage(result.source === "supabase" ? "Supabaseのprofilesからユーザー情報を読み込みました。" : "デモユーザー情報を表示しています。");
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Profile load failed.", error);
        setProfiles(demoUsersToProfiles());
        setProfileStatus("error");
        setProfileMessage("profilesの読み込みに失敗したため、デモユーザー情報を表示しています。");
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    setProfileDrafts((drafts) => {
      const nextDrafts = { ...drafts };
      const profileIds = new Set(profiles.map((profile) => profile.id));

      profiles.forEach((profile) => {
        if (!nextDrafts[profile.id]) {
          nextDrafts[profile.id] = {
            departmentName: profile.departmentName,
            position: profile.position,
          };
        }
      });

      Object.keys(nextDrafts).forEach((profileId) => {
        if (!profileIds.has(profileId)) {
          delete nextDrafts[profileId];
        }
      });

      return nextDrafts;
    });
  }, [profiles]);

  const getProfileDraft = (profile: TeamProfileEntry) => profileDrafts[profile.id] ?? {
    departmentName: profile.departmentName,
    position: profile.position,
  };

  const updateProfileDraft = (profileId: string, draft: Partial<{ departmentName: string; position: string }>) => {
    setProfileDrafts((drafts) => ({
      ...drafts,
      [profileId]: {
        departmentName: draft.departmentName ?? drafts[profileId]?.departmentName ?? "",
        position: draft.position ?? drafts[profileId]?.position ?? "",
      },
    }));
  };

  const applyUpdatedProfile = (updatedProfile: TeamProfileEntry) => {
    setProfiles((items) =>
      items.map((item) =>
        item.id === updatedProfile.id
          ? {
            ...item,
            ...updatedProfile,
            roleLabel: getRoleLabel(updatedProfile.role),
          }
          : item,
      ),
    );
    setProfileDrafts((drafts) => ({
      ...drafts,
      [updatedProfile.id]: {
        departmentName: updatedProfile.departmentName,
        position: updatedProfile.position,
      },
    }));
  };

  const inviteUser = async () => {
    if (!canChangeUserRoles) return;
    if (currentAuthSource !== "supabase") {
      setInviteStatus("招待メール送信は本ログイン時に利用できます。デモでは入力フォームの確認のみ可能です。");
      return;
    }

    setIsInviting(true);
    setInviteStatus(`${inviteEmail} へ招待メールを送信しています。`);

    try {
      const invitedProfile = await inviteTeamUser({
        displayName: inviteName,
        email: inviteEmail,
        departmentName: inviteDepartment,
        position: invitePosition,
        role: inviteRole,
      });

      if (invitedProfile) {
        setProfiles((items) => [invitedProfile, ...items.filter((item) => item.id !== invitedProfile.id)]);
      }
      setInviteName("");
      setInviteEmail("");
      setInvitePosition("");
      setInviteRole("member");
      setInviteStatus(`${inviteEmail} へ招待メールを送信しました。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "招待に失敗しました。";
      setInviteStatus(message);
    } finally {
      setIsInviting(false);
    }
  };

  const updateProfileRole = async (profile: TeamProfileEntry, role: AppRole) => {
    if (!canChangeUserRoles || profile.role === "owner") return;
    const normalizedRole = role === "owner" ? "member" : role;
    const previousProfiles = profiles;
    setSavingProfileId(profile.id);
    setProfileMessage(`${profile.displayName}さんの権限を${getRoleLabel(normalizedRole)}に更新しています。`);
    setProfiles((items) =>
      items.map((item) =>
        item.id === profile.id
          ? { ...item, role: normalizedRole, roleLabel: getRoleLabel(normalizedRole) }
          : item,
      ),
    );

    try {
      const result = await updateProfileRoleInSupabase(profile.id, normalizedRole);
      if (result.profile) {
        applyUpdatedProfile({
          ...result.profile,
          departmentName: profile.departmentName,
          position: profile.position,
        });
      }
      setProfileMessage(result.source === "supabase"
        ? `${profile.displayName}さんの権限を${getRoleLabel(normalizedRole)}に更新しました。`
        : `${profile.displayName}さんの権限をデモ表示上で更新しました。Supabase反映には本ログインが必要です。`);
    } catch (error) {
      console.warn("Profile role update failed.", error);
      setProfiles(previousProfiles);
      setProfileMessage("権限更新に失敗しました。Supabaseのprofiles権限とRLS設定を確認してください。");
    } finally {
      setSavingProfileId(null);
    }
  };

  const updateProfileDepartmentAndPosition = async (profile: TeamProfileEntry) => {
    if (!canChangeUserRoles) return;
    const draft = getProfileDraft(profile);
    const departmentName = draft.departmentName.trim();
    const position = draft.position.trim() || "未設定";

    if (!departmentName) {
      setProfileMessage("部門を選択してください。");
      return;
    }

    setSavingProfileId(profile.id);
    setProfileMessage(`${profile.displayName}さんの部門・役職を更新しています。`);

    try {
      const result = await updateProfileDepartmentAndPositionInSupabase(profile.id, {
        departmentName,
        position,
      });

      if (result.profile) {
        const updatedProfile = result.positionSaved
          ? result.profile
          : { ...result.profile, position: profile.position };
        applyUpdatedProfile(updatedProfile);
      } else {
        setProfiles((items) =>
          items.map((item) =>
            item.id === profile.id
              ? { ...item, departmentName, position }
              : item,
          ),
        );
      }

      setProfileMessage(result.positionSaved
        ? `${profile.displayName}さんの部門・役職を更新しました。`
        : `${profile.displayName}さんの部門を更新しました。役職保存にはSupabaseで add_profile_position_20260606.sql を実行してください。`);
    } catch (error) {
      console.warn("Profile department/position update failed.", error);
      setProfileDrafts((drafts) => ({
        ...drafts,
        [profile.id]: {
          departmentName: profile.departmentName,
          position: profile.position,
        },
      }));
      const message = error instanceof Error ? error.message : "部門・役職の更新に失敗しました。";
      setProfileMessage(message);
    } finally {
      setSavingProfileId(null);
    }
  };

  return (
    <PageFrame title="設定" lead="通知、権限、外部連携、AI連携、承認ルールを管理します。">
      <PanelCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-bold">権限ランク追加</h3>
            <p className="mt-1 text-sm text-slate-500">チームページで使う権限ランクを追加できます。本実装ではログインユーザーIDにこのランクを紐づけます。</p>
            {!canChangeUserRoles ? (
              <p className="mt-2 text-xs font-bold text-slate-500">現在のログイン: {currentUserName} / 権限変更はOwnerのみ可能です。</p>
            ) : null}
          </div>
          <PermissionBadge rank="Admin" />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[180px_1fr_120px]">
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-400" placeholder="例: Manager" value={newRank} disabled={!canChangeUserRoles} onChange={(event) => setNewRank(event.target.value)} />
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-400" placeholder="権限の説明" value={newDescription} disabled={!canChangeUserRoles} onChange={(event) => setNewDescription(event.target.value)} />
          <button
            className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!canChangeUserRoles || !newRank.trim()}
            type="button"
            onClick={() => {
              setPermissionRanks((ranks) => [...ranks, { rank: newRank.trim(), description: newDescription.trim() || "追加された権限ランクです。" }]);
              setNewRank("");
              setNewDescription("");
            }}
          >
            追加
          </button>
        </div>
        <div className="mt-5 grid gap-2">
          {permissionRanks.map((permission) => (
            <div key={permission.rank} className="grid gap-2 rounded-lg border border-slate-100 p-3 text-sm md:grid-cols-[120px_1fr] md:items-center">
              <PermissionBadge rank={permission.rank} />
              <span className="text-slate-600">{permission.description}</span>
            </div>
          ))}
        </div>
      </PanelCard>

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <PanelCard className="p-3">
          <div className="grid gap-2">
            {settingDetails.map((setting) => {
              const Icon = setting.icon;
              const active = activeSettingKey === setting.key;
              return (
                <button
                  key={setting.key}
                  className={`grid gap-2 rounded-lg border p-4 text-left transition ${active ? "border-[#D6001C] bg-red-50" : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                  type="button"
                  onClick={() => setActiveSettingKey(setting.key)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3 font-bold text-slate-950">
                      <Icon className={active ? "text-[#D6001C]" : "text-slate-500"} size={18} />
                      {setting.label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${setting.status === "今後実装予定" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {setting.status}
                    </span>
                  </div>
                  <span className="text-xs leading-5 text-slate-500">{setting.lead}</span>
                </button>
              );
            })}
          </div>
        </PanelCard>

        <PanelCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-[#D6001C]">
                <ActiveIcon size={20} />
              </div>
              <div>
                <h3 className="font-bold">{activeSetting.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{activeSetting.lead}</p>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${activeSetting.status === "今後実装予定" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
              {activeSetting.status}
            </span>
          </div>

          {activeSetting.status === "今後実装予定" ? (
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-800">今後実装予定の機能です</p>
              <p className="mt-2 text-sm leading-6 text-blue-700">
                デモ版では接続前の設計内容を表示しています。本実装ではログインユーザーと権限ランクを確認したうえで、接続・変更できる範囲を制御します。
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {activeSetting.items.map((item) => (
              <div key={item} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">{item}</p>
              </div>
            ))}
          </div>

          {activeSetting.key === "users" ? (
            <div className="mt-5 rounded-lg border border-slate-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold">ユーザー権限一覧</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Ownerは楢原悠太郎さんのみ固定です。Admin/Manager/MemberはOwnerが変更できます。
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${profileStatus === "error" ? "bg-red-50 text-red-700" : profileStatus === "loading" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {profileStatus === "loading" ? "読込中" : profileStatus === "error" ? "要確認" : `${profiles.length}名`}
                </span>
              </div>

              {profileMessage ? (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{profileMessage}</p>
              ) : null}

              {!canManageSettings ? (
                <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                  現在の権限では設定変更はできません。ユーザー情報は確認のみ可能です。
                </p>
              ) : null}

              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-black text-slate-900">ユーザー招待</h5>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Ownerが新しいメンバーへ招待メールを送り、初期権限をprofilesへ登録します。
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${currentAuthSource === "supabase" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {currentAuthSource === "supabase" ? "本ログイン" : "デモ確認中"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-[1.1fr_1.3fr_1fr_1fr_1fr_140px]">
                  <input
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder="氏名"
                    value={inviteName}
                    disabled={!canChangeUserRoles || isInviting}
                    onChange={(event) => setInviteName(event.target.value)}
                  />
                  <input
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder="メールアドレス"
                    type="email"
                    value={inviteEmail}
                    disabled={!canChangeUserRoles || isInviting}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                  <select
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    value={inviteDepartment}
                    disabled={!canChangeUserRoles || isInviting}
                    onChange={(event) => setInviteDepartment(event.target.value)}
                  >
                    {normalizedDepartments.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                  <input
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder="役職"
                    value={invitePosition}
                    disabled={!canChangeUserRoles || isInviting}
                    onChange={(event) => setInvitePosition(event.target.value)}
                  />
                  <select
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    value={inviteRole}
                    disabled={!canChangeUserRoles || isInviting}
                    onChange={(event) => setInviteRole(event.target.value as AppRole)}
                  >
                    {OPERATIONAL_ROLE_OPTIONS.filter((option) => option.value !== "owner").map((option) => (
                      <option key={`invite-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button
                    className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    type="button"
                    disabled={!canChangeUserRoles || isInviting || !inviteName.trim() || !inviteEmail.trim()}
                    onClick={() => void inviteUser()}
                  >
                    {isInviting ? "送信中" : "招待"}
                  </button>
                </div>
                {inviteStatus ? (
                  <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">{inviteStatus}</p>
                ) : null}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="p-3">ユーザー</th>
                      <th className="p-3">所属</th>
                      <th className="p-3">部門・役職変更</th>
                      <th className="p-3">現在の権限</th>
                      <th className="p-3">権限変更</th>
                      <th className="p-3">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile) => {
                      const isOwner = profile.role === "owner";
                      const isSaving = savingProfileId === profile.id;
                      const canEditRole = canChangeUserRoles && !isOwner;
                      const canEditProfileDetails = canChangeUserRoles;
                      const draft = getProfileDraft(profile);
                      const profileDepartmentOptions = normalizeDepartmentList([...normalizedDepartments, profile.departmentName, draft.departmentName]);
                      const normalizedDraftPosition = draft.position.trim() || "未設定";
                      const profileDetailsChanged = draft.departmentName !== profile.departmentName || normalizedDraftPosition !== profile.position;
                      return (
                        <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                          <td className="p-3">
                            <p className="font-black text-slate-950">{profile.displayName}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{profile.email || "メール未設定"}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-800">{profile.departmentName}</p>
                            <p className="mt-1 text-xs text-slate-500">{profile.position}</p>
                          </td>
                          <td className="p-3">
                            <div className="grid min-w-[330px] gap-2 lg:grid-cols-[1fr_1fr_72px]">
                              <select
                                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                value={draft.departmentName}
                                disabled={!canEditProfileDetails || isSaving}
                                onChange={(event) => updateProfileDraft(profile.id, { departmentName: event.target.value, position: draft.position })}
                              >
                                {profileDepartmentOptions.map((department) => (
                                  <option key={`${profile.id}-${department}`} value={department}>{department}</option>
                                ))}
                              </select>
                              <input
                                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                placeholder="役職"
                                value={draft.position}
                                disabled={!canEditProfileDetails || isSaving}
                                onChange={(event) => updateProfileDraft(profile.id, { departmentName: draft.departmentName, position: event.target.value })}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && profileDetailsChanged && normalizedDraftPosition) {
                                    void updateProfileDepartmentAndPosition(profile);
                                  }
                                }}
                              />
                              <button
                                className="h-10 rounded-lg bg-slate-900 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                                type="button"
                                disabled={!canEditProfileDetails || isSaving || !profileDetailsChanged || !draft.departmentName.trim()}
                                onClick={() => void updateProfileDepartmentAndPosition(profile)}
                              >
                                保存
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            <PermissionBadge rank={profile.roleLabel} />
                          </td>
                          <td className="p-3">
                            {isOwner ? (
                              <span className="text-xs font-bold text-slate-500">Owner固定</span>
                            ) : (
                              <select
                                className="h-10 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                value={profile.role}
                                disabled={!canEditRole || isSaving}
                                onChange={(event) => void updateProfileRole(profile, event.target.value as AppRole)}
                              >
                                {OPERATIONAL_ROLE_OPTIONS.filter((option) => option.value !== "owner").map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex min-w-20 justify-center rounded-md px-2 py-1 text-xs font-black ring-1 ${profile.isActive ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                              {profile.isActive ? "有効" : "停止"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeSetting.key === "departments" ? (
            <div className="mt-5 rounded-lg border border-slate-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold">部門マスタ</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ここで登録した部門が、課題登録の選択メニューとダッシュボードの部門別進捗率に反映されます。
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {normalizedDepartments.length}件
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px]">
                <input
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#D6001C]"
                  placeholder="例: 整備部"
                  value={newDepartment}
                  onChange={(event) => setNewDepartment(event.target.value)}
                />
                <button
                  className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="button"
                  disabled={!newDepartment.trim()}
                  onClick={() => {
                    onAddDepartment?.(newDepartment);
                    setNewDepartment("");
                  }}
                >
                  追加
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                {normalizedDepartments.map((department) => (
                  <div key={department} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="text-sm font-bold text-slate-800">{department}</span>
                    <button
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:opacity-40"
                      type="button"
                      disabled={normalizedDepartments.length <= 1}
                      onClick={() => onDeleteDepartment?.(department)}
                    >
                      <Trash2 size={13} />
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeSetting.key === "permissions" ? (
            <div className="mt-5 rounded-lg border border-slate-100 p-4">
              <h4 className="text-sm font-bold">現在の権限ランク</h4>
              <div className="mt-3 grid gap-2">
                {permissionRanks.map((permission) => (
                  <div key={`detail-${permission.rank}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm md:grid-cols-[120px_1fr] md:items-center">
                    <PermissionBadge rank={permission.rank} />
                    <span className="text-slate-600">{permission.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeSetting.key === "ai" ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {["要約", "分類", "候補化"].map((step) => (
                <div key={step} className="rounded-lg border border-blue-100 bg-white p-4">
                  <p className="text-xs font-bold text-blue-600">AI Secretary</p>
                  <h4 className="mt-1 font-bold">{step}</h4>
                  <p className="mt-2 text-xs leading-5 text-slate-500">人間承認前の下書きとして保持し、勝手に登録・送信しません。</p>
                </div>
              ))}
            </div>
          ) : null}
        </PanelCard>
      </section>
    </PageFrame>
  );
}

export function InboxPage() {
  return <AiSuggestionsPage />;
}

function PageFrame({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-5">
      <PanelCard className="p-6">
        <p className="text-sm font-bold tracking-wide text-[#D6001C]">TJ-TeamOS</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{lead}</p>
      </PanelCard>
      {children}
    </div>
  );
}
