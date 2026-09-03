-- 0025 stopped a client or guest from deleting and renaming FILE ROWS, but left
-- three ways to change the files themselves, all still gated on
-- can_see_project() and so satisfied by any reviewer:
--
--   * inserting a mockup row  -> uploading a new file or version
--   * writing to the mockups bucket
--   * DELETING from the mockups bucket -- the row was protected while the actual
--     image behind it could still be removed
--
-- Uploading and destroying work belongs to the owning team. A reviewer, invited
-- or anonymous, reads the design and writes feedback about it. Nothing else.

drop policy if exists "members add mockups" on public.mockups;
create policy "members add mockups" on public.mockups
  for insert with check (public.can_manage_project(project_id));

-- Folders organize the team's own work; a reviewer has no business restructuring
-- it. (This was FOR ALL, so it covered insert, update and delete at once.)
drop policy if exists "manage mockup folders" on public.mockup_folders;
create policy "manage mockup folders" on public.mockup_folders
  for all using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

drop policy if exists "write mockup objects" on storage.objects;
create policy "write mockup objects" on storage.objects
  for insert with check (
    bucket_id = 'mockups'
    and public.can_manage_project(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "delete mockup objects" on storage.objects;
create policy "delete mockup objects" on storage.objects
  for delete using (
    bucket_id = 'mockups'
    and public.can_manage_project(((storage.foldername(name))[1])::uuid)
  );

-- comment-files stays open to reviewers on purpose: attaching a screenshot to a
-- comment IS the feedback, and it lands under the comment that carries it.
