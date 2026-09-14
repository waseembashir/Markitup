-- Same shape of bug as the duplicate workspaces in 0032, one table over.
--
-- request_mockup_access checks whether this person already asked for this file
-- in the last 24 hours, and inserts a notification for every workspace member if
-- not. Check, then insert, with nothing in between — so two calls that arrive
-- together both see no prior request and both fan out. A double-clicked "Request
-- access" button puts two identical notifications in front of every member of
-- the workspace, which is precisely what the 24-hour window exists to prevent.
--
-- Serialize per (asker, file). Two people asking about different files, or the
-- same file from different accounts, never wait on each other.

create or replace function public.request_mockup_access(p_mockup uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_workspace uuid;
  v_file text;
  v_actor text;
  v_sent int := 0;
begin
  -- A guest has no email, so an access request from one could never be answered.
  if auth.uid() is null or public.is_guest() then
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

  if public.can_see_project(v_project) then
    return 'has_access';
  end if;

  -- Held until this transaction ends, so the check below and the insert that
  -- follows it cannot be interleaved with another call from the same person.
  perform pg_advisory_xact_lock(hashtext('access_request:' || auth.uid()::text || ':' || p_mockup::text));

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
