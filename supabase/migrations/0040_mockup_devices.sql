-- Every file offered both a desktop and a mobile view, whether or not it had
-- been designed for both. A desktop-only mockup opened in mobile view is the
-- desktop design squeezed into a phone frame, and a client who finds that
-- toggle reasonably assumes they are looking at the mobile design and leaves
-- feedback on it.
--
-- Record which views a file is meant to be reviewed in. The agency chooses at
-- upload; clients are offered only those. The team still sees every view, so a
-- mobile layout can be checked internally before it is released to the client.
--
-- This is a presentation setting, not an access boundary: the file is the same
-- file in either view, so a client forcing the other view reveals nothing they
-- could not already see. It is enforced in the viewer, not by RLS.

alter table public.mockups
  add column if not exists devices text[] not null default array['desktop', 'mobile'];

alter table public.mockups
  drop constraint if exists mockups_devices_valid;
alter table public.mockups
  add constraint mockups_devices_valid check (
    devices <@ array['desktop', 'mobile']
    and cardinality(devices) >= 1
  );
