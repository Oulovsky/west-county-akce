-- FÁZE 2.1: interní read-only role hdt (profiles.role + update_user_role RPC).

comment on column public.profiles.role is
  'Interní role: admin, sef, skladnik, zamestnanec, hdt (read-only).';

create or replace function public.update_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(trim(new_role));
begin
  if target_user_id is null then
    raise exception 'Chybí ID uživatele.';
  end if;

  if v_role is null or v_role = '' then
    raise exception 'Role je povinná.';
  end if;

  if v_role not in ('admin', 'sef', 'skladnik', 'zamestnanec', 'hdt') then
    raise exception 'Neplatná role: %', v_role;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.aktivni, true) = true
  ) then
    raise exception 'Forbidden';
  end if;

  update public.profiles
  set role = v_role
  where user_id = target_user_id;

  if not found then
    raise exception 'Profil uživatele nebyl nalezen.';
  end if;
end;
$$;

grant execute on function public.update_user_role(uuid, text) to authenticated;
