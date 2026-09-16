-- Comments could be written and deleted but never corrected. The only way to
-- fix a typo, or a sentence that read as sharper than it was meant, was to
-- delete the comment and post it again — which loses its place in the thread
-- and any replies hanging off it.
--
-- There is no UPDATE policy on public.comments today, so the table simply
-- refuses every update. Add one, for the author and nobody else: a teammate who
-- can delete an off-topic comment still must not be able to change what someone
-- said and leave it under their name.

create policy "authors edit their own comments" on public.comments
  for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Record that a comment changed after it was posted. In a feedback tool people
-- act on what a comment said; one that can be rewritten silently, after a
-- designer has already read it and started work, is worse than one that cannot
-- be edited at all. Null means never edited.
alter table public.comments add column if not exists edited_at timestamptz;

-- Stamp it in the database rather than trusting the caller to, and refuse the
-- two things the UPDATE policy alone would still allow: moving a comment to
-- another pin or thread, and reassigning its author.
create or replace function public.mark_comment_edited()
returns trigger language plpgsql as $$
begin
  new.edited_at := now();
  new.author_id := old.author_id;
  new.pin_id := old.pin_id;
  new.parent_comment_id := old.parent_comment_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists comments_mark_edited on public.comments;
create trigger comments_mark_edited
  before update on public.comments
  for each row execute function public.mark_comment_edited();
