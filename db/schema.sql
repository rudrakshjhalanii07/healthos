-- HealthOS schema. Idempotent: `npm run db:migrate` can be re-run safely.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_id on sessions (user_id);

-- One JSON document per user: the app's whole `Data` object. `version` guards against lost updates.
create table if not exists user_data (
  user_id uuid primary key references users on delete cascade,
  data jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
