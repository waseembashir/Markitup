-- The dashboard table, one level deeper: a project opens to show its files.
--
-- Purely additive. 0042 already returns one row per project; this returns the
-- same shape per FILE, plus the handful of people outside the team who opened
-- it, so "Seen by" can carry faces instead of a bare count. The project row
-- merges the faces of its files rather than asking the database twice.
create or replace function public.mockup_feedback_rows(p uuid[])
returns table (
  mockup_id uuid,
  project_id uuid,
  name text,
  created_at timestamptz,
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
  viewers jsonb
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
    select m.id, m.project_id, m.name, m.created_at
    from public.mockups m
    join visible v on v.id = m.project_id
    where m.archived_at is null
  ),
  team as (
    select distinct wm.workspace_id, wm.user_id
    from public.workspace_members wm
    join proj on proj.workspace_id = wm.workspace_id
  ),
  pn as (
    select pin.mockup_id,
           count(*)::int as threads,
           count(*) filter (where pin.status <> 'resolved')::int as open_threads
    from public.pins pin
    join mk on mk.id = pin.mockup_id
    group by pin.mockup_id
  ),
  -- comments on this file, and when someone outside the team last said one
  cm as (
    select pin.mockup_id,
           count(*)::int as n,
           max(c.created_at) filter (
             where not exists (
               select 1
               from team t
               join mk m2 on m2.id = pin.mockup_id
               join proj on proj.id = m2.project_id and proj.workspace_id = t.workspace_id
               where t.user_id = c.author_id
             )
           ) as last_client_comment
    from public.comments c
    join public.pins pin on pin.id = c.pin_id
    join mk on mk.id = pin.mockup_id
    group by pin.mockup_id
  ),
  -- a file can carry more than one link; the newest is the one that was shared
  sh as (
    select s.mockup_id, max(s.created_at) as shared_at
    from public.share_links s
    join mk on mk.id = s.mockup_id
    group by s.mockup_id
  ),
  -- one row per client who opened it, keeping their latest visit
  client_views as (
    select v.mockup_id, v.user_id, max(v.viewed_at) as viewed_at
    from public.mockup_views v
    join mk on mk.id = v.mockup_id
    join proj on proj.id = mk.project_id
    where not exists (
      select 1 from team t where t.workspace_id = proj.workspace_id and t.user_id = v.user_id
    )
    group by v.mockup_id, v.user_id
  ),
  vw as (
    select cv.mockup_id,
           count(*)::int as client_viewers,
           max(cv.viewed_at) as last_client_view,
           (
             select jsonb_agg(face)
             from (
               select jsonb_build_object('name', pf.name, 'email', pf.email) as face
               from client_views c2
               join public.profiles pf on pf.id = c2.user_id
               where c2.mockup_id = cv.mockup_id
               order by c2.viewed_at desc
               limit 5
             ) as faces
           ) as viewers
    from client_views cv
    group by cv.mockup_id
  ),
  rem as (
    select distinct on (r.mockup_id)
           r.mockup_id, r.recipient_email, r.recipient_name, r.sent_count, r.last_sent_at
    from public.reminder_schedules r
    join mk on mk.id = r.mockup_id
    order by r.mockup_id, r.created_at desc
  )
  select mk.id,
         mk.project_id,
         mk.name,
         mk.created_at,
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
         vw.viewers
  from mk
  left join sh on sh.mockup_id = mk.id
  left join pn on pn.mockup_id = mk.id
  left join cm on cm.mockup_id = mk.id
  left join vw on vw.mockup_id = mk.id
  left join rem on rem.mockup_id = mk.id
  order by mk.created_at desc;
$$;

grant execute on function public.mockup_feedback_rows(uuid[]) to authenticated;
