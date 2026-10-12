-- Everyone at the company should share one workspace without being invited
-- one by one: anyone with an @apexure.com address belongs in the workspace
-- owned by success@apexure.com, sees every project and upload on their
-- dashboard, and can do everything a Manager can.
--
-- Two things stood in the way. Nobody joined a workspace without an invite. And
-- ensure_workspace() opened a person's OLDEST membership, so a teammate who had
-- signed up before being invited kept landing in the empty personal workspace
-- signup gave them, never seeing the team's projects.
--
-- workspace_domains claims an email domain for a workspace. ensure_workspace()
-- — run on every app page load — now adds a verified address on a claimed
-- domain to that workspace, and opens that workspace ahead of any other.
--
--   * Verified addresses only (email_confirmed_at; Google sign-in sets it).
--     Typing someone@apexure.com at signup must not open client designs.
--   * Once. workspace_domain_joins records the automatic join, so an admin who
--     removes someone isn't overruled on their next page load.
--   * Nothing is deleted. Old personal workspaces stay; they just stop being
--     the one that opens.

create table public.workspace_domains (
  domain       text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]+$'),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- 'member' is shown as Manager.
  role         text not null default 'member' check (role in ('admin', 'member')),
  created_at   timestamptz not null default now()
);
alter table public.workspace_domains enable row level security;
create policy "members read domains" on public.workspace_domains
  for select using (public.is_workspace_member(workspace_id));

create table public.workspace_domain_joins (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
-- Read and written only by ensure_workspace() and this migration.
alter table public.workspace_domain_joins enable row level security;

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
  dom_ws    uuid;
  dom_role  text;
begin
  if uid is null then
    return;
  end if;

  -- A guest on a public link is a reviewer passing through, not an account
  -- holder. Minting them a workspace would spawn one per visitor.
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return;
  end if;

  -- Their company's workspace, if their verified address is on a claimed domain.
  select d.workspace_id, d.role into dom_ws, dom_role
  from auth.users u
  join public.workspace_domains d on d.domain = lower(split_part(u.email, '@', 2))
  where u.id = uid and u.email_confirmed_at is not null;

  if dom_ws is not null
     and not exists (select 1 from public.workspace_domain_joins j
                      where j.workspace_id = dom_ws and j.user_id = uid) then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (dom_ws, uid, dom_role)
    on conflict (workspace_id, user_id) do nothing;
    insert into public.workspace_domain_joins (workspace_id, user_id)
    values (dom_ws, uid)
    on conflict do nothing;
  end if;

  -- Fast path: already a member of something. The company workspace first, then
  -- the oldest — ordered, so every request agrees on which workspace that is.
  select w.id, w.name into found_id, found_nm
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = uid
  order by (m.workspace_id is not distinct from dom_ws) desc, m.created_at, w.id
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

-- Claim apexure.com for the workspace success@apexure.com owns. A database
-- without that account (dev, a fresh install) simply claims nothing.
insert into public.workspace_domains (domain, workspace_id)
select 'apexure.com', w.id
from public.workspaces w
join public.profiles p on p.id = w.owner_id
where lower(p.email) = 'success@apexure.com'
order by w.created_at, w.id
limit 1
on conflict (domain) do nothing;

-- Bring in everyone already signed up on a claimed domain, now rather than on
-- their next page load, so the Team list shows them straight away. Roles of
-- people already on the team are left as they are.
insert into public.workspace_members (workspace_id, user_id, role)
select d.workspace_id, u.id, d.role
from auth.users u
join public.profiles p on p.id = u.id
join public.workspace_domains d on d.domain = lower(split_part(u.email, '@', 2))
where u.email_confirmed_at is not null
  and coalesce(u.is_anonymous, false) = false
on conflict (workspace_id, user_id) do nothing;

insert into public.workspace_domain_joins (workspace_id, user_id)
select d.workspace_id, u.id
from auth.users u
join public.profiles p on p.id = u.id
join public.workspace_domains d on d.domain = lower(split_part(u.email, '@', 2))
where u.email_confirmed_at is not null
  and coalesce(u.is_anonymous, false) = false
on conflict do nothing;
