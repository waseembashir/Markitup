-- The dashboard's feedback table: one row per project with the numbers that
-- answer "who has seen what, and who is keeping us waiting".
--
-- Everything here could be done from the app in half a dozen queries, but the
-- interesting parts (open threads, who viewed that isn't one of us, the last
-- reminder we sent) each need a join across mockups, so it is one round trip
-- instead of several that grow with the number of projects. Same shape as
-- project_stats_many: filter by can_see_project first, so a caller passing
-- project ids they cannot see gets no row rather than a zeroed one.

create or replace function public.project_feedback_rows(p uuid[])
returns table (
  project_id uuid,
  files int,
  threads int,
  open_threads int,
  comments int,
  shared_at timestamptz,
  client_viewers int,
  last_client_view timestamptz,
  last_client_comment timestamptz,
  recipient_email text,
  recipient_name text,
  reminders_sent int,
  last_reminder_at timestamptz,
  latest_mockup_id uuid
)
language sql security definer stable set search_path = public as $$
  with visible as (
    select id from unnest(p) as id where public.can_see_project(id)
  ),
  proj as (
    select v.id, pr.workspace_id
    from visible v
    join public.projects pr on pr.id = v.id
  ),
  mk as (
    select m.id, m.project_id, m.created_at
    from public.mockups m
    join visible v on v.id = m.project_id
    where m.archived_at is null
  ),
  -- the team, so a viewer who isn't one of them counts as a client
  team as (
    select distinct wm.workspace_id, wm.user_id
    from public.workspace_members wm
    join proj on proj.workspace_id = wm.workspace_id
  ),
  files as (
    select project_id, count(*)::int as n from mk group by project_id
  ),
  latest as (
    select distinct on (project_id) project_id, id
    from mk order by project_id, created_at desc
  ),
  pn as (
    select mk.project_id,
           count(*)::int as threads,
           count(*) filter (where pin.status <> 'resolved')::int as open_threads
    from public.pins pin
    join mk on mk.id = pin.mockup_id
    group by mk.project_id
  ),
  cm as (
    select mk.project_id,
           count(*)::int as n,
           max(c.created_at) filter (
             where not exists (
               select 1 from team t
               join proj on proj.id = mk.project_id and proj.workspace_id = t.workspace_id
               where t.user_id = c.author_id
             )
           ) as last_client_comment
    from public.comments c
    join public.pins pin on pin.id = c.pin_id
    join mk on mk.id = pin.mockup_id
    group by mk.project_id
  ),
  sh as (
    select mk.project_id, max(s.created_at) as shared_at
    from public.share_links s
    join mk on mk.id = s.mockup_id
    group by mk.project_id
  ),
  vw as (
    select mk.project_id,
           count(distinct v.user_id)::int as client_viewers,
           max(v.viewed_at) as last_client_view
    from public.mockup_views v
    join mk on mk.id = v.mockup_id
    join proj on proj.id = mk.project_id
    where not exists (
      select 1 from team t where t.workspace_id = proj.workspace_id and t.user_id = v.user_id
    )
    group by mk.project_id
  ),
  rem as (
    select distinct on (mk.project_id)
           mk.project_id, r.recipient_email, r.recipient_name, r.sent_count, r.last_sent_at
    from public.reminder_schedules r
    join mk on mk.id = r.mockup_id
    order by mk.project_id, r.created_at desc
  )
  select v.id,
         coalesce(files.n, 0),
         coalesce(pn.threads, 0),
         coalesce(pn.open_threads, 0),
         coalesce(cm.n, 0),
         sh.shared_at,
         coalesce(vw.client_viewers, 0),
         vw.last_client_view,
         cm.last_client_comment,
         rem.recipient_email,
         rem.recipient_name,
         coalesce(rem.sent_count, 0),
         rem.last_sent_at,
         latest.id
  from visible v
  left join files on files.project_id = v.id
  left join latest on latest.project_id = v.id
  left join pn on pn.project_id = v.id
  left join cm on cm.project_id = v.id
  left join sh on sh.project_id = v.id
  left join vw on vw.project_id = v.id
  left join rem on rem.project_id = v.id;
$$;

grant execute on function public.project_feedback_rows(uuid[]) to authenticated;
