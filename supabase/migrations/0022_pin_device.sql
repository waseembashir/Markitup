-- Desktop and mobile are separate review surfaces. A pin dropped on the 1440px
-- desktop layout is meaningless on a 375px phone layout, where the same element
-- has moved, reflowed, or isn't rendered at all — so showing desktop feedback in
-- mobile view put pins on unrelated parts of the page.
--
-- Tag every pin with the viewport it was left on. Existing pins become
-- 'desktop', which is where all of them were actually created.

alter table public.pins
  add column device text not null default 'desktop'
  check (device in ('desktop', 'mobile'));

-- Number pins per (mockup, device) so each surface counts from 1. Sharing one
-- sequence would leave mobile numbered 4, 7, 9 — gaps inherited from a list the
-- reviewer can't even see.
-- Drop whichever name the old constraint carries. 0004 declares it inline and
-- unnamed, so a database built from these files calls it
-- pins_mockup_id_number_key, while the long-running production database carries
-- an explicitly named pins_mockup_number_unique from before the files existed.
-- Naming only one of them meant this migration could never run on a fresh
-- install — which nobody could discover until someone built the schema from zero.
alter table public.pins drop constraint if exists pins_mockup_number_unique;
alter table public.pins drop constraint if exists pins_mockup_id_number_key;
alter table public.pins add constraint pins_mockup_device_number_unique
  unique (mockup_id, device, number);

-- Same advisory-lock serialization as before, now scoped per device so the two
-- sequences can't race each other either.
create or replace function public.assign_pin_number()
returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.mockup_id::text || ':' || new.device));
  select coalesce(max(number), 0) + 1 into new.number
  from public.pins
  where mockup_id = new.mockup_id and device = new.device;
  return new;
end;
$$;
