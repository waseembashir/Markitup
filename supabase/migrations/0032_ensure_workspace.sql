-- A signup produced two workspaces. Not under load — on a single page view.
--
-- getCurrentWorkspace() was a lazy get-or-create in application code: look for a
-- membership, and if there is none, insert a workspace and a membership. Both
-- app/app/layout.tsx and app/app/page.tsx call it, and a layout and its page
-- render concurrently in one pass. Both saw no membership. Both inserted.
--
-- The lookup then read `limit 1` with no order by, so which of the two a user
-- got back was whatever Postgres returned first — not stable between requests.
-- Projects created in one were invisible from the other, and the Slack, Figma,
-- reminder and email-template settings each attached to whichever workspace
-- happened to answer that request.
--
-- Nothing in application code can fix this: two requests cannot agree without
-- something serializing them. Do the whole get-or-create in one statement in the
-- database, behind an advisory lock on the user, the same way assign_pin_number
-- already serializes pin numbering.

create or replace function public.ensure_workspace()
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  found_id  uuid;
  found_nm  text;
  display   text;
begin
  if uid is null then
    return;
  end if;

  -- A guest on a public link is a reviewer passing through, not an account
  -- holder. Minting them a workspace would spawn one per visitor.
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return;
  end if;

  -- Fast path: already a member of something. Ordered, so every request agrees
  -- on which workspace that is even where duplicates still exist.
  select w.id, w.name into found_id, found_nm
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = uid
  order by m.created_at, w.id
  limit 1;

  if found_id is not null then
    return query select found_id, found_nm;
    return;
  end if;

  -- Serialize the concurrent first-load renders for this one user. Released at
  -- transaction end, and PostgREST gives every request its own transaction.
  perform pg_advisory_xact_lock(hashtext('ensure_workspace:' || uid::text));

  -- Re-check under the lock: whoever held it before us may have just created it.
  -- Read committed takes a fresh snapshot here, so their commit is visible.
  select w.id, w.name into found_id, found_nm
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = uid
  order by m.created_at, w.id
  limit 1;

  if found_id is not null then
    return query select found_id, found_nm;
    return;
  end if;

  select coalesce(nullif(p.name, ''), nullif(p.email, ''), 'My')
    into display
  from public.profiles p
  where p.id = uid;

  insert into public.workspaces (name, owner_id)
  values (coalesce(display, 'My') || '''s Workspace', uid)
  returning workspaces.id, workspaces.name into found_id, found_nm;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (found_id, uid, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return query select found_id, found_nm;
end;
$$;

revoke all on function public.ensure_workspace() from public;
grant execute on function public.ensure_workspace() to authenticated;

-- ---------------------------------------------------------------------------
-- Merge the duplicates this already created.
--
-- Keep the oldest workspace per owner and move everything into it. The tables
-- keyed one-row-per-workspace (integrations, reminder settings, email
-- templates) can collide, so those rows move only where the keeper has none;
-- otherwise the keeper's own settings win and the duplicate's are dropped with
-- it. Content tables — projects, folders, invitations, schedules, batches —
-- always move, because losing a project is not an acceptable outcome.
-- ---------------------------------------------------------------------------
do $$
declare
  keeper uuid;
  dupes  uuid[];
begin
  for keeper, dupes in
    select (array_agg(w.id order by w.created_at, w.id))[1],
           (array_agg(w.id order by w.created_at, w.id))[2:]
    from public.workspaces w
    group by w.owner_id
    having count(*) > 1
  loop
    update public.projects               set workspace_id = keeper where workspace_id = any(dupes);
    update public.folders                set workspace_id = keeper where workspace_id = any(dupes);
    update public.invitations            set workspace_id = keeper where workspace_id = any(dupes);
    update public.reminder_schedules     set workspace_id = keeper where workspace_id = any(dupes);
    update public.slack_comment_batches  set workspace_id = keeper where workspace_id = any(dupes);

    update public.workspace_integrations set workspace_id = keeper
     where workspace_id = any(dupes)
       and not exists (select 1 from public.workspace_integrations k where k.workspace_id = keeper);

    update public.reminder_settings set workspace_id = keeper
     where workspace_id = any(dupes)
       and not exists (select 1 from public.reminder_settings k where k.workspace_id = keeper);

    update public.email_templates t set workspace_id = keeper
     where t.workspace_id = any(dupes)
       and not exists (select 1 from public.email_templates k
                        where k.workspace_id = keeper and k.key = t.key);

    -- Teammates invited into a duplicate keep their access, at their own role.
    update public.workspace_members m set workspace_id = keeper
     where m.workspace_id = any(dupes)
       and not exists (select 1 from public.workspace_members k
                        where k.workspace_id = keeper and k.user_id = m.user_id);

    delete from public.workspaces where id = any(dupes);
  end loop;
end;
$$;
