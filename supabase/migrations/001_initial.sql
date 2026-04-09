-- Jung Sparring – initial schema

create extension if not exists "uuid-ossp";

-- Clients
create table clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  industry text not null,
  competitors text[] not null default '{}',
  core_questions text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Pipeline runs
create type run_status as enum (
  'pending', 'researching', 'planning', 'creating', 'evaluating', 'done', 'error'
);

create table runs (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  topic text not null,
  status run_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Researcher output
create table signals (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references runs(id) on delete cascade,
  content text not null,
  sources text[] not null default '{}',
  approved boolean,  -- null = pending, true = approved, false = rejected
  created_at timestamptz not null default now()
);

-- Planner output
create table insights (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references runs(id) on delete cascade,
  content text not null,
  reasoning text not null default '',
  approved boolean,
  created_at timestamptz not null default now()
);

-- Creative output
create table ideas (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references runs(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Filter + Opponent evaluation
create table evaluations (
  id uuid primary key default uuid_generate_v4(),
  idea_id uuid not null references ideas(id) on delete cascade,
  filter_score integer not null default 5 check (filter_score between 1 and 10),
  filter_reasoning text not null default '',
  opponent_challenge text not null default '',
  survived boolean not null default true,
  created_at timestamptz not null default now()
);

-- Indexes
create index runs_client_id_idx on runs(client_id);
create index signals_run_id_idx on signals(run_id);
create index insights_run_id_idx on insights(run_id);
create index ideas_run_id_idx on ideas(run_id);
create index evaluations_idea_id_idx on evaluations(idea_id);
