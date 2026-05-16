alter table public.dotaznik_fotky enable row level security;

drop policy if exists "Interni uzivatele ctou fotky dotazniku" on public.dotaznik_fotky;
drop policy if exists "Anonymni uzivatele nevkladaji fotky dotazniku" on public.dotaznik_fotky;

create policy "Interni uzivatele ctou fotky dotazniku"
on public.dotaznik_fotky
for select
to authenticated
using (
  exists (
    select 1
    from public.zakazky z
    where z.zakazka_id = dotaznik_fotky.zakazka_id
  )
);
