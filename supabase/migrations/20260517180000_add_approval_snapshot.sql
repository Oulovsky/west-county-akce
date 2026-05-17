alter table public.zakazka_approval_links
  add column if not exists approval_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists approval_snapshot_created_at timestamptz null;

comment on column public.zakazka_approval_links.approval_snapshot is
  'Snapshot finální objednávky odeslané klientovi ke schválení. Veřejné schválení má číst tento snapshot, ne živá data zakázky.';
