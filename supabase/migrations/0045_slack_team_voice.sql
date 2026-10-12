-- The team's own comments kept reaching the client channel.
--
-- The app decided "team or client" by reading workspace_members as the
-- commenter. That is right for a teammate signed in with their own account,
-- but teammates often open a client's share link while signed out, type their
-- name, and become an anonymous guest. Every Slack message the team complained
-- of came from such a guest — "Vinay", "Sajad", "Mohsin" — and the session
-- stays in that browser, so it kept happening after they were told to sign in.
--
-- The workspace owner's ruling: the channel is for clients only. A comment is
-- the team's when the commenter is a member of the project's workspace, or is a
-- guest who gave a team member's name or email — a member's or a pending
-- invite's. A client who happens to share a teammate's first name goes
-- unannounced too; that trade was made knowingly.
--
-- A guest cannot read the roster (members read roster), hence security definer.
-- The caller must be able to see the file, exactly as for leaving a comment on
-- it, and the answer is a single boolean about their own comment.
create or replace function public.comment_from_team(p_mockup uuid)
returns boolean
language plpgsql security definer stable set search_path = public as $$
declare
  me uuid := auth.uid();
  ws uuid;
  is_guest boolean;
  typed text;
  typed_first text;
begin
  if me is null or not public.can_see_pin(p_mockup) then
    return false;
  end if;

  select p.workspace_id into ws
  from public.mockups m join public.projects p on p.id = m.project_id
  where m.id = p_mockup;
  if ws is null then
    return false;
  end if;

  if exists (select 1 from public.workspace_members where workspace_id = ws and user_id = me) then
    return true;
  end if;

  -- A real account that isn't on the team is a client, whatever it is called.
  select coalesce(u.is_anonymous, false) into is_guest from auth.users u where u.id = me;
  if not coalesce(is_guest, false) then
    return false;
  end if;

  select lower(btrim(regexp_replace(pr.name, '\s+', ' ', 'g'))) into typed
  from public.profiles pr where pr.id = me;
  if coalesce(typed, '') = '' then
    return false;
  end if;
  typed_first := split_part(typed, ' ', 1);

  return exists (
    with team(name, email) as (
      select lower(btrim(regexp_replace(pr.name, '\s+', ' ', 'g'))), lower(pr.email)
      from public.workspace_members wm join public.profiles pr on pr.id = wm.user_id
      where wm.workspace_id = ws
      union all
      -- Invited to the team but not signed up yet: all we know is the email.
      select '', lower(i.email)
      from public.invitations i
      where i.workspace_id = ws and i.project_id is null and i.accepted_at is null
    ),
    keys(k) as (
      select name from team where name <> ''                          -- "vinay rajput"
      union select split_part(name, ' ', 1) from team where name <> '' -- "vinay"
      union select email from team                                     -- "vinay.rajput@apexure.com"
      union select split_part(email, '@', 1) from team                 -- "vinay.rajput"
      union select regexp_replace(split_part(email, '@', 1), '[._-].*$', '') from team -- "vinay"
    )
    select 1 from keys
    where length(k) >= 2 and (k = typed or k = typed_first)
  );
end;
$$;

grant execute on function public.comment_from_team(uuid) to authenticated;
