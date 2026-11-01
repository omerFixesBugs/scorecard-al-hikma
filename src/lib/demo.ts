import type { AppData } from './types';

/** Sample data for previewing without a database: add ?demo to any public URL. */
export function demoData(): AppData {
  const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
  const day = 86400000;
  const base = { half_length: 45, extra_half_length: 15, added_minutes: 0, pens_home: null, pens_away: null, venue: 'Main ground',
    counts_for_table: true, is_knockout: false, players_on_field: null, bench_size: null, created_at: iso(10 * day), tournament_id: 't1', running_since: null };
  return {
    featuredId: 'm1',
    tournaments: [{ id: 't1', name: 'Inter-School Football Tournament', year: '2026', tagline: 'Schools united through football',
      slug: 'inter-school-2026', is_active: true, points_win: 3, points_draw: 1, players_on_field: 11, bench_size: 5, created_at: iso(30 * day) }],
    teams: [
      { id: 'a', name: 'CADT', full_name: 'International School', logo_url: null, color: '#0e2a6b' },
      { id: 'b', name: 'CGS (NC)', full_name: 'Chattogram Grammar School (National Curriculum)', logo_url: null, color: '#111111' },
      { id: 'c', name: 'AHIS', full_name: 'Al Hekmah International School', logo_url: null, color: '#9b1c1f' },
      { id: 'd', name: 'SIS', full_name: 'Sunshine International School', logo_url: null, color: '#0f766e' },
    ],
    players: [],
    lineups: [],
    tournamentTeams: [
      { tournament_id: 't1', team_id: 'a', group_name: 'A' }, { tournament_id: 't1', team_id: 'b', group_name: 'A' },
      { tournament_id: 't1', team_id: 'c', group_name: 'B' }, { tournament_id: 't1', team_id: 'd', group_name: 'B' },
    ],
    matches: [
      { ...base, id: 'm1', home_team_id: 'a', away_team_id: 'b', group_name: 'A', stage: 'Group A', status: 'live', period: 2,
        elapsed_seconds: 0, running_since: iso((52 * 60 + 18) * 1000), scheduled_at: iso(3600000) },
      { ...base, id: 'm2', home_team_id: 'c', away_team_id: 'd', group_name: 'B', stage: 'Group B', status: 'finished', period: 2,
        elapsed_seconds: 5400, scheduled_at: iso(day) },
      { ...base, id: 'm3', home_team_id: 'a', away_team_id: 'c', group_name: null, stage: 'Final', is_knockout: true,
        counts_for_table: false, status: 'scheduled', period: 0, elapsed_seconds: 0, scheduled_at: iso(-3 * day) },
    ],
    goals: [
      { id: 'g1', match_id: 'm1', team_id: 'a', player_id: null, player_name: 'Samiul Haque', minute: 14, added_minute: null, own_goal: false, penalty: false },
      { id: 'g2', match_id: 'm1', team_id: 'b', player_id: null, player_name: 'Rafi Ahmed', minute: 27, added_minute: null, own_goal: false, penalty: false },
      { id: 'g3', match_id: 'm1', team_id: 'a', player_id: null, player_name: 'Tahmid Rahman', minute: 38, added_minute: null, own_goal: false, penalty: false },
      { id: 'g5', match_id: 'm1', team_id: 'a', player_id: null, player_name: 'Samiul Haque', minute: 49, added_minute: null, own_goal: false, penalty: true },
      { id: 'g4', match_id: 'm2', team_id: 'c', player_id: null, player_name: 'Arif Hossain', minute: 61, added_minute: null, own_goal: false, penalty: true },
    ],
  };
}
