alter table public.zakazka_lide
add column if not exists confirmation_status text not null default 'pending',
add column if not exists declined_reason text,
add column if not exists responded_at timestamp with time zone,
add column if not exists notified_at timestamp with time zone,
add column if not exists assigned_at timestamp with time zone not null default now();

alter table public.zakazka_lide
drop constraint if exists zakazka_lide_confirmation_status_check;

alter table public.zakazka_lide
add constraint zakazka_lide_confirmation_status_check
check (confirmation_status in ('pending', 'accepted', 'declined'));

update public.zakazka_lide
set confirmation_status = 'pending'
where confirmation_status is null;
