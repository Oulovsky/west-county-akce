create table if not exists public.ucetni_konfigurace (
  id uuid primary key default gen_random_uuid(),
  jmeno text null,
  nazev_firmy text null,
  adresa text null,
  telefon text null,
  email text null,
  poznamka text null,
  aktivni boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ucetni_konfigurace_single_active_idx
  on public.ucetni_konfigurace (aktivni)
  where aktivni = true;

alter table public.ucetni_konfigurace enable row level security;

drop policy if exists "Admin cte ucetni konfiguraci" on public.ucetni_konfigurace;
create policy "Admin cte ucetni konfiguraci"
on public.ucetni_konfigurace
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.aktivni, true) = true
  )
);

drop policy if exists "Admin spravuje ucetni konfiguraci" on public.ucetni_konfigurace;
create policy "Admin spravuje ucetni konfiguraci"
on public.ucetni_konfigurace
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.aktivni, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.aktivni, true) = true
  )
);
