-- Creating a project and reading it back in one statement fails, with an error
-- that points nowhere near the cause:
--
--   new row violates row-level security policy for table "projects"  (42501)
--
-- The insert itself is allowed. What fails is the read. PostgREST turns
-- `Prefer: return=representation` into INSERT ... RETURNING, and RETURNING runs
-- the SELECT policy too. That policy was can_see_project(id), which finds the
-- project by looking it up:
--
--   exists (select 1 from projects pr where pr.id = p and is_workspace_member(pr.workspace_id))
--
-- The function is STABLE, so it sees the snapshot from the start of the
-- statement — a snapshot in which the row being inserted does not exist yet. The
-- policy therefore denies the author sight of their own new row.
--
-- Nothing hits this today: createProject inserts without .select(). It is a trap
-- rather than an outage, and the kind that costs an afternoon, because the error
-- names the INSERT while the fault is in the SELECT.
--
-- Decide from the row's own columns instead of looking the row up. For a row
-- that already exists the two are identical — pr.id = p means pr IS the row, so
-- is_workspace_member(pr.workspace_id) is is_workspace_member(workspace_id) —
-- and for a row being inserted, only this version can be evaluated at all.
--
-- Still SECURITY DEFINER: the project_members check has to see rows that table's
-- own policies would hide, exactly as can_see_project does. can_see_project is
-- left alone; other tables' policies call it with a project_id they already
-- hold, where the lookup is correct.

create or replace function public.can_see_project_row(p_id uuid, p_workspace uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_workspace_member(p_workspace)
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = p_id and pm.user_id = auth.uid()
      );
$$;

grant execute on function public.can_see_project_row(uuid, uuid) to authenticated;

drop policy if exists "see projects" on public.projects;
create policy "see projects" on public.projects
  for select using (public.can_see_project_row(id, workspace_id));
