-- MyToDo: personal todos and notes.
-- Run after supabase/migrations/20260603_initial_schema.sql.

create table if not exists public.my_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  memo text,
  due_date date,
  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'on_hold', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_my_todos_user_status_due
on public.my_todos (user_id, status, due_date);

create index if not exists idx_my_todos_user_priority
on public.my_todos (user_id, priority);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_my_todos_updated_at on public.my_todos;
create trigger set_my_todos_updated_at before update on public.my_todos
for each row execute function public.set_updated_at();

alter table public.my_todos enable row level security;

drop policy if exists "my_todos_select_own" on public.my_todos;
drop policy if exists "my_todos_insert_own" on public.my_todos;
drop policy if exists "my_todos_update_own" on public.my_todos;
drop policy if exists "my_todos_delete_own" on public.my_todos;

create policy "my_todos_select_own"
on public.my_todos
for select
using (auth.uid() = user_id);

create policy "my_todos_insert_own"
on public.my_todos
for insert
with check (auth.uid() = user_id);

create policy "my_todos_update_own"
on public.my_todos
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "my_todos_delete_own"
on public.my_todos
for delete
using (auth.uid() = user_id);

comment on table public.my_todos is 'Personal MyToDo records. Never participates in issue/task/approval workflows.';
comment on column public.my_todos.user_id is 'Owner of the personal MyToDo. RLS always limits access to auth.uid().';
