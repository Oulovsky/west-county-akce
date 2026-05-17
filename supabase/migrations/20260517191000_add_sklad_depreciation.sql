create table if not exists public.sklad_odpisova_pasma (
  odpisove_pasmo_id uuid primary key default gen_random_uuid(),
  nazev text not null,
  pocet_mesicu integer not null check (pocet_mesicu > 0),
  aktivni boolean not null default true,
  poradi integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sklad_odpisova_pasma_nazev_key
  on public.sklad_odpisova_pasma (nazev);

create index if not exists sklad_odpisova_pasma_poradi_idx
  on public.sklad_odpisova_pasma (aktivni desc, poradi asc, nazev asc);

insert into public.sklad_odpisova_pasma (nazev, pocet_mesicu, aktivni, poradi)
values
  ('1 rok', 12, true, 10),
  ('2 roky', 24, true, 20),
  ('3 roky', 36, true, 30),
  ('5 let', 60, true, 50)
on conflict (nazev) do update
set
  pocet_mesicu = excluded.pocet_mesicu,
  aktivni = excluded.aktivni,
  poradi = excluded.poradi,
  updated_at = now();

alter table public.sklad_polozky_kusy
  add column if not exists porizovaci_hodnota numeric null check (porizovaci_hodnota is null or porizovaci_hodnota >= 0),
  add column if not exists datum_porizeni date null,
  add column if not exists odpisove_pasmo_id uuid null references public.sklad_odpisova_pasma(odpisove_pasmo_id) on delete set null;

create index if not exists sklad_polozky_kusy_odpisove_pasmo_id_idx
  on public.sklad_polozky_kusy (odpisove_pasmo_id);

alter table public.sklad_odpisova_pasma enable row level security;

drop policy if exists "Interni uzivatele ctou odpisova pasma" on public.sklad_odpisova_pasma;
drop policy if exists "Interni uzivatele spravuji odpisova pasma" on public.sklad_odpisova_pasma;

create policy "Interni uzivatele ctou odpisova pasma"
on public.sklad_odpisova_pasma
for select
to authenticated
using (true);

create policy "Interni uzivatele spravuji odpisova pasma"
on public.sklad_odpisova_pasma
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin', 'sef', 'skladnik')
      and coalesce(p.aktivni, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin', 'sef', 'skladnik')
      and coalesce(p.aktivni, true) = true
  )
);
