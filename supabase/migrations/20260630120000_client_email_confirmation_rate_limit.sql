-- Rate limit pro opětovné odeslání potvrzovacího e-mailu (logika v aplikaci).
alter table public.client_accounts
  add column if not exists email_confirmation_last_sent_at timestamptz null;

comment on column public.client_accounts.email_confirmation_last_sent_at is
  'Čas posledního odeslání potvrzovacího e-mailu (Supabase Auth confirmation).';
