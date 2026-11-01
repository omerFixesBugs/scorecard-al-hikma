import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { activeTournament, lookup, useData, useTick } from '../lib/data';
import { clockView, countdown, fmt, minuteLabel, periodLabel } from '../lib/clock';
import { score } from '../lib/league';
import { BallIcon, BigBall, Crest, SchoolLogo } from '../components/Crest';
import { BRAND, asset } from '../brand';
import type { Goal, Match, Team } from '../lib/types';
import '../styles/board.css';

/** Keeps the 1280x720 board scaled to fit the window. */
function useFitScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / 1280, innerHeight / 720));
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);
  return scale;
}

export default function Scoreboard() {
  const { data, error, demo } = useData();
  const { matchId } = useParams();
  const scale = useFitScale();
  useTick(250);

  const find = data && lookup(data);
  const match = data && find
    ? find.match(matchId) || find.match(data.featuredId) || data.matches.find(m => m.period > 0 && m.status !== 'finished')
    : undefined;
  const tournament = (data && find && (find.tournament(match?.tournament_id) || activeTournament(data))) || undefined;
  const home = find?.team(match?.home_team_id);
  const away = find?.team(match?.away_team_id);
  const goals = match && data ? data.goals.filter(g => g.match_id === match.id) : [];
  const s = match ? score(match, goals) : { home: 0, away: 0 };

  const notice = error === 'not-configured' ? 'Supabase is not configured yet — see README.md. Add ?demo to preview.'
    : error ? `Could not load data: ${error}`
    : !data ? 'Loading…'
    : !match ? 'No match is on the scoreboard yet.' : '';

  const logo = BRAND.logoUrl ? <img src={asset(BRAND.logoUrl)} alt="" className="school-logo" /> : <SchoolLogo />;
  const logoSmall = BRAND.logoUrl ? <img src={asset(BRAND.logoUrl)} alt="" /> : <SchoolLogo />;

  return (
    <div id="viewport">
      <div id="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className={`bg ${BRAND.backgroundUrl ? 'photo' : ''}`}
          style={BRAND.backgroundUrl ? { backgroundImage: `url("${asset(BRAND.backgroundUrl)}")` } : undefined} />
        <div className="bg-lights" /><div className="bg-crowd" /><div className="bg-pitch" />
        <div className="corner-tl" /><div className="corner-br" />

        <div className="script-tl">{BRAND.cornerLeft.map((l, i) => <div key={i}>{l}</div>)}</div>
        <div className="tagline-tr">{BRAND.cornerRight.map((l, i) => <div key={i}>{l}</div>)}</div>

        <header className="brand">
          <div className="brand-row">
            {logo}
            <div className="brand-text">
              <div className="brand-name">{BRAND.schoolName}</div>
              <div className="brand-sub">{BRAND.schoolSub}</div>
            </div>
          </div>
          <h1 className="title">{(tournament?.name ?? 'Football Tournament').toUpperCase()} <span className="year">{tournament?.year}</span></h1>
          {tournament?.tagline && <div className="tagline"><span /><b>{tournament.tagline.toUpperCase()}</b><span /></div>}
        </header>

        <section className="scorebar">
          <Plate side="home" team={home} />
          <Plate side="away" team={away} />
          <ScoreBox side="home" value={s.home} />
          <ScoreBox side="away" value={s.away} />
          <div className="vs">VS</div>
          <Clock match={match} />
          {match && match.pens_home != null && match.pens_away != null &&
            <div className="pens">Penalties {match.pens_home} – {match.pens_away}</div>}
        </section>

        <section className="scorers">
          <ScorerList goals={goals.filter(g => g.team_id === home?.id)} />
          <div className="scorer-mid">{(match?.stage || (match?.group_name ? `Group ${match.group_name}` : '')).toUpperCase()}</div>
          <ScorerList goals={goals.filter(g => g.team_id === away?.id)} />
        </section>

        <GoalFlash match={match} goals={goals} home={home} away={away} />

        <div className="ball">
          <BigBall />
          <div className="ball-logo">{logoSmall}<b>{BRAND.schoolName}</b><small>{BRAND.schoolSub}</small></div>
        </div>
        <div className="values">{BRAND.values.map(v => <span key={v}>{v}</span>)}</div>
        <div className="script-br">{BRAND.footerScript.map((l, i) => <div key={i}>{l}</div>)}</div>

        {notice && <div className="notice">{notice}</div>}
      </div>
      <Link className="nav-link" to={demo ? '/?demo' : '/'}>Standings &amp; fixtures</Link>
    </div>
  );
}

function Plate({ side, team }: { side: 'home' | 'away'; team: Team | undefined }) {
  const crest = <div className="plate-crest"><Crest team={team} /></div>;
  const text = (
    <div className="plate-text">
      <div className="team-name">{team?.name ?? '—'}</div>
      <div className="team-full">{team?.full_name}</div>
    </div>
  );
  return (
    <div className={`plate plate-${side}`}>
      <div className="plate-body">{side === 'home' ? <>{crest}{text}</> : <>{text}{crest}</>}</div>
    </div>
  );
}

