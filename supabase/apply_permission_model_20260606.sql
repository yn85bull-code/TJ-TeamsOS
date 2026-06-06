-- Apply TeamOS permission model:
-- Owner / Admin: all work data, final approval.
-- Manager: own department/team read, reviewer confirmation, no final approval.
-- Member: own related work only, no approval list.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('owner', 'admin'), false)
$$;

create or replace function public.is_department_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('department_manager', 'team_manager', 'executive'), false)
$$;

drop policy if exists "issues_select_scope" on public.issues;
create policy "issues_select_scope"
on public.issues for select
using (
  public.is_admin()
  or created_by = auth.uid()
  or assignee_id = auth.uid()
  or approver_id = auth.uid()
  or (
    public.is_department_manager()
    and (
      public.same_department(department_id)
      or public.same_team(team_id)
    )
  )
);

drop policy if exists "tasks_select_scope" on public.tasks;
create policy "tasks_select_scope"
on public.tasks for select
using (
  public.is_admin()
  or created_by = auth.uid()
  or assignee_id = auth.uid()
  or exists (
    select 1 from public.issues i
    where i.id = tasks.issue_id
      and (
        i.created_by = auth.uid()
        or i.assignee_id = auth.uid()
        or (
          public.is_department_manager()
          and (
            public.same_department(i.department_id)
            or public.same_team(i.team_id)
          )
        )
      )
  )
);

drop policy if exists "approvals_select_related" on public.approvals;
create policy "approvals_select_related"
on public.approvals for select
using (
  public.is_admin()
  or requester_id = auth.uid()
  or reviewer_id = auth.uid()
  or final_approver_id = auth.uid()
);

drop policy if exists "approvals_update_approver_or_requester" on public.approvals;
create policy "approvals_update_approver_or_requester"
on public.approvals for update
using (
  public.is_admin()
  or requester_id = auth.uid()
  or reviewer_id = auth.uid()
  or final_approver_id = auth.uid()
)
with check (
  public.is_admin()
  or requester_id = auth.uid()
  or reviewer_id = auth.uid()
  or final_approver_id = auth.uid()
);
