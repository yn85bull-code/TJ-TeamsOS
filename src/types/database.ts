export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole =
  | "owner"
  | "admin"
  | "executive"
  | "department_manager"
  | "team_manager"
  | "member"
  | "viewer";

export type WorkStatus =
  | "not_started"
  | "in_progress"
  | "waiting_review"
  | "waiting_approval"
  | "rejected_back"
  | "on_hold"
  | "completed"
  | "rejected"
  | "overdue";

export type ApprovalStatus =
  | "draft"
  | "submitted"
  | "waiting_approval"
  | "approved"
  | "rejected_back"
  | "rejected"
  | "cancelled";

export type SuggestionStatus = "pending" | "approved" | "rejected" | "converted";
export type SuggestionType = "task" | "issue" | "approval" | "reply" | "meeting_agenda";
export type MyTodoPriority = "high" | "medium" | "low";
export type MyTodoStatus = "not_started" | "in_progress" | "on_hold" | "done";

type RowTimestamps = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: RowTimestamps & {
          id: string;
          display_name: string;
          email: string | null;
          avatar_url: string | null;
          position: string | null;
          role: AppRole;
          department_id: string | null;
          team_id: string | null;
          manager_id: string | null;
          is_active: boolean;
        };
        Insert: {
          id: string;
          display_name: string;
          email?: string | null;
          avatar_url?: string | null;
          position?: string | null;
          role?: AppRole;
          department_id?: string | null;
          team_id?: string | null;
          manager_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      departments: {
        Row: RowTimestamps & {
          id: string;
          name: string;
          description: string | null;
          manager_id: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          manager_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
      };
      teams: {
        Row: RowTimestamps & {
          id: string;
          name: string;
          department_id: string | null;
          manager_id: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          department_id?: string | null;
          manager_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
      };
      issues: {
        Row: RowTimestamps & {
          id: string;
          title: string;
          category1: string | null;
          category2: string | null;
          priority: string;
          department_id: string | null;
          department_name: string | null;
          team_id: string | null;
          as_is: string | null;
          to_be: string | null;
          todo: string | null;
          result: string | null;
          assignee_id: string | null;
          assignee_name: string | null;
          created_by: string | null;
          approver_id: string | null;
          due_date: string | null;
          status: WorkStatus;
          visibility: string;
          external_source_id: string | null;
          external_source_type: string | null;
          external_message_id: string | null;
          ai_created: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          category1?: string | null;
          category2?: string | null;
          priority?: string;
          department_id?: string | null;
          department_name?: string | null;
          team_id?: string | null;
          as_is?: string | null;
          to_be?: string | null;
          todo?: string | null;
          result?: string | null;
          assignee_id?: string | null;
          assignee_name?: string | null;
          created_by?: string | null;
          approver_id?: string | null;
          due_date?: string | null;
          status?: WorkStatus;
          visibility?: string;
          external_source_id?: string | null;
          external_source_type?: string | null;
          external_message_id?: string | null;
          ai_created?: boolean;
          deleted_at?: string | null;
          deleted_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["issues"]["Insert"]>;
      };
      tasks: {
        Row: RowTimestamps & {
          id: string;
          issue_id: string | null;
          title: string;
          body: string | null;
          project_name: string | null;
          assignee_id: string | null;
          assignee_name: string | null;
          created_by: string | null;
          due_date: string | null;
          priority: string;
          status: WorkStatus;
          progress: number;
          source_type: string | null;
          source_issue_label: string | null;
          issue_created_at_label: string | null;
          taskized_at_label: string | null;
          responsible_person: string | null;
          assignee_person: string | null;
          visibility: string;
          external_source_id: string | null;
          ai_created: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          issue_id?: string | null;
          title: string;
          body?: string | null;
          project_name?: string | null;
          assignee_id?: string | null;
          assignee_name?: string | null;
          created_by?: string | null;
          due_date?: string | null;
          priority?: string;
          status?: WorkStatus;
          progress?: number;
          source_type?: string | null;
          source_issue_label?: string | null;
          issue_created_at_label?: string | null;
          taskized_at_label?: string | null;
          responsible_person?: string | null;
          assignee_person?: string | null;
          visibility?: string;
          external_source_id?: string | null;
          ai_created?: boolean;
          deleted_at?: string | null;
          deleted_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
      };
      approvals: {
        Row: RowTimestamps & {
          id: string;
          requester_id: string | null;
          approver_id: string | null;
          reviewer_id: string | null;
          final_approver_id: string | null;
          approval_type: string;
          target_title: string;
          requester_name: string | null;
          approver_name: string | null;
          reviewer_name: string | null;
          final_approver_name: string | null;
          reviewed_by: string | null;
          reviewed_by_name: string | null;
          review_comment: string | null;
          issue_id: string | null;
          task_id: string | null;
          priority: string;
          due_date: string | null;
          due_date_label: string | null;
          issue_created_at_label: string | null;
          body: string;
          approval_comment: string | null;
          rejected_reason: string | null;
          status: ApprovalStatus;
          approved_at: string | null;
          reviewed_at: string | null;
          rejected_back_at: string | null;
          rejected_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id?: string | null;
          approver_id?: string | null;
          reviewer_id?: string | null;
          final_approver_id?: string | null;
          approval_type: string;
          target_title?: string;
          requester_name?: string | null;
          approver_name?: string | null;
          reviewer_name?: string | null;
          final_approver_name?: string | null;
          reviewed_by?: string | null;
          reviewed_by_name?: string | null;
          review_comment?: string | null;
          issue_id?: string | null;
          task_id?: string | null;
          priority?: string;
          due_date?: string | null;
          due_date_label?: string | null;
          issue_created_at_label?: string | null;
          body: string;
          approval_comment?: string | null;
          rejected_reason?: string | null;
          status?: ApprovalStatus;
          approved_at?: string | null;
          reviewed_at?: string | null;
          rejected_back_at?: string | null;
          rejected_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["approvals"]["Insert"]>;
      };
      comments: {
        Row: RowTimestamps & {
          id: string;
          target_type: "issue" | "task" | "approval";
          target_id: string;
          author_id: string | null;
          body: string;
        };
        Insert: {
          id?: string;
          target_type: "issue" | "task" | "approval";
          target_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string | null;
          actor_name: string | null;
          notification_type: string;
          title: string;
          body: string | null;
          target_type: string | null;
          target_id: string | null;
          target_label: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id?: string | null;
          actor_name?: string | null;
          notification_type: string;
          title: string;
          body?: string | null;
          target_type?: string | null;
          target_id?: string | null;
          target_label?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      my_todos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          memo: string | null;
          due_date: string | null;
          priority: MyTodoPriority;
          status: MyTodoStatus;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          memo?: string | null;
          due_date?: string | null;
          priority?: MyTodoPriority;
          status?: MyTodoStatus;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["my_todos"]["Insert"]>;
      };
      ai_suggestions: {
        Row: {
          id: string;
          suggestion_type: SuggestionType;
          source_type: string | null;
          source_id: string | null;
          suggested_title: string | null;
          suggested_body: string | null;
          suggested_assignee_id: string | null;
          suggested_due_date: string | null;
          suggested_priority: string | null;
          suggested_visibility: string | null;
          confidence_score: number | null;
          status: SuggestionStatus;
          approved_by: string | null;
          approved_at: string | null;
          rejected_by: string | null;
          rejected_at: string | null;
          converted_issue_id: string | null;
          converted_task_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          suggestion_type: SuggestionType;
          source_type?: string | null;
          source_id?: string | null;
          suggested_title?: string | null;
          suggested_body?: string | null;
          suggested_assignee_id?: string | null;
          suggested_due_date?: string | null;
          suggested_priority?: string | null;
          suggested_visibility?: string | null;
          confidence_score?: number | null;
          status?: SuggestionStatus;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          converted_issue_id?: string | null;
          converted_task_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_suggestions"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_name: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          target_label: string | null;
          before_data: Json | null;
          after_data: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          is_ai_suggestion: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          target_label?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          is_ai_suggestion?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_profile_role: { Args: Record<string, never>; Returns: AppRole };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      same_department: { Args: { department: string }; Returns: boolean };
      same_team: { Args: { team: string }; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      work_status: WorkStatus;
      approval_status: ApprovalStatus;
      suggestion_status: SuggestionStatus;
      suggestion_type: SuggestionType;
    };
  };
};
