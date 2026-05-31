-- Klientský portál: read-only přístup ke zakázkám vzniklým z poptávky klienta.

create or replace function public.client_can_access_zakazka(p_zakazka_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.zakazky z
    join public.poptavky p on p.poptavka_id = z.zdroj_poptavka_id
    where z.zakazka_id = p_zakazka_id
      and z.klient_id = public.current_client_klient_id()
      and p.klient_id = public.current_client_klient_id()
      and p.zakazka_id = z.zakazka_id
      and z.zdroj_poptavka_id is not null
  );
$$;

grant execute on function public.client_can_access_zakazka(uuid) to authenticated;

drop policy if exists "Klient ctou sve portalove zakazky" on public.zakazky;
create policy "Klient ctou sve portalove zakazky"
on public.zakazky
for select
to authenticated
using (
  public.is_client_portal_user()
  and public.client_can_access_zakazka(zakazka_id)
);
