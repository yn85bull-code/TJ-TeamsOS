"use client";

import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { LoginScreen } from "@/components/auth/login-screen";
import { CreateDrawer, CreateDrawerPayload } from "@/components/layout/create-drawer";
import { Sidebar } from "@/components/layout/sidebar";
import { TopHeader } from "@/components/layout/top-header";
import {
  ActivityLogEntry,
  ActivityLogsPage,
  AiSuggestionsPage,
  ApprovalHistoryEntry,
  ApprovalRequestEntry,
  ApprovalReviewerOption,
  ApprovalsPage,
  CreatedTaskEntry,
  CreatedIssueEntry,
  IssuesPage,
  ReportsPage,
  SendbackTaskEntry,
  SettingsPage,
  TasksPage,
  TeamsPage,
} from "@/components/pages/workspace-pages";
import { AuthUser, demoUsers } from "@/lib/auth-demo-data";
import { navItems } from "@/lib/dashboard-demo-data";
import { can, mapDemoRoleToAppRole } from "@/lib/domain/permissions";
import { normalizePriority } from "@/lib/domain/priority";
import { signOutSupabase } from "@/lib/supabase/auth";
import { createActivityLogRecord, loadActivityLogsFromSupabase } from "@/lib/workspace/activity-log-store";
import { createApprovalRecord, loadApprovalRecordsFromSupabase, updateApprovalDecision, updateApprovalReview } from "@/lib/workspace/approval-record-store";
import { createIssueRecord, createTaskRecord, loadCreatedRecordsFromSupabase, restoreIssueRecord, restoreTaskRecord, softDeleteIssueRecord, softDeleteTaskRecord, updateIssueRecord, updateTaskRecord } from "@/lib/workspace/created-record-store";
import { createNotificationRecord, loadNotificationsFromSupabase, markNotificationReadRecord, markNotificationsReadRecord, type AppNotificationEntry } from "@/lib/workspace/notification-store";
import { AppRole } from "@/types/database";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const APPROVAL_REQUESTS_STORAGE_KEY = "tauros-teamos.approval-requests.v1";
const RESOLVED_APPROVALS_STORAGE_KEY = "tauros-teamos.resolved-approvals.v1";
const APPROVAL_HISTORY_STORAGE_KEY = "tauros-teamos.approval-history.v1";
const SENDBACK_TASKS_STORAGE_KEY = "tauros-teamos.sendback-tasks.v1";
const CREATED_TASKS_STORAGE_KEY = "tauros-teamos.created-tasks.v1";
const CREATED_ISSUES_STORAGE_KEY = "tauros-teamos.created-issues.v1";
const ACTIVITY_LOGS_STORAGE_KEY = "tauros-teamos.activity-logs.v1";
const NOTIFICATIONS_STORAGE_KEY = "tauros-teamos.notifications.v1";
const SOLE_OWNER_USER_ID = "user-owner-yamada";
const SOLE_OWNER_EMAIL = "yamada@example.com";

type NotificationRecipient = {
  id: string;
  name: string;
};

