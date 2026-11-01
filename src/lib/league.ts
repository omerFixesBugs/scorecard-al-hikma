import type { AppData, Goal, Match, Team, Tournament } from './types';

export function score(match: Match, goals: Goal[]) {
  let home = 0, away = 0;
  for (const g of goals) {
    if (g.match_id !== match.id) continue;
    if (g.team_id === match.home_team_id) home++;
    else if (g.team_id === match.away_team_id) away++;
  }
  return { home, away };
}

/** Winner's team id for a finished match (penalties decide a drawn knockout), or null for a draw. */
export function winnerId(match: Match, goals: Goal[]) {
  if (match.status !== 'finished') return null;
  const s = score(match, goals);
  if (s.home !== s.away) return s.home > s.away ? match.home_team_id : match.away_team_id;
  if (match.pens_home != null && match.pens_away != null && match.pens_home !== match.pens_away)
    return match.pens_home > match.pens_away ? match.home_team_id : match.away_team_id;
  return null;
}

export interface StandingRow {
  team: Team;
  p: number; w: number; d: number; l: number;
  gf: number; ga: number; gd: number; pts: number;
  form: ('W' | 'D' | 'L')[];
}

export interface GroupTable { group: string | null; rows: StandingRow[] }

const byDate = (a: Match, b: Match) =>
  new Date(a.scheduled_at || a.created_at).getTime() - new Date(b.scheduled_at || b.created_at).getTime();

/** One table per group (or a single table when the tournament has no groups). */
export function standings(t: Tournament, data: AppData): GroupTable[] {
  const entries = data.tournamentTeams.filter(x => x.tournament_id === t.id);
  const groups = [...new Set(entries.map(e => e.group_name || null))].sort((a, b) => (a ?? '').localeCompare(b ?? ''));
  const matches = data.matches
    .filter(m => m.tournament_id === t.id && m.counts_for_table && !m.is_knockout && m.status === 'finished')
    .sort(byDate);

  return groups.map(group => {
    const rows = new Map<string, StandingRow>();
    for (const e of entries.filter(e => (e.group_name || null) === group)) {
      const team = data.teams.find(x => x.id === e.team_id);
      if (team) rows.set(team.id, { team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] });
    }
    for (const m of matches) {
      // Only group matches count for that group's table; matches with no group count in a no-group table.
      if ((m.group_name || null) !== group && group !== null) continue;
      const h = rows.get(m.home_team_id), a = rows.get(m.away_team_id);
      if (!h || !a) continue;
      const s = score(m, data.goals);
      const apply = (r: StandingRow, gf: number, ga: number) => {
        r.p++; r.gf += gf; r.ga += ga;
        if (gf > ga) { r.w++; r.pts += t.points_win; r.form.push('W'); }
        else if (gf === ga) { r.d++; r.pts += t.points_draw; r.form.push('D'); }
        else { r.l++; r.form.push('L'); }
      };
      apply(h, s.home, s.away);
      apply(a, s.away, s.home);
    }
    const sorted = [...rows.values()]
      .map(r => ({ ...r, gd: r.gf - r.ga, form: r.form.slice(-5) }))
      .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.name.localeCompare(y.team.name));
    return { group, rows: sorted };
  });
}

export function topScorers(t: Tournament, data: AppData) {
  const matchIds = new Set(data.matches.filter(m => m.tournament_id === t.id).map(m => m.id));
  const rows = new Map<string, { name: string; team: Team | undefined; goals: number }>();
  for (const g of data.goals) {
    if (!matchIds.has(g.match_id) || g.own_goal || !g.player_name) continue;
    const key = g.player_id || `${g.team_id}:${g.player_name}`;
    const row = rows.get(key) || { name: g.player_name, team: data.teams.find(x => x.id === g.team_id), goals: 0 };
    row.goals++;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);
