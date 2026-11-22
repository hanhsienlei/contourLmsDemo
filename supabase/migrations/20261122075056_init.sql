create type public.app_role as enum ('student', 'admin');
create type public.consultation_status as enum ('scheduled', 'completed', 'cancelled');

-- mirror of the auth user's email, so the admin list can show who booked
create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       public.app_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.consultations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(user_id) on delete cascade,
  first_name   text not null check (length(btrim(first_name)) between 1 and 100),
  last_name    text not null check (length(btrim(last_name))  between 1 and 100),
  reason       text not null check (length(btrim(reason))     between 1 and 1000),
  scheduled_at timestamptz not null
               -- exact 15-minute alignment: no cast, so fractional seconds can't round into a pass;
               -- epoch is timezone-independent
               check (extract(epoch from scheduled_at) % 900 = 0),
  status       public.consultation_status not null default 'scheduled',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- one active booking per student per slot (completed still occupies the slot)
create unique index consultations_user_slot_active
  on public.consultations (user_id, scheduled_at)
  where status <> 'cancelled';

create index consultations_user_scheduled on public.consultations (user_id, scheduled_at);
create index consultations_scheduled_id   on public.consultations (scheduled_at, id);  -- admin keyset

alter table public.profiles      enable row level security;  -- no policies: deny all
alter table public.user_roles    enable row level security;
alter table public.consultations enable row level security;
revoke all on public.profiles, public.user_roles, public.consultations from anon, authenticated;

-- locked by default: objects created later in public (by migration, Studio or psql)
-- get no grants for anon/authenticated unless a migration grants them on purpose
alter default privileges for role postgres in schema public
  revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, public;

-- not exposed through the Supabase API
create schema if not exists private;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create trigger consultations_touch_updated_at before update on public.consultations
  for each row execute function private.touch_updated_at();

create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email);
  insert into public.user_roles (user_id) values (new.id);   -- default 'student'
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
