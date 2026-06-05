create extension if not exists "pgcrypto";

create type app_role as enum (
  'owner',
  'admin',
  'executive',
  'department_manager',
  'team_manager',
  'member',
  'viewer'
);

create type work_status as enum (
  'not_started',
  'in_progress',
  'waiting_review',
  'waiting_approval',
  'rejected_back',
  'on_hold',
  'completed',
  'rejected',
  'overdue'
);

create type approval_status as enum (
  'draft',
  'submitted',
  'waiting_approval',
  'approved',
  'rejected_back',
  'rejected',
  'cancelled'
);

create type suggestion_status as enum (
  'pending',
  'approved',
  'rejected',
  'converted'
);

create type suggestion_type as enum (
  'task',
  'issue',
  'approval',
  'reply',
  'meeting_agenda'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  role app_role not null default 'member',
  department_id uuid,
  team_id uuid,
  manager_id uuid references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_single_owner
on public.profiles ((role))
where role = 'owner';

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  manager_id uuid references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_department_fk foreign key (department_id) references public.departments(id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid references public.departments(id),
  manager_id uuid references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_team_fk foreign key (team_id) references public.teams(id);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role app_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name app_role not null unique,
  description text
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  role app_role not null,
  resource text not null,
  action text not null,
  allowed boolean not null default true,
  unique (role, resource, action)
);

create table public.external_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  owner_id uuid references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category1 text,
  category2 text,
  priority text not null default 'Should',
  department_id uuid references public.departments(id),
  department_name text,
  team_id uuid references public.teams(id),
  as_is text,
  to_be text,
  todo text,
  result text,
  assignee_id uuid references public.profiles(id),
  assignee_name text,
  created_by uuid references public.profiles(id),
  approver_id uuid references public.profiles(id),
  due_date date,
  status work_status not null default 'not_started',
  visibility text not null default 'team',
  external_source_id uuid references public.external_sources(id),
  external_source_type text,
  external_message_id uuid,
  ai_created boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete set null,
  title text not null,
  body text,
  project_name text,
  assignee_id uuid references public.profiles(id),
  assignee_name text,
  created_by uuid references public.profiles(id),
  due_date date,
  priority text not null default 'Should',
  status work_status not null default 'not_started',
  progress integer not null default 0 check (progress between 0 and 100),
  source_type text,
  source_issue_label text,
  issue_created_at_label text,
  taskized_at_label text,
  responsible_person text,
  assignee_person text,
  visibility text not null default 'team',
  external_source_id uuid references public.external_sources(id),
  ai_created boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  status work_status not null default 'not_started',
  assignee_id uuid references public.profiles(id),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id),
  approver_id uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  final_approver_id uuid references public.profiles(id),
  approval_type text not null,
  target_title text not null default '',
  requester_name text,
  approver_name text,
  reviewer_name text,
  final_approver_name text,
  reviewed_by uuid references public.profiles(id),
  reviewed_by_name text,
  review_comment text,
  issue_id uuid references public.issues(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  priority text not null default 'Should',
  due_date date,
  due_date_label text,
  issue_created_at_label text,
  body text not null,
  approval_comment text,
  rejected_reason text,
  status approval_status not null default 'draft',
  approved_at timestamptz,
  reviewed_at timestamptz,
  rejected_back_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals(id) on delete cascade,
  step_order integer not null,
  approver_id uuid references public.profiles(id),
  status approval_status not null default 'waiting_approval',
  comment text,
  acted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.approval_histories (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  before_status approval_status,
  after_status approval_status,
  comment text,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('issue', 'task', 'approval')),
  target_id uuid not null,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('issue', 'task', 'approval', 'comment')),
  target_id uuid not null,
  uploaded_by uuid references public.profiles(id),
  bucket text not null default 'team-attachments',
  path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  actor_name text,
  notification_type text not null,
  title text not null,
  body text,
  target_type text,
  target_id uuid,
  target_label text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.external_messages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.external_sources(id),
  source_type text not null,
  external_id text,
  owner_id uuid references public.profiles(id),
  sender text,
  subject text,
  body text,
  ai_summary text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggestion_type suggestion_type not null,
  source_type text,
  source_id uuid,
  suggested_title text,
  suggested_body text,
  suggested_assignee_id uuid references public.profiles(id),
  suggested_due_date date,
  suggested_priority text,
  suggested_visibility text,
  confidence_score numeric(4, 3),
  status suggestion_status not null default 'pending',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.profiles(id),
  rejected_at timestamptz,
  converted_issue_id uuid references public.issues(id),
  converted_task_id uuid references public.tasks(id),
  created_at timestamptz not null default now()
);

create table public.ai_action_logs (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid references public.ai_suggestions(id) on delete set null,
  actor_id uuid references public.profiles(id),
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_name text,
  action text not null,
  target_type text not null,
  target_id uuid,
  target_label text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  is_ai_suggestion boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_departments_updated_at before update on public.departments
for each row execute function public.set_updated_at();

create trigger set_teams_updated_at before update on public.teams
for each row execute function public.set_updated_at();

create trigger set_issues_updated_at before update on public.issues
for each row execute function public.set_updated_at();

create trigger set_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

create trigger set_subtasks_updated_at before update on public.subtasks
for each row execute function public.set_updated_at();

create trigger set_checklists_updated_at before update on public.checklists
for each row execute function public.set_updated_at();

create trigger set_approvals_updated_at before update on public.approvals
for each row execute function public.set_updated_at();

create trigger set_comments_updated_at before update on public.comments
for each row execute function public.set_updated_at();

create or replace function public.current_profile_role()
returns app_role
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('owner', 'admin', 'executive'), false)
$$;

