-- SECURITY: odstranit falešné interní profily (orphan), které vznikly starým auth triggerem
-- u uživatelů s aktivním klientským účtem. Klientský auth user nesmí mít interní profiles,
-- pokud není skutečně interně založený (admin nebo interní role se jménem = provisioned).
--
-- Kritéria orphan profilu (shodné s isClientOnlyOrphanProfile v aplikaci):
--   - má aktivní client_accounts (stav='active', klient_id not null),
--   - interní role, ale NE admin,
--   - není provisioned = nemá vyplněné jméno ani příjmení.
-- Admin a interní role se jménem se NIKDY nemažou.

delete from public.profiles p
where coalesce(btrim(p.jmeno), '') = ''
  and coalesce(btrim(p.prijmeni), '') = ''
  and lower(btrim(coalesce(p.role, ''))) in ('sef', 'skladnik', 'zamestnanec', 'hdt')
  and exists (
    select 1
    from public.client_accounts ca
    where ca.user_id = p.user_id
      and ca.stav = 'active'
      and ca.klient_id is not null
  );

-- Pojistka: trigger automatického zakládání profiles nesmí existovat (viz 20260629190000).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
