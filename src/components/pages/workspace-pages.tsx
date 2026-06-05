"use client";

import { PanelCard, PriorityBadge, ProgressBar, StatusBadge } from "@/components/ui/dashboard-ui";
import { can } from "@/lib/domain/permissions";
import { normalizePriority, sortByPriorityAndDueDate } from "@/lib/domain/priority";
import { departmentProgress, kanbanColumns, myTasks, pageDemo, TaskPriority, TaskStatus, TaskSummary } from "@/lib/dashboard-demo-data";
import { loadLocalTaskRecords, saveLocalTaskRecords, saveTaskRecord } from "@/lib/tasks/task-record-store";
import { AppRole } from "@/types/database";
import { Bot, ClipboardList, Inbox, ListChecks, Search, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  appRole?: AppRole;
};

export type ActivityLogEntry = {
  actor: string;
  action: string;
  target: string;
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
};

export type TaskRecord = {
  progress: number;
  todoMemo: string;
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

type ApprovalsPageProps = NavigateHandler & {
  approvalRequests?: ApprovalRequestEntry[];
  resolvedApprovalIds?: string[];
  onResolveApproval?: (approval: ApprovalRequestEntry, mode: "approve" | "sendback", comment: string) => void;
  onReviewApproval?: (approval: ApprovalRequestEntry, comment: string) => void;
  onSendBackTask?: (task: SendbackTaskEntry) => void;
  approvalHistory?: ApprovalHistoryEntry[];
  onRecordApproval?: (entry: ApprovalHistoryEntry) => void;
};

export function IssuesPage({ onNavigate, onAddLog, onCreateTask, onUpdateIssue, onDeleteIssue, onRestoreIssue, createdIssues = [], currentUserName = "山田 太郎", currentUserId, appRole = "viewer" }: NavigateHandler) {
  const [actionMessage, setActionMessage] = useState("課題を選んで、詳細確認・タスク化・削除を行えます。");
  const [deletedIssueIds, setDeletedIssueIds] = useState<string[]>([]);
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null);
  const [editIssueId, setEditIssueId] = useState<string | null>(null);
  const [taskizeIssueId, setTaskizeIssueId] = useState<string | null>(null);
  const [deleteIssueId, setDeleteIssueId] = useState<string | null>(null);
  const [responsiblePerson, setResponsiblePerson] = useState("山田 太郎");
  const [assigneePerson, setAssigneePerson] = useState("未選択");
  const flowSteps = ["課題登録", "タスク振り分け", "担当者が実行", "完了報告", "承認後に完了"];
  const activeCreatedIssues = useMemo(() => createdIssues.filter((issue) => !issue.deletedAt), [createdIssues]);
  const deletedCreatedIssues = useMemo(() => createdIssues.filter((issue) => issue.deletedAt), [createdIssues]);
  const allIssues = useMemo(() => [...activeCreatedIssues, ...pageDemo.issues], [activeCreatedIssues]);
  const visibleIssues = allIssues.filter((issue) => !deletedIssueIds.includes(issue.id));
  const detailIssue = detailIssueId ? allIssues.find((issue) => issue.id === detailIssueId) : undefined;
  const editIssue = editIssueId ? createdIssues.find((issue) => issue.id === editIssueId) : undefined;
  const taskizeIssue = taskizeIssueId ? allIssues.find((issue) => issue.id === taskizeIssueId) : undefined;
  const pendingDeleteIssue = deleteIssueId ? allIssues.find((issue) => issue.id === deleteIssueId) : undefined;
  const memberOptions = ["未選択", "山田 太郎", "山田 花子", "佐藤 一郎", "鈴木 太郎", "田中 美咲", "高橋 健"];
  const canEditIssues = can(appRole, "issues", "update");
  const canDeleteIssues = can(appRole, "issues", "delete");

  const openTaskize = (issueId: string) => {
    const issue = allIssues.find((item) => item.id === issueId);
    setTaskizeIssueId(issueId);
    setResponsiblePerson(issue?.owner && issue.owner !== "未設定" ? issue.owner : "山田 太郎");
    setAssigneePerson("未選択");
    setDetailIssueId(null);
    setEditIssueId(null);
    setDeleteIssueId(null);
    setActionMessage(`${issueId} のタスク化準備中です。担当責任者と担当者を選択してください。`);
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
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">課題</th>
                <th className="p-3">部門</th>
                <th className="p-3">担当</th>
                <th className="p-3">優先度</th>
                <th className="p-3">Status</th>
                <th className="p-3">期限</th>
                <th className="p-3">次の操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleIssues.map((issue) => {
                const createdIssue = getCreatedIssue(issue);
                const canEditThisIssue = createdIssue ? canEditCreatedIssue(createdIssue, currentUserName, appRole, currentUserId) : false;
                return (
                  <tr key={issue.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                    <td className="p-3 font-mono text-xs text-slate-500">{issue.id}</td>
                    <td className="p-3 font-semibold">{issue.title}</td>
                    <td className="p-3">{issue.department}</td>
                    <td className="p-3">{issue.owner}</td>
                    <td className="p-3"><IssuePriorityBadge priority={issue.priority} /></td>
                    <td className="p-3"><IssueStatusBadge status={issue.status} /></td>
                    <td className="p-3 font-bold text-[#D6001C]">{issue.due}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C]" type="button" onClick={() => setDetailIssueId(issue.id)}>
                          詳細
                        </button>
                        {createdIssue ? (
                          <button
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300"
                            type="button"
                            disabled={!canEditThisIssue}
                            onClick={() => {
                              setEditIssueId(createdIssue.id);
                              setDetailIssueId(null);
                              setTaskizeIssueId(null);
                              setDeleteIssueId(null);
                            }}
                          >
                            編集
                          </button>
                        ) : null}
                        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300" type="button" disabled={!canEditIssues} onClick={() => openTaskize(issue.id)}>
                          タスク化
                        </button>
                        <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-950 disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canDeleteIssues} onClick={() => openDeleteConfirm(issue.id)}>
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
            <DetailBox label="登録日時 / 発生日" value={detailIssue.createdAt} />
            <DetailBox label="As-Is" value={getIssueAsIsValue(detailIssue)} />
            <DetailBox label="To-Be" value={getIssueToBe(detailIssue.id)} />
          </div>
        </PanelCard>
      ) : null}

      {editIssue ? (
        <IssueEditPanel
          issue={editIssue}
          onCancel={() => setEditIssueId(null)}
          onSave={(issue) => {
            onUpdateIssue?.(issue);
            setEditIssueId(null);
            setActionMessage(`${issue.id} を更新しました。更新日時: ${issue.updatedAt}`);
            onAddLog?.({
              actor: currentUserName,
              action: "課題を編集",
              target: issue.title,
              time: issue.updatedAt ?? formatDateTime(new Date()),
            });
          }}
        />
      ) : null}

      {pendingDeleteIssue ? (
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
      ) : null}

      {taskizeIssue ? (
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
  onCancel,
  onSave,
}: {
  issue: CreatedIssueEntry;
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
  const canSave = Boolean(title.trim() && department.trim() && owner.trim() && due.trim() && asIs.trim());

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
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={department} onChange={(event) => setDepartment(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          担当者
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
  return canEditCreatedRecord(task, currentUserName, appRole, "tasks", currentUserId);
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

function getIssueToBe(issueId: string) {
  if (issueId === "ISS-001") return "MVVと判断基準が共有され、部門をまたいでも同じ基準で判断できる状態。";
  if (issueId === "ISS-002") return "研修ルールが標準化され、新人・既存メンバーが同じ手順で対応できる状態。";
  return "端末利用とデータ持ち出しルールが明確になり、監査可能な状態。";
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
  appRole = "viewer",
  requesterName = "山田 太郎",
  currentUserName = requesterName,
  currentUserId,
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
  const allTaskSummaries = useMemo(() => [...myTasks, ...activeCreatedTasks, ...teamTaskSummaries, ...allSendbackTasks], [activeCreatedTasks, allSendbackTasks]);
  const initialRecords = useMemo(() => buildInitialTaskRecords(allTaskSummaries), [allTaskSummaries]);
  const [taskRecords, setTaskRecords] = useState<Record<string, TaskRecord>>(initialRecords);
  const [saveMessage, setSaveMessage] = useState("進捗報告と承認申請は、このブラウザに保存されます。Supabase接続後はDB保存に切り替わります。");
  const [activeAction, setActiveAction] = useState<TaskAction>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [taskView, setTaskView] = useState<"mine" | "team" | "approval" | "sendback">("mine");
  const activeTask = activeAction ? allTaskSummaries.find((task) => task.id === activeAction.taskId) : undefined;
  const activeRecord = activeTask ? taskRecords[activeTask.id] : undefined;
  const editTask = editTaskId ? activeCreatedTasks.find((task) => task.id === editTaskId) : undefined;
  const visibleTasks = sortTasksByPriority(
    taskView === "mine"
      ? myTasks
      : taskView === "team"
        ? allTaskSummaries
        : taskView === "approval"
          ? allTaskSummaries.filter((task) => task.status === "approval_pending" || (taskRecords[task.id]?.approvalRequestedAt))
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
    { key: "mine", label: "自分のタスク", count: myTasks.length },
    { key: "team", label: "チームタスク", count: allTaskSummaries.length },
    { key: "approval", label: "承認待ちタスク", count: allTaskSummaries.filter((task) => task.status === "approval_pending" || taskRecords[task.id]?.approvalRequestedAt).length },
    { key: "sendback", label: "差し戻しタスク", count: allSendbackTasks.length },
  ] as const;
  const canUpdateTasks = can(appRole, "tasks", "update");
  const canDeleteTasks = can(appRole, "tasks", "delete");
  const canCreateApprovals = can(appRole, "approvals", "create");

  useEffect(() => {
    setTaskRecords(loadLocalTaskRecords(initialRecords));
  }, [initialRecords]);

  useEffect(() => {
    if (preferredView) setTaskView(preferredView);
  }, [preferredView]);

  const openAction = (taskId: string, mode: "progress" | "approval") => {
    setActiveAction({ taskId, mode });
    setEditTaskId(null);
  };

  const saveProgress = (taskId: string, memo: string, progress: number) => {
    const timestamp = formatDateTime(new Date());
    const persistenceTaskId = createdTaskDetails[taskId]?.supabaseId ?? taskId;
    setTaskRecords((records) => {
      const nextRecord = {
        ...records[taskId],
        progress,
        todoMemo: memo,
        updates: [{ at: timestamp, memo, progress }, ...records[taskId].updates],
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
    setTaskRecords((records) => {
      const nextRecord = {
        ...records[taskId],
        progress: Math.max(records[taskId].progress, 95),
        approvalToBe: toBe,
        approvalRequestedAt: timestamp,
        updates: [{ at: timestamp, memo: `承認申請: To-Be ${toBe}`, progress: Math.max(records[taskId].progress, 95) }, ...records[taskId].updates],
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
          const record = taskRecords[task.id];
          const status = getTaskStatus(record.progress);
          const latestUpdate = record.updates[0];
          const sendbackDetail = sendbackTaskDetails[task.id];
          const createdTaskDetail = createdTaskDetails[task.id];
          const canEditThisTask = createdTaskDetail ? canEditCreatedTask(createdTaskDetail, currentUserName, appRole, currentUserId) : false;

          return (
            <PanelCard key={task.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{task.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{task.projectName}</p>
                </div>
                <PriorityBadge priority={task.priority} />
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
                <div>
                  <p className="text-xs font-bold text-slate-500">ToDoメモ</p>
                  <p className="mt-1 rounded-lg border border-slate-100 bg-white p-3 text-sm leading-6 text-slate-700">{record.todoMemo}</p>
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
                      <p className="mt-1 leading-5 text-slate-600">{update.memo}</p>
                    </div>
                  ))}
                </div>
              </div>

              {record.approvalRequestedAt ? (
                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-800">
                  <strong>承認申請済み</strong>
                  <p className="mt-1">申請日時: {record.approvalRequestedAt}</p>
                  <p className="mt-1">To-Be: {record.approvalToBe}</p>
                </div>
              ) : null}

              {createdTaskDetail ? (
                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <strong>{createdTaskDetail.sourceType === "direct" ? "新規タスク登録" : "課題からタスク化"}</strong>
                  <p className="mt-1">{createdTaskDetail.sourceType === "direct" ? "登録" : `元課題: ${createdTaskDetail.sourceIssueId}`} / 発生日: {createdTaskDetail.issueCreatedAt}</p>
                  <p className="mt-1">担当責任者: {createdTaskDetail.responsiblePerson} / 担当者: {createdTaskDetail.assigneePerson}</p>
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

              <div className="mt-5 flex gap-2">
                {createdTaskDetail ? (
                  <button
                    className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300"
                    type="button"
                    disabled={!canEditThisTask}
                    onClick={() => {
                      setEditTaskId(createdTaskDetail.id);
                      setActiveAction(null);
                    }}
                  >
                    編集
                  </button>
                ) : null}
                <button className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300" type="button" disabled={!canUpdateTasks} onClick={() => openAction(task.id, "progress")}>
                  進捗報告
                </button>
                <button className="h-9 rounded-lg bg-[#D6001C] px-3 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canCreateApprovals} onClick={() => openAction(task.id, "approval")}>
                  承認申請
                </button>
                {createdTaskDetail ? (
                  <button className="h-9 rounded-lg bg-slate-800 px-3 text-xs font-bold text-white hover:bg-slate-950 disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canDeleteTasks} onClick={() => deleteTask(createdTaskDetail)}>
                    削除
                  </button>
                ) : null}
              </div>
            </PanelCard>
          );
        })}
      </div>

      {editTask ? (
        <TaskEditPanel
          task={editTask}
          onCancel={() => setEditTaskId(null)}
          onSave={(task) => {
            onUpdateTask?.(task);
            setEditTaskId(null);
            setSaveMessage(`${task.title} を更新しました。更新日時: ${task.updatedAt}`);
          }}
        />
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
        <TaskActionPanel
          mode={activeAction?.mode ?? "progress"}
          taskTitle={activeTask.title}
          currentProgress={activeRecord.progress}
          currentMemo={activeRecord.todoMemo}
          onCancel={() => setActiveAction(null)}
          onSaveProgress={(memo, progress) => saveProgress(activeTask.id, memo, progress)}
          onRequestApproval={(toBe, reviewer) => requestApproval(activeTask.id, toBe, reviewer)}
          approvalReviewerOptions={approvalReviewerOptions}
          finalApprover={finalApprover}
        />
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
  const [dueDate, setDueDate] = useState(task.dueDate);
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
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#D6001C]" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
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
              dueDate: dueDate.trim(),
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
  onCancel: () => void;
  onSaveProgress: (memo: string, progress: number) => void;
  onRequestApproval: (toBe: string, reviewer?: ApprovalReviewerOption) => void;
  approvalReviewerOptions?: ApprovalReviewerOption[];
  finalApprover?: ApprovalReviewerOption;
}) {
  const [memo, setMemo] = useState(currentMemo);
  const [progress, setProgress] = useState(currentProgress);
  const [toBe, setToBe] = useState("");
  const [reviewerId, setReviewerId] = useState(approvalReviewerOptions[0]?.id ?? "");
  const selectedReviewer = approvalReviewerOptions.find((reviewer) => reviewer.id === reviewerId) ?? approvalReviewerOptions[0];

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
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            ToDoメモ
            <textarea className="min-h-28 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700 outline-none focus:border-[#D6001C]" value={memo} onChange={(event) => setMemo(event.target.value)} />
          </label>
          <div className="grid gap-3">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              タスク進捗
              <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" max={100} min={0} type="number" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
            </label>
            <ProgressBar value={progress} />
            <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white" type="button" onClick={() => onSaveProgress(memo, clampProgress(progress))}>
              進捗報告を保存
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
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
            To-Be
            <textarea className="min-h-32 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700 outline-none focus:border-[#D6001C]" placeholder="完了後にどういう状態になっているべきかを入力" value={toBe} onChange={(event) => setToBe(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white" type="button" onClick={() => onRequestApproval(toBe || "完了条件を満たし、上長確認待ちの状態", selectedReviewer)}>
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
      {
        progress: task.progress,
        todoMemo: getInitialTodoMemo(index),
        updates: [
          {
            at: getInitialUpdateTime(index),
            memo: getInitialTodoMemo(index),
            progress: task.progress,
          },
        ],
      },
    ]),
  ) as Record<string, TaskRecord>;
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
  const canApproveRequests = can(appRole ?? "viewer", "approvals", "approve");

  const completeApprovalAction = (comment: string) => {
    if (!activeAction || !activeApproval) return;

    if (activeAction.mode === "review") {
      if (!canReviewApproval(activeApproval, currentUserId)) return;
      onReviewApproval?.(activeApproval, comment);
      setResultMessage(`${activeApproval.id} を確認済みにしました。コメント: ${comment}`);
      setActiveAction(null);
      return;
    }

    if (!canFinalizeApproval(activeApproval, currentUserId, appRole ?? "viewer")) return;
    if (!activeApproval.reviewedAt) {
      setResultMessage(`${activeApproval.id} は確認承認者の確認待ちです。確認済み後に最終決裁できます。`);
      setActiveAction(null);
      return;
    }

    onResolveApproval?.(activeApproval, activeAction.mode, comment);
    if (activeAction.mode === "approve") {
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
      return;
    }

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
              <button className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300" type="button" disabled={!canReviewApproval(approval, currentUserId) || Boolean(approval.reviewedAt)} onClick={() => setActiveAction({ approvalId: approval.id, mode: "review" })}>確認済みにする</button>
              <button className="h-9 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300" type="button" disabled={!canApproveRequests || !canFinalizeApproval(approval, currentUserId, appRole ?? "viewer")} onClick={() => setActiveAction({ approvalId: approval.id, mode: "approve" })}>最終承認</button>
              <button className="h-9 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-[#D6001C] hover:text-[#D6001C] disabled:cursor-not-allowed disabled:text-slate-300" type="button" disabled={!canApproveRequests || !canFinalizeApproval(approval, currentUserId, appRole ?? "viewer")} onClick={() => setActiveAction({ approvalId: approval.id, mode: "sendback" })}>差し戻し</button>
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
        <ApprovalCommentPanel
          approvalTarget={activeApproval.target}
          mode={activeAction.mode}
          onCancel={() => setActiveAction(null)}
          onSubmit={completeApprovalAction}
        />
      ) : null}
    </PageFrame>
  );
}

function canFinalizeApproval(approval: ApprovalRequestEntry, currentUserId?: string, appRole: AppRole = "viewer") {
  if (appRole !== "owner") return false;
  if (!approval.reviewedAt) return false;
  return !approval.finalApproverId || approval.finalApproverId === currentUserId;
}

function canReviewApproval(approval: ApprovalRequestEntry, currentUserId?: string) {
  return Boolean(currentUserId && approval.reviewerId && approval.reviewerId === currentUserId);
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
  const label = mode === "approve" ? "承認コメント" : "差し戻しコメント";
  const buttonLabel = mode === "approve" ? "コメント付きで承認" : "コメント付きで差し戻し";

  return (
    <PanelCard className="border-[#D6001C]/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[#D6001C]">{mode === "approve" ? "承認" : "差し戻し"}</p>
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
          placeholder={mode === "approve" ? "承認理由や確認した内容を入力" : "戻す理由と修正してほしい内容を入力"}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white" type="button" onClick={() => onSubmit(comment || "コメント未入力")}>
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
  { department: "営業部", position: "本部長", name: "山田 太郎", permission: "Owner" },
  { department: "営業部", position: "課長", name: "山田 花子", permission: "Approver" },
  { department: "買取部", position: "主任", name: "佐藤 一郎", permission: "Editor" },
  { department: "販売部", position: "リーダー", name: "鈴木 太郎", permission: "Editor" },
  { department: "総務部", position: "担当", name: "田中 美咲", permission: "Viewer" },
  { department: "システム部", position: "管理者", name: "高橋 健", permission: "Admin" },
];

function PermissionBadge({ rank }: { rank: string }) {
  const config =
    rank === "Owner"
      ? "bg-red-50 text-red-700 ring-red-200"
      : rank === "Admin"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
        : rank === "Approver"
          ? "bg-orange-50 text-orange-700 ring-orange-200"
          : rank === "Editor"
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
  const logs = [...activityLogs, ...pageDemo.logs];
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
          {logs.map((log) => (
            <div key={`${log.actor}-${log.action}-${log.target}-${log.time}`} className="grid gap-2 rounded-lg border border-slate-100 p-4 md:grid-cols-[160px_1fr_180px_150px] md:items-center">
              <strong>{log.actor}</strong>
              <span>{log.action}</span>
              <span className="text-slate-500">{log.target}</span>
              <span className="font-mono text-xs font-semibold text-slate-600">{log.time}</span>
            </div>
          ))}
        </div>
      </PanelCard>
    </PageFrame>
  );
}

export function SettingsPage() {
  const settingDetails = [
    {
      key: "users",
      label: "ユーザー設定",
      icon: Users,
      status: "デモ表示中",
      lead: "ログインユーザーの氏名、所属部門、役職、連絡先を管理します。",
      items: ["氏名・メールアドレス", "所属部門・役職", "ログイン状態", "個人連携アカウント"],
    },
    {
      key: "permissions",
      label: "権限設定",
      icon: ShieldCheck,
      status: "操作可能",
      lead: "権限ランクを追加し、メンバーごとに閲覧・編集・承認範囲を制御します。",
      items: ["Owner: 全権限", "Admin: 管理者", "Approver: 承認者", "Editor: 編集者", "Viewer: 閲覧者"],
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
      key: "approvalRules",
      label: "承認ルール設定",
      icon: ListChecks,
      status: "デモ表示中",
      lead: "承認が必要な条件、承認者、差し戻し時の戻し先を設定します。",
      items: ["Mustタスクは承認必須", "部門長承認", "差し戻し時はタスクへ戻す", "承認コメント必須"],
    },
  ] as const;
  const [activeSettingKey, setActiveSettingKey] = useState<(typeof settingDetails)[number]["key"]>("permissions");
  const [permissionRanks, setPermissionRanks] = useState([
    { rank: "Owner", description: "全権限。会社・全データ・権限設定を管理できます。" },
    { rank: "Admin", description: "管理者。部門横断の設定とメンバー管理ができます。" },
    { rank: "Approver", description: "承認者。承認申請の承認・差し戻しができます。" },
    { rank: "Editor", description: "編集者。課題・タスクの登録と進捗更新ができます。" },
    { rank: "Viewer", description: "閲覧者。閲覧のみ可能です。" },
  ]);
  const [newRank, setNewRank] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const activeSetting = settingDetails.find((setting) => setting.key === activeSettingKey) ?? settingDetails[1];
  const ActiveIcon = activeSetting.icon;

  return (
    <PageFrame title="設定" lead="通知、権限、外部連携、AI連携、承認ルールを管理します。">
      <PanelCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-bold">権限ランク追加</h3>
            <p className="mt-1 text-sm text-slate-500">チームページで使う権限ランクを追加できます。本実装ではログインユーザーIDにこのランクを紐づけます。</p>
          </div>
          <PermissionBadge rank="Admin" />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[180px_1fr_120px]">
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="例: Manager" value={newRank} onChange={(event) => setNewRank(event.target.value)} />
          <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="権限の説明" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} />
          <button
            className="h-10 rounded-lg bg-[#D6001C] px-4 text-sm font-bold text-white disabled:bg-slate-300"
            disabled={!newRank.trim()}
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
        <p className="text-sm font-bold uppercase tracking-wide text-[#D6001C]">Tauros TeamOS</p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{lead}</p>
      </PanelCard>
      {children}
    </div>
  );
}
