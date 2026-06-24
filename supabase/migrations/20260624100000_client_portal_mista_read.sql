-- Klientský portál: read-only přístup k vlastním místům konání a jejich technickému know-how.

create or replace function public.client_can_access_misto(p_misto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_misto_id is not null
    and public.current_client_klient_id() is not null
    and exists (
      select 1
      from public.mista_konani m
      where m.misto_id = p_misto_id
        and m.klient_id = public.current_client_klient_id()
        and m.aktivni = true
    );
$$;

grant execute on function public.client_can_access_misto(uuid) to authenticated;

drop policy if exists "Klient ctou sve mista konani" on public.mista_konani;
create policy "Klient ctou sve mista konani"
on public.mista_konani
for select
to authenticated
using (
  public.is_client_portal_user()
  and klient_id = public.current_client_klient_id()
  and aktivni = true
);

drop policy if exists "Klient ctou technicke poznamky sveho mista" on public.misto_technicke_poznamky;
create policy "Klient ctou technicke poznamky sveho mista"
on public.misto_technicke_poznamky
for select
to authenticated
using (
  public.is_client_portal_user()
  and public.client_can_access_misto(misto_id)
);

drop policy if exists "Klient ctou technicke fotky sveho mista" on public.misto_technicke_fotky;
create policy "Klient ctou technicke fotky sveho mista"
on public.misto_technicke_fotky
for select
to authenticated
using (
  public.is_client_portal_user()
  and public.client_can_access_misto(misto_id)
);

comment on function public.client_can_access_misto(uuid) is
  'True pouze pro aktivní místo konání patřící přihlášenému klientovi portálu.';
