import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeTournament, useData, useTick } from '../lib/data';
import { isLive } from '../lib/clock';
import { standings, topScorers, type GroupTable } from '../lib/league';
import { MatchRow } from '../components/MatchRow';
import { SiteHeader, StatusPanel } from '../components/SiteHeader';
import { Crest, TeamChip } from '../components/Crest';
import type { AppData, Match, Tournament } from '../lib/types';

type Tab = 'matches' | 'standings' | 'scorers' | 'teams';

export default function TournamentPage() {
  const { data } = useData();
  const { slug } = useParams();
  const [tab, setTab] = useState<Tab>('matches');
  useTick(1000);

  const t = data && (slug ? data.tournaments.find(x => x.slug === slug) : activeTournament(data));

  return (
    <>
      <SiteHeader tournament={t || undefined} />
      {t && (
        <div className="hero">
          <h1>{t.name} <span>{t.year}</span></h1>
          {t.tagline && <p>{t.tagline}</p>}
          <div className="subtabs">
            {(['matches', 'standings', 'scorers', 'teams'] as Tab[]).map(k => (
              <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {{ matches: 'Matches', standings: 'Standings', scorers: 'Top scorers', teams: 'Teams' }[k]}
              </button>
            ))}
          </div>
        </div>
      )}
      <main>
        <StatusPanel />
        {data && !t && <div className="panel empty">{slug ? 'Tournament not found.' : 'No tournament has been set up yet.'}</div>}
        {data && t && tab === 'matches' && <Matches t={t} data={data} />}
        {data && t && tab === 'standings' && <Standings t={t} data={data} />}
        {data && t && tab === 'scorers' && <Scorers t={t} data={data} />}
        {data && t && tab === 'teams' && <Teams t={t} data={data} />}
      </main>
      <div className="footer"><Link to="/admin">Admin</Link></div>
    </>
  );
}

const byDate = (a: Match, b: Match) =>
  new Date(a.scheduled_at || a.created_at).getTime() - new Date(b.scheduled_at || b.created_at).getTime();

function Matches({ t, data }: { t: Tournament; data: AppData }) {
  const ms = data.matches.filter(m => m.tournament_id === t.id).sort(byDate);
  const live = ms.filter(isLive);
  const upcoming = ms.filter(m => m.period === 0);
  const results = ms.filter(m => m.status === 'finished').reverse();
  return (
    <>
      {live.length > 0 && <div className="panel"><h2><span className="live-dot" />Live now</h2>{live.map(m => <MatchRow key={m.id} match={m} />)}</div>}
      <div className="grid2">
        <div className="panel"><h2>Upcoming</h2>
          {upcoming.length ? upcoming.map(m => <MatchRow key={m.id} match={m} />) : <div className="empty">No fixtures scheduled.</div>}</div>
        <div className="panel"><h2>Results</h2>
          {results.length ? results.map(m => <MatchRow key={m.id} match={m} />) : <div className="empty">No results yet.</div>}</div>
      </div>
    </>
  );
}

function Standings({ t, data }: { t: Tournament; data: AppData }) {
  const tables = standings(t, data);
  const knockouts = data.matches.filter(m => m.tournament_id === t.id && m.is_knockout).sort(byDate);
  const stages = [...new Set(knockouts.map(m => m.stage || 'Knockout'))];
  return (
    <>
      {tables.length === 0 && <div className="panel empty">No teams have been added to this tournament yet.</div>}
      <div className={tables.length > 1 ? 'grid2' : ''}>
        {tables.map(g => <Table key={g.group ?? '-'} g={g} />)}
      </div>
      {tables.length > 0 && <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
        Win {t.points_win} pts · Draw {t.points_draw} pt · Ranked by points, goal difference, goals scored. Finished matches only.</p>}
      {stages.length > 0 && (
        <div className="panel"><h2>Knockout stage</h2>
          {stages.map(st => (
            <div key={st}><h3 style={{ marginTop: 14 }}>{st}</h3>
              {knockouts.filter(m => (m.stage || 'Knockout') === st).map(m => <MatchRow key={m.id} match={m} showScorers={false} />)}</div>
          ))}
        </div>
      )}
    </>
  );
}

function Table({ g }: { g: GroupTable }) {
  return (
    <div className="panel wrap-x">
      <h2>{g.group ? `Group ${g.group}` : 'Standings'}</h2>
      <table className="league">
        <thead><tr><th className="pos">#</th><th>Team</th><th className="num">P</th><th className="num">W</th><th className="num">D</th><th className="num">L</th>
          <th className="num hide-sm">GF</th><th className="num hide-sm">GA</th><th className="num">GD</th><th className="num">Pts</th><th className="hide-sm">Form</th></tr></thead>
        <tbody>
          {g.rows.map((r, i) => (
            <tr key={r.team.id}>
              <td className="pos">{i + 1}</td><td><TeamChip team={r.team} /></td>
              <td className="num">{r.p}</td><td className="num">{r.w}</td><td className="num">{r.d}</td><td className="num">{r.l}</td>
              <td className="num hide-sm">{r.gf}</td><td className="num hide-sm">{r.ga}</td>
              <td className="num">{r.gd > 0 ? '+' : ''}{r.gd}</td><td className="num pts">{r.pts}</td>
              <td className="form hide-sm">{r.form.map((f, j) => <span key={j} className={f}>{f}</span>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Scorers({ t, data }: { t: Tournament; data: AppData }) {
  const rows = topScorers(t, data);
  return (
    <div className="panel" style={{ maxWidth: 640, margin: '0 auto' }}><h2>Top scorers</h2>
      {rows.length ? <table><tbody>{rows.map((s, i) => (
        <tr key={i}><td className="pos">{i + 1}</td><td>{s.name}</td><td><TeamChip team={s.team} /></td><td className="num"><b>{s.goals}</b></td></tr>
      ))}</tbody></table> : <div className="empty">No goals yet.</div>}
    </div>
  );
}

function Teams({ t, data }: { t: Tournament; data: AppData }) {
  const entries = data.tournamentTeams.filter(e => e.tournament_id === t.id);
  return (
    <div className="grid2">
      {entries.map(e => {
        const team = data.teams.find(x => x.id === e.team_id);
        if (!team) return null;
        const squad = data.players.filter(p => p.team_id === team.id);
        return (
          <div className="panel" key={team.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <Crest team={team} className="crest-lg" />
              <div><h2 style={{ margin: 0 }}>{team.name}</h2>
                <div className="muted">{team.full_name}{e.group_name && ` · Group ${e.group_name}`}</div></div>
            </div>
            {squad.length ? squad.map(p => (
              <div className="list-item" key={p.id}>
                <span className={`jersey ${p.jersey_number == null ? 'none' : ''}`}>{p.jersey_number ?? '–'}</span>
                <span className="grow">{p.name}</span>
              </div>
            )) : <div className="empty">Squad not announced.</div>}
          </div>
        );
      })}
      {!entries.length && <div className="panel empty">No teams yet.</div>}
    </div>
  );
}
