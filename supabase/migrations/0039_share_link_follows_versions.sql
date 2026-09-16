-- Uploading a new version of a file produced a new share link, so the agency
-- had to send the client a fresh URL every time the design changed — and every
-- link already sent quietly pointed at an old version the client would go on
-- reviewing.
--
-- A share link is shared once and lives in somebody's inbox for weeks. It has
-- to mean "this design", not "this particular upload of it".
--
-- Versions of a file are rows in `mockups` sharing a `version_group`. Two
-- changes make a link follow the group rather than the row it was minted from:
-- the resolver below, so links already sent land on the current version, and
-- getShareInfo, which now looks for an existing link anywhere in the group
-- before creating one.

-- Which version of a file should a link open? The newest one that has not been
-- archived, falling back to the highest version if every one is archived, so a
-- link never dead-ends.
create or replace function public.latest_in_version_group(p_mockup uuid)
returns uuid
language sql security definer stable set search_path = public as $$
  select mk.id
  from public.mockups mk
  where mk.version_group = (select version_group from public.mockups where id = p_mockup)
    and mk.project_id   = (select project_id    from public.mockups where id = p_mockup)
  order by (mk.archived_at is null) desc, mk.version desc
  limit 1;
$$;

grant execute on function public.latest_in_version_group(uuid) to authenticated;

create or replace function public.join_project_via_share(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mockup uuid;
  v_project uuid;
  v_vis text;
begin
  select sl.mockup_id, mk.project_id, sl.visibility
    into v_mockup, v_project, v_vis
  from public.share_links sl
  join public.mockups mk on mk.id = sl.mockup_id
  where sl.token = p_token;

  if v_mockup is null then
    return null;
  end if;

  if v_vis = 'public' then
    insert into public.project_members (project_id, user_id, role)
    values (v_project, auth.uid(), 'reviewer')
    on conflict (project_id, user_id) do nothing;
  end if;

  -- Follow the group to whatever the current version is.
  return coalesce(public.latest_in_version_group(v_mockup), v_mockup);
end;
$$;

-- The preview names the file on the guest gate before anyone signs in, so it
-- should name the version they are about to be shown.
-- Same four columns as before — the return type cannot change — but mockup_id
-- and the name now describe the version the link will actually open, not the
-- one it happened to be created from.
create or replace function public.share_link_preview(p_token text)
returns table (mockup_id uuid, visibility text, mockup_name text, project_name text)
language sql security definer stable set search_path = public as $$
  select latest.id, sl.visibility, latest.name, pr.name
  from public.share_links sl
  join public.mockups mk on mk.id = sl.mockup_id
  join public.mockups latest on latest.id = coalesce(public.latest_in_version_group(sl.mockup_id), sl.mockup_id)
  join public.projects pr on pr.id = mk.project_id
  where sl.token = p_token;
$$;

grant execute on function public.share_link_preview(text) to anon, authenticated;
