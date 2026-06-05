-- Quick setup check after running the schema and profile seed.

select
  'profiles' as target,
  count(*) as row_count
from public.profiles
union all
select
  'departments' as target,
  count(*) as row_count
from public.departments
union all
select
  'roles' as target,
  count(*) as row_count
from public.roles;

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'issues', 'tasks', 'approvals')
order by tablename, policyname;
