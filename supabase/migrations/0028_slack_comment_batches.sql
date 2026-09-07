-- Slack got one message per comment. A client working through a page produced a
-- dozen notifications in as many minutes, which is enough noise that people stop
-- reading the channel.
--
-- Comments are now batched per (project, author). The first comment of a burst
-- posts immediately -- you still learn straight away that a client is reviewing --
-- and everything for the next N minutes is counted rather than posted. Once the
-- burst goes quiet, one roll-up says how many followed.

create table public.slack_comment_batches (
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  -- Where the roll-up should link. The newest commented file wins.
  mockup_id       uuid references public.mockups(id) on delete set null,
  -- Denormalized so the cron can flush without joining through RLS.
  project_name    text not null,
  author_name     text not null,
  pending         int not null default 0,
  last_comment_at timestamptz not null default now(),
  last_posted_at  timestamptz,
  primary key (workspace_id, project_id, author_id)
);
create index slack_batches_due_idx on public.slack_comment_batches (last_comment_at) where pending > 0;

-- Internal bookkeeping: no direct access from the client. RLS on with no policies
-- denies everything; the security-definer functions below are the only way in.
alter table public.slack_comment_batches enable row level security;

-- Record a comment against its burst. Returns true when this comment OPENS a
-- burst and should therefore be posted to Slack immediately.
create function public.slack_batch_record(
  p_workspace uuid,
  p_project uuid,
  p_author uuid,
  p_mockup uuid,
  p_project_name text,
  p_author_name text,
  p_window_minutes int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window interval := make_interval(mins => p_window_minutes);
  v_last_posted timestamptz;
  v_fresh boolean;
begin
  -- Serialize concurrent comments on the same burst, so two arriving together
  -- can't both decide they are the first. Same approach as assign_pin_number.
  perform pg_advisory_xact_lock(hashtext(p_workspace::text || ':' || p_project::text || ':' || p_author::text));

  select last_posted_at into v_last_posted
  from public.slack_comment_batches
  where workspace_id = p_workspace and project_id = p_project and author_id = p_author;

  v_fresh := v_last_posted is null or v_last_posted <= now() - v_window;

  insert into public.slack_comment_batches as b
    (workspace_id, project_id, author_id, mockup_id, project_name, author_name,
     pending, last_comment_at, last_posted_at)
  values (p_workspace, p_project, p_author, p_mockup, p_project_name, p_author_name,
          0, now(), now())
  on conflict (workspace_id, project_id, author_id) do update
    set mockup_id       = excluded.mockup_id,
        project_name    = excluded.project_name,
        author_name     = excluded.author_name,
        last_comment_at = now(),
        -- A fresh burst resets the count and restarts the window; otherwise this
        -- comment is folded into the running total and stays unposted.
        pending        = case when v_fresh then 0 else b.pending + 1 end,
        last_posted_at = case when v_fresh then now() else b.last_posted_at end;

  return v_fresh;
end;
$$;
grant execute on function public.slack_batch_record(uuid,uuid,uuid,uuid,text,text,int) to authenticated;

-- Claim every burst that has gone quiet and still has comments to announce.
-- Zeroing the counter in the same statement that returns it means two flushes
-- racing each other cannot post the same roll-up twice.
--
-- p_workspace null flushes every workspace, which is what the nightly cron does;
-- a signed-in caller may only flush a workspace they belong to.
create function public.slack_batches_due(p_workspace uuid, p_window_minutes int)
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
  if auth.uid() is not null and p_workspace is not null
     and not public.is_workspace_member(p_workspace) then
    return;
  end if;

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
grant execute on function public.slack_batches_due(uuid,int) to authenticated;
