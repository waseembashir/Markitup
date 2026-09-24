-- Client comments never reached Slack.
--
-- The webhook was read straight from workspace_integrations using the
-- commenter's own session, and that table's select policy is
-- is_workspace_member(workspace_id). A client commenting through a share link
-- is not a member, so the read came back empty, the webhook looked absent, and
-- the whole Slack block -- including recording the burst -- was skipped. Only
-- teammates' own comments were ever announced, which is the half nobody needed.
--
-- Same shape of fix as 0029, and for the same reason: the caller is the client.
-- Authorisation is can_see_pin(mockup) -- exactly the predicate that let them
-- leave the comment -- and the row is ciphertext, which is what a workspace
-- member could already read and is useless without the server's key.
create or replace function public.slack_webhook_for_mockup(p_mockup uuid)
returns table (cipher text, iv text)
language sql security definer stable set search_path = public as $$
  select i.slack_webhook_cipher, i.slack_webhook_iv
  from public.mockups m
  join public.projects p on p.id = m.project_id
  join public.workspace_integrations i on i.workspace_id = p.workspace_id
  where m.id = p_mockup
    and public.can_see_pin(p_mockup)
    and i.slack_webhook_cipher is not null
    and i.slack_webhook_iv is not null;
$$;

grant execute on function public.slack_webhook_for_mockup(uuid) to authenticated;
