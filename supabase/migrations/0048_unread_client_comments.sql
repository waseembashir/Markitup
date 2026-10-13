-- The dashboard should put a project a client just commented on at the top,
-- with a red count of the comments you haven't seen yet.
--
-- "Client" has to mean what it means for Slack (0045): not a member of the
-- workspace, and not a guest who gave a teammate's name or email. That test
-- lived inside comment_from_team(), which can only ask about the caller. It
-- moves into is_team_voice(), which asks about any author, and both callers
-- share it so the channel and the dashboard never disagree about who's a client.

create or replace function public.is_team_voice(ws uuid, author uuid)
returns boolean
language plpgsql security definer stable set search_path = public as $$
declare
  is_guest boolean;
  typed text;
  typed_first text;
begin
  if exists (select 1 from public.workspace_members where workspace_id = ws and user_id = author) then
    return true;
  end if;

  -- A real account that isn't on the team is a client, whatever it is called.
  select coalesce(u.is_anonymous, false) into is_guest from auth.users u where u.id = author;
  if not coalesce(is_guest, false) then
    return false;
  end if;

  select lower(btrim(regexp_replace(pr.name, '\s+', ' ', 'g'))) into typed
  from public.profiles pr where pr.id = author;
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
      select '', lower(i.email)
      from public.invitations i
      where i.workspace_id = ws and i.project_id is null and i.accepted_at is null
    ),
    keys(k) as (
      select name from team where name <> ''
      union select split_part(name, ' ', 1) from team where name <> ''
      union select email from team
      union select split_part(email, '@', 1) from team
      union select regexp_replace(split_part(email, '@', 1), '[._-].*$', '') from team
    )
    select 1 from keys
    where length(k) >= 2 and (k = typed or k = typed_first)
  );
end;
$$;

-- Internal: answers about any author, so only other definer functions call it.
revoke all on function public.is_team_voice(uuid, uuid) from public;
revoke execute on function public.is_team_voice(uuid, uuid) from anon, authenticated;

-- Same answer as before (0045), now from the shared test.
create or replace function public.comment_from_team(p_mockup uuid)
returns boolean
language plpgsql security definer stable set search_path = public as $$
declare
  me uuid := auth.uid();
  ws uuid;
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
  return public.is_team_voice(ws, me);
end;
$$;

grant execute on function public.comment_from_team(uuid) to authenticated;

-- Client comments the caller hasn't seen, per file: posted since they last
-- opened it. For a file they've never opened, the past week's — otherwise
-- every old file would light up with its whole history the day this ships.
create or replace function public.unread_client_comments(p uuid[])
returns table (project_id uuid, mockup_id uuid, unread int, latest_at timestamptz)
language sql security definer stable set search_path = public as $$
  with visible as (
    select id from unnest(p) as id where public.can_see_project(id)
  ),
  mk as (
    select m.id, m.project_id, pr.workspace_id
    from public.mockups m
    join visible v on v.id = m.project_id
    join public.projects pr on pr.id = m.project_id
    where m.archived_at is null
  ),
  c as (
    select mk.project_id, mk.id as mockup_id, mk.workspace_id, cm.author_id, cm.created_at
    from public.comments cm
    join public.pins pin on pin.id = cm.pin_id
    join mk on mk.id = pin.mockup_id
    left join public.mockup_views mv on mv.mockup_id = mk.id and mv.user_id = auth.uid()
    where cm.created_at > coalesce(mv.viewed_at, now() - interval '7 days')
      and cm.author_id is distinct from auth.uid()
  ),
  -- one verdict per person, not per comment
  voices as (
    select distinct c.workspace_id, c.author_id,
           public.is_team_voice(c.workspace_id, c.author_id) as team
    from c
  )
  select c.project_id, c.mockup_id, count(*)::int, max(c.created_at)
  from c
  join voices vo on vo.workspace_id = c.workspace_id and vo.author_id = c.author_id
  where not vo.team
  group by c.project_id, c.mockup_id;
$$;

grant execute on function public.unread_client_comments(uuid[]) to authenticated;
