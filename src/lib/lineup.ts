import type { AppData, Match, Player, Tournament } from './types';

/** Players on the field and substitutes on the bench: the match's setting, else the tournament's. */
export function matchFormat(m: Match, t: Tournament | undefined) {
  return { onField: m.players_on_field ?? t?.players_on_field ?? 11, bench: m.bench_size ?? t?.bench_size ?? 5 };
}

/** Splits a jersey number typed into a name: "Bruno Fernandes - 8" or "8 Bruno Fernandes" → name + 8. */
export function splitJersey(raw: string): { name: string; number: number | null } {
  const lead = raw.match(/^\s*#?(\d{1,3})[\s.)\-–]+(.+)$/);
  if (lead) return { name: lead[2].trim(), number: +lead[1] };
  const trail = raw.match(/^(.+?)(?:\s+#?|\s*[-–#]\s*)(\d{1,3})\s*$/);
  if (trail) return { name: trail[1].trim(), number: +trail[2] };
  return { name: raw.trim(), number: null };
}

/** Shirt number and display name, falling back to a number written inside the name. */
export function shirtOf(p: Player) {
  const s = splitJersey(p.name);
  return { number: p.jersey_number ?? s.number, name: s.name };
}

export type LineupStatus = 'field' | 'bench' | null;

/** A team's lineup for one match. Until a lineup is set, the whole squad counts as on the field. */
export function lineup(data: AppData, matchId: string, teamId: string | undefined) {
  const squad = data.players.filter(p => p.team_id === teamId);
  const rows = data.lineups.filter(l => l.match_id === matchId && l.team_id === teamId);
  const status = (p: Player): LineupStatus => {
    const r = rows.find(x => x.player_id === p.id);
    return r ? (r.on_field ? 'field' : 'bench') : null;
  };
  return {
    squad,
    isSet: rows.length > 0,
    field: rows.length ? squad.filter(p => status(p) === 'field') : squad,
    bench: squad.filter(p => status(p) === 'bench'),
    status,
  };
}
