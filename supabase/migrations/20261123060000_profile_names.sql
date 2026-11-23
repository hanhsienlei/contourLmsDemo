-- The student's name belongs to the account. Each consultation still keeps the
-- name typed on its booking form (the brief puts it there); the profile name
-- only pre-fills that form.
--
-- Nullable: staff and admin-created accounts (seed, dashboard) may have none.
alter table public.profiles
  add column first_name text check (first_name is null or length(btrim(first_name)) between 1 and 100),
  add column last_name  text check (last_name  is null or length(btrim(last_name))  between 1 and 100);

-- Names come from the sign-up metadata (options.data on supabase.auth.signUp).
-- That metadata is user-supplied, so it is trimmed, blanks become null and
-- anything over 100 characters is cut: a bad value never blocks sign-up.
-- Only the name is read from it; the role still always defaults to 'student'.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    nullif(btrim(left(btrim(new.raw_user_meta_data ->> 'first_name'), 100)), ''),
    nullif(btrim(left(btrim(new.raw_user_meta_data ->> 'last_name'), 100)), '')
  );
  insert into public.user_roles (user_id) values (new.id);   -- default 'student'
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Existing accounts: take the name from their most recently created booking.
update public.profiles p
set first_name = c.first_name, last_name = c.last_name
from (
  select distinct on (user_id) user_id, btrim(first_name) as first_name, btrim(last_name) as last_name
  from public.consultations
  order by user_id, created_at desc
) c
where c.user_id = p.user_id and p.first_name is null and p.last_name is null;
