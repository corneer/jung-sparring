-- Finance evaluations: output from Tilde (CFO) and Otto (Account Director)
create table finance_evaluations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  tilde_output text not null default '',
  otto_output text not null default '',
  created_at timestamptz not null default now()
);

create index finance_evaluations_run_id_idx on finance_evaluations(run_id);

-- PR evaluations: output from Ebbe, Lova and Felix
create table pr_evaluations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  ebbe_output text not null default '',
  lova_output text not null default '',
  felix_output text not null default '',
  created_at timestamptz not null default now()
);

create index pr_evaluations_run_id_idx on pr_evaluations(run_id);

-- Briefs: Alba's final Figma-ready brief
create table briefs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now()
);

create index briefs_run_id_idx on briefs(run_id);

-- Add new statuses to run_status enum
alter type run_status add value if not exists 'financing';
alter type run_status add value if not exists 'pr-ing';
alter type run_status add value if not exists 'packaging';
