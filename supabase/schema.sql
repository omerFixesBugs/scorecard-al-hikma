-- Football Tournament schema
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

-- A tournament (e.g. "Inter-School Football Tournament 2026"). Several can exist; one is active.
create table if not exists tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  year        text,
  tagline     text,
  slug        text not null unique,          -- used in URLs: /t/<slug>
  is_active   boolean not null default false, -- shown on the home page
  points_win  int not null default 3,
  points_draw int not null default 1,
  created_at  timestamptz not null default now()
);
create unique index if not exists one_active_tournament on tournaments (is_active) where is_active;

-- Schools / teams, reused across tournaments.
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- short name shown big, e.g. "CADT"
  full_name   text,                          -- subtitle, e.g. "International School"
  logo_url    text,
  color       text not null default '#0b2a5b',
  created_at  timestamptz not null default now()
);

create table if not exists players (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references teams(id) on delete cascade,
  name           text not null,
  jersey_number  int,                        -- optional
  created_at     timestamptz not null default now()
);

-- Which teams play in a tournament, and in which group (null = no groups / league format).
create table if not exists tournament_teams (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id       uuid not null references teams(id) on delete cascade,
  group_name    text,
  primary key (tournament_id, team_id)
);

create table if not exists matches (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references tournaments(id) on delete cascade,
  home_team_id       uuid not null references teams(id) on delete restrict,
  away_team_id       uuid not null references teams(id) on delete restrict,
  group_name         text,                   -- set for group-stage matches
  stage              text,                   -- e.g. "Group stage", "Semi-final", "Final"
  is_knockout        boolean not null default false,
  venue              text,
  scheduled_at       timestamptz,
  half_length        int  not null default 45,
  extra_half_length  int  not null default 15,
  -- clock state
  status             text not null default 'scheduled'
                     check (status in ('scheduled','live','paused','break','finished')),
  period             int  not null default 0,  -- 0 none, 1 1st half, 2 2nd half, 3 ET 1st, 4 ET 2nd
  elapsed_seconds    int  not null default 0,  -- match clock when last stopped
  running_since      timestamptz,              -- when the clock last started; null = stopped
  added_minutes      int  not null default 0,  -- announced stoppage time for current period
  -- penalty shoot-out (knockout matches)
  pens_home          int,
  pens_away          int,
  counts_for_table   boolean not null default true,
  created_at         timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table if not exists goals (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  team_id       uuid not null references teams(id) on delete cascade,  -- team credited with the goal
  player_id     uuid references players(id) on delete set null,
  player_name   text,                         -- copy, so history survives squad edits
  minute        int not null,
  added_minute  int,                          -- e.g. 2 for 45+2'
  own_goal      boolean not null default false,
  penalty       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Match format: players on the field and substitutes on the bench.
-- Set per tournament; a match can override it (null = use the tournament's).
-- "add column if not exists" makes this safe to re-run on an existing database.
alter table tournaments add column if not exists players_on_field int not null default 11;
alter table tournaments add column if not exists bench_size       int not null default 5;
alter table matches     add column if not exists players_on_field int;
alter table matches     add column if not exists bench_size       int;

-- Matchday lineup: who is on the field and who is on the bench, per match.
-- A substitution swaps on_field between two players of the same team.
create table if not exists match_players (
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  team_id    uuid not null references teams(id) on delete cascade,
  on_field   boolean not null default true,  -- false = on the bench
  primary key (match_id, player_id)
);

-- Single row: which match the big screen shows.
create table if not exists app_state (
  id                 int primary key default 1 check (id = 1),
  featured_match_id  uuid references matches(id) on delete set null
);
insert into app_state (id) values (1) on conflict do nothing;

create index if not exists players_team_idx on players(team_id);
create index if not exists matches_tournament_idx on matches(tournament_id);
create index if not exists goals_match_idx on goals(match_id);

-- Server time, so every screen runs the clock off the same source.
create or replace function server_now() returns timestamptz
language sql stable as $$ select now() $$;
grant execute on function server_now() to anon, authenticated;

-- ---------- Security: everyone can read, only logged-in admins can write ----------

do $$
declare t text;
begin
  foreach t in array array['tournaments','teams','players','tournament_teams','matches','goals','app_state','match_players'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "admin write" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('create policy "admin write" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- Realtime: push changes to open pages ----------

do $$
declare t text;
begin
  foreach t in array array['tournaments','teams','players','tournament_teams','matches','goals','app_state','match_players'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
