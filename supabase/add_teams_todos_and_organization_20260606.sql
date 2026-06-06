-- Organization / TeamsToDo foundation.
-- Run after:
-- 1. supabase/migrations/20260603_initial_schema.sql
-- 2. supabase/add_my_todos_20260606.sql

alter type public.app_role add value if not exists 'leader';

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists organization text,
  add column if not exists department text,
  add column if not exists store text,
  add column if not exists employment_status text default '在籍中',
  add column if not exists joined_at date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_employment_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_employment_status_check
      check (employment_status in ('在籍中', '休職中', '停止中', '退職'))
      not valid;
  end if;
end $$;

alter table public.profiles validate constraint profiles_employment_status_check;

update public.profiles p
set
  organization = coalesce(p.organization, d.name),
  department = coalesce(p.department, d.name),
  employment_status = coalesce(p.employment_status, case when p.is_active then '在籍中' else '停止中' end)
from public.departments d
where p.department_id = d.id;

create table if not exists public.teams_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  memo text,
  due_date date,
  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'on_hold', 'done')),
  target_organization text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_by_name text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_teams_todos_org_status_due
on public.teams_todos (target_organization, status, due_date);

create index if not exists idx_teams_todos_org_priority
on public.teams_todos (target_organization, priority);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_teams_todos_updated_at on public.teams_todos;
create trigger set_teams_todos_updated_at before update on public.teams_todos
for each row execute function public.set_updated_at();

alter table public.teams_todos enable row level security;

drop policy if exists "teams_todos_select_own_organization" on public.teams_todos;
drop policy if exists "teams_todos_insert_managers_own_organization" on public.teams_todos;
drop policy if exists "teams_todos_update_managers_own_organization" on public.teams_todos;
drop policy if exists "teams_todos_delete_managers_own_organization" on public.teams_todos;

create policy "teams_todos_select_own_organization"
on public.teams_todos
for select
using (
  exists (
    select 1
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where p.id = auth.uid()
      and p.is_active = true
      and coalesce(nullif(p.organization, ''), nullif(p.department, ''), d.name, '') = teams_todos.target_organization
  )
);

create policy "teams_todos_insert_managers_own_organization"
on public.teams_todos
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text in ('owner', 'admin', 'department_manager', 'team_manager', 'leader')
      and coalesce(nullif(p.organization, ''), nullif(p.department, ''), d.name, '') = teams_todos.target_organization
  )
);

create policy "teams_todos_update_managers_own_organization"
on public.teams_todos
for update
using (
  exists (
    select 1
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text in ('owner', 'admin', 'department_manager', 'team_manager', 'leader')
      and coalesce(nullif(p.organization, ''), nullif(p.department, ''), d.name, '') = teams_todos.target_organization
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text in ('owner', 'admin', 'department_manager', 'team_manager', 'leader')
      and coalesce(nullif(p.organization, ''), nullif(p.department, ''), d.name, '') = teams_todos.target_organization
  )
);

create policy "teams_todos_delete_managers_own_organization"
on public.teams_todos
for delete
using (
  exists (
    select 1
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where p.id = auth.uid()
      and p.is_active = true
      and p.role::text in ('owner', 'admin', 'department_manager', 'team_manager', 'leader')
      and coalesce(nullif(p.organization, ''), nullif(p.department, ''), d.name, '') = teams_todos.target_organization
  )
);

create table if not exists public.organization_master_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.organization_master_audit_logs enable row level security;

drop policy if exists "organization_audit_owner_admin_select" on public.organization_master_audit_logs;

create policy "organization_audit_owner_admin_select"
on public.organization_master_audit_logs
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('owner', 'admin')
      and p.is_active = true
  )
);

comment on table public.teams_todos is 'Organization-scoped lightweight ToDo records. Separate from Project/tasks and approval flows.';
comment on column public.teams_todos.target_organization is 'Organization/department scope. RLS limits normal access to the logged-in user organization.';
comment on table public.organization_master_audit_logs is 'Foundation for auditing organization/profile/account master changes.';