function ScoreBox({ side, value }: { side: 'home' | 'away'; value: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value && ref.current) {
      ref.current.classList.remove('bump');
      void ref.current.offsetWidth;
      ref.current.classList.add('bump');
    }
    prev.current = value;
  }, [value]);
  // Two- and three-digit scores get a smaller size so they never run under the clock.
  return <div ref={ref} className={`score score-${side} d${Math.min(String(value).length, 3)}`}><span>{value}</span></div>;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Kick-off time for the label under the clock, e.g. "2:00 PM", or "SAT 2:00 PM" when it isn't today. */
function kickoffTime(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

function Clock({ match: m }: { match: Match | undefined }) {
  let main = '00:00', stoppage: string | null = null, label = 'KICK-OFF', added = '';
  if (m) {
    const cd = countdown(m);
    if (cd > 0) {
      main = cd >= 86400 ? `${Math.floor(cd / 86400)}d ${pad2(Math.floor(cd % 86400 / 3600))}h`
        : cd >= 3600 ? `${Math.floor(cd / 3600)}h ${pad2(Math.floor(cd % 3600 / 60))}m` : fmt(cd);
    } else {
      ({ main, stoppage } = clockView(m));
    }
    label = periodLabel(m);
    // Before kick-off the clock stays at 00:00; the planned time goes in the label instead.
    if (m.status === 'scheduled' && m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now())
      label = `KICK-OFF ${kickoffTime(m.scheduled_at).toUpperCase()}`;
    if (m.added_minutes > 0 && (m.status === 'live' || m.status === 'paused') && cd === 0) added = `+${m.added_minutes}`;
  }
  const wide = main.length + (stoppage?.length ?? 0) > 10;
  return (
    <div className="clock">
      <div className={`clock-time ${wide ? 'wide' : ''}`}><span>{main}</span>{stoppage && <span className="stoppage">{stoppage}</span>}</div>
      <div className="clock-period">{label}</div>
      {added && <div className="added">{added}</div>}
    </div>
  );
}

/** One row per scorer (own goals kept apart), in order of their first goal. */
function scorerRows(goals: Goal[]) {
  const rows = new Map<string, { name: string; own: boolean; goals: Goal[] }>();
  for (const g of goals) {
    const key = `${g.player_id ?? g.player_name ?? g.id}|${g.own_goal}`;
    const row = rows.get(key) ?? { name: g.player_name || (g.own_goal ? 'Own goal' : 'Goal'), own: g.own_goal, goals: [] };
    row.goals.push(g);
    rows.set(key, row);
  }
  return [...rows.entries()].map(([key, r]) => ({ key, ...r }));
}

// The list has room for 4 normal rows or 6 compact ones; beyond that it pages through.
const ROWS_NORMAL = 4, ROWS_COMPACT = 6, PAGE_MS = 6000, MAX_MINUTES = 3;

function ScorerList({ goals }: { goals: Goal[] }) {
  const rows = scorerRows(goals);
  const pages = Math.max(1, Math.ceil(rows.length / ROWS_COMPACT));
  const page = Math.floor(Date.now() / PAGE_MS) % pages;
  const per = Math.ceil(rows.length / pages);  // spread rows evenly, e.g. 9 rows = 5 + 4
  const shown = rows.slice(page * per, (page + 1) * per);
  return (
    <ul className={`scorer-list ${rows.length > ROWS_NORMAL ? 'compact' : ''}`}>
      {shown.map(r => {
        const mins = r.goals.slice(-MAX_MINUTES);
        return (
          <li key={`${page}-${r.key}`} className="new">
            <BallIcon />
            <span className="who">{r.name}{r.own && <span className="tag"> (OG)</span>}</span>
            {r.goals.length > 1 && <span className="count">×{r.goals.length}</span>}
            <span className="min">
              {r.goals.length > MAX_MINUTES && '… '}
              {mins.map((g, i) => <span key={g.id}>{i > 0 && ' '}{minuteLabel(g)}{g.penalty && <small>P</small>}</span>)}
            </span>
          </li>
        );
      })}
      {pages > 1 && <li className="pager">{Array.from({ length: pages }, (_, i) => <i key={i} className={i === page ? 'on' : ''} />)}</li>}
    </ul>
  );
}

/** Big "GOAL!" banner whenever a goal appears for the match on screen. */
function GoalFlash({ match, goals, home, away }: { match: Match | undefined; goals: Goal[]; home?: Team; away?: Team }) {
  const seen = useRef<{ matchId?: string; ids: Set<string> | null }>({ ids: null });
  const [flash, setFlash] = useState<string | null>(null);
  const key = goals.map(g => g.id).join(',');

  useEffect(() => {
    if (!match) return;
    if (seen.current.matchId !== match.id) seen.current = { matchId: match.id, ids: null };
    const prev = seen.current.ids;
    seen.current.ids = new Set(goals.map(g => g.id));
    const fresh = prev ? goals.filter(g => !prev.has(g.id)) : [];
    if (!fresh.length) return;
    const g = fresh[fresh.length - 1];
    const team = g.team_id === home?.id ? home : away;
    setFlash(`${g.player_name || ''} ${minuteLabel(g)} · ${team?.name ?? ''}`.trim());
    const t = setTimeout(() => setFlash(null), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, key]);

  return (
    <div className={`goal-flash ${flash ? 'show' : ''}`}>
      <div>GOAL!</div><small>{flash}</small>
    </div>
  );
}
