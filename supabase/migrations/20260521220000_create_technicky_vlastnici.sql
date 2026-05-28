create extension if not exists pgcrypto;

create table if not exists public.technicky_vlastnici (
  id uuid primary key default gen_random_uuid(),
  nazev text not null,
  kod text not null,
  poznamka text null,
  poradi integer not null default 0,
  aktivni boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technicky_vlastnici_kod_check check (char_length(trim(kod)) > 0),
  constraint technicky_vlastnici_nazev_check check (char_length(trim(nazev)) > 0)
);

create unique index if not exists technicky_vlastnici_kod_key
  on public.technicky_vlastnici (lower(trim(kod)));

create index if not exists technicky_vlastnici_poradi_idx
  on public.technicky_vlastnici (aktivni desc, poradi asc, nazev asc);

insert into public.technicky_vlastnici (nazev, kod, poradi, aktivni)
select 'WEST COUNTY', 'WEST_COUNTY', 10, true
where not exists (
  select 1 from public.technicky_vlastnici where lower(trim(kod)) = 'west_county'
);

insert into public.technicky_vlastnici (nazev, kod, poradi, aktivni)
select 'HDT', 'HDT', 20, true
where not exists (
  select 1 from public.technicky_vlastnici where lower(trim(kod)) = 'hdt'
);

create or replace function public.default_technicky_vlastnik_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select id
  from public.technicky_vlastnici
  where lower(trim(kod)) = 'west_county'
    and aktivni = true
  order by poradi asc, nazev asc
  limit 1;
$$;

alter table public.skladove_polozky
  add column if not exists technicky_vlastnik_id uuid null
    references public.technicky_vlastnici (id) on delete restrict;

update public.skladove_polozky
set technicky_vlastnik_id = public.default_technicky_vlastnik_id()
where technicky_vlastnik_id is null;

alter table public.skladove_polozky
  alter column technicky_vlastnik_id set default public.default_technicky_vlastnik_id();

alter table public.skladove_polozky
  alter column technicky_vlastnik_id set not null;

create index if not exists skladove_polozky_technicky_vlastnik_id_idx
  on public.skladove_polozky (technicky_vlastnik_id);

alter table public.technicky_vlastnici enable row level security;

drop policy if exists "Interni uzivatele ctou technicke vlastniky" on public.technicky_vlastnici;
drop policy if exists "Interni uzivatele spravuji technicke vlastniky" on public.technicky_vlastnici;

create policy "Interni uzivatele ctou technicke vlastniky"
on public.technicky_vlastnici
for select
to authenticated
using (true);

create policy "Interni uzivatele spravuji technicke vlastniky"
on public.technicky_vlastnici
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

grant select on public.technicky_vlastnici to authenticated;
grant insert, update, delete on public.technicky_vlastnici to authenticated;

create or replace function public.update_skladova_polozka_vlastnik(
  p_skladova_polozka_id uuid,
  p_technicky_vlastnik_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_skladova_polozka_id is null then
    raise exception 'MISSING_SKLADOVA_POLOZKA_ID';
  end if;

  if p_technicky_vlastnik_id is null then
    raise exception 'MISSING_TECHNICKY_VLASTNIK_ID';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin', 'sef', 'skladnik')
      and coalesce(p.aktivni, true) = true
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.technicky_vlastnici tv
    where tv.id = p_technicky_vlastnik_id
      and tv.aktivni = true
  ) then
    raise exception 'INVALID_OR_INACTIVE_TECHNICKY_VLASTNIK';
  end if;

  update public.skladove_polozky
  set technicky_vlastnik_id = p_technicky_vlastnik_id
  where skladova_polozka_id = p_skladova_polozka_id;

  if not found then
    raise exception 'SKLADOVA_POLOZKA_NOT_FOUND';
  end if;
end;
$$;

grant execute on function public.update_skladova_polozka_vlastnik(uuid, uuid) to authenticated;
