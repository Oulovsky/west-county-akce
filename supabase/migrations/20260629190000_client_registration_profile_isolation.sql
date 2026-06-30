-- SECURITY: klientská registrace nesmí zanechat interní profil (profiles) u auth uživatele.
-- Interní zaměstnanec se zakládá výhradně přes admin createEmployee.

-- 1) Zastavit automatické zakládání profiles při každém auth signup (pokud trigger v projektu existuje)
drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user() cascade;

-- 2) Cílený cleanup falešného orphan profilu u klientského účtu (viz také 20260629200000).
-- Nesmí mazat reálné zaměstnance bez jména, kteří nemají aktivní client_accounts.
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

-- 3) Interní beta allowlist — správný e-mail šéfa (gmail, ne klientský email.com)
insert into public.povolene_emaily (email)
values ('prchal.jarda@gmail.com')
on conflict (email) do nothing;

delete from public.povolene_emaily
where lower(btrim(email)) = 'prchal.jarda@email.com';

comment on table public.profiles is
  'Interní zaměstnanci WEST COUNTY. Řádek vzniká jen ručně v adminu (createEmployee), ne při klientské registraci.';