export default function Home() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeKey, setActiveKey] = useState("dashboard");
  const [createOpen, setCreateOpen] = useState(false);
  const [createNotice, setCreateNotice] = useState<{ label: string; registeredAt: string } | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequestEntry[]>([]);
  const [resolvedApprovalIds, setResolvedApprovalIds] = useState<string[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [sendbackTasks, setSendbackTasks] = useState<SendbackTaskEntry[]>([]);
  const [createdTasks, setCreatedTasks] = useState<CreatedTaskEntry[]>([]);
  const [createdIssues, setCreatedIssues] = useState<CreatedIssueEntry[]>([]);
  const [preferredTaskView, setPreferredTaskView] = useState<"mine" | "team" | "approval" | "sendback" | undefined>();
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [headerNotifications, setHeaderNotifications] = useState<AppNotificationEntry[]>([]);
  const activeItem = useMemo(
    () => navItems.find((item) => item.key === activeKey) ?? navItems[0],
    [activeKey],
  );
  const currentAppRole = useMemo<AppRole>(
    () => getEffectiveAppRole(currentUser),
    [currentUser],
  );
  const finalApprover = useMemo(() => getSoleOwnerApprover(currentUser), [currentUser]);
  const approvalReviewerOptions = useMemo(() => getApprovalReviewerOptions(), []);
  const visibleHeaderNotifications = useMemo(
    () => headerNotifications.filter((notification) => shouldShowNotification(notification, currentUser)),
    [currentUser, headerNotifications],
  );
  const openCreateDrawer = () => {
    setCreateNotice(null);
    setCreateOpen(true);
  };

  useEffect(() => {
    setApprovalRequests(loadStoredList<ApprovalRequestEntry>(APPROVAL_REQUESTS_STORAGE_KEY));
    setResolvedApprovalIds(loadStoredList<string>(RESOLVED_APPROVALS_STORAGE_KEY));
    setApprovalHistory(loadStoredList<ApprovalHistoryEntry>(APPROVAL_HISTORY_STORAGE_KEY));
    setSendbackTasks(loadStoredList<SendbackTaskEntry>(SENDBACK_TASKS_STORAGE_KEY));
    setCreatedTasks(loadStoredList<CreatedTaskEntry>(CREATED_TASKS_STORAGE_KEY));
    setCreatedIssues(loadStoredList<CreatedIssueEntry>(CREATED_ISSUES_STORAGE_KEY));
    setActivityLogs(loadStoredList<ActivityLogEntry>(ACTIVITY_LOGS_STORAGE_KEY));
    setHeaderNotifications(loadStoredList<AppNotificationEntry>(NOTIFICATIONS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.authSource !== "supabase") return;

    let cancelled = false;
    void loadCreatedRecordsFromSupabase(currentUser.id, currentUser.name).then((records) => {
      if (cancelled || records.target !== "supabase") return;
      setCreatedIssues((items) => mergeByRecordId([...records.issues, ...records.deletedIssues], items));
      setCreatedTasks((items) => mergeByRecordId([...records.tasks, ...records.deletedTasks], items));
    });
    void loadApprovalRecordsFromSupabase(currentUser.id).then((records) => {
      if (cancelled || records.target !== "supabase") return;
      setApprovalRequests((items) => mergeByRecordId(records.requests, items));
      setApprovalHistory((items) => mergeByRecordId(records.histories, items));
      setSendbackTasks((items) => mergeByRecordId(records.sendbacks, items));
    });
    void loadActivityLogsFromSupabase(currentUser.id).then((records) => {
      if (cancelled || records.target !== "supabase") return;
      setActivityLogs((items) => mergeByRecordId(records.logs, items));
    });
    void loadNotificationsFromSupabase(currentUser.id).then((records) => {
      if (cancelled || records.target !== "supabase") return;
      setHeaderNotifications((items) => mergeByRecordId(records.notifications, items));
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    saveStoredList(APPROVAL_REQUESTS_STORAGE_KEY, approvalRequests);
  }, [approvalRequests]);

  useEffect(() => {
    saveStoredList(RESOLVED_APPROVALS_STORAGE_KEY, resolvedApprovalIds);
  }, [resolvedApprovalIds]);

  useEffect(() => {
    saveStoredList(APPROVAL_HISTORY_STORAGE_KEY, approvalHistory);
  }, [approvalHistory]);

  useEffect(() => {
    saveStoredList(SENDBACK_TASKS_STORAGE_KEY, sendbackTasks);
  }, [sendbackTasks]);

  useEffect(() => {
    saveStoredList(CREATED_TASKS_STORAGE_KEY, createdTasks);
  }, [createdTasks]);

  useEffect(() => {
    saveStoredList(CREATED_ISSUES_STORAGE_KEY, createdIssues);
  }, [createdIssues]);

  useEffect(() => {
    saveStoredList(ACTIVITY_LOGS_STORAGE_KEY, activityLogs);
  }, [activityLogs]);

  useEffect(() => {
    saveStoredList(NOTIFICATIONS_STORAGE_KEY, headerNotifications);
  }, [headerNotifications]);

  const createApprovalRequest = async (approval: ApprovalRequestEntry) => {
    const fallbackReviewer = approvalReviewerOptions[0];
    const normalizedApproval = {
      ...approval,
      requesterId: approval.requesterId ?? (currentUser?.authSource === "supabase" ? currentUser.id : undefined),
      requester: approval.requester || currentUser?.name || "山田 太郎",
      reviewerId: approval.reviewerId ?? fallbackReviewer?.id,
      reviewerName: approval.reviewerName ?? fallbackReviewer?.name,
      finalApproverId: finalApprover.id,
      finalApproverName: finalApprover.name,
    };
    const saved = await createApprovalRecord(normalizedApproval, normalizedApproval.requesterId);
    setApprovalRequests((items) => [saved.entry, ...items.filter((item) => item.taskId !== saved.entry.taskId)]);
    if (saved.entry.taskId) {
      setSendbackTasks((items) => items.filter((item) => item.id !== saved.entry.taskId));
    }
    setResolvedApprovalIds((ids) => ids.filter((id) => id !== saved.entry.id));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "承認申請を作成",
      target: saved.entry.target,
      targetId: saved.entry.supabaseId,
      targetType: "approval",
      time: saved.entry.requestedAt ?? formatDateTime(new Date()),
    });
    addNotification({
      title: "承認申請が届きました",
      detail: `${saved.entry.requester}さんから「${saved.entry.target}」の承認申請。確認承認者: ${saved.entry.reviewerName ?? "未設定"} / 最終決裁: ${saved.entry.finalApproverName ?? finalApprover.name}`,
      target: "approvals",
      notificationType: "approval",
      targetType: "approval",
      targetId: saved.entry.supabaseId,
      targetLabel: saved.entry.target,
    }, resolveApprovalRequestRecipients(saved.entry, currentUser));
    setPreferredTaskView("approval");
    setActiveKey("approvals");
  };

  const resolveApproval = (approval: ApprovalRequestEntry, mode: "approve" | "sendback", comment: string) => {
    setResolvedApprovalIds((ids) => [...new Set([...ids, approval.id])]);
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: mode === "approve" ? "承認申請を承認" : "承認申請を差し戻し",
      target: approval.target,
      targetId: approval.supabaseId,
      targetType: "approval",
      time: formatDateTime(new Date()),
    });
    void updateApprovalDecision(
      approval,
      mode,
      comment,
      currentUser?.authSource === "supabase" ? currentUser.id : undefined,
      currentUser?.name,
    );
    addNotification({
      title: mode === "approve" ? "承認されました" : "差し戻されました",
      detail: `「${approval.target}」${mode === "approve" ? "が承認されました" : "が差し戻されました"}`,
      target: mode === "approve" ? "approvals" : "tasks",
      notificationType: mode === "approve" ? "approval_approved" : "approval_sendback",
      targetType: "approval",
      targetId: approval.supabaseId,
      targetLabel: approval.target,
    }, resolveApprovalResultRecipients(approval, currentUser));
  };

  const reviewApproval = (approval: ApprovalRequestEntry, comment: string) => {
    const reviewedAt = formatDateTime(new Date());
    const reviewedApproval: ApprovalRequestEntry = {
      ...approval,
      reviewedById: currentUser?.id,
      reviewedByName: currentUser?.name,
      reviewedAt,
      reviewComment: comment,
      status: "確認済み / 最終決裁待ち",
    };

    setApprovalRequests((items) => items.map((item) => item.id === approval.id ? reviewedApproval : item));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "承認申請を確認済みに変更",
      target: approval.target,
      targetId: approval.supabaseId,
      targetType: "approval",
      time: reviewedAt,
    });
    void updateApprovalReview(
      approval,
      comment,
      currentUser?.authSource === "supabase" ? currentUser.id : undefined,
      currentUser?.name,
    );
    addNotification({
      title: "最終決裁待ちになりました",
      detail: `「${approval.target}」が${currentUser?.name ?? approval.reviewerName ?? "確認承認者"}さんに確認されました`,
      target: "approvals",
      notificationType: "approval_reviewed",
      targetType: "approval",
      targetId: approval.supabaseId,
      targetLabel: approval.target,
    }, approval.finalApproverId ? [{ id: approval.finalApproverId, name: approval.finalApproverName ?? approval.finalApproverId }] : [finalApprover]);
  };

  const sendBackTask = (task: SendbackTaskEntry) => {
    setSendbackTasks((items) => [task, ...items.filter((item) => item.id !== task.id)]);
    setPreferredTaskView("sendback");
  };

  const addActivityLog = (log: ActivityLogEntry) => {
    const normalizedLog = {
      ...log,
      actor: log.actor || currentUser?.name || "山田 太郎",
    };
    setActivityLogs((logs) => [normalizedLog, ...logs]);
    void createActivityLogRecord(
      normalizedLog,
      currentUser?.authSource === "supabase" ? currentUser.id : undefined,
    );
  };

  const addNotification = (
    notification: Omit<AppNotificationEntry, "id" | "time" | "recipientId"> & Partial<Pick<AppNotificationEntry, "id" | "time" | "recipientId">>,
    recipients?: NotificationRecipient[],
  ) => {
    const timestamp = new Date();
    const notificationRecipients = normalizeNotificationRecipients(
      recipients?.length
        ? recipients
        : notification.recipientId
          ? [{ id: notification.recipientId, name: notification.recipientId }]
          : currentUser
            ? [{ id: currentUser.id, name: currentUser.name }]
            : [],
    );
    const entries: AppNotificationEntry[] = notificationRecipients.map((recipient, index) => ({
      ...notification,
      id: notification.id && notificationRecipients.length === 1 ? notification.id : `ntf-${timestamp.getTime()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      time: notification.time ?? formatDateTime(timestamp),
      recipientId: recipient.id,
      actorId: notification.actorId ?? (currentUser?.authSource === "supabase" ? currentUser.id : undefined),
      actorName: notification.actorName ?? currentUser?.name,
    }));

    if (entries.length === 0) return;

    setHeaderNotifications((items) => [
      ...entries,
      ...items.filter((item) => !entries.some((entry) => getRecordMergeKey(item) === getRecordMergeKey(entry))),
    ].slice(0, 80));
    for (const entry of entries) {
      void createNotificationRecord(entry, entry.actorId).then((saved) => {
        if (saved.target !== "supabase") return;
        setHeaderNotifications((items) => items.map((item) => item.id === entry.id ? saved.entry : item));
      });
    }
  };

  const markNotificationRead = (notification: AppNotificationEntry) => {
    const readAt = notification.readAt ?? new Date().toISOString();
    setHeaderNotifications((items) => items.map((item) => getRecordMergeKey(item) === getRecordMergeKey(notification) ? { ...item, readAt } : item));
    void markNotificationReadRecord({ ...notification, readAt }, currentUser?.authSource === "supabase" ? currentUser.id : undefined);
  };

  const markAllNotificationsRead = (notifications: AppNotificationEntry[]) => {
    const readAt = new Date().toISOString();
    const readKeys = new Set(notifications.map(getRecordMergeKey));
    setHeaderNotifications((items) => items.map((item) => readKeys.has(getRecordMergeKey(item)) ? { ...item, readAt } : item));
    void markNotificationsReadRecord(
      notifications.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })),
      currentUser?.authSource === "supabase" ? currentUser.id : undefined,
    );
  };

  const createTaskFromIssue = async (task: CreatedTaskEntry) => {
    const normalizedTask = {
      ...task,
      createdById: task.createdById ?? (currentUser?.authSource === "supabase" ? currentUser.id : undefined),
      createdByName: task.createdByName ?? currentUser?.name ?? "山田 太郎",
    };
    const saved = await createTaskRecord(normalizedTask, normalizedTask.createdById);
    setCreatedTasks((items) => [saved.entry, ...items.filter((item) => item.sourceIssueId !== saved.entry.sourceIssueId)]);
    addNotification({
      title: "タスクが割り当てられました",
      detail: `「${saved.entry.title}」の担当者になりました`,
      target: "tasks",
      notificationType: "task_assigned",
      targetType: "task",
      targetId: saved.entry.supabaseId,
      targetLabel: saved.entry.title,
    }, resolveTaskAssigneeRecipients(saved.entry, currentUser));
    setPreferredTaskView("team");
    setActiveKey("tasks");
  };
  const updateCreatedIssue = (issue: CreatedIssueEntry) => {
    setCreatedIssues((items) => items.map((item) => item.id === issue.id ? issue : item));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "課題を編集",
      target: issue.title,
      targetId: issue.supabaseId,
      targetType: "issue",
      time: issue.updatedAt ?? formatDateTime(new Date()),
    });
    void updateIssueRecord(issue);
  };
  const updateCreatedTask = (task: CreatedTaskEntry) => {
    setCreatedTasks((items) => items.map((item) => item.id === task.id ? task : item));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "タスクを編集",
      target: task.title,
      targetId: task.supabaseId,
      targetType: "task",
      time: task.updatedAt ?? formatDateTime(new Date()),
    });
    void updateTaskRecord(task);
  };
  const deleteCreatedIssue = (issue: CreatedIssueEntry) => {
    setCreatedIssues((items) => items.map((item) => item.id === issue.id ? issue : item));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "課題を論理削除",
      target: issue.title,
      targetId: issue.supabaseId,
      targetType: "issue",
      time: issue.deletedAt ?? formatDateTime(new Date()),
    });
    void softDeleteIssueRecord(issue, currentUser?.authSource === "supabase" ? currentUser.id : undefined);
  };
  const restoreCreatedIssue = (issue: CreatedIssueEntry) => {
    setCreatedIssues((items) => items.map((item) => item.id === issue.id ? issue : item));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "課題を復元",
      target: issue.title,
      targetId: issue.supabaseId,
      targetType: "issue",
      time: formatDateTime(new Date()),
    });
    void restoreIssueRecord(issue, currentUser?.authSource === "supabase" ? currentUser.id : undefined);
  };
  const deleteCreatedTask = (task: CreatedTaskEntry) => {
    setCreatedTasks((items) => items.map((item) => item.id === task.id ? task : item));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "タスクを論理削除",
      target: task.title,
      targetId: task.supabaseId,
      targetType: "task",
      time: task.deletedAt ?? formatDateTime(new Date()),
    });
    void softDeleteTaskRecord(task, currentUser?.authSource === "supabase" ? currentUser.id : undefined);
  };
  const restoreCreatedTask = (task: CreatedTaskEntry) => {
    setCreatedTasks((items) => items.map((item) => item.id === task.id ? task : item));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "タスクを復元",
      target: task.title,
      targetId: task.supabaseId,
      targetType: "task",
      time: formatDateTime(new Date()),
    });
    void restoreTaskRecord(task, currentUser?.authSource === "supabase" ? currentUser.id : undefined);
  };
  const completeCreate = async (payload: CreateDrawerPayload) => {
    if (payload.type === "issue") {
      const issue: CreatedIssueEntry = {
        id: `ISS-NEW-${Date.now()}`,
        title: payload.title,
        department: payload.department,
        owner: payload.assignee,
        priority: payload.priority,
        status: "未着手",
        due: payload.displayDueDate,
        createdAt: payload.registeredAt,
        category1: payload.category1,
        category2: payload.category2,
        asIs: payload.asIs,
        createdById: currentUser?.authSource === "supabase" ? currentUser.id : undefined,
        createdByName: currentUser?.name ?? "山田 太郎",
      };
      const saved = await createIssueRecord(issue, issue.createdById);
      setCreatedIssues((items) => [saved.entry, ...items]);
      addActivityLog({
        actor: currentUser?.name ?? "山田 太郎",
        action: "課題を登録",
        target: saved.entry.title,
        targetId: saved.entry.supabaseId,
        targetType: "issue",
        time: payload.registeredAt,
      });
      setActiveKey("issues");
    }

    if (payload.type === "task") {
      const task: CreatedTaskEntry = {
        id: `task-direct-${Date.now()}`,
        title: payload.title,
        projectName: payload.department,
        assigneeName: payload.assignee,
        dueDate: payload.displayDueDate,
        priority: normalizePriority(payload.priority),
        status: "not_started",
        progress: 0,
        sourceType: "direct",
        sourceIssueId: "直接登録",
        issueCreatedAt: payload.registeredAt,
        taskizedAt: payload.registeredAt,
        responsiblePerson: payload.assignee,
        assigneePerson: payload.assignee,
        createdById: currentUser?.authSource === "supabase" ? currentUser.id : undefined,
        createdByName: currentUser?.name ?? "山田 太郎",
      };
      const saved = await createTaskRecord(task, task.createdById);
      setCreatedTasks((items) => [saved.entry, ...items]);
      addActivityLog({
        actor: currentUser?.name ?? "山田 太郎",
        action: "タスクを登録",
        target: saved.entry.title,
        targetId: saved.entry.supabaseId,
        targetType: "task",
        time: payload.registeredAt,
      });
      addNotification({
        title: "タスクが割り当てられました",
        detail: `「${saved.entry.title}」の担当者になりました`,
        target: "tasks",
        notificationType: "task_assigned",
        targetType: "task",
        targetId: saved.entry.supabaseId,
        targetLabel: saved.entry.title,
        time: payload.registeredAt,
      }, resolveTaskAssigneeRecipients(saved.entry, currentUser));
      setPreferredTaskView("team");
      setActiveKey("tasks");
    }

    setCreateOpen(false);
    setCreateNotice(payload);
  };
  const login = (user: AuthUser) => {
    setCurrentUser(user);
    setActiveKey("dashboard");
    setCreateNotice(null);
    setCreateOpen(false);
  };
  const logout = async () => {
    if (currentUser?.authSource === "supabase") {
      await signOutSupabase();
    }
    setCurrentUser(null);
    setActiveKey("dashboard");
    setCreateOpen(false);
    setCreateNotice(null);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-950">
      <Sidebar activeKey={activeKey} onSelect={setActiveKey} />
      <div className="lg:pl-[240px]">
        <TopHeader
          title={activeItem.label}
          activeKey={activeKey}
          user={currentUser}
          canCreate={can(currentAppRole, "tasks", "create")}
          onSelect={setActiveKey}
          onCreate={openCreateDrawer}
          onLogout={logout}
          notifications={visibleHeaderNotifications}
          onMarkNotificationRead={markNotificationRead}
          onMarkAllNotificationsRead={markAllNotificationsRead}
        />
        <main className="px-4 py-5 lg:px-6">
          {createNotice ? <CreateCompleteNotice notice={createNotice} onClose={() => setCreateNotice(null)} /> : null}
          <ActivePage
            activeKey={activeKey}
            onNavigate={setActiveKey}
            resolvedApprovalIds={resolvedApprovalIds}
            approvalRequests={approvalRequests}
            sendbackTasks={sendbackTasks}
            createdTasks={createdTasks}
            createdIssues={createdIssues}
            preferredTaskView={preferredTaskView}
            requesterName={currentUser.name}
            currentUserName={currentUser.name}
            currentUserId={currentUser.id}
            approvalReviewerOptions={approvalReviewerOptions}
            finalApprover={finalApprover}
            onCreateApproval={createApprovalRequest}
            onCreateTask={createTaskFromIssue}
            onUpdateIssue={updateCreatedIssue}
            onUpdateTask={updateCreatedTask}
            onDeleteIssue={deleteCreatedIssue}
            onRestoreIssue={restoreCreatedIssue}
            onDeleteTask={deleteCreatedTask}
            onRestoreTask={restoreCreatedTask}
            onResolveApproval={resolveApproval}
            onReviewApproval={reviewApproval}
            onSendBackTask={sendBackTask}
            approvalHistory={approvalHistory}
            onRecordApproval={(entry) => setApprovalHistory((items) => [entry, ...items])}
            activityLogs={activityLogs}
            onAddLog={addActivityLog}
            appRole={currentAppRole}
          />
        </main>
      </div>
      <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={completeCreate} />
    </div>
  );
}

function CreateCompleteNotice({
  notice,
  onClose,
}: {
  notice: { label: string; registeredAt: string };
  onClose: () => void;
}) {
  return (
    <section className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white">
          <CheckCircle2 size={18} />
        </div>
        <div>
          <p className="text-sm font-black text-emerald-800">登録完了</p>
          <p className="mt-1 text-sm leading-6 text-emerald-700">
            {notice.label}を登録しました。HOME画面に戻りました。登録日時: {notice.registeredAt}
          </p>
        </div>
      </div>
      <button className="grid size-8 place-items-center rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100" type="button" aria-label="登録完了アナウンスを閉じる" onClick={onClose}>
        <X size={16} />
      </button>
    </section>
  );
}

function ActivePage({
  activeKey,
  onNavigate,
  resolvedApprovalIds,
  approvalRequests,
  sendbackTasks,
  createdTasks,
  createdIssues,
  preferredTaskView,
  requesterName,
  currentUserName,
  currentUserId,
  approvalReviewerOptions,
  finalApprover,
  onCreateApproval,
  onCreateTask,
  onUpdateIssue,
  onUpdateTask,
  onDeleteIssue,
  onRestoreIssue,
  onDeleteTask,
  onRestoreTask,
  onResolveApproval,
  onReviewApproval,
  onSendBackTask,
  approvalHistory,
  onRecordApproval,
  activityLogs,
  onAddLog,
  appRole,
}: {
  activeKey: string;
  onNavigate: (key: string) => void;
  resolvedApprovalIds: string[];
  approvalRequests: ApprovalRequestEntry[];
  sendbackTasks: SendbackTaskEntry[];
  createdTasks: CreatedTaskEntry[];
  createdIssues: CreatedIssueEntry[];
  preferredTaskView?: "mine" | "team" | "approval" | "sendback";
  requesterName: string;
  currentUserName: string;
  currentUserId: string;
  approvalReviewerOptions: ApprovalReviewerOption[];
  finalApprover: ApprovalReviewerOption;
  onCreateApproval: (approval: ApprovalRequestEntry) => void;
  onCreateTask: (task: CreatedTaskEntry) => void;
  onUpdateIssue: (issue: CreatedIssueEntry) => void;
  onUpdateTask: (task: CreatedTaskEntry) => void;
  onDeleteIssue: (issue: CreatedIssueEntry) => void;
  onRestoreIssue: (issue: CreatedIssueEntry) => void;
  onDeleteTask: (task: CreatedTaskEntry) => void;
  onRestoreTask: (task: CreatedTaskEntry) => void;
  onResolveApproval: (approval: ApprovalRequestEntry, mode: "approve" | "sendback", comment: string) => void;
  onReviewApproval: (approval: ApprovalRequestEntry, comment: string) => void;
  onSendBackTask: (task: SendbackTaskEntry) => void;
  approvalHistory: ApprovalHistoryEntry[];
  onRecordApproval: (entry: ApprovalHistoryEntry) => void;
  activityLogs: ActivityLogEntry[];
  onAddLog: (log: ActivityLogEntry) => void;
  appRole: AppRole;
}) {
  switch (activeKey) {
    case "dashboard":
      return <DashboardPage onNavigate={onNavigate} createdTasks={createdTasks} createdIssues={createdIssues} />;
    case "issues":
      return <IssuesPage onNavigate={onNavigate} onAddLog={onAddLog} onCreateTask={onCreateTask} onUpdateIssue={onUpdateIssue} onDeleteIssue={onDeleteIssue} onRestoreIssue={onRestoreIssue} createdIssues={createdIssues} currentUserName={currentUserName} currentUserId={currentUserId} appRole={appRole} />;
    case "tasks":
      return <TasksPage appRole={appRole} requesterName={requesterName} currentUserName={currentUserName} currentUserId={currentUserId} sendbackTasks={sendbackTasks} createdTasks={createdTasks} preferredView={preferredTaskView} approvalReviewerOptions={approvalReviewerOptions} finalApprover={finalApprover} onCreateApproval={onCreateApproval} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} onRestoreTask={onRestoreTask} />;
    case "approvals":
      return <ApprovalsPage onNavigate={onNavigate} approvalRequests={approvalRequests} resolvedApprovalIds={resolvedApprovalIds} onResolveApproval={onResolveApproval} onReviewApproval={onReviewApproval} onSendBackTask={onSendBackTask} approvalHistory={approvalHistory} onRecordApproval={onRecordApproval} currentUserName={currentUserName} currentUserId={currentUserId} appRole={appRole} />;
    case "teams":
      return <TeamsPage />;
    case "ai":
      return <AiSuggestionsPage />;
    case "reports":
      return <ReportsPage />;
    case "logs":
      return <ActivityLogsPage activityLogs={activityLogs} />;
    case "settings":
      return <SettingsPage />;
    default:
      return <DashboardPage onNavigate={onNavigate} createdTasks={createdTasks} createdIssues={createdIssues} />;
  }
}

function loadStoredList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function saveStoredList<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function shouldShowNotification(notification: AppNotificationEntry, currentUser: AuthUser | null) {
  if (!currentUser) return false;
  if (!notification.recipientId) return true;
  return notification.recipientId === currentUser.id;
}

function getEffectiveAppRole(user: AuthUser | null): AppRole {
  const mappedRole = (user?.appRole as AppRole | undefined) ?? mapDemoRoleToAppRole(user?.role ?? "Viewer");
  if (mappedRole === "owner" && !isSoleOwnerUser(user)) return "admin";
  return mappedRole;
}

function getSoleOwnerApprover(currentUser?: AuthUser | null): ApprovalReviewerOption {
  if (currentUser && isSoleOwnerUser(currentUser)) {
    return { id: currentUser.id, name: currentUser.name, role: "Owner" };
  }

  const owner = demoUsers.find((user) => user.id === SOLE_OWNER_USER_ID) ?? demoUsers[0];
  return { id: owner.id, name: owner.name, role: "Owner" };
}

function getApprovalReviewerOptions(): ApprovalReviewerOption[] {
  return demoUsers
    .filter((user) => user.id !== SOLE_OWNER_USER_ID && user.role !== "Viewer")
    .map((user) => ({ id: user.id, name: user.name, role: user.role }));
}

function isSoleOwnerUser(user?: AuthUser | null) {
  return Boolean(user && (user.id === SOLE_OWNER_USER_ID || user.email === SOLE_OWNER_EMAIL));
}

function resolveApprovalRequestRecipients(approval: ApprovalRequestEntry, currentUser: AuthUser | null): NotificationRecipient[] {
  return normalizeNotificationRecipients([
    approval.reviewerId ? { id: approval.reviewerId, name: approval.reviewerName ?? approval.reviewerId } : undefined,
    approval.finalApproverId ? { id: approval.finalApproverId, name: approval.finalApproverName ?? approval.finalApproverId } : getSoleOwnerApprover(currentUser),
    currentUser && !approval.reviewerId && !approval.finalApproverId ? toNotificationRecipient(currentUser) : undefined,
  ].filter((recipient): recipient is NotificationRecipient => Boolean(recipient)));
}

function resolveApprovalResultRecipients(approval: ApprovalRequestEntry, currentUser: AuthUser | null): NotificationRecipient[] {
  if (approval.requesterId) {
    return [{ id: approval.requesterId, name: approval.requester || approval.requesterId }];
  }

  const requester = findDemoUserByName(approval.requester);
  if (requester) return [toNotificationRecipient(requester)];

  return currentUser ? [toNotificationRecipient(currentUser)] : [];
}

function resolveTaskAssigneeRecipients(task: CreatedTaskEntry, currentUser: AuthUser | null): NotificationRecipient[] {
  const assignees = findDemoUsersByNames(task.assigneeName);
  if (assignees.length) return assignees.map(toNotificationRecipient);

  if (currentUser && samePerson(task.assigneeName, currentUser.name)) {
    return [toNotificationRecipient(currentUser)];
  }

  return currentUser ? [toNotificationRecipient(currentUser)] : [];
}

function normalizeNotificationRecipients(recipients: NotificationRecipient[]) {
  const unique = new Map<string, NotificationRecipient>();
  for (const recipient of recipients) {
    if (!recipient.id) continue;
    unique.set(recipient.id, recipient);
  }
  return Array.from(unique.values());
}

function toNotificationRecipient(user: AuthUser): NotificationRecipient {
  return { id: user.id, name: user.name };
}

function findDemoUsersByNames(value: string) {
  return splitRecipientNames(value)
    .map(findDemoUserByName)
    .filter((user): user is AuthUser => Boolean(user));
}

function findDemoUserByName(value?: string) {
  if (!value) return undefined;
  return demoUsers.find((user) => samePerson(value, user.name) || normalizePersonName(value).includes(normalizePersonName(user.name)));
}

function splitRecipientNames(value: string) {
  return value.split(/[\/／,、]/).map((part) => part.trim()).filter(Boolean);
}

function samePerson(left: string, right: string) {
  const normalizedLeft = normalizePersonName(left);
  const normalizedRight = normalizePersonName(right);
  return Boolean(normalizedLeft && normalizedRight && (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)));
}

function normalizePersonName(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function formatDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function mergeByRecordId<T extends { id?: string; supabaseId?: string }>(incoming: T[], existing: T[]) {
  const merged = new Map<string, T>();
  for (const item of existing) {
    merged.set(getRecordMergeKey(item), item);
  }
  for (const item of incoming) {
    merged.set(getRecordMergeKey(item), item);
  }
  return Array.from(merged.values());
}

function getRecordMergeKey(item: { id?: string; supabaseId?: string }) {
  return item.supabaseId ?? item.id ?? JSON.stringify(item);
}
