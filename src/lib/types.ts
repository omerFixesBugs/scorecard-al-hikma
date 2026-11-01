export type MatchStatus = 'scheduled' | 'live' | 'paused' | 'break' | 'finished';

export interface Tournament {
  id: string;
  name: string;
  year: string | null;
  tagline: string | null;
  slug: string;
  is_active: boolean;
  points_win: number;
  points_draw: number;
  players_on_field: number;
  bench_size: number;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  full_name: string | null;
  logo_url: string | null;
  color: string;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  jersey_number: number | null;
}

export interface TournamentTeam {
  tournament_id: string;
  team_id: string;
  group_name: string | null;
}

export interface Match {
  id: string;
  tournament_id: string;
  home_team_id: string;
  away_team_id: string;
  group_name: string | null;
  stage: string | null;
  is_knockout: boolean;
  venue: string | null;
  scheduled_at: string | null;
  half_length: number;
  extra_half_length: number;
  status: MatchStatus;
  period: number;
  elapsed_seconds: number;
  running_since: string | null;
  added_minutes: number;
  pens_home: number | null;
  pens_away: number | null;
  counts_for_table: boolean;
  /** null = use the tournament's setting */
  players_on_field: number | null;
  bench_size: number | null;
  created_at: string;
}

export interface Goal {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string | null;
  player_name: string | null;
  minute: number;
  added_minute: number | null;
  own_goal: boolean;
  penalty: boolean;
  created_at?: string;
}

/** A player in a match's lineup: on the field, or on the bench. */
export interface MatchPlayer {
  match_id: string;
  player_id: string;
  team_id: string;
  on_field: boolean;
}

export interface AppData {
  tournaments: Tournament[];
  teams: Team[];
  players: Player[];
  tournamentTeams: TournamentTeam[];
  matches: Match[];
  goals: Goal[];
  lineups: MatchPlayer[];
  featuredId: string | null;
}
