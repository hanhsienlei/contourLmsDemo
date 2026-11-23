-- Backstop for the status rules in lib/consultations/service.ts. The service
-- holds a key that bypasses RLS, so a future bug or a one-off script could
-- otherwise revive a cancelled booking. The service stays the place the rules
-- are checked (and turned into 409s); this trigger only refuses rows the
-- service would never write, so hitting it means a bug and surfaces as a 500.
--
--   scheduled -> completed, completed -> scheduled, scheduled -> cancelled
--   cancelled is final: no column can change
--   scheduled_at changes only while the booking stays scheduled (reschedule)
create function private.guard_consultation_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status = 'cancelled' then
    raise exception 'cancelled consultations cannot be changed'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status
     and not (old.status, new.status) in (
       ('scheduled'::public.consultation_status, 'completed'::public.consultation_status),
       ('completed', 'scheduled'),
       ('scheduled', 'cancelled')
     ) then
    raise exception 'status cannot change from % to %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.scheduled_at is distinct from old.scheduled_at
     and not (old.status = 'scheduled' and new.status = 'scheduled') then
    raise exception 'only scheduled consultations can be rescheduled'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;
revoke all on function private.guard_consultation_update() from public, anon, authenticated;

create trigger consultations_guard_update before update on public.consultations
  for each row execute function private.guard_consultation_update();
