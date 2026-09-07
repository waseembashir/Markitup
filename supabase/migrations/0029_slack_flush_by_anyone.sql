-- slack_batches_due() only let a WORKSPACE MEMBER flush. Clients and guests are
-- the ones actually leaving comments, so in practice the common case never
-- triggered a roll-up: a client's burst would sit unannounced until a teammate
-- happened to comment, or the nightly cron ran.
--
-- The membership check bought nothing. The function only ever returns bursts
-- that have ALREADY gone quiet past the window, and it only ever posts a
-- workspace's own pending notifications to that workspace's own channel. There
-- is no message a caller can conjure and nothing they can make arrive early.
create or replace function public.slack_batches_due(p_workspace uuid, p_window_minutes int)
returns table (
  project_id uuid,
  author_id uuid,
  mockup_id uuid,
  project_name text,
  author_name text,
  pending int
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select b.workspace_id, b.project_id, b.author_id
    from public.slack_comment_batches b
    where (p_workspace is null or b.workspace_id = p_workspace)
      and b.pending > 0
      and b.last_comment_at <= now() - make_interval(mins => p_window_minutes)
    for update skip locked
  ),
  -- Read the counts from the pre-update snapshot; RETURNING on the UPDATE would
  -- hand back the zeroes it just wrote.
  claimed as (
    select b.project_id, b.author_id, b.mockup_id, b.project_name, b.author_name, b.pending
    from public.slack_comment_batches b
    join due d on d.workspace_id = b.workspace_id
              and d.project_id = b.project_id
              and d.author_id = b.author_id
  ),
  cleared as (
    update public.slack_comment_batches b
       set pending = 0, last_posted_at = now()
      from due d
     where b.workspace_id = d.workspace_id
       and b.project_id = d.project_id
       and b.author_id = d.author_id
    returning 1
  )
  select c.project_id, c.author_id, c.mockup_id, c.project_name, c.author_name, c.pending
  from claimed c
  where (select count(*) from cleared) >= 0;
end;
$$;
