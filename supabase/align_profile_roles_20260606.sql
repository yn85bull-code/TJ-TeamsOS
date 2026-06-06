-- Align TJ-TeamsOS profiles with the four operational roles:
-- Owner / Admin / Manager / Member.
-- Run this in Supabase SQL Editor after the Auth users exist.

with departments_seed(name, description) as (
  values
    ('営業本部', '営業全体の管理部門'),
    ('買取営業', '買取営業部門'),
    ('情シス', 'システム管理部門'),
    ('総務部', '総務・確認部門')
)
insert into public.departments (name, description)
select name, description
from departments_seed
on conflict (name) do update set
  description = excluded.description,
  updated_at = now();

drop trigger if exists enforce_profile_role_update_scope on public.profiles;

update public.profiles
set role = 'admin'
where role = 'owner'
  and email <> 'yamada@example.com';

insert into public.profiles (id, display_name, email, role, department_id)
values
  (
    '3c3c1893-eb7a-4442-b189-d5f430fe909f',
    '山田 太郎',
    'yamada@example.com',
    'owner',
    (select id from public.departments where name = '営業本部')
  ),
  (
    '2c70b447-3988-45f7-ad9e-cf2dd9b10e01',
    '佐藤 一郎',
    'sato@example.com',
    'department_manager',
    (select id from public.departments where name = '買取営業')
  ),
  (
    '8a6e2853-d976-4aba-b9f8-ba1bbd116b12',
    '鈴木 太郎',
    'suzuki@example.com',
    'admin',
    (select id from public.departments where name = '情シス')
  ),
  (
    '2323f6d1-8172-45da-a41d-0186f1ad10fc',
    '田中 美咲',
    'tanaka@example.com',
    'member',
    (select id from public.departments where name = '総務部')
  )
on conflict (id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  role = excluded.role,
  department_id = excluded.department_id,
  updated_at = now();

update public.profiles
set role = case
  when email = 'yamada@example.com' then 'owner'::app_role
  when email = 'suzuki@example.com' then 'admin'::app_role
  when email = 'sato@example.com' then 'department_manager'::app_role
  when email = 'tanaka@example.com' then 'member'::app_role
  when role in ('executive', 'team_manager') then 'department_manager'::app_role
  when role = 'viewer' then 'member'::app_role
  else role
end,
updated_at = now()
where email in ('yamada@example.com', 'suzuki@example.com', 'sato@example.com', 'tanaka@example.com')
   or role in ('executive', 'team_manager', 'viewer');

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('owner', 'admin'), false)
$$;

create or replace function public.enforce_profile_role_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if public.current_profile_role() <> 'owner' then
      raise exception 'Only Owner can update profile roles.';
    end if;

    if old.role = 'owner' and new.role <> 'owner' then
      raise exception 'Owner role cannot be removed from the sole owner in this workflow.';
    end if;

    if new.role = 'owner' and old.role <> 'owner' then
      raise exception 'Owner is fixed to the sole owner in this workflow.';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_profile_role_update_scope
before update on public.profiles
for each row execute function public.enforce_profile_role_update_scope();

select
  display_name,
  email,
  role
from public.profiles
where email in ('yamada@example.com', 'suzuki@example.com', 'sato@example.com', 'tanaka@example.com')
order by role, display_name;
