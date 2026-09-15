-- Two people reviewing the same file could not see each other's work. A client
-- left a comment, the designer was on the same page, and nothing happened until
-- one of them reloaded. For a tool whose whole purpose is a conversation on top
-- of a design, that reads as the tool having lost the comment.
--
-- Publish pins and comments so Postgres streams their changes. Realtime honours
-- row-level security: a subscriber is sent a row only if their own policies let
-- them select it, so a guest on one share link cannot learn anything about
-- another workspace by listening.
--
-- Nothing else is published. Every table added here is a stream of rows leaving
-- the database for as long as someone is connected, and these two are the only
-- ones a second person needs to see change while they watch.

do $$
begin
  -- The publication exists on every Supabase project, but creating it here keeps
  -- this migration runnable against a plain Postgres too.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pins'
  ) then
    alter publication supabase_realtime add table public.pins;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end;
$$;

-- A DELETE sends only the replica identity, which defaults to the primary key.
-- That is enough here: the client is told a row went away and asks the server
-- for the current state rather than trying to reconstruct it from the payload,
-- so there is no need to stream whole deleted rows to every listener.
