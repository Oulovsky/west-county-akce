alter table public.zakazky
  add column if not exists workflow_change_pending boolean not null default false,
  add column if not exists workflow_change_pending_at timestamptz null,
  add column if not exists workflow_change_pending_by uuid null,
  add column if not exists workflow_change_summary text null;

create index if not exists zakazky_workflow_change_pending_idx
  on public.zakazky (workflow_change_pending, workflow_change_pending_at desc);
