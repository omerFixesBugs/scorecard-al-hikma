import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { check, sb } from '../../lib/supabase';
import { score } from '../../lib/league';
import { TeamChip } from '../../components/Crest';
import { matchLabel, when } from '../../components/MatchRow';
import { formValues, toLocalInput, useAdmin } from './AdminLayout';

const STAGES = ['Group stage', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third place', 'Final', 'Friendly'];

export default function Matches() {
  const { data, tournament: t, run, toast } = useAdmin();
  const nav = useNavigate();
  const [editId, setEditId] = useState<string | null>(null);
  if (!t) return <div className="panel empty">Create a tournament first in <Link to="/admin/tournaments">Tournaments</Link>.</div>;

  const em = data.matches.find(m => m.id === editId);
  const entries = data.tournamentTeams.filter(e => e.tournament_id === t.id);
  const teams = data.teams.filter(x => entries.some(e => e.team_id === x.id));
  const groups = [...new Set(entries.map(e => e.group_name).filter(Boolean))] as string[];
  const groupOf = (id: string) => entries.find(e => e.team_id === id)?.group_name ?? null;
  const list = data.matches.filter(m => m.tournament_id === t.id).reverse();
  const team = (id: string) => data.teams.find(x => x.id === id);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e), form = e.currentTarget;
    if (v.home_team_id === v.away_team_id) return toast('Pick two different teams', true);
    const knockout = !!v.is_knockout;
    const group = knockout ? null
      : v.group_name === 'auto' ? (groupOf(v.home_team_id) === groupOf(v.away_team_id) ? groupOf(v.home_team_id) : null)
      : v.group_name || null;
    const row: Record<string, unknown> = {
      tournament_id: t.id,
      home_team_id: v.home_team_id, away_team_id: v.away_team_id,
      scheduled_at: v.scheduled_at ? new Date(v.scheduled_at).toISOString() : null,
      stage: v.stage.trim() || (group ? `Group ${group}` : null),
      group_name: group, is_knockout: knockout, venue: v.venue.trim() || null,
      half_length: +v.half_length, extra_half_length: +v.extra_half_length,
      counts_for_table: !knockout && !!v.counts_for_table,
      // Empty = use the tournament's setting.
      players_on_field: v.players_on_field ? +v.players_on_field : null,
      bench_size: v.bench_size ? +v.bench_size : null,
    };
    if (!em && v.auto_start) {
      if (!row.scheduled_at) return toast('Set a kick-off time to auto start', true);
      Object.assign(row, { status: 'live', period: 1, elapsed_seconds: 0, running_since: row.scheduled_at });
    }
    const ok = await run(() => (em
      ? sb.from('matches').update(row).eq('id', em.id)
      : sb.from('matches').insert(row)).then(check), em ? 'Match saved' : 'Match created');
    if (ok) { setEditId(null); if (!em) form.reset(); }
  };

  const feature = (id: string) => run(() => sb.from('app_state').update({ featured_match_id: id }).eq('id', 1).then(check), 'Now on the scoreboard');
  const control = (id: string) => { localStorage.setItem('admin.match', id); nav('/admin'); };

  return (
    <>
      <form className="panel" onSubmit={save} key={editId ?? 'new'}>
        <h2>{em ? 'Edit match' : `New match · ${t.name} ${t.year ?? ''}`}</h2>
        {teams.length < 2 ? <div className="empty">Add at least two teams to this tournament first (<Link to="/admin/tournaments">Tournaments</Link>).</div> : <>
          <div className="row field">
            <div><label>Home team</label><select name="home_team_id" required defaultValue={em?.home_team_id ?? ''}>
              <option value="">Select team…</option>{teams.map(x => <option key={x.id} value={x.id}>{x.name}{groupOf(x.id) ? ` (Group ${groupOf(x.id)})` : ''}</option>)}</select></div>
            <div><label>Away team</label><select name="away_team_id" required defaultValue={em?.away_team_id ?? ''}>
              <option value="">Select team…</option>{teams.map(x => <option key={x.id} value={x.id}>{x.name}{groupOf(x.id) ? ` (Group ${groupOf(x.id)})` : ''}</option>)}</select></div>
          </div>
          <div className="row field">
            <div><label>Kick-off date &amp; time</label><input type="datetime-local" name="scheduled_at" defaultValue={toLocalInput(em?.scheduled_at)} /></div>
            <div><label>Venue (optional)</label><input name="venue" defaultValue={em?.venue ?? ''} /></div>
          </div>
          <div className="row field">
            <div><label>Stage / round</label><input name="stage" list="stages" placeholder="auto: Group A" defaultValue={em?.stage ?? ''} />
              <datalist id="stages">{STAGES.map(s => <option key={s} value={s} />)}</datalist></div>
            <div><label>Group</label><select name="group_name" defaultValue={em ? em.group_name ?? '' : 'auto'}>
              <option value="auto">Auto (from the teams' group)</option><option value="">No group</option>
              {groups.map(g => <option key={g} value={g}>Group {g}</option>)}</select></div>
          </div>
          <div className="row field">
            <div><label>Minutes per half</label><input type="number" name="half_length" min="1" max="60" defaultValue={em?.half_length ?? 45} required /></div>
            <div><label>Minutes per extra-time half</label><input type="number" name="extra_half_length" min="1" max="30" defaultValue={em?.extra_half_length ?? 15} required /></div>
          </div>
          <div className="row field">
            <div><label>Players on the field (empty = tournament: {t.players_on_field ?? 11})</label>
              <input type="number" name="players_on_field" min="1" max="11" placeholder={String(t.players_on_field ?? 11)} defaultValue={em?.players_on_field ?? ''} /></div>
            <div><label>Substitutes on the bench (empty = tournament: {t.bench_size ?? 5})</label>
              <input type="number" name="bench_size" min="0" max="20" placeholder={String(t.bench_size ?? 5)} defaultValue={em?.bench_size ?? ''} /></div>
          </div>
          <div className="row field">
            <label className="check"><input type="checkbox" name="is_knockout" defaultChecked={em?.is_knockout} /> Knockout match (extra time / penalties, not in table)</label>
            <label className="check"><input type="checkbox" name="counts_for_table" defaultChecked={em ? em.counts_for_table : true} /> Counts for standings</label>
            {!em && <label className="check"><input type="checkbox" name="auto_start" /> Start the clock automatically at kick-off time</label>}
          </div>
          <button className="go">{em ? 'Save changes' : 'Create match'}</button>{' '}
          {em && <button type="button" className="secondary" onClick={() => setEditId(null)}>Cancel</button>}
        </>}
      </form>

      <div className="panel wrap-x">
        <h2>Matches ({list.length})</h2>
        {list.length ? <table><thead>
          <tr><th>Kick-off</th><th>Match</th><th className="num">Score</th><th>Status</th><th /></tr></thead><tbody>
          {list.map(m => {
            const s = score(m, data.goals);
            return (
              <tr key={m.id}>
                <td>{when(m.scheduled_at)}<div className="muted" style={{ fontSize: 12 }}>{matchLabel(m)}{m.is_knockout && ' · KO'}</div></td>
                <td><TeamChip team={team(m.home_team_id)} /> <span className="muted">vs</span> <TeamChip team={team(m.away_team_id)} /></td>
                <td className="num"><b>{m.period > 0 ? `${s.home} – ${s.away}` : '–'}</b>
                  {m.pens_home != null && <div className="muted" style={{ fontSize: 12 }}>pens {m.pens_home}–{m.pens_away}</div>}</td>
                <td><span className={`pill ${m.status}`}>{m.status}</span> {m.id === data.featuredId && <span className="pill featured">on board</span>}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="small" onClick={() => control(m.id)}>Control</button>{' '}
                  {m.id !== data.featuredId && <><button className="small warn" onClick={() => feature(m.id)}>Show</button>{' '}</>}
                  <button className="small secondary" onClick={() => { setEditId(m.id); scrollTo(0, 0); }}>Edit</button>{' '}
                  <button className="small danger" onClick={() => confirm('Delete this match and its goals?') &&
                    run(() => sb.from('matches').delete().eq('id', m.id).then(check), 'Match deleted')}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody></table> : <div className="empty">No matches yet.</div>}
      </div>
    </>
  );
}
