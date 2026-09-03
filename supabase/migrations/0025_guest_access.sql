-- Public links that need no login: a visitor gets an ANONYMOUS Supabase session,
-- so pins, comments, RLS and notifications keep working unchanged instead of
-- needing a parallel "guest" authorship path.
--
-- The catch, and the reason most of this file is about permissions: an anonymous
-- user carries the `authenticated` role. Every policy that applied to a signed-in
-- person now applies to a stranger with a link. And those policies were loose --
-- mockups, pins, comments and share links were all gated on can_see_project /
-- can_see_pin, which ANY project member satisfies regardless of role. So an
-- invited client could already delete the agency's files; a public link would
-- have handed that to anyone at all.

-- ── helpers ──────────────────────────────────────────────────────────────────

-- Is the caller on an anonymous (no-account) session?
create function public.is_guest()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;
grant execute on function public.is_guest() to authenticated, anon;

-- Is the caller on the OWNING TEAM for this project / file — as opposed to a
-- client or guest who merely has access to it?
create function public.can_manage_project(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and public.is_workspace_member(pr.workspace_id)
  );
$$;
grant execute on function public.can_manage_project(uuid) to authenticated;

create function public.can_manage_mockup(m uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mockups mk
    where mk.id = m and public.can_manage_project(mk.project_id)
  );
$$;
grant execute on function public.can_manage_mockup(uuid) to authenticated;

-- ── an anonymous visitor is a reviewer, never an account holder ──────────────

-- Without this, opening /app as a guest would lazily mint them a workspace.
drop policy if exists "authed create workspace" on public.workspaces;
create policy "authed create workspace" on public.workspaces
  for insert with check (owner_id = auth.uid() and not public.is_guest());

-- A guest has no email, so an access request from one could never be answered.
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

-- ── destroying things is for the owning team (and authors' own words) ────────

-- Renaming, archiving and deleting a file is the agency's call, not a client's.
drop policy if exists "members delete mockups" on public.mockups;
create policy "members delete mockups" on public.mockups
  for delete using (public.can_manage_project(project_id));

drop policy if exists "members update mockups" on public.mockups;
create policy "members update mockups" on public.mockups
  for update using (public.can_manage_project(project_id));

-- Anyone may withdraw their OWN pin; only the team may remove someone else's.
drop policy if exists "delete pins" on public.pins;
create policy "delete pins" on public.pins
  for delete using (created_by = auth.uid() or public.can_manage_mockup(mockup_id));

-- Resolving is a review action, so a client can resolve a thread they opened,
-- but not close out feedback that isn't theirs.
drop policy if exists "update pin status" on public.pins;
create policy "update pin status" on public.pins
  for update using (created_by = auth.uid() or public.can_manage_mockup(mockup_id));

-- Same shape for comments: your own, or the team's.
drop policy if exists "delete comments" on public.comments;
create policy "delete comments" on public.comments
  for delete using (
    author_id = auth.uid()
    or exists (
      select 1 from public.pins p
      where p.id = pin_id and public.can_manage_mockup(p.mockup_id)
    )
  );

-- Making a link public (or private) decides who can reach the work. Never a
-- client's decision, and certainly not a guest's.
drop policy if exists "update share link" on public.share_links;
create policy "update share link" on public.share_links
  for update using (public.can_manage_mockup(mockup_id));

drop policy if exists "create share link" on public.share_links;
create policy "create share link" on public.share_links
  for insert with check (public.can_manage_mockup(mockup_id) and created_by = auth.uid());

-- ── a guest has no email address ────────────────────────────────────────────

-- profiles.email is NOT NULL, and an anonymous auth user has no email, so the
-- signup trigger would fail and signInAnonymously() would error. Give guests a
-- non-routable placeholder on a reserved TLD (RFC 2606) so nothing can ever try
-- to deliver to it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, 'guest-' || new.id || '@guest.invalid'),
    coalesce(new.raw_user_meta_data->>'name', '')
  );
  return new;
end;
$$;
