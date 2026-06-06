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
  MyTodoPage,
  ReportsPage,
  SendbackTaskEntry,
  SettingsPage,
  TaskRecord,
  TasksPage,
  TeamsPage,
  TaurosAiPage,
} from "@/components/pages/workspace-pages";
import { AuthUser, demoUsers } from "@/lib/auth-demo-data";
import { navItems } from "@/lib/dashboard-demo-data";
import { can, canAccessNavItem, mapDemoRoleToAppRole, normalizeAppRole } from "@/lib/domain/permissions";
import { signOutSupabase } from "@/lib/supabase/auth";
import { loadLocalTaskRecords, saveTaskRecord } from "@/lib/tasks/task-record-store";
import { createActivityLogRecord, loadActivityLogsFromSupabase } from "@/lib/workspace/activity-log-store";
import { createApprovalRecord, loadApprovalRecordsFromSupabase, updateApprovalDecision, updateApprovalReview } from "@/lib/workspace/approval-record-store";
import { createIssueRecord, createTaskRecord, loadCreatedRecordsFromSupabase, restoreIssueRecord, restoreTaskRecord, softDeleteIssueRecord, softDeleteTaskRecord, updateIssueRecord, updateTaskRecord } from "@/lib/workspace/created-record-store";
import { DEPARTMENTS_STORAGE_KEY, DEFAULT_DEPARTMENTS, normalizeDepartmentList } from "@/lib/workspace/department-store";
import { createAssignedMyTodoRecord, createMyTodoRecord, formatMyTodoDateTime, loadMyTodos, softDeleteMyTodoRecord, updateMyTodoRecord, type MyTodoEntry } from "@/lib/workspace/my-todo-store";
import { createNotificationRecord, loadNotificationsFromSupabase, markNotificationReadRecord, markNotificationsReadRecord, type AppNotificationEntry } from "@/lib/workspace/notification-store";
import { createTeamsTodoRecord, loadTeamsTodos, softDeleteTeamsTodoRecord, updateTeamsTodoRecord, type TeamsTodoEntry } from "@/lib/workspace/teams-todo-store";
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
const SOLE_OWNER_USER_ID = "e8925ab3-25c7-4ecf-8187-0a13359f6832";
const SOLE_OWNER_EMAIL = "yn85bull@gmail.com";
const SOLE_OWNER_NAME = "楢原悠太郎";

type NotificationRecipient = {
  id: string;
  name: string;
};

