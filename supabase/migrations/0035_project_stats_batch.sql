-- The dashboard called project_stats once per project, in parallel:
--
--   projectIds.map(async (id) => supabase.rpc("project_stats", { p: id }))
--
-- One HTTP round-trip and one Postgres connection per project, all at once. A
-- workspace with fifty projects opened fifty simultaneous connections every
-- time someone loaded the dashboard; two hundred projects, two hundred. The
-- pooler runs out long before the database does, and the failure looks like the
-- dashboard hanging rather than anything to do with project count.
--
-- Answer all of them in one query. can_see_project is still consulted per
-- project, but inside the database, where it costs an index lookup rather than
-- a network round-trip.

create or replace function public.project_stats_many(p uuid[])
returns table (project_id uuid, mockups int, comments int, resolved int)
language sql security definer stable set search_path = public as $$
  with visible as (
    -- Filter first: everything below joins against this, so a caller passing
    -- someone else's project ids gets no row for them rather than a zeroed one.
    select id from unnest(p) as id where public.can_see_project(id)
  ),
  mk as (
    select m.project_id, count(*)::int as n
    from public.mockups m
    join visible v on v.id = m.project_id
    group by m.project_id
  ),
  pn as (
    select m.project_id, count(*) filter (where pin.status = 'resolved')::int as resolved
    from public.pins pin
    join public.mockups m on m.id = pin.mockup_id
    join visible v on v.id = m.project_id
    group by m.project_id
  ),
  cm as (
    select m.project_id, count(*)::int as n
    from public.comments c
    join public.pins pin on pin.id = c.pin_id
    join public.mockups m on m.id = pin.mockup_id
    join visible v on v.id = m.project_id
    group by m.project_id
  )
  select v.id,
         coalesce(mk.n, 0),
         coalesce(cm.n, 0),
         coalesce(pn.resolved, 0)
  from visible v
  left join mk on mk.project_id = v.id
  left join cm on cm.project_id = v.id
  left join pn on pn.project_id = v.id;
$$;

grant execute on function public.project_stats_many(uuid[]) to authenticated;

-- public.project_stats(uuid) is left in place. Nothing calls it now, but it is
-- granted to authenticated and dropping a function a deployed client might
-- still reference is a needless way to break a running app.
