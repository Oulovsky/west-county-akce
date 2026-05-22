-- Oprava přístupu: tabulka bez GRANT pro authenticated způsobovala "permission denied for table".

grant select, insert, update, delete on table public.dochazka_payout_overrides to authenticated;
grant all on table public.dochazka_payout_overrides to service_role;
