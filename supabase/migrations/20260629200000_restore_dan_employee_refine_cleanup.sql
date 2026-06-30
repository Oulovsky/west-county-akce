-- Obnovení zaměstnance smazaného / skrytého chybným cleanupem.
-- Cílené odstranění falešného orphan profilu u klientského účtu (ne broad delete interních rolí).

-- 1) Obnovit Dana Matouška (zamestnanec, 0 Kč/h, aktivní)
insert into public.profiles (user_id, email, role, aktivni, hodinovy_naklad_akce, jmeno, prijmeni)
select
  u.id,
  lower(btrim(u.email::text)),
  'zamestnanec',
  true,
  0,
  null,
  null
from auth.users u
where lower(btrim(u.email::text)) = 'danmatouseek@gmail.com'
on conflict (user_id) do update
set
  email = excluded.email,
  role = 'zamestnanec',
  aktivni = true,
  hodinovy_naklad_akce = 0,
  updated_at = now();

-- 2) Odstranit falešný orphan profil u klientského účtu šéfa (ne interní gmail účet)
delete from public.profiles p
where lower(btrim(coalesce(p.email, ''))) = 'prchal.jarda@email.com'
  and exists (
    select 1
    from public.client_accounts ca
    where ca.user_id = p.user_id
      and ca.stav = 'active'
      and ca.klient_id is not null
  )
  and coalesce(btrim(p.jmeno), '') = ''
  and coalesce(btrim(p.prijmeni), '') = '';
