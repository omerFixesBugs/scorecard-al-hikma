import { Link, useParams } from 'react-router-dom';
import { lookup, useData, useTick } from '../lib/data';
import { clockView, countdown, fmt, minuteLabel, periodLabel } from '../lib/clock';
import { score } from '../lib/league';
import { SiteHeader, StatusPanel } from '../components/SiteHeader';
import { TeamChip } from '../components/Crest';
import { matchLabel, when } from '../components/MatchRow';

export default function MatchPage() {
  const { data, demo } = useData();
  const { id } = useParams();
  useTick(500);
  const q = demo ? '?demo' : '';

  const m = data && lookup(data).match(id);
  const t = data && m ? lookup(data).tournament(m.tournament_id) : undefined;

  return (
    <>
      <SiteHeader tournament={t} />
      <main>
        <StatusPanel />
        {data && !m && <div className="panel empty">Match not found.</div>}
        {data && m && (() => {
          const { team } = lookup(data);
          const home = team(m.home_team_id), away = team(m.away_team_id);
          const goals = data.goals.filter(g => g.match_id === m.id);
          const s = score(m, goals);
          const cd = countdown(m);
          const clock = cd > 0 ? fmt(cd) : m.period > 0 ? clockView(m) : null;
          return (
            <>
              <div className="panel match-hero">
                <div className="muted">{t && <Link to={`/t/${t.slug}${q}`}>{t.name} {t.year}</Link>}{matchLabel(m) && ` · ${matchLabel(m)}`}</div>
                <div className="teams" style={{ marginTop: 14 }}>
                  <TeamChip team={home} />
                  <div>
                    <div className="big">{m.period > 0 && cd === 0 ? `${s.home} – ${s.away}` : 'vs'}</div>
                    {clock && <div className="control-clock">{typeof clock === 'string' ? clock : <>{clock.main} {clock.stoppage && <small>{clock.stoppage}</small>}</>}</div>}
                    <div className="control-period">{periodLabel(m)}</div>
                    {m.pens_home != null && m.pens_away != null && <div><b>Penalties {m.pens_home} – {m.pens_away}</b></div>}
                  </div>
                  <TeamChip team={away} />
                </div>
                <div className="muted" style={{ marginTop: 12 }}>{when(m.scheduled_at)}{m.venue && ` · ${m.venue}`}</div>
                <div style={{ marginTop: 12 }}><Link to={`/scoreboard/${m.id}${q}`}>Open full-screen scoreboard ↗</Link></div>
              </div>
              <div className="panel">
                <h2>Goals</h2>
                {goals.length ? <table><tbody>{goals.map(g => (
                  <tr key={g.id}>
                    <td style={{ width: 70 }}><b>{minuteLabel(g)}</b></td>
                    <td>{g.player_name || 'Goal'}{g.own_goal && ' (OG)'}{g.penalty && ' (P)'}</td>
                    <td><TeamChip team={team(g.team_id)} /></td>
                  </tr>
                ))}</tbody></table> : <div className="empty">No goals yet.</div>}
              </div>
            </>
          );
        })()}
      </main>
    </>
  );
}
