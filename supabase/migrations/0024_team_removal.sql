-- Taking someone off the team was impossible: workspace_members has RLS enabled
-- with only SELECT and INSERT policies, so every DELETE was silently denied.
-- Same for invitations (no way to revoke a pending one) and project_members
-- (no way to withdraw a guest's access).

-- Admin check as a security-definer function rather than an inline EXISTS on
-- workspace_members. A policy that queries its own table re-enters RLS, and the
-- existing helpers already establish this pattern.
create function public.is_workspace_admin(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

-- Whether a SPECIFIC user owns the workspace (is_workspace_owner only answers
-- that question for the caller).
create function public.is_workspace_owner_user(ws uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspaces where id = ws and owner_id = uid);
$$;
grant execute on function public.is_workspace_owner_user(uuid, uuid) to authenticated;

-- Admins remove teammates. Two guards that must live here rather than in the
-- app, because RLS is the only thing a direct API call cannot route around:
--   * the workspace owner can never be removed, by anyone, including themselves
--   * you cannot remove yourself, so a workspace can't be left without an admin
--     by accident (leaving would be a separate, deliberate action)
create policy "admins remove members" on public.workspace_members
  for delete using (
    public.is_workspace_admin(workspace_id)
    and user_id <> auth.uid()
    and not public.is_workspace_owner_user(workspace_id, user_id)
  );

-- Revoke a pending invitation.
create policy "admins revoke invitations" on public.invitations
  for delete using (public.is_workspace_admin(workspace_id));

-- Withdraw project-level access. Scoped to admins of the project's workspace so
-- one reviewer can't remove another.
create policy "admins remove project members" on public.project_members
  for delete using (
    exists (
      select 1 from public.projects pr
      where pr.id = project_id and public.is_workspace_admin(pr.workspace_id)
    )
  );
