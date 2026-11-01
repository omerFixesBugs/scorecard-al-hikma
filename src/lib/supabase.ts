import { createClient } from '@supabase/supabase-js';
import type { AppData } from './types';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/+$/, '');
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

// A malformed URL (e.g. a typo like "hhttps://") would crash the realtime client, so validate it up front.
export const isConfigured = !!url && !!key && /^https?:\/\/[^/\s]+$/.test(url) && !url.includes('YOUR-PROJECT');
if (url && !isConfigured) console.error(`VITE_SUPABASE_URL looks wrong: "${url}". It should look like https://xxxx.supabase.co`);

// A placeholder client keeps imports working before .env.local is filled in.
export const sb = createClient(isConfigured ? url! : 'https://placeholder.supabase.co', isConfigured ? key! : 'placeholder');

export function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

// ---------- server clock ----------
let serverOffset = 0;

export async function syncServerTime() {
  const t0 = Date.now();
  const { data, error } = await sb.rpc('server_now');
  const t1 = Date.now();
  if (!error && data) serverOffset = new Date(data as string).getTime() - (t0 + t1) / 2;
}

/** Current time in ms on the database server's clock. */
export const now = () => Date.now() + serverOffset;

// ---------- loading ----------
export async function loadAll(): Promise<AppData> {
  const [tournaments, teams, players, tournamentTeams, matches, goals, state, lineups] = await Promise.all([
    sb.from('tournaments').select('*').order('created_at', { ascending: false }),
    sb.from('teams').select('*').order('name'),
    sb.from('players').select('*').order('jersey_number', { nullsFirst: false }).order('name'),
    sb.from('tournament_teams').select('*'),
    sb.from('matches').select('*').order('scheduled_at', { nullsFirst: false }).order('created_at'),
    sb.from('goals').select('*').order('minute').order('added_minute', { nullsFirst: true }),
    sb.from('app_state').select('*').eq('id', 1).maybeSingle(),
    sb.from('match_players').select('*'),
  ]);
  return {
    tournaments: check(tournaments) ?? [],
    teams: check(teams) ?? [],
    players: check(players) ?? [],
    tournamentTeams: check(tournamentTeams) ?? [],
    matches: check(matches) ?? [],
    goals: check(goals) ?? [],
    // Tolerated if missing, so the site keeps working until the updated schema.sql is run.
    lineups: lineups.error ? [] : lineups.data ?? [],
    featuredId: check(state)?.featured_match_id ?? null,
  };
}

const TABLES = ['tournaments', 'teams', 'players', 'tournament_teams', 'matches', 'goals', 'app_state', 'match_players'];

/** Calls onChange (debounced) whenever any table changes. Returns an unsubscribe function. */
export function subscribeAll(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const fire = () => { clearTimeout(timer); timer = setTimeout(onChange, 150); };
  const ch = sb.channel('all-changes-' + Math.random().toString(36).slice(2));
  for (const table of TABLES) ch.on('postgres_changes', { event: '*', schema: 'public', table }, fire);
  ch.subscribe();
  return () => { clearTimeout(timer); sb.removeChannel(ch); };
}
