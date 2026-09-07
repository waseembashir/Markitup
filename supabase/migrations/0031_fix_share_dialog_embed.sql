-- REGRESSION FIX. 0028 gave slack_comment_batches foreign keys to BOTH projects
-- and workspaces. PostgREST reads a table with FKs to two tables as a junction
-- between them, so `projects -> workspaces` suddenly had two relationships and
-- every query embedding one inside the other started failing with PGRST201:
--
--   mockups.select("project_id, projects(workspace_id, name, workspaces(name))")
--
-- That is the Share dialog's only query. It returned no row, the action reported
-- "File not found", and with it went the public toggle, the copy-link button and
-- teammate invites. The viewer page survived because it stops one level short.
--
-- The workspace FK is redundant anyway: deleting a workspace already cascades to
-- its projects, and project_id cascades from there. Dropping the constraint
-- removes the phantom relationship while keeping the column the primary key and
-- the nightly cron rely on, and keeps the cascade intact through projects.
alter table public.slack_comment_batches
  drop constraint slack_comment_batches_workspace_id_fkey;
