-- Google returns the person's name under `full_name` (and `name`), never under
-- the `name` key our own signup form sets first. The trigger only looked at
-- `name`, so a Google signup could land with an empty profile name and show up
-- as a bare email beside their comments.
--
-- The fallback has to stay away from guest placeholders: an anonymous visitor's
-- address is guest-<uuid>@guest.invalid, and naming them after the local part
-- would put "guest-266c8174-5154..." next to their comments. GuestGate always
-- sends a typed name, so this only matters if one ever arrives without.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_guest boolean := new.email is null;
  v_email text := coalesce(new.email, 'guest-' || new.id || '@guest.invalid');
  v_name  text := nullif(trim(coalesce(
                    new.raw_user_meta_data->>'name',
                    new.raw_user_meta_data->>'full_name',
                    ''
                  )), '');
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    v_email,
    coalesce(v_name, case when v_guest then 'Guest' else split_part(v_email, '@', 1) end)
  );
  return new;
end;
$$;
