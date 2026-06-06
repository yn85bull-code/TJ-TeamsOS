-- Add job title / position support for TeamOS user management.
alter table public.profiles
  add column if not exists position text;

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
