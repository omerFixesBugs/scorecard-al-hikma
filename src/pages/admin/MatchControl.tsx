import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { check, now, sb } from '../../lib/supabase';
import { useTick } from '../../lib/data';
import { clockSeconds, clockView, countdown, currentMinute, fmt, minuteLabel, PERIOD_SHORT, periodLabel, periodStart } from '../../lib/clock';
import { score } from '../../lib/league';
import { TeamChip } from '../../components/Crest';
import { when } from '../../components/MatchRow';
import { formValues, useAdmin } from './AdminLayout';
import { lineup, matchFormat, shirtOf, type LineupStatus } from '../../lib/lineup';
import type { Match, Player, Team } from '../../lib/types';

const iso = (ms: number) => new Date(ms).toISOString();

export default function MatchControl() {
  const { data, tournament: t, run } = useAdmin();
  const [matchId, setMatchId] = useState<string | null>(() => localStorage.getItem('admin.match'));
  useTick(250);

  const pool = data.matches.filter(m => m.tournament_id === t?.id);
  if (!pool.length) return <div className="panel empty">No matches in this tournament yet. Create one in <Link to="/admin/matches">Matches</Link>.</div>;

  const m = pool.find(x => x.id === matchId) || pool.find(x => x.id === data.featuredId)
    || pool.find(x => x.period > 0 && x.status !== 'finished') || pool.find(x => x.status !== 'finished') || pool[0];
  const team = (id: string) => data.teams.find(x => x.id === id);
  const home = team(m.home_team_id), away = team(m.away_team_id);
  const goals = data.goals.filter(g => g.match_id === m.id);
  const s = score(m, goals);
  const cd = countdown(m);
  const featured = data.featuredId === m.id;

  const pick = (id: string) => { setMatchId(id); localStorage.setItem('admin.match', id); };
  const update = (patch: Partial<Match>, msg?: string) => run(() => sb.from('matches').update(patch).eq('id', m.id).then(check), msg);
  const feature = () => run(() => sb.from('app_state').update({ featured_match_id: m.id }).eq('id', 1).then(check), 'Now on the scoreboard');

  const startPeriod = (p: number) => run(async () => {
    await sb.from('matches').update({ status: 'live', period: p, elapsed_seconds: periodStart(m, p), running_since: iso(now()), added_minutes: 0 }).eq('id', m.id).then(check);
    // Put the match on the big screen unless another match is in progress there.
    const f = data.matches.find(x => x.id === data.featuredId);
    if (!f || f.id === m.id || f.status === 'finished' || f.period === 0)
      await sb.from('app_state').update({ featured_match_id: m.id }).eq('id', 1).then(check);
  });
  const stop = (status: Match['status']) => ({ status, elapsed_seconds: clockSeconds(m), running_since: null });
  const reset = (withGoals: boolean) => {
    if (!confirm(withGoals ? 'Reset the clock AND delete every goal in this match?' : 'Reset the clock to "not started"? Goals are kept.')) return;
    run(async () => {
      if (withGoals) await sb.from('goals').delete().eq('match_id', m.id).then(check);
      await sb.from('matches').update({ status: 'scheduled', period: 0, elapsed_seconds: 0, running_since: null, added_minutes: 0, pens_home: null, pens_away: null }).eq('id', m.id).then(check);
    }, 'Match reset');
  };

  const setClock = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const [mm, ss] = formValues(e).clock.split(':').map(Number);
    if (!(ss >= 0 && ss < 60)) return;
    update({ elapsed_seconds: mm * 60 + ss, running_since: m.status === 'live' && m.running_since ? iso(now()) : null }, 'Clock set');
  };

  // ---- clock buttons for the current state ----
  // A plain function, not a component, so buttons aren't remounted on every clock tick.
  const B = (key: string, label: string, cls: string, on: () => void) =>
    <button key={key} className={`big ${cls}`} onClick={on}>{label}</button>;
  const buttons: JSX.Element[] = [];
  if (m.status === 'scheduled' || m.period === 0) {
    buttons.push(B('k', '▶ Kick off now', 'go', () => startPeriod(1)));
    if (m.scheduled_at && new Date(m.scheduled_at).getTime() > now())
      buttons.push(B('a', `⏱ Auto start at ${new Date(m.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 'secondary',
        () => update({ status: 'live', period: 1, elapsed_seconds: 0, running_since: m.scheduled_at, added_minutes: 0 }, 'Clock will start at kick-off time')));
  } else if (cd > 0) {
    buttons.push(B('k', '▶ Kick off now', 'go', () => startPeriod(1)));
    buttons.push(B('c', 'Cancel auto start', 'secondary', () => update({ status: 'scheduled', period: 0, elapsed_seconds: 0, running_since: null })));
  } else if (m.status === 'live' || m.status === 'paused') {
    buttons.push(m.status === 'live'
      ? B('p', '❚❚ Pause', 'warn', () => update(stop('paused')))
      : B('r', '▶ Resume', 'go', () => update({ status: 'live', running_since: iso(now()) })));
    buttons.push(B('e', `■ End ${PERIOD_SHORT[m.period]}`, '', () => update({ ...stop('break'), added_minutes: 0 })));
  } else if (m.status === 'break') {
    if (m.period === 1) buttons.push(B('2', '▶ Start 2nd half', 'go', () => startPeriod(2)));
    if (m.period === 2) buttons.push(B('3', '▶ Start extra time', m.is_knockout && s.home === s.away ? 'go' : 'secondary', () => startPeriod(3)));
    if (m.period === 3) buttons.push(B('4', '▶ Start ET 2nd half', 'go', () => startPeriod(4)));
  } else if (m.status === 'finished') {
    buttons.push(B('o', 'Reopen match', 'secondary', () => update({ status: 'break' })));
  }
  if (m.status !== 'finished' && m.period > 0 && cd === 0)
    buttons.push(B('f', '🏁 Full time', 'danger', () => confirm('End the match (full time)?') && update({ ...stop('finished'), added_minutes: 0 }, 'Full time')));

  const view = cd > 0 ? { main: fmt(cd), stoppage: null } : clockView(m);
  const showPens = m.is_knockout && m.period >= 2 && s.home === s.away && (m.status === 'break' || m.status === 'finished');

  return (
    <>
      <div className="panel">
        <div className="row">
          <div><label>Match</label>
            <select value={m.id} onChange={e => pick(e.target.value)}>
              {pool.map(x => <option key={x.id} value={x.id}>
                {team(x.home_team_id)?.name} vs {team(x.away_team_id)?.name} — {when(x.scheduled_at)}{x.stage ? ` · ${x.stage}` : ''} [{x.status}]</option>)}
            </select></div>
          <div className="shrink">{featured ? <span className="pill featured">ON SCOREBOARD</span> : <button className="warn" onClick={feature}>Show on scoreboard</button>}</div>
        </div>
      </div>

      <div className="panel">
        <div className="control-head">
          <div><TeamChip team={home} /><div className="control-score">{s.home}</div></div>
          <div>
            <div className="control-clock">{view.main} {view.stoppage && <small>{view.stoppage}</small>}</div>
            <div className="control-period">{periodLabel(m)}</div>
            <div className="muted">{m.added_minutes ? `Added time shown: +${m.added_minutes}` : ''}</div>
          </div>
          <div><TeamChip team={away} /><div className="control-score">{s.away}</div></div>
        </div>
        <div className="btn-group" style={{ justifyContent: 'center' }}>{buttons}</div>
        <div className="btn-group" style={{ justifyContent: 'center' }}>
          <span className="muted" style={{ alignSelf: 'center' }}>Added time:</span>
          {[1, 2, 3, 4, 5].map(n => <button key={n} className="secondary small" onClick={() => update({ added_minutes: m.added_minutes + n })}>+{n}</button>)}
          <button className="secondary small" onClick={() => update({ added_minutes: Math.max(0, m.added_minutes - 1) })}>−1</button>
          <button className="secondary small" onClick={() => update({ added_minutes: 0 })}>Clear</button>
        </div>
        <form className="row" onSubmit={setClock} style={{ maxWidth: 420, margin: '14px auto 0' }} key={m.id}>
          <div><label>Adjust clock (mm:ss)</label><input name="clock" placeholder="e.g. 52:18" pattern="\d{1,3}:\d{2}" required /></div>
          <div className="shrink"><button className="secondary">Set clock</button></div>
        </form>
      </div>

      {showPens && <Penalties match={m} />}

      <div className="grid2">
        <TeamPanel key={`h-${m.id}`} match={m} team={home} other={away} />
        <TeamPanel key={`a-${m.id}`} match={m} team={away} other={home} />
      </div>

      <div className="panel">
        <h2>Goals</h2>
        {goals.length ? <table><tbody>{goals.map(g => (
          <tr key={g.id}>
            <td style={{ width: 70 }}><b>{minuteLabel(g)}</b></td>
            <td><TeamChip team={team(g.team_id)} /></td>
            <td>{g.player_name || '—'} {g.own_goal && <span className="pill">OG</span>} {g.penalty && <span className="pill">PEN</span>}</td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {!g.own_goal && <><button className={`small ${g.penalty ? 'warn' : 'secondary'}`} title="Mark or unmark as a penalty"
                onClick={() => run(() => sb.from('goals').update({ penalty: !g.penalty }).eq('id', g.id).then(check))}>Penalty</button>{' '}</>}
              <button className="danger small"
              onClick={() => confirm('Remove this goal?') && run(() => sb.from('goals').delete().eq('id', g.id).then(check))}>Remove</button></td>
          </tr>
        ))}</tbody></table> : <div className="empty">No goals yet.</div>}
      </div>

      <div className="panel">
        <h3>Danger zone</h3>
        <button className="danger" onClick={() => reset(false)}>Reset clock to not started</button>{' '}
        <button className="danger" onClick={() => reset(true)}>Reset clock and remove all goals</button>
      </div>
    </>
  );
}

/** Goal buttons, own goals, substitutions and lineup for one team. */
function TeamPanel({ match: m, team, other }: { match: Match; team?: Team; other?: Team }) {
  const { data, run, toast } = useAdmin();
  const [pen, setPen] = useState(false);
  const [at, setAt] = useState('');                    // manual minute, e.g. "45+2"
  const [otherName, setOtherName] = useState('');
  const [busy, setBusy] = useState(false);             // stops a double tap adding two goals
  // undefined = not substituting; null = picking who comes on (bench); a player = picking who they replace (field)
  const [subIn, setSubIn] = useState<Player | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  const limits = matchFormat(m, data.tournaments.find(x => x.id === m.tournament_id));
  const mine = lineup(data, m.id, team?.id);
  const theirs = lineup(data, m.id, other?.id);
  const cur = currentMinute(m);

  const addGoal = async (player: Player | null, own: boolean, name = player?.name ?? null) => {
    let minute = cur.minute, added = cur.added;
    if (at.trim()) {
      const mm = at.trim().match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?$/);
      if (!mm) return toast('Minute must look like 23 or 45+2', true);
      minute = +mm[1]; added = mm[2] ? +mm[2] : null;
    }
    setBusy(true);
    const ok = await run(() => sb.from('goals').insert({
      match_id: m.id, team_id: team!.id, player_id: player?.id ?? null, player_name: name,
      minute, added_minute: added, own_goal: own, penalty: pen && !own,
    }).then(check), `⚽ ${team?.name}: ${name ?? 'Own goal'}${own ? ' (OG)' : ''} ${minuteLabel({ minute, added_minute: added })}`);
    setBusy(false);
    if (ok) { setPen(false); setAt(''); setOtherName(''); }
  };

  const substitute = async (off: Player, on: Player) => {
    const ok = await run(() => sb.from('match_players').upsert([
      { match_id: m.id, player_id: off.id, team_id: team!.id, on_field: false },
      { match_id: m.id, player_id: on.id, team_id: team!.id, on_field: true },
    ]).then(check), `⇄ ${shirt(on)} on, ${shirt(off)} off`);
    if (ok) setSubIn(undefined);
  };

  const startSub = () => {
    if (!mine.isSet) return toast('Set the lineup first: who starts and who is on the bench.', true);
    if (!mine.bench.length) return toast('Nobody is on the bench. Add substitutes with Edit lineup.', true);
    setSubIn(null);
  };

  const editLineup = () => {
    if (m.period > 0 && m.status !== 'finished' && mine.isSet &&
      !confirm('The match has started. Use Substitution to bring a player on.\n\nOpen the lineup anyway? (You can change the bench; the players on the field stay locked.)')) return;
    setEditing(true);
  };

  return (
    <div className="panel team-panel">
      <div className="tp-head">
        <h2><TeamChip team={team} /></h2>
        <span className="muted">{mine.isSet
          ? `On field ${mine.field.length}/${limits.onField} · Bench ${mine.bench.length}/${limits.bench}`
          : `${limits.onField}-a-side · lineup not set`}</span>
      </div>

      {editing ? <LineupEditor match={m} team={team!} limits={limits} onDone={() => setEditing(false)} />

      : subIn !== undefined ? <div className="sub-box">
        <div className="sub-steps">
          <span className={subIn ? 'done' : 'now'}>1 · Coming ON{subIn && <>: <b>{shirt(subIn)}</b></>}</span>
          <span className={subIn ? 'now' : ''}>2 · Going OFF</span>
        </div>
        <div className="tp-label">{subIn
          ? <>⬇ Who does <b>{shirt(subIn)}</b> replace? Tap a player on the field.</>
          : <>⬆ Who comes on? Tap a substitute from the bench.</>}</div>
        <div className="jerseys">
          {(subIn ? mine.field : mine.bench).map(p =>
            <Jersey key={p.id} player={p} className={subIn ? 'sub-off' : 'sub-on'} onClick={() => subIn ? substitute(p, subIn) : setSubIn(p)} />)}
        </div>
        <div className="btn-group">
          {subIn && <button className="secondary small" onClick={() => setSubIn(null)}>← Pick another substitute</button>}
          <button className="secondary small" onClick={() => setSubIn(undefined)}>Cancel</button>
        </div>
      </div>

      : <>
        <div className="tp-label">Tap the scorer · goal for {team?.name}</div>
        <div className="tp-tools">
          <button type="button" className={`small ${pen ? 'warn' : 'secondary'}`} onClick={() => setPen(!pen)}>
            {pen ? '● Penalty: next goal' : 'Penalty'}</button>
          <input className="tp-minute" value={at} onChange={e => setAt(e.target.value)} aria-label="Goal minute"
            placeholder={`Minute: auto ${minuteLabel({ minute: cur.minute, added_minute: cur.added })}`} />
          <span className="spacer" />
          <button type="button" className="small warn" onClick={startSub}>⇄ Substitution</button>
        </div>
        <div className="jerseys">
          {mine.field.map(p => <Jersey key={p.id} player={p} className={pen ? 'pen' : ''} disabled={busy} onClick={() => addGoal(p, false)} />)}
          {!mine.field.length && <div className="empty">No players yet. Add the squad in <Link to="/admin/teams">Teams &amp; squads</Link>, or type the name below.</div>}
        </div>
        <form className="row tp-other" onSubmit={e => { e.preventDefault(); if (otherName.trim()) addGoal(null, false, otherName.trim()); }}>
          <div><input value={otherName} onChange={e => setOtherName(e.target.value)} placeholder="Scorer not listed? Type the name" /></div>
          <div className="shrink"><button className="secondary" disabled={!otherName.trim() || busy}>Add goal</button></div>
        </form>

        <div className="og-box">
          <div className="tp-label">Own goal by a {other?.name} player <span className="muted">· counts for {team?.name}</span></div>
          <div className="jerseys">
            {theirs.field.map(p => <Jersey key={p.id} player={p} className="og" disabled={busy} onClick={() => addGoal(p, true)} />)}
            <button type="button" className="jbtn og" disabled={busy} onClick={() => addGoal(null, true)}><b>?</b><small>Unknown</small></button>
          </div>
        </div>

        <div className="tp-foot">
          {mine.isSet && <>
            <span className="muted">Bench:</span>
            {mine.bench.length ? mine.bench.map(p => <span key={p.id} className="jersey bench" title={p.name}>{shirtOf(p).number ?? initials(p.name)}</span>)
              : <span className="muted">none</span>}
          </>}
          <span className="spacer" />
          <button className="secondary" onClick={editLineup}>{mine.isSet ? 'Edit lineup' : 'Set lineup'}</button>
        </div>
        {!mine.isSet && mine.squad.length > limits.onField &&
          <div className="muted tp-hint">Set the lineup to show only the {limits.onField} players on the field and to make substitutions.</div>}
      </>}
    </div>
  );
}

// Letters only, so "Bruno Fernandes - 8" doesn't become "BF-".
const initials = (name: string) => name.split(/\s+/).filter(w => /^\p{L}/u.test(w)).map(w => w[0]).join('').slice(0, 3).toUpperCase();
const shirt = (p: Player) => { const s = shirtOf(p); return s.number != null ? `#${s.number} ${s.name}` : s.name; };

function Jersey({ player: p, className = '', disabled, onClick }: { player: Player; className?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`jbtn ${className}`} disabled={disabled} onClick={onClick} title={p.name}>
      <b>{shirtOf(p).number ?? initials(p.name)}</b><small>{shirtOf(p).name}</small>
    </button>
  );
}

/** Pick who starts on the field and who is on the bench for this match. */
function LineupEditor({ match: m, team, limits, onDone }: {
  match: Match; team: Team; limits: { onField: number; bench: number }; onDone: () => void;
}) {
  const { data, run, toast } = useAdmin();
  const lu = lineup(data, m.id, team.id);
  // Once the match is on, players only come on through a substitution; unlocking is for fixing mistakes.
  const started = m.period > 0 && m.status !== 'finished' && lu.isSet;
  const [unlocked, setUnlocked] = useState(false);
  const locked = started && !unlocked;
  const count = (s: LineupStatus) => lu.squad.filter(p => lu.status(p) === s).length;
  const nField = count('field'), nBench = count('bench');

  const set = (p: Player, to: LineupStatus) => {
    if (to === lu.status(p)) return;
    if (locked && (to === 'field' || lu.status(p) === 'field'))
      return toast('The match has started. Use Substitution to change who is on the field.', true);
    if (to === 'field' && nField >= limits.onField) return toast(`Already ${limits.onField} on the field. Move someone to the bench first.`, true);
    if (to === 'bench' && nBench >= limits.bench) return toast(`The bench is full (${limits.bench}).`, true);
    run(() => (to === null
      ? sb.from('match_players').delete().eq('match_id', m.id).eq('player_id', p.id)
      : sb.from('match_players').upsert({ match_id: m.id, player_id: p.id, team_id: team.id, on_field: to === 'field' })).then(check));
  };

  const replace = (rows: { player_id: string; on_field: boolean }[], msg: string) => run(async () => {
    await sb.from('match_players').delete().eq('match_id', m.id).eq('team_id', team.id).then(check);
    if (rows.length) await sb.from('match_players').insert(rows.map(r => ({ ...r, match_id: m.id, team_id: team.id }))).then(check);
  }, msg);

  const fill = () => replace(lu.squad.slice(0, limits.onField + limits.bench).map((p, i) => ({ player_id: p.id, on_field: i < limits.onField })),
    'Lineup filled. Adjust it below if needed.');

  // The team's most recent other match with a lineup, so it can be reused.
  const prev = data.matches
    .filter(x => x.id !== m.id && data.lineups.some(l => l.match_id === x.id && l.team_id === team.id))
    .sort((a, b) => (b.scheduled_at ?? b.created_at).localeCompare(a.scheduled_at ?? a.created_at))[0];
  const copy = () => replace(data.lineups
    .filter(l => l.match_id === prev!.id && l.team_id === team.id && lu.squad.some(p => p.id === l.player_id))
    .map(l => ({ player_id: l.player_id, on_field: l.on_field })), 'Lineup copied');
  const opponent = prev && data.teams.find(x => x.id === (prev.home_team_id === team.id ? prev.away_team_id : prev.home_team_id));

  return (
    <div className="lineup-edit">
      <div className="tp-label">
        Lineup · <span className={nField === limits.onField ? 'ok' : ''}>On field {nField}/{limits.onField}</span> · Bench {nBench}/{limits.bench}
      </div>
      {started && <div className="lock-note">
        {locked ? <>🔒 Match in progress: players on the field are locked. Use <b>Substitution</b> to bring someone on.</>
          : <>🔓 Unlocked. Changes here are not recorded as substitutions.</>}
        <label className="check"><input type="checkbox" checked={unlocked} onChange={e => setUnlocked(e.target.checked)} /> Unlock to fix a mistake</label>
      </div>}
      {!locked && <div className="btn-group" style={{ marginTop: 0, marginBottom: 8 }}>
        <button className="small secondary" onClick={fill}>Quick fill (first {limits.onField} on field)</button>
        {prev && <button className="small secondary" onClick={copy}>Copy from match vs {opponent?.name}</button>}
        {lu.isSet && <button className="small danger" onClick={() => confirm('Clear this lineup?') && replace([], 'Lineup cleared')}>Clear</button>}
      </div>}
      {lu.squad.map(p => (
        <div className="list-item" key={p.id}>
          <span className={`jersey ${p.jersey_number == null ? 'none' : ''}`}>{p.jersey_number ?? '–'}</span>
          <span className="grow">{p.name}</span>
          <div className="seg">
            {([['field', 'Field'], ['bench', 'Bench'], [null, 'Out']] as const).map(([s, label]) =>
              <button key={label} className={lu.status(p) === s ? `on seg-${label.toLowerCase()}` : ''}
                disabled={locked && (s === 'field' || lu.status(p) === 'field') && lu.status(p) !== s} onClick={() => set(p, s)}>{label}</button>)}
          </div>
        </div>
      ))}
      {!lu.squad.length && <div className="empty">No players yet. Add them in <Link to="/admin/teams">Teams &amp; squads</Link>.</div>}
      <button className="go" style={{ width: '100%', marginTop: 10 }} onClick={onDone}>Done</button>
    </div>
  );
}

function Penalties({ match: m }: { match: Match }) {
  const { run } = useAdmin();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e);
    run(() => sb.from('matches').update({ pens_home: +v.home, pens_away: +v.away }).eq('id', m.id).then(check), 'Penalty score saved');
  };
  return (
    <form className="panel" onSubmit={submit} key={`${m.pens_home}-${m.pens_away}`}>
      <h2>Penalty shoot-out</h2>
      <div className="row" style={{ maxWidth: 480 }}>
        <div><label>Home penalties</label><input name="home" type="number" min="0" required defaultValue={m.pens_home ?? 0} /></div>
        <div><label>Away penalties</label><input name="away" type="number" min="0" required defaultValue={m.pens_away ?? 0} /></div>
        <div className="shrink"><button className="go">Save</button></div>
        {m.pens_home != null && <div className="shrink"><button type="button" className="secondary"
          onClick={() => run(() => sb.from('matches').update({ pens_home: null, pens_away: null }).eq('id', m.id).then(check))}>Clear</button></div>}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Shown on the scoreboard and decides the winner. Update it after each kick if you like, then press Full time.</p>
    </form>
  );
}
