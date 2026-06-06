-- Add job title / position support for TeamOS user management.
alter table public.profiles
  add column if not exists position text;

create or replace function public.enforce_profile_role_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    or new.department_id is distinct from old.department_id
    or new.position is distinct from old.position then
    if public.current_profile_role() <> 'owner' then
      raise exception 'Only Owner can update profile role, department, or position.';
    end if;
  end if;

  if old.role = 'owner' and new.role <> 'owner' then
    raise exception 'Owner role cannot be removed from the sole owner in this workflow.';
  end if;

  if new.role = 'owner' and old.role <> 'owner' then
    raise exception 'Owner is fixed to the sole owner in this workflow.';
  end if;

  return new;
end;
$$;

update public.profiles
set position = case
  when email = 'yn85bull@gmail.com' then '代表'
  when email = 'narahara-t@tauros.jp' then '部長'
  when email = 'takara@tauros.jp' then '次長'
  when email = 'nakayama@tauros.jp' then '事務'
  else coalesce(position, '未設定')
end
where position is null
   or email in (
    'yn85bull@gmail.com',
    'narahara-t@tauros.jp',
    'takara@tauros.jp',
    'nakayama@tauros.jp'
  );