export default function Home({ initialActiveKey = "dashboard" }: { initialActiveKey?: string } = {}) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeKey, setActiveKey] = useState(initialActiveKey);
  const [createOpen, setCreateOpen] = useState(false);
  const [createNotice, setCreateNotice] = useState<{ label: string; registeredAt: string } | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequestEntry[]>([]);
  const [resolvedApprovalIds, setResolvedApprovalIds] = useState<string[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [sendbackTasks, setSendbackTasks] = useState<SendbackTaskEntry[]>([]);
  const [createdTasks, setCreatedTasks] = useState<CreatedTaskEntry[]>([]);
  const [createdIssues, setCreatedIssues] = useState<CreatedIssueEntry[]>([]);
  const [myTodos, setMyTodos] = useState<MyTodoEntry[]>([]);
  const [teamsTodos, setTeamsTodos] = useState<TeamsTodoEntry[]>([]);
  const [preferredTaskView, setPreferredTaskView] = useState<"mine" | "team" | "approval" | "sendback" | undefined>();
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [headerNotifications, setHeaderNotifications] = useState<AppNotificationEntry[]>([]);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [storedRecordsLoaded, setStoredRecordsLoaded] = useState(false);
  const currentAppRole = useMemo<AppRole>(
    () => getEffectiveAppRole(currentUser),
    [currentUser],
  );
  const safeActiveKey = canAccessNavItem(currentAppRole, activeKey) ? activeKey : "dashboard";
  const activeItem = useMemo(
    () => navItems.find((item) => item.key === safeActiveKey) ?? navItems[0],
    [safeActiveKey],
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
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setApprovalRequests(loadStoredList<ApprovalRequestEntry>(APPROVAL_REQUESTS_STORAGE_KEY));
      setResolvedApprovalIds(loadStoredList<string>(RESOLVED_APPROVALS_STORAGE_KEY));
      setApprovalHistory(loadStoredList<ApprovalHistoryEntry>(APPROVAL_HISTORY_STORAGE_KEY));
      setSendbackTasks(loadStoredList<SendbackTaskEntry>(SENDBACK_TASKS_STORAGE_KEY));
      setCreatedTasks(loadStoredList<CreatedTaskEntry>(CREATED_TASKS_STORAGE_KEY));
      setCreatedIssues(loadStoredList<CreatedIssueEntry>(CREATED_ISSUES_STORAGE_KEY));
      setActivityLogs(loadStoredList<ActivityLogEntry>(ACTIVITY_LOGS_STORAGE_KEY));
      setHeaderNotifications(loadStoredList<AppNotificationEntry>(NOTIFICATIONS_STORAGE_KEY));
      const storedDepartments = loadStoredList<string>(DEPARTMENTS_STORAGE_KEY);
      setDepartments(storedDepartments.length ? normalizeDepartmentList(storedDepartments) : DEFAULT_DEPARTMENTS);
      setStoredRecordsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
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
    if (!currentUser) return;

    let cancelled = false;
    void loadMyTodos(currentUser.id, currentUser.name).then((records) => {
      if (cancelled) return;
      setMyTodos(records.todos);
    });
    void loadTeamsTodos(currentUser.department, currentUser.id, currentUser.name).then((records) => {
      if (cancelled) return;
      setTeamsTodos(records.todos);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!storedRecordsLoaded) return;
    saveStoredList(APPROVAL_REQUESTS_STORAGE_KEY, approvalRequests);
  }, [approvalRequests, storedRecordsLoaded]);

  useEffect(() => {
    if (!storedRecordsLoaded) return;
    saveStoredList(RESOLVED_APPROVALS_STORAGE_KEY, resolvedApprovalIds);
  }, [resolvedApprovalIds, storedRecordsLoaded]);

  useEffect(() => {
    if (!storedRecordsLoaded) return;
    saveStoredList(APPROVAL_HISTORY_STORAGE_KEY, approvalHistory);
  }, [approvalHistory, storedRecordsLoaded]);

  useEffect(() => {
    if (!storedRecordsLoaded) return;
    saveStoredList(SENDBACK_TASKS_STORAGE_KEY, sendbackTasks);
  }, [sendbackTasks, storedRecordsLoaded]);

  useEffect(() => {
    if (!storedRecordsLoaded) return;
    saveStoredList(CREATED_TASKS_STORAGE_KEY, createdTasks);
  }, [createdTasks, storedRecordsLoaded]);

  useEffect(() => {
    if (!storedRecordsLoaded) return;
    saveStoredList(CREATED_ISSUES_STORAGE_KEY, createdIssues);
  }, [createdIssues, storedRecordsLoaded]);

  useEffect(() => {
    if (!storedRecordsLoaded) return;
    saveStoredList(ACTIVITY_LOGS_STORAGE_KEY, activityLogs);
  }, [activityLogs, storedRecordsLoaded]);

  useEffect(() => {
    if (!storedRecordsLoaded) return;
    saveStoredList(NOTIFICATIONS_STORAGE_KEY, headerNotifications);
  }, [headerNotifications, storedRecordsLoaded]);

  useEffect(() => {
    if (!storedRecordsLoaded) return;
    saveStoredList(DEPARTMENTS_STORAGE_KEY, departments);
  }, [departments, storedRecordsLoaded]);

  useEffect(() => {
    if (currentUser && !canAccessNavItem(currentAppRole, activeKey)) {
      queueMicrotask(() => setActiveKey("dashboard"));
    }
  }, [activeKey, currentAppRole, currentUser]);

  const createApprovalRequest = async (approval: ApprovalRequestEntry) => {
    const fallbackReviewer = approvalReviewerOptions[0];
    const normalizedApproval: ApprovalRequestEntry = {
      ...approval,
      requesterId: approval.requesterId ?? (currentUser?.authSource === "supabase" ? currentUser.id : undefined),
      requester: approval.requester || currentUser?.name || "山田 太郎",
      reviewerId: approval.reviewerId ?? fallbackReviewer?.id,
      reviewerName: approval.reviewerName ?? fallbackReviewer?.name,
      finalApproverId: finalApprover.id,
      finalApproverName: finalApprover.name,
    };
    setApprovalRequests((items) => [
      normalizedApproval,
      ...items.filter((item) => !isSameApprovalRequest(item, normalizedApproval)),
    ]);
    if (normalizedApproval.taskId) {
      setSendbackTasks((items) => items.filter((item) => item.id !== normalizedApproval.taskId));
    }
    setResolvedApprovalIds((ids) => ids.filter((id) => id !== normalizedApproval.id));
    setPreferredTaskView("approval");
    setActiveKey("approvals");

    let approvalForSideEffects = normalizedApproval;
    try {
      const saved = await createApprovalRecord(normalizedApproval, normalizedApproval.requesterId);
      approvalForSideEffects = saved.entry;
      setApprovalRequests((items) =>
        items.map((item) => isSameApprovalRequest(item, normalizedApproval) ? saved.entry : item),
      );
    } catch (error) {
      console.warn("Approval request save failed. Keeping optimistic local request.", error);
    }

    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "承認申請を作成",
      target: approvalForSideEffects.target,
      targetId: approvalForSideEffects.supabaseId,
      targetType: "approval",
      time: approvalForSideEffects.requestedAt ?? formatDateTime(new Date()),
    });
    addNotification({
      title: "承認申請が届きました",
      detail: `${approvalForSideEffects.requester}さんから「${approvalForSideEffects.target}」の承認申請。確認承認者: ${approvalForSideEffects.reviewerName ?? "未設定"} / 最終決裁: ${approvalForSideEffects.finalApproverName ?? finalApprover.name}`,
      target: "approvals",
      notificationType: "approval",
      targetType: "approval",
      targetId: approvalForSideEffects.supabaseId,
      targetLabel: approvalForSideEffects.target,
    }, resolveApprovalRequestRecipients(approvalForSideEffects, currentUser));
  };

  const resolveApproval = (approval: ApprovalRequestEntry, mode: "approve" | "sendback", comment: string) => {
    const resolvedAt = formatDateTime(new Date());
    setResolvedApprovalIds((ids) => [...new Set([...ids, approval.id])]);
    if (mode === "approve") {
      completeApprovedTask(approval, comment, resolvedAt);
    }
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: mode === "approve" ? "承認申請を承認" : "承認申請を差し戻し",
      target: approval.target,
      detail: mode === "approve"
        ? "関連タスクを完了扱いにし、通常のタスク一覧から非表示にしました。"
        : "関連タスクを差し戻しタスクとして再対応に戻しました。",
      targetId: approval.supabaseId,
      targetType: "approval",
      time: resolvedAt,
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

  const completeApprovedTask = (approval: ApprovalRequestEntry, comment: string, approvedAt: string) => {
    const matchedTask = createdTasks.find((task) => isApprovalTaskMatch(approval, task));
    if (!approval.taskId && !approval.taskSupabaseId && !matchedTask) return;

    setCreatedTasks((items) =>
      items.map((task) =>
        isApprovalTaskMatch(approval, task)
          ? { ...task, progress: 100, status: "done", updatedAt: approvedAt }
          : task,
      ),
    );

    const existingRecords = loadLocalTaskRecords({});
    const existingRecord = getExistingApprovalTaskRecord(approval, matchedTask, existingRecords);
    const doneRecord = buildApprovedTaskRecord(approval, existingRecord, comment, approvedAt);
    for (const taskId of getApprovalTaskRecordIds(approval, matchedTask)) {
      void saveTaskRecord(taskId, doneRecord, "completed").catch((error) => {
        console.warn("Task completion save failed after approval.", error);
      });
    }
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

  const addDepartment = (name: string) => {
    setDepartments((items) => normalizeDepartmentList([...items, name]));
  };

  const deleteDepartment = (name: string) => {
    setDepartments((items) => {
      const nextDepartments = items.filter((item) => item !== name);
      return nextDepartments.length ? nextDepartments : items;
    });
  };

  const addActivityLog = (log: ActivityLogEntry) => {
    const normalizedLog = {
      ...log,
      id: log.id ?? log.supabaseId ?? createClientId("log"),
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
    setPreferredTaskView(isTaskForCurrentUser(saved.entry, currentUser) ? "mine" : "team");
  };
  const updateCreatedIssue = (issue: CreatedIssueEntry) => {
    const previousIssue = createdIssues.find((item) => isSameRecord(item, issue));
    setCreatedIssues((items) => items.map((item) => item.id === issue.id ? issue : item));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "Projectを編集",
      target: issue.title,
      detail: previousIssue ? describeIssueChanges(previousIssue, issue) : "編集内容を保存",
      targetId: issue.supabaseId,
      targetType: "issue",
      time: issue.updatedAt ?? formatDateTime(new Date()),
    });
    void updateIssueRecord(issue);
  };
  const updateCreatedTask = (task: CreatedTaskEntry) => {
    const previousTask = createdTasks.find((item) => isSameRecord(item, task));
    setCreatedTasks((items) => items.map((item) => item.id === task.id ? task : item));
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "タスクを編集",
      target: task.title,
      detail: previousTask ? describeTaskChanges(previousTask, task) : "編集内容を保存",
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
      action: "Projectを論理削除",
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
      action: "Projectを復元",
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
  const createMyTodo = async (todo: MyTodoEntry) => {
    const saved = await createMyTodoRecord(todo, currentUser?.id);
    setMyTodos((items) => [saved.entry, ...items.filter((item) => !isSameMyTodo(item, saved.entry))]);
  };
  const updateMyTodo = (todo: MyTodoEntry) => {
    setMyTodos((items) => items.map((item) => isSameMyTodo(item, todo) ? todo : item));
    void updateMyTodoRecord(todo, currentUser?.id);
  };
  const deleteMyTodo = (todo: MyTodoEntry) => {
    setMyTodos((items) => items.map((item) => isSameMyTodo(item, todo) ? todo : item));
    void softDeleteMyTodoRecord(todo, currentUser?.id);
  };
  const createTeamsTodo = async (todo: TeamsTodoEntry) => {
    const saved = await createTeamsTodoRecord(todo, currentUser?.id);
    setTeamsTodos((items) => [saved.entry, ...items.filter((item) => !isSameTeamsTodo(item, saved.entry))]);
    void assignTeamsTodoToMyTodo(saved.entry);
  };
  const updateTeamsTodo = (todo: TeamsTodoEntry) => {
    const previousTodo = teamsTodos.find((item) => isSameTeamsTodo(item, todo));
    setTeamsTodos((items) => items.map((item) => isSameTeamsTodo(item, todo) ? todo : item));
    void updateTeamsTodoRecord(todo, currentUser?.id);
    if (todo.assigneeId && todo.assigneeId !== previousTodo?.assigneeId) {
      void assignTeamsTodoToMyTodo(todo);
    }
  };
  const deleteTeamsTodo = (todo: TeamsTodoEntry) => {
    setTeamsTodos((items) => items.map((item) => isSameTeamsTodo(item, todo) ? todo : item));
    void softDeleteTeamsTodoRecord(todo, currentUser?.id);
  };
  const assignTeamsTodoToMyTodo = async (todo: TeamsTodoEntry) => {
    if (!todo.assigneeId || !todo.assigneeName || !currentUser) return;
    const now = formatMyTodoDateTime(new Date());
    const assignedTodo: MyTodoEntry = {
      id: `assigned-${todo.id}-${todo.assigneeId}`,
      userId: todo.assigneeId,
      title: todo.title,
      memo: buildAssignedMyTodoMemo(todo),
      dueDate: todo.dueDate,
      priority: todo.priority,
      status: todo.status,
      sourceType: "teams_todo",
      sourceTeamsTodoId: todo.supabaseId ?? todo.id,
      assignedById: currentUser.id,
      assignedByName: currentUser.name,
      createdByName: currentUser.name,
      completedAt: todo.status === "done" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await createAssignedMyTodoRecord(assignedTodo, currentUser.id);
    if (saved.entry.userId === currentUser.id) {
      setMyTodos((items) => [saved.entry, ...items.filter((item) => !isSameMyTodo(item, saved.entry))]);
    }
    const assignedTeamsTodo = {
      ...todo,
      assignedMyTodoId: saved.entry.supabaseId ?? saved.entry.id,
      assignedAt: now,
      updatedAt: now,
    };
    setTeamsTodos((items) => items.map((item) => isSameTeamsTodo(item, assignedTeamsTodo) ? assignedTeamsTodo : item));
    void updateTeamsTodoRecord(assignedTeamsTodo, currentUser.id);
  };
  const completeCreate = async (payload: CreateDrawerPayload) => {
    const issue: CreatedIssueEntry = {
      id: `ISS-NEW-${Date.now()}`,
      title: payload.title,
      department: payload.department,
      owner: payload.registrant,
      priority: payload.priority,
      status: "未着手",
      due: payload.displayDueDate,
      createdAt: payload.registeredAt,
      category1: payload.category1,
      category2: payload.category2,
      asIs: payload.asIs,
      toBe: payload.toBe,
      createdById: currentUser?.authSource === "supabase" ? currentUser.id : undefined,
      createdByName: currentUser?.name ?? "山田 太郎",
    };
    const saved = await createIssueRecord(issue, issue.createdById);
    setCreatedIssues((items) => [saved.entry, ...items]);
    addActivityLog({
      actor: currentUser?.name ?? "山田 太郎",
      action: "Projectを登録",
      target: saved.entry.title,
      targetId: saved.entry.supabaseId,
      targetType: "issue",
      time: payload.registeredAt,
    });
    setActiveKey("issues");

    setCreateOpen(false);
    setCreateNotice(payload);
  };
  const login = (user: AuthUser) => {
    setCurrentUser(user);
    const loginRole = getEffectiveAppRole(user);
    setActiveKey(canAccessNavItem(loginRole, initialActiveKey) ? initialActiveKey : "dashboard");
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
    setMyTodos([]);
    setTeamsTodos([]);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-950">
      <Sidebar activeKey={safeActiveKey} appRole={currentAppRole} onSelect={setActiveKey} />
      <div className="min-w-0 overflow-x-hidden lg:ml-[240px]">
        <TopHeader
          title={activeItem.label}
          activeKey={safeActiveKey}
          user={currentUser}
          appRole={currentAppRole}
          canCreate={can(currentAppRole, "tasks", "create")}
          onSelect={setActiveKey}
          onCreate={openCreateDrawer}
          onLogout={logout}
          notifications={visibleHeaderNotifications}
          onMarkNotificationRead={markNotificationRead}
          onMarkAllNotificationsRead={markAllNotificationsRead}
        />
        <main className="min-w-0 px-4 py-5 lg:px-6">
          {createNotice ? <CreateCompleteNotice notice={createNotice} onClose={() => setCreateNotice(null)} /> : null}
          <ActivePage
            activeKey={safeActiveKey}
            onNavigate={setActiveKey}
            resolvedApprovalIds={resolvedApprovalIds}
            approvalRequests={approvalRequests}
            sendbackTasks={sendbackTasks}
            createdTasks={createdTasks}
            createdIssues={createdIssues}
            myTodos={myTodos}
            teamsTodos={teamsTodos}
            preferredTaskView={preferredTaskView}
            requesterName={currentUser.name}
            currentUserName={currentUser.name}
            currentUserId={currentUser.id}
            currentUserDepartment={currentUser.department}
            currentAuthSource={currentUser.authSource}
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
            onCreateMyTodo={createMyTodo}
            onUpdateMyTodo={updateMyTodo}
            onDeleteMyTodo={deleteMyTodo}
            onCreateTeamsTodo={createTeamsTodo}
            onUpdateTeamsTodo={updateTeamsTodo}
            onDeleteTeamsTodo={deleteTeamsTodo}
            onResolveApproval={resolveApproval}
            onReviewApproval={reviewApproval}
            onSendBackTask={sendBackTask}
            approvalHistory={approvalHistory}
            onRecordApproval={(entry) => setApprovalHistory((items) => [entry, ...items])}
            activityLogs={activityLogs}
            onAddLog={addActivityLog}
            appRole={currentAppRole}
            departments={departments}
            onAddDepartment={addDepartment}
            onDeleteDepartment={deleteDepartment}
          />
        </main>
      </div>
      <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={completeCreate} departmentOptions={departments} currentUserName={currentUser?.name ?? "山田 太郎"} />
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
  myTodos,
  teamsTodos,
  preferredTaskView,
  requesterName,
  currentUserName,
  currentUserId,
  currentUserDepartment,
  currentAuthSource,
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
  onCreateMyTodo,
  onUpdateMyTodo,
  onDeleteMyTodo,
  onCreateTeamsTodo,
  onUpdateTeamsTodo,
  onDeleteTeamsTodo,
  onResolveApproval,
  onReviewApproval,
  onSendBackTask,
  approvalHistory,
  onRecordApproval,
  activityLogs,
  onAddLog,
  appRole,
  departments,
  onAddDepartment,
  onDeleteDepartment,
}: {
  activeKey: string;
  onNavigate: (key: string) => void;
  resolvedApprovalIds: string[];
  approvalRequests: ApprovalRequestEntry[];
  sendbackTasks: SendbackTaskEntry[];
  createdTasks: CreatedTaskEntry[];
  createdIssues: CreatedIssueEntry[];
  myTodos: MyTodoEntry[];
  teamsTodos: TeamsTodoEntry[];
  preferredTaskView?: "mine" | "team" | "approval" | "sendback";
  requesterName: string;
  currentUserName: string;
  currentUserId: string;
  currentUserDepartment: string;
  currentAuthSource?: AuthUser["authSource"];
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
  onCreateMyTodo: (todo: MyTodoEntry) => void;
  onUpdateMyTodo: (todo: MyTodoEntry) => void;
  onDeleteMyTodo: (todo: MyTodoEntry) => void;
  onCreateTeamsTodo: (todo: TeamsTodoEntry) => void;
  onUpdateTeamsTodo: (todo: TeamsTodoEntry) => void;
  onDeleteTeamsTodo: (todo: TeamsTodoEntry) => void;
  onResolveApproval: (approval: ApprovalRequestEntry, mode: "approve" | "sendback", comment: string) => void;
  onReviewApproval: (approval: ApprovalRequestEntry, comment: string) => void;
  onSendBackTask: (task: SendbackTaskEntry) => void;
  approvalHistory: ApprovalHistoryEntry[];
  onRecordApproval: (entry: ApprovalHistoryEntry) => void;
  activityLogs: ActivityLogEntry[];
  onAddLog: (log: ActivityLogEntry) => void;
  appRole: AppRole;
  departments: string[];
  onAddDepartment: (name: string) => void;
  onDeleteDepartment: (name: string) => void;
}) {
  switch (activeKey) {
    case "dashboard":
      return <DashboardPage onNavigate={onNavigate} createdTasks={createdTasks} createdIssues={createdIssues} myTodos={myTodos} teamsTodos={teamsTodos} departmentOptions={departments} appRole={appRole} currentUserName={currentUserName} currentUserId={currentUserId} currentUserDepartment={currentUserDepartment} />;
    case "issues":
      return <IssuesPage onNavigate={onNavigate} onAddLog={onAddLog} onCreateTask={onCreateTask} onUpdateIssue={onUpdateIssue} onDeleteIssue={onDeleteIssue} onRestoreIssue={onRestoreIssue} createdIssues={createdIssues} createdTasks={createdTasks} currentUserName={currentUserName} currentUserId={currentUserId} currentUserDepartment={currentUserDepartment} appRole={appRole} departmentOptions={departments} />;
    case "tasks":
      return <TasksPage appRole={appRole} requesterName={requesterName} currentUserName={currentUserName} currentUserId={currentUserId} currentUserDepartment={currentUserDepartment} sendbackTasks={sendbackTasks} createdTasks={createdTasks} createdIssues={createdIssues} preferredView={preferredTaskView} approvalReviewerOptions={approvalReviewerOptions} finalApprover={finalApprover} onCreateApproval={onCreateApproval} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} onRestoreTask={onRestoreTask} />;
    case "my_todo":
      return <MyTodoPage myTodos={myTodos} teamsTodos={teamsTodos} currentUserName={currentUserName} currentUserId={currentUserId} currentUserDepartment={currentUserDepartment} appRole={appRole} onCreateMyTodo={onCreateMyTodo} onUpdateMyTodo={onUpdateMyTodo} onDeleteMyTodo={onDeleteMyTodo} onCreateTeamsTodo={onCreateTeamsTodo} onUpdateTeamsTodo={onUpdateTeamsTodo} onDeleteTeamsTodo={onDeleteTeamsTodo} />;
    case "approvals":
      return <ApprovalsPage onNavigate={onNavigate} approvalRequests={approvalRequests} resolvedApprovalIds={resolvedApprovalIds} onResolveApproval={onResolveApproval} onReviewApproval={onReviewApproval} onSendBackTask={onSendBackTask} approvalHistory={approvalHistory} onRecordApproval={onRecordApproval} currentUserName={currentUserName} currentUserId={currentUserId} currentUserDepartment={currentUserDepartment} appRole={appRole} />;
    case "teams":
      return <TeamsPage appRole={appRole} currentUserName={currentUserName} currentUserDepartment={currentUserDepartment} />;
    case "tauros_ai":
      return <TaurosAiPage appRole={appRole} currentUserDepartment={currentUserDepartment} currentUserName={currentUserName} />;
    case "ai":
      return <AiSuggestionsPage />;
    case "reports":
      return <ReportsPage />;
    case "logs":
      return <ActivityLogsPage activityLogs={activityLogs} />;
    case "settings":
      return <SettingsPage departments={departments} onAddDepartment={onAddDepartment} onDeleteDepartment={onDeleteDepartment} currentUserId={currentUserId} currentUserName={currentUserName} currentAuthSource={currentAuthSource} appRole={appRole} />;
    default:
      return <DashboardPage onNavigate={onNavigate} createdTasks={createdTasks} createdIssues={createdIssues} myTodos={myTodos} teamsTodos={teamsTodos} departmentOptions={departments} appRole={appRole} currentUserName={currentUserName} currentUserId={currentUserId} currentUserDepartment={currentUserDepartment} />;
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
  const mappedRole = (user?.appRole as AppRole | undefined) ?? mapDemoRoleToAppRole(user?.role ?? "Member");
  const normalizedRole = normalizeAppRole(mappedRole);
  if (normalizedRole === "owner" && !isSoleOwnerUser(user)) return "admin";
  return normalizedRole;
}

function getSoleOwnerApprover(currentUser?: AuthUser | null): ApprovalReviewerOption {
  if (currentUser && isSoleOwnerUser(currentUser)) {
    return { id: currentUser.id, name: currentUser.name, role: "Owner" };
  }

  return { id: SOLE_OWNER_USER_ID, name: SOLE_OWNER_NAME, role: "Owner" };
}

function getApprovalReviewerOptions(): ApprovalReviewerOption[] {
  return demoUsers
    .filter((user) => user.id !== SOLE_OWNER_USER_ID && ["Admin", "Manager"].includes(user.role))
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

function isTaskForCurrentUser(task: CreatedTaskEntry, currentUser: AuthUser | null) {
  if (!currentUser) return false;
  if (task.createdById && task.createdById === currentUser.id) return true;
  return [task.assigneeName, task.assigneePerson, task.responsiblePerson, task.createdByName]
    .some((name) => Boolean(name && samePerson(name, currentUser.name)));
}

function describeIssueChanges(before: CreatedIssueEntry, after: CreatedIssueEntry) {
  return describeChanges([
    { label: "タイトル", before: before.title, after: after.title },
    { label: "部門", before: before.department, after: after.department },
    { label: "登録者", before: before.owner, after: after.owner },
    { label: "優先度", before: before.priority, after: after.priority },
    { label: "ステータス", before: before.status, after: after.status },
    { label: "期限", before: before.due, after: after.due },
    { label: "Project分類大区分", before: before.category1, after: after.category1 },
    { label: "Project分類小区分", before: before.category2, after: after.category2 },
    { label: "As-Is", before: before.asIs, after: after.asIs },
    { label: "To-Be", before: before.toBe, after: after.toBe },
  ]);
}

function describeTaskChanges(before: CreatedTaskEntry, after: CreatedTaskEntry) {
  return describeChanges([
    { label: "タイトル", before: before.title, after: after.title },
    { label: "部門/プロジェクト", before: before.projectName, after: after.projectName },
    { label: "担当", before: before.assigneeName, after: after.assigneeName },
    { label: "担当責任者", before: before.responsiblePerson, after: after.responsiblePerson },
    { label: "担当者", before: before.assigneePerson, after: after.assigneePerson },
    { label: "期限", before: before.dueDate, after: after.dueDate },
    { label: "優先度", before: formatTaskPriority(before.priority), after: formatTaskPriority(after.priority) },
    { label: "ステータス", before: formatTaskStatus(before.status), after: formatTaskStatus(after.status) },
    { label: "進捗", before: `${before.progress}%`, after: `${after.progress}%` },
  ]);
}

function describeChanges(changes: Array<{ label: string; before?: string | number; after?: string | number }>) {
  const changed = changes
    .filter(({ before, after }) => normalizeLogValue(before) !== normalizeLogValue(after))
    .map(({ label, before, after }) => `${label}: ${formatLogValue(before)} → ${formatLogValue(after)}`);
  return changed.length ? changed.join(" / ") : "変更差分なし";
}

function normalizeLogValue(value?: string | number) {
  return String(value ?? "").trim();
}

function formatLogValue(value?: string | number) {
  const formatted = normalizeLogValue(value);
  return formatted || "未設定";
}

function formatTaskPriority(priority: CreatedTaskEntry["priority"]) {
  const labels: Record<CreatedTaskEntry["priority"], string> = {
    must: "Must",
    should: "Should",
    could: "Could",
  };
  return labels[priority] ?? priority;
}

function formatTaskStatus(status: CreatedTaskEntry["status"]) {
  const labels: Record<CreatedTaskEntry["status"], string> = {
    not_started: "未着手",
    in_progress: "進行中",
    approval_pending: "承認待ち",
    done: "完了",
  };
  return labels[status] ?? status;
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

function isApprovalTaskMatch(approval: ApprovalRequestEntry, task: CreatedTaskEntry) {
  return Boolean(
    (approval.taskId && approval.taskId === task.id) ||
    (approval.taskSupabaseId && approval.taskSupabaseId === task.supabaseId),
  );
}

function isSameApprovalRequest(left: ApprovalRequestEntry, right: ApprovalRequestEntry) {
  return Boolean(
    left.id === right.id ||
    (left.supabaseId && left.supabaseId === right.supabaseId) ||
    (left.taskId && left.taskId === right.taskId),
  );
}

function getApprovalTaskRecordIds(approval: ApprovalRequestEntry, task?: CreatedTaskEntry) {
  return Array.from(new Set([
    approval.taskId,
    task?.id,
    approval.taskSupabaseId,
    task?.supabaseId,
  ].filter((id): id is string => Boolean(id))));
}

function getExistingApprovalTaskRecord(
  approval: ApprovalRequestEntry,
  task: CreatedTaskEntry | undefined,
  records: Record<string, TaskRecord>,
) {
  return getApprovalTaskRecordIds(approval, task)
    .map((taskId) => records[taskId])
    .find(Boolean);
}

function buildApprovedTaskRecord(
  approval: ApprovalRequestEntry,
  existingRecord: TaskRecord | undefined,
  comment: string,
  approvedAt: string,
): TaskRecord {
  return {
    progress: 100,
    todoMemo: existingRecord?.todoMemo ?? approval.body ?? approval.target,
    approvalToBe: existingRecord?.approvalToBe ?? approval.body,
    approvalRequestedAt: existingRecord?.approvalRequestedAt ?? approval.requestedAt,
    updates: [
      { at: approvedAt, memo: `最終承認完了: ${comment}`, progress: 100 },
      ...(existingRecord?.updates ?? []),
    ],
  };
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

function isSameRecord(left: { id?: string; supabaseId?: string }, right: { id?: string; supabaseId?: string }) {
  return Boolean(
    (left.id && right.id && left.id === right.id) ||
    (left.supabaseId && right.supabaseId && left.supabaseId === right.supabaseId),
  );
}

function isSameMyTodo(left: MyTodoEntry, right: MyTodoEntry) {
  return isSameRecord(left, right);
}

function isSameTeamsTodo(left: TeamsTodoEntry, right: TeamsTodoEntry) {
  return isSameRecord(left, right);
}

function buildAssignedMyTodoMemo(todo: TeamsTodoEntry) {
  return [
    todo.memo,
    `TeamToDoから指名: ${todo.targetOrganization}`,
    todo.assigneeName ? `指名先: ${todo.assigneeName}` : "",
  ].filter(Boolean).join("\n");
}

function createClientId(prefix: string) {
  const randomValue = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${randomValue}`;
}
