-- A teammate's role could not be changed. workspace_members had policies to
-- read, insert and delete, none to update, so promoting a Manager to Admin was
-- impossible: inviting them again collided with their existing row ("duplicate
-- key value violates unique constraint workspace_members_workspace_id_user_id")
-- and the only other route was to remove them and lose nothing but time.
--
-- Same guards as removal (0024): an admin of the workspace may change someone
-- else's role; nobody changes their own, the owner's row is untouchable, and
-- the only roles on offer are the two the Invite dialog offers.
create policy "admins change roles" on public.workspace_members
  for update
  using (
    public.is_workspace_admin(workspace_id)
    and user_id <> auth.uid()
    and not public.is_workspace_owner_user(workspace_id, user_id)
  )
  with check (
    public.is_workspace_admin(workspace_id)
    and user_id <> auth.uid()
    and role in ('admin', 'member')
  );
