-- Feedback often refers to a REGION ("this whole hero block"), not a point.
-- Give every pin an optional normalized size: x,y stay the anchor (the top-left
-- corner of the region), and w,h describe how far it extends.
--
-- w = h = 0 is a plain point pin, which is what every existing pin is and what
-- a simple click still produces — so nothing about current feedback changes.

alter table public.pins
  add column w double precision not null default 0 check (w >= 0 and w <= 1),
  add column h double precision not null default 0 check (h >= 0 and h <= 1);
