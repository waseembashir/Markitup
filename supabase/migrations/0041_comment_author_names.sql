-- A client reading feedback saw "Unknown" on every comment written by the
-- agency.
--
-- profiles is readable for your own row, for people who share a workspace with
-- you, and for members of a project you can see. A client is not in the
-- agency's workspace, and the agency team belong to the WORKSPACE rather than to
-- each project's member list — so none of the three matched. The client could
-- read other clients' names and not the name of the designer they were talking
-- to. It went unnoticed because the agency only ever tests as the agency.
--
-- The obvious fix is wrong. Widening the profiles SELECT policy would hand the
-- team's email addresses to anyone holding a public share link: row-level
-- security is row-level, and a readable row is every column in it.
--
-- So resolve names through a narrow door instead. The rule is the natural one —
-- if you can see a comment, you can see who wrote it — and the answer is a
-- display name and nothing else. No email crosses it.

create or replace function public.comment_author_names(p_pins uuid[])
returns table (id uuid, name text)
language sql security definer stable set search_path = public as $$
  select distinct pr.id,
         -- A name if they have set one; otherwise the part of their address
         -- before the @, which is what the team already sees in its place. The
         -- domain is never returned.
         coalesce(nullif(pr.name, ''), split_part(pr.email, '@', 1)) as name
  from public.comments c
  join public.pins pn    on pn.id = c.pin_id
  join public.profiles pr on pr.id = c.author_id
  where c.pin_id = any(p_pins)
    -- Checked per pin: a caller naming pins from a file they cannot see gets
    -- nothing back for them.
    and public.can_see_pin(pn.mockup_id);
$$;

revoke all on function public.comment_author_names(uuid[]) from public;
grant execute on function public.comment_author_names(uuid[]) to authenticated;
