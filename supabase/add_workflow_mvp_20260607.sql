-- TJ-TeamOS Workflow MVP schema
-- Run in Supabase SQL Editor after the base TeamOS schema is installed.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workflow_status') then
    create type public.workflow_status as enum (
      'draft',
      'submitted',
      'manager_wait',
      'confirmed',
      'approval_wait',
      'sendback',
      'resubmit',
      'approved',
      'rejected',
      'cancelled',
      'completed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'workflow_field_type') then
    create type public.workflow_field_type as enum (
      'text',
      'textarea',
      'number',
      'currency',
      'date',
      'select',
      'multi_select',
      'checkbox',
      'file',
      'url',
      'employee',
      'department',
      'store'
    );
  end if;
end $$;

create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workflow_templates(id) on delete cascade,
  label text not null,
  field_type public.workflow_field_type not null,
  is_required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_requests (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.workflow_templates(id) on delete set null,
  template_name text not null,
  title text not null,
  body text not null,
  amount numeric,
  desired_date date,
  status public.workflow_status not null default 'draft',
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  applicant_name text not null,
  department text,
  manager_id uuid references public.profiles(id) on delete set null,
  manager_name text,
  final_approver_id uuid references public.profiles(id) on delete set null,
  final_approver_name text,
  payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.workflow_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  action text not null,
  comment text,
  status_from public.workflow_status,
  status_to public.workflow_status,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_templates_active on public.workflow_templates (is_active, deleted_at);
create index if not exists idx_workflow_requests_applicant on public.workflow_requests (applicant_id, status);
create index if not exists idx_workflow_requests_manager on public.workflow_requests (manager_id, status);
create index if not exists idx_workflow_requests_final_approver on public.workflow_requests (final_approver_id, status);
create index if not exists idx_workflow_requests_department on public.workflow_requests (department, status);
create index if not exists idx_workflow_request_history_request on public.workflow_request_history (request_id, created_at desc);

alter table public.workflow_templates enable row level security;
alter table public.workflow_template_fields enable row level security;
alter table public.workflow_requests enable row level security;
alter table public.workflow_request_history enable row level security;

drop policy if exists "workflow_templates_select_active" on public.workflow_templates;
create policy "workflow_templates_select_active"
on public.workflow_templates for select
to authenticated
using (deleted_at is null);

drop policy if exists "workflow_templates_manage_admin" on public.workflow_templates;
create policy "workflow_templates_manage_admin"
on public.workflow_templates for all
to authenticated
using (public.current_profile_role() in ('owner', 'admin'))
with check (public.current_profile_role() in ('owner', 'admin'));

drop policy if exists "workflow_template_fields_select_active" on public.workflow_template_fields;
create policy "workflow_template_fields_select_active"
on public.workflow_template_fields for select
to authenticated
using (
  exists (
    select 1
    from public.workflow_templates t
    where t.id = workflow_template_fields.template_id
      and t.deleted_at is null
  )
);

drop policy if exists "workflow_template_fields_manage_admin" on public.workflow_template_fields;
create policy "workflow_template_fields_manage_admin"
on public.workflow_template_fields for all
to authenticated
using (public.current_profile_role() in ('owner', 'admin'))
with check (public.current_profile_role() in ('owner', 'admin'));

drop policy if exists "workflow_requests_select_related" on public.workflow_requests;
create policy "workflow_requests_select_related"
on public.workflow_requests for select
to authenticated
using (
  public.current_profile_role() in ('owner', 'admin')
  or applicant_id = auth.uid()
  or manager_id = auth.uid()
  or final_approver_id = auth.uid()
  or (
    public.current_profile_role() in ('department_manager', 'team_manager', 'leader')
    and department = (select p.department from public.profiles p where p.id = auth.uid())
  )
);

drop policy if exists "workflow_requests_insert_own" on public.workflow_requests;
create policy "workflow_requests_insert_own"
on public.workflow_requests for insert
to authenticated
with check (applicant_id = auth.uid());

drop policy if exists "workflow_requests_update_related" on public.workflow_requests;
create policy "workflow_requests_update_related"
on public.workflow_requests for update
to authenticated
using (
  public.current_profile_role() in ('owner', 'admin')
  or applicant_id = auth.uid()
  or manager_id = auth.uid()
  or final_approver_id = auth.uid()
  or (
    public.current_profile_role() in ('department_manager', 'team_manager', 'leader')
    and department = (select p.department from public.profiles p where p.id = auth.uid())
  )
)
with check (
  public.current_profile_role() in ('owner', 'admin')
  or applicant_id = auth.uid()
  or manager_id = auth.uid()
  or final_approver_id = auth.uid()
  or (
    public.current_profile_role() in ('department_manager', 'team_manager', 'leader')
    and department = (select p.department from public.profiles p where p.id = auth.uid())
  )
);

drop policy if exists "workflow_history_select_related" on public.workflow_request_history;
create policy "workflow_history_select_related"
on public.workflow_request_history for select
to authenticated
using (
  exists (
    select 1
    from public.workflow_requests r
    where r.id = workflow_request_history.request_id
      and (
        public.current_profile_role() in ('owner', 'admin')
        or r.applicant_id = auth.uid()
        or r.manager_id = auth.uid()
        or r.final_approver_id = auth.uid()
        or workflow_request_history.actor_id = auth.uid()
        or (
          public.current_profile_role() in ('department_manager', 'team_manager', 'leader')
          and r.department = (select p.department from public.profiles p where p.id = auth.uid())
        )
      )
  )
);

drop policy if exists "workflow_history_insert_related" on public.workflow_request_history;
create policy "workflow_history_insert_related"
on public.workflow_request_history for insert
to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1
    from public.workflow_requests r
    where r.id = workflow_request_history.request_id
      and (
        public.current_profile_role() in ('owner', 'admin')
        or r.applicant_id = auth.uid()
        or r.manager_id = auth.uid()
        or r.final_approver_id = auth.uid()
        or (
          public.current_profile_role() in ('department_manager', 'team_manager', 'leader')
          and r.department = (select p.department from public.profiles p where p.id = auth.uid())
        )
      )
  )
);