create or replace function public.same_department(department uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.department_id = department
  )
$$;

create or replace function public.same_team(team uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.profile_id = auth.uid()
      and tm.team_id = team
  )
$$;

create or replace function public.enforce_task_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or old.created_by = auth.uid() then
    return new;
  end if;

  if old.assignee_id = auth.uid() then
    if new.id = old.id
      and new.issue_id is not distinct from old.issue_id
      and new.title is not distinct from old.title
      and new.project_name is not distinct from old.project_name
      and new.assignee_id is not distinct from old.assignee_id
      and new.assignee_name is not distinct from old.assignee_name
      and new.created_by is not distinct from old.created_by
      and new.due_date is not distinct from old.due_date
      and new.priority is not distinct from old.priority
      and new.source_type is not distinct from old.source_type
      and new.source_issue_label is not distinct from old.source_issue_label
      and new.issue_created_at_label is not distinct from old.issue_created_at_label
      and new.taskized_at_label is not distinct from old.taskized_at_label
      and new.responsible_person is not distinct from old.responsible_person
      and new.assignee_person is not distinct from old.assignee_person
      and new.visibility is not distinct from old.visibility
      and new.external_source_id is not distinct from old.external_source_id
      and new.ai_created is not distinct from old.ai_created
      and new.created_at is not distinct from old.created_at then
      return new;
    end if;
  end if;

  raise exception 'Only the creator or an admin can edit task details.';
end;
$$;

create trigger enforce_tasks_update_scope before update on public.tasks
for each row execute function public.enforce_task_update_scope();

alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.issues enable row level security;
alter table public.tasks enable row level security;
alter table public.approvals enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;
alter table public.external_sources enable row level security;
alter table public.external_messages enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.ai_action_logs enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self_or_admin"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "profiles_update_self_or_admin"
on public.profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "departments_select_members"
on public.departments for select
using (public.is_admin() or public.same_department(id));

create policy "teams_select_members"
on public.teams for select
using (public.is_admin() or public.same_team(id));

create policy "team_members_select_related"
on public.team_members for select
using (public.is_admin() or profile_id = auth.uid() or public.same_team(team_id));

create policy "issues_select_scope"
on public.issues for select
using (
  public.is_admin()
  or created_by = auth.uid()
  or assignee_id = auth.uid()
  or approver_id = auth.uid()
  or public.same_department(department_id)
  or public.same_team(team_id)
);

create policy "issues_insert_authenticated"
on public.issues for insert
with check (auth.uid() is not null and created_by = auth.uid());

create policy "issues_update_scope"
on public.issues for update
using (public.is_admin() or created_by = auth.uid())
with check (public.is_admin() or created_by = auth.uid());

create policy "tasks_select_scope"
on public.tasks for select
using (
  public.is_admin()
  or created_by = auth.uid()
  or assignee_id = auth.uid()
  or exists (
    select 1 from public.issues i
    where i.id = tasks.issue_id
      and (
        i.created_by = auth.uid()
        or i.assignee_id = auth.uid()
        or public.same_department(i.department_id)
        or public.same_team(i.team_id)
      )
  )
);

create policy "tasks_insert_authenticated"
on public.tasks for insert
with check (auth.uid() is not null and created_by = auth.uid());

create policy "tasks_update_scope"
on public.tasks for update
using (public.is_admin() or created_by = auth.uid() or assignee_id = auth.uid())
with check (public.is_admin() or created_by = auth.uid() or assignee_id = auth.uid());

create policy "approvals_select_related"
on public.approvals for select
using (public.is_admin() or requester_id = auth.uid() or approver_id = auth.uid() or reviewer_id = auth.uid() or final_approver_id = auth.uid());

create policy "approvals_insert_authenticated"
on public.approvals for insert
with check (auth.uid() is not null and requester_id = auth.uid());

create policy "approvals_update_approver_or_requester"
on public.approvals for update
using (public.is_admin() or requester_id = auth.uid() or approver_id = auth.uid() or final_approver_id = auth.uid())
with check (public.is_admin() or requester_id = auth.uid() or approver_id = auth.uid() or final_approver_id = auth.uid());

create policy "comments_select_related"
on public.comments for select
using (auth.uid() is not null);

create policy "comments_insert_authenticated"
on public.comments for insert
with check (auth.uid() is not null and author_id = auth.uid());

create policy "notifications_select_own"
on public.notifications for select
using (recipient_id = auth.uid() or public.is_admin());

create policy "notifications_insert_authenticated"
on public.notifications for insert
with check (auth.uid() is not null and (actor_id = auth.uid() or actor_id is null or public.is_admin()));

create policy "notifications_update_own"
on public.notifications for update
using (recipient_id = auth.uid() or public.is_admin())
with check (recipient_id = auth.uid() or public.is_admin());

create policy "ai_suggestions_select_related"
on public.ai_suggestions for select
using (
  public.is_admin()
  or approved_by = auth.uid()
  or rejected_by = auth.uid()
  or suggested_assignee_id = auth.uid()
);

create policy "audit_logs_select_scope"
on public.audit_logs for select
using (public.is_admin() or actor_id = auth.uid());

create policy "audit_logs_insert_authenticated"
on public.audit_logs for insert
with check (auth.uid() is not null and actor_id = auth.uid());

insert into public.roles (name, description) values
  ('owner', 'System owner'),
  ('admin', 'All access administrator'),
  ('executive', 'Executive viewer and approver'),
  ('department_manager', 'Department manager'),
  ('team_manager', 'Team manager'),
  ('member', 'Standard member'),
  ('viewer', 'Read only viewer')
on conflict (name) do nothing;
