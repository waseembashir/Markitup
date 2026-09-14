-- Postgres indexes primary keys and unique constraints automatically. It does
-- not index foreign keys. Thirty-two foreign keys in this schema have no
-- supporting index, which is invisible at the size these tables are now — a
-- sequential scan over two hundred rows is faster than an index lookup — and
-- becomes the whole performance story at a hundred thousand.
--
-- These eight are the ones on paths that run constantly. The rest are left
-- alone deliberately: every index costs write throughput and storage, and most
-- of the remaining foreign keys are author/creator columns that matter only
-- when deleting a profile, which happens approximately never.

-- Every authenticated page load resolves the current workspace, and
-- ensure_workspace looks the membership up by user alone. The existing
-- unique (workspace_id, user_id) cannot serve that: a composite index is only
-- useful for a query that knows its leading column.
create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);

-- The dashboard, the projects list, the team screen and the reminder settings
-- all list projects for one workspace.
create index if not exists projects_workspace_id_idx
  on public.projects (workspace_id);

-- Listing the files in a project — the core screen of the product — and the
-- dashboard's activity feed, which fetches every mockup across every project.
create index if not exists mockups_project_id_idx
  on public.mockups (project_id);

-- Opening a mockup loads its comments through its pins. Without this, every
-- open scans the entire comments table, across every workspace, to find the
-- handful belonging to one file.
create index if not exists comments_pin_id_idx
  on public.comments (pin_id);

-- Threaded replies resolve children by parent.
create index if not exists comments_parent_comment_id_idx
  on public.comments (parent_comment_id)
  where parent_comment_id is not null;

-- Attachments are fetched per comment; most comments have none, so the partial
-- index stays small.
create index if not exists comment_attachments_comment_id_idx
  on public.comment_attachments (comment_id);

-- The folder tree for a workspace.
create index if not exists folders_workspace_id_idx
  on public.folders (workspace_id);

-- request_mockup_access asks "has this person already asked about this file in
-- the last 24 hours" on every attempt, and answers it by scanning every
-- notification ever created.
create index if not exists notifications_access_request_idx
  on public.notifications (mockup_id, actor_id, created_at desc)
  where type = 'access_request';
