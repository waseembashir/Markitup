-- Someone who has a file's link but no access currently gets a bare 404: RLS
-- returns no row, so the viewer page cannot tell "you may not see this" from
-- "this does not exist". That also dead-ends every RESTRICTED share link, since
-- join_project_via_share only auto-joins on a public link and then redirects
-- into a page the visitor is not allowed to load.
--
-- These two security-definer functions let the page tell the two cases apart
-- and let the visitor ask the owning team for access.

-- Allow the new notification kind.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'invite', 'share', 'access_request'));

-- Minimal preview of a file the caller cannot see, used only to render the
-- locked screen. Returns names but never file paths, ids, comments or members.
-- Mockup ids are gen_random_uuid(), so they cannot be enumerated; an unknown id
-- returns no row, which is exactly what the page turns back into a 404.
create function public.mockup_access_preview(p_mockup uuid)
returns table (mockup_name text, project_name text, workspace_name text)
language sql security definer stable set search_path = public as $$
  select mk.name, pr.name, w.name
  from public.mockups mk
  join public.projects pr on pr.id = mk.project_id
  join public.workspaces w on w.id = pr.workspace_id
  where mk.id = p_mockup;
$$;
grant execute on function public.mockup_access_preview(uuid) to authenticated;

-- Tell the owning workspace that the caller wants in. Notifies every member of
-- the file's workspace and reports the outcome so the UI can be specific.
-- Deliberately returns a status only: the caller must never learn who was
-- notified, so this stays safe to expose to any authenticated user.
create function public.request_mockup_access(p_mockup uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_workspace uuid;
  v_file text;
  v_actor text;
  v_sent int := 0;
begin
  if auth.uid() is null then
    return 'unauthenticated';
  end if;

  select mk.project_id, pr.workspace_id, mk.name
    into v_project, v_workspace, v_file
  from public.mockups mk
  join public.projects pr on pr.id = mk.project_id
  where mk.id = p_mockup;

  if v_project is null then
    return 'not_found';
  end if;

  -- already allowed in — nothing to ask for
  if public.can_see_project(v_project) then
    return 'has_access';
  end if;

  -- one ask per person per file per day, so the button cannot be used to spam
  -- a workspace's notification feed
  if exists (
    select 1 from public.notifications
    where type = 'access_request'
      and mockup_id = p_mockup
      and actor_id = auth.uid()
      and created_at > now() - interval '24 hours'
  ) then
    return 'already_requested';
  end if;

  select coalesce(nullif(p.name, ''), p.email, 'Someone') into v_actor
  from public.profiles p where p.id = auth.uid();

  insert into public.notifications (user_id, actor_id, type, mockup_id, project_id, body)
  select wm.user_id, auth.uid(), 'access_request', p_mockup, v_project,
         v_actor || ' is asking for access to ' || v_file
  from public.workspace_members wm
  where wm.workspace_id = v_workspace
    and wm.user_id <> auth.uid();

  get diagnostics v_sent = row_count;
  if v_sent = 0 then
    return 'no_recipients';
  end if;
  return 'sent';
end;
$$;
grant execute on function public.request_mockup_access(uuid) to authenticated;
