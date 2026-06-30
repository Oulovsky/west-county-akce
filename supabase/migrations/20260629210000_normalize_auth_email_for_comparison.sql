-- Gmail-aware normalizace pro interní allowlist/login porovnání (ne pro zobrazení).

create or replace function public.normalize_auth_email_for_comparison(p_email text)
returns text
language plpgsql
immutable
as $$
declare
  v_email text := lower(btrim(p_email));
  v_local text;
  v_domain text;
  v_plus int;
begin
  if v_email is null or v_email = '' then
    return null;
  end if;

  if v_email !~ '@' then
    return v_email;
  end if;

  v_local := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);

  if v_domain = 'googlemail.com' then
    v_domain := 'gmail.com';
  end if;

  if v_domain = 'gmail.com' then
    v_plus := strpos(v_local, '+');
    if v_plus > 0 then
      v_local := substring(v_local from 1 for v_plus - 1);
    end if;
    v_local := replace(v_local, '.', '');
  end if;

  return v_local || '@' || v_domain;
end;
$$;

comment on function public.normalize_auth_email_for_comparison(text) is
  'Porovnávací klíč pro interní allowlist/login. Gmail: lowercase, bez teček a +tag v local-part.';

drop policy if exists "povolene_emaily_select_own" on public.povolene_emaily;
create policy "povolene_emaily_select_own"
on public.povolene_emaily
for select
to authenticated
using (
  public.normalize_auth_email_for_comparison(email) = public.normalize_auth_email_for_comparison(
    coalesce(
      (select u.email::text from auth.users u where u.id = auth.uid()),
      ''
    )
  )
);

drop policy if exists "system_admin_emails_select_own" on public.system_admin_emails;
create policy "system_admin_emails_select_own"
on public.system_admin_emails
for select
to authenticated
using (
  public.normalize_auth_email_for_comparison(email) = public.normalize_auth_email_for_comparison(
    coalesce(
      (select u.email::text from auth.users u where u.id = auth.uid()),
      ''
    )
  )
);

comment on table public.povolene_emaily is
  'Interní beta allowlist. Porovnání přes normalize_auth_email_for_comparison (Gmail tečky/+tag).';
