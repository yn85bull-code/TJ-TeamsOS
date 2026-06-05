-- Run this after creating users in Supabase Authentication.
-- Replace each 00000000-0000-0000-0000-000000000000 value with the
-- matching Auth user UUID from Dashboard > Authentication > Users.

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

insert into public.profiles (id, display_name, email, role, department_id)
values
  (
    '00000000-0000-0000-0000-000000000001',
    '山田 太郎',
    'yamada@example.com',
    'owner',
    (select id from public.departments where name = '営業本部')
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '佐藤 一郎',
    'sato@example.com',
    'department_manager',
    (select id from public.departments where name = '買取営業')
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '鈴木 太郎',
    'suzuki@example.com',
    'member',
    (select id from public.departments where name = '情シス')
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '田中 美咲',
    'tanaka@example.com',
    'viewer',
    (select id from public.departments where name = '総務部')
  )
on conflict (id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  role = excluded.role,
  department_id = excluded.department_id,
  updated_at = now();
