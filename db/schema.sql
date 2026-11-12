-- HealthOS schema. Idempotent: `npm run db:migrate` can be re-run safely.
-- Accounts and sessions live in Neon Auth's `neon_auth` schema, which Neon manages.

-- One JSON document per user: the app's whole `Data` object. `version` guards against lost updates.
create table if not exists user_data (
  user_id uuid primary key references neon_auth."user" (id) on delete cascade,
  data jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
