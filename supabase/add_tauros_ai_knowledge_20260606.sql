-- TaurosAI knowledge base foundation.
-- This creates the storage/data model for chat, knowledge, files, and FAQ candidates.

do $$
begin
  create type knowledge_visibility_type as enum (
    'company',
    'owner_only',
    'admin',
    'manager',
    'department',
    'store',
    'role'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type knowledge_faq_candidate_status as enum (
    'pending',
    'approved',
    'rejected',
    'converted'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'FAQ',
  description text,
  content text not null default '',
  file_url text,
  file_name text,
  file_type text,
  visibility_type knowledge_visibility_type not null default 'company',
  allowed_roles app_role[] not null default array['owner','admin','department_manager','member']::app_role[],
  allowed_departments text[] not null default array[]::text[],
  allowed_stores text[] not null default array[]::text[],
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_files (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  question text not null,
  answer text not null,
  referenced_knowledge_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_faq_candidates (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  suggested_answer text,
  source_chat_log_ids uuid[] not null default array[]::uuid[],
  status knowledge_faq_candidate_status not null default 'pending',
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_items_category_idx on public.knowledge_items (category);
create index if not exists knowledge_items_visibility_idx on public.knowledge_items (visibility_type);
create index if not exists knowledge_items_deleted_idx on public.knowledge_items (deleted_at);
create index if not exists knowledge_chat_logs_user_created_idx on public.knowledge_chat_logs (user_id, created_at desc);

create or replace function public.can_manage_tauros_ai_knowledge()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('owner', 'admin'), false)
$$;

create or replace function public.can_view_knowledge_item(
  visibility knowledge_visibility_type,
  allowed_roles app_role[],
  allowed_departments text[],
  allowed_stores text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_profile as (
    select role, d.name as department_name
    from public.profiles p
    left join public.departments d on d.id = p.department_id
    where p.id = auth.uid()
  )
  select coalesce(
    exists (
      select 1
      from current_profile p
      where p.role = 'owner'
         or (visibility <> 'owner_only' and p.role = 'admin')
         or visibility = 'company'
         or (
           visibility = 'manager'
           and p.role = 'department_manager'
           and (cardinality(allowed_departments) = 0 or p.department_name = any(allowed_departments))
         )
         or (
           visibility = 'department'
           and p.role = any(allowed_roles)
           and p.department_name = any(allowed_departments)
         )
         or (
           visibility = 'role'
           and p.role = any(allowed_roles)
         )
    ),
    false
  )
$$;

alter table public.knowledge_items enable row level security;
alter table public.knowledge_files enable row level security;
alter table public.knowledge_chat_logs enable row level security;
alter table public.knowledge_faq_candidates enable row level security;

drop policy if exists "knowledge_items_select_allowed" on public.knowledge_items;
create policy "knowledge_items_select_allowed"
on public.knowledge_items for select
using (
  deleted_at is null
  and public.can_view_knowledge_item(visibility_type, allowed_roles, allowed_departments, allowed_stores)
);

drop policy if exists "knowledge_items_insert_admin" on public.knowledge_items;
create policy "knowledge_items_insert_admin"
on public.knowledge_items for insert
with check (public.can_manage_tauros_ai_knowledge());

drop policy if exists "knowledge_items_update_admin" on public.knowledge_items;
create policy "knowledge_items_update_admin"
on public.knowledge_items for update
using (public.can_manage_tauros_ai_knowledge())
with check (public.can_manage_tauros_ai_knowledge());

drop policy if exists "knowledge_files_select_allowed" on public.knowledge_files;
create policy "knowledge_files_select_allowed"
on public.knowledge_files for select
using (
  exists (
    select 1
    from public.knowledge_items k
    where k.id = knowledge_files.knowledge_item_id
      and k.deleted_at is null
      and public.can_view_knowledge_item(k.visibility_type, k.allowed_roles, k.allowed_departments, k.allowed_stores)
  )
);

drop policy if exists "knowledge_files_manage_admin" on public.knowledge_files;
create policy "knowledge_files_manage_admin"
on public.knowledge_files for all
using (public.can_manage_tauros_ai_knowledge())
with check (public.can_manage_tauros_ai_knowledge());

drop policy if exists "knowledge_chat_logs_self_or_admin" on public.knowledge_chat_logs;
create policy "knowledge_chat_logs_self_or_admin"
on public.knowledge_chat_logs for select
using (user_id = auth.uid() or public.can_manage_tauros_ai_knowledge());

drop policy if exists "knowledge_chat_logs_insert_self" on public.knowledge_chat_logs;
create policy "knowledge_chat_logs_insert_self"
on public.knowledge_chat_logs for insert
with check (user_id = auth.uid());

drop policy if exists "knowledge_faq_candidates_admin" on public.knowledge_faq_candidates;
create policy "knowledge_faq_candidates_admin"
on public.knowledge_faq_candidates for all
using (public.can_manage_tauros_ai_knowledge())
with check (public.can_manage_tauros_ai_knowledge());

insert into storage.buckets (id, name, public)
values ('tauros-ai-knowledge', 'tauros-ai-knowledge', false)
on conflict (id) do nothing;
