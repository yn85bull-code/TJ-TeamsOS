-- TeamsToDo assignment support.
-- Run after supabase/add_teams_todos_and_organization_20260606.sql.

alter table public.teams_todos
  add column if not exists assignee_id uuid references public.profiles(id) on delete set null,
  add column if not exists assignee_name text,
  add column if not exists assigned_my_todo_id uuid references public.my_todos(id) on delete set null,
  add column if not exists assigned_at timestamptz;

alter table public.my_todos
  add column if not exists source_type text default 'personal',
  add column if not exists source_teams_todo_id uuid references public.teams_todos(id) on delete set null,
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_by_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'my_todos_source_type_check'
      and conrelid = 'public.my_todos'::regclass
  ) then
    alter table public.my_todos
      add constraint my_todos_source_type_check
      check (source_type in ('personal', 'teams_todo'))
      not valid;
  end if;
end $$;

alter table public.my_todos validate constraint my_todos_source_type_check;

create index if not exists idx_teams_todos_assignee
on public.teams_todos (target_organization, assignee_id, status);

create index if not exists idx_my_todos_source_teams_todo
on public.my_todos (source_teams_todo_id);

comment on column public.teams_todos.assignee_id is 'Optional same-organization user assigned from TeamsToDo.';
comment on column public.teams_todos.assigned_my_todo_id is 'MyToDo copy created for the assignee.';
comment on column public.my_todos.source_type is 'personal or teams_todo. MyToDo remains visible only to user_id.';
comment on column public.my_todos.assigned_by is 'Profile that assigned a TeamsToDo into this user MyToDo.';
