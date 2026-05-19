-- Whitelist e-mailů pro přihlášení (proxy.ts, AuthGate, requireSession).
-- Bez tabulky a SELECT RLS vrací chybu / prázdný výsledek → redirect "not_allowed".

create table if not exists public.povolene_emaily (
  email text primary key
);

comment on table public.povolene_emaily is
  'Přihlášení přes Google: proxy porovnává lower(trim(user.email)) s řádkem zde (uložte e-mail v malých písmenech).';

alter table public.povolene_emaily enable row level security;

drop policy if exists "povolene_emaily_select_own" on public.povolene_emaily;
create policy "povolene_emaily_select_own"
on public.povolene_emaily
for select
to authenticated
using (
  lower(btrim(email)) = lower(
    btrim(
      coalesce(
        (select u.email::text from auth.users u where u.id = auth.uid()),
        ''
      )
    )
  )
);

create or replace function public.add_whitelist_email(email_to_add text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(email_to_add));
begin
  if v_email is null or v_email = '' then
    raise exception 'Email is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Forbidden';
  end if;

  insert into public.povolene_emaily (email)
  values (v_email)
  on conflict (email) do nothing;
end;
$$;

create or replace function public.delete_whitelist_email(email_to_delete text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(email_to_delete));
begin
  if v_email is null or v_email = '' then
    raise exception 'Email is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Forbidden';
  end if;

  delete from public.povolene_emaily where email = v_email;
end;
$$;

create or replace function public.get_whitelist()
returns table (email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  select pe.email
  from public.povolene_emaily pe
  order by pe.email asc;
end;
$$;

grant select on public.povolene_emaily to authenticated;

grant execute on function public.add_whitelist_email(text) to authenticated;
grant execute on function public.delete_whitelist_email(text) to authenticated;
grant execute on function public.get_whitelist() to authenticated;
