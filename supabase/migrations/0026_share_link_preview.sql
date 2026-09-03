-- The guest gate needs to name the file it's asking for feedback on, before the
-- visitor has any session at all.
--
-- Deliberately keyed on the TOKEN rather than the mockup id: the caller must
-- already hold a working share link, so this exposes nothing that link doesn't.
-- (mockup_access_preview stays authenticated-only for that reason.)
create function public.share_link_preview(p_token text)
returns table (mockup_id uuid, visibility text, mockup_name text, project_name text)
language sql security definer stable set search_path = public as $$
  select sl.mockup_id, sl.visibility, mk.name, pr.name
  from public.share_links sl
  join public.mockups mk on mk.id = sl.mockup_id
  join public.projects pr on pr.id = mk.project_id
  where sl.token = p_token;
$$;
grant execute on function public.share_link_preview(text) to anon, authenticated;
