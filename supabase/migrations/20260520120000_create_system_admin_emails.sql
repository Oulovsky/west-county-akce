-- Systémoví admini podle e-mailu (nezávislé na profiles.role — mzdy dál z role zaměstnance).

create table if not exists public.system_admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

comment on table public.system_admin_emails is
  'Plná admin oprávnění: přihlášený auth e-mail v tabulce má přístup jako admin i při profiles.role = zamestnanec.';

insert into public.system_admin_emails (email)
values ('oulovskyo@gmail.com')
on conflict (email) do nothing;

alter table public.system_admin_emails enable row level security;

drop policy if exists "system_admin_emails_select_own" on public.system_admin_emails;
create policy "system_admin_emails_select_own"
on public.system_admin_emails
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
