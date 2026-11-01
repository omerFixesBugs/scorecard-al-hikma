import { Link } from 'react-router-dom';
import { lookup, useData } from '../lib/data';
import { clockView, countdown, isLive, minuteLabel, periodLabel } from '../lib/clock';
import { score, winnerId } from '../lib/league';
import { TeamChip } from './Crest';
import type { Match } from '../lib/types';

export const when = (s: string | null) => s
  ? new Date(s).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Date TBC';

export const matchLabel = (m: Match) => m.stage || (m.group_name ? `Group ${m.group_name}` : '');

/** One fixture / result line linking to the match page. */
export function MatchRow({ match: m, showScorers = true }: { match: Match; showScorers?: boolean }) {
  const { data, demo } = useData();
  if (!data) return null;
  const { team } = lookup(data);
  const s = score(m, data.goals);
  const played = m.period > 0 && countdown(m) === 0;
  const live = played && isLive(m);
  const win = winnerId(m, data.goals);
  const goals = data.goals.filter(g => g.match_id === m.id);
  const list = (teamId: string) => goals.filter(g => g.team_id === teamId)
    .map(g => `${g.player_name || 'Goal'}${g.own_goal ? ' (OG)' : ''}${g.penalty ? ' (P)' : ''} ${minuteLabel(g)}`).join(', ');
  const status = m.status === 'finished' ? periodLabel(m).replace('FULL TIME', 'FT') : live ? `${clockView(m).main} · ${periodLabel(m)}` : '';

  return (
    <Link className="result" to={`/match/${m.id}${demo ? '?demo' : ''}`}>
      <div className="home"><TeamChip team={team(m.home_team_id)} className={win === m.home_team_id ? 'win' : ''} /></div>
      <div className={`sc ${played ? (live ? 'live' : '') : 'up'}`}>{played ? `${s.home} – ${s.away}` : 'vs'}</div>
      <div><TeamChip team={team(m.away_team_id)} className={win === m.away_team_id ? 'win' : ''} /></div>
      <div className="meta">
        {live && <span className="live-dot" />}
        {when(m.scheduled_at)}{matchLabel(m) && ` · ${matchLabel(m)}`}{m.venue && ` · ${m.venue}`}
        {status && <> · <b>{status}</b></>}
        {m.pens_home != null && m.pens_away != null && <> · pens {m.pens_home}–{m.pens_away}</>}
      </div>
      {showScorers && goals.length > 0 && (
        <div className="scorers"><div>{list(m.home_team_id)}</div><div>{list(m.away_team_id)}</div></div>
      )}
    </Link>
  );
}
