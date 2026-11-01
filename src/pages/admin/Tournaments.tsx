import { useState, type FormEvent } from 'react';
import { check, sb } from '../../lib/supabase';
import { slugify } from '../../lib/league';
import { TeamChip } from '../../components/Crest';
import { formValues, useAdmin } from './AdminLayout';

export default function Tournaments() {
  const { data, tournament, setTournamentId, run, toast } = useAdmin();
  const [editId, setEditId] = useState<string | null>(null);
  const editing = data.tournaments.find(t => t.id === editId);

  const makeActive = (id: string) => run(async () => {
    // Only one tournament may be active (unique index), so clear first.
    await sb.from('tournaments').update({ is_active: false }).eq('is_active', true).then(check);
    await sb.from('tournaments').update({ is_active: true }).eq('id', id).then(check);
  }, 'Active tournament changed');

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e);
    const row = {
      name: v.name.trim(), year: v.year.trim() || null, tagline: v.tagline.trim() || null,
      slug: slugify(v.slug || `${v.name} ${v.year}`),
      points_win: +v.points_win, points_draw: +v.points_draw,
      players_on_field: +v.players_on_field, bench_size: +v.bench_size,
    };
    if (!row.slug) return toast('Please enter a name', true);
    const form = e.currentTarget;
    const ok = await run(async () => {
      if (editing) {
        await sb.from('tournaments').update(row).eq('id', editing.id).then(check);
      } else {
        const first = data.tournaments.length === 0;
        const t = check(await sb.from('tournaments').insert({ ...row, is_active: first }).select().single());
        setTournamentId(t.id);
      }
    }, editing ? 'Tournament saved' : 'Tournament created');
    if (ok) { setEditId(null); form.reset(); }
  };

  const remove = (id: string) => {
    const n = data.matches.filter(m => m.tournament_id === id).length;
    if (!confirm(`Delete this tournament${n ? ` and its ${n} matches` : ''}? This cannot be undone.`)) return;
    run(() => sb.from('tournaments').delete().eq('id', id).then(check), 'Tournament deleted');
  };

  return (
    <div className="grid2">
      <div>
        <form className="panel" onSubmit={save} key={editId ?? 'new'}>
          <h2>{editing ? 'Edit tournament' : 'New tournament'}</h2>
          <div className="row field">
            <div style={{ flex: 3 }}><label>Name</label><input name="name" required defaultValue={editing?.name ?? 'Inter-School Football Tournament'} /></div>
            <div><label>Year</label><input name="year" defaultValue={editing?.year ?? String(new Date().getFullYear())} /></div>
          </div>
          <div className="field"><label>Tagline (optional)</label><input name="tagline" placeholder="Schools united through football" defaultValue={editing?.tagline ?? ''} /></div>
          <div className="field"><label>Web address (auto if empty)</label><input name="slug" placeholder="inter-school-2026" defaultValue={editing?.slug ?? ''} /></div>
          <div className="row field">
            <div><label>Points for a win</label><input name="points_win" type="number" min="0" defaultValue={editing?.points_win ?? 3} /></div>
            <div><label>Points for a draw</label><input name="points_draw" type="number" min="0" defaultValue={editing?.points_draw ?? 1} /></div>
          </div>
          <div className="row field">
            <div><label>Players on the field (per team)</label><input name="players_on_field" type="number" min="1" max="11" required defaultValue={editing?.players_on_field ?? 11} /></div>
            <div><label>Substitutes on the bench</label><input name="bench_size" type="number" min="0" max="20" required defaultValue={editing?.bench_size ?? 5} /></div>
          </div>
          <button className="go">{editing ? 'Save' : 'Create tournament'}</button>{' '}
          {editing && <button type="button" className="secondary" onClick={() => setEditId(null)}>Cancel</button>}
        </form>

        <div className="panel">
          <h2>All tournaments</h2>
          {data.tournaments.length ? data.tournaments.map(t => (
            <div className="list-item" key={t.id} style={t.id === tournament?.id ? { background: '#fff7ed', margin: '0 -8px', padding: 8 } : undefined}>
              <div className="grow"><b>{t.name} {t.year}</b> {t.is_active && <span className="pill live">active on public site</span>}
                <div className="muted" style={{ fontSize: 12 }}>/t/{t.slug} · {data.matches.filter(m => m.tournament_id === t.id).length} matches</div></div>
              {t.id !== tournament?.id && <button className="small" onClick={() => setTournamentId(t.id)}>Work on</button>}
              {!t.is_active && <button className="small warn" onClick={() => makeActive(t.id)}>Make active</button>}
              <button className="small secondary" onClick={() => setEditId(t.id)}>Edit</button>
              <button className="small danger" onClick={() => remove(t.id)}>Delete</button>
            </div>
          )) : <div className="empty">No tournaments yet. Create one above.</div>}
        </div>
      </div>

      {tournament ? <Participants /> : <div className="panel empty">Create a tournament first.</div>}
    </div>
  );
}

/** Which teams play in the working tournament, and their groups. */
function Participants() {
  const { data, tournament, run } = useAdmin();
  const t = tournament!;
  const entries = data.tournamentTeams.filter(e => e.tournament_id === t.id);
  const entry = (teamId: string) => entries.find(e => e.team_id === teamId);

  const toggle = (teamId: string, on: boolean) => run(() => on
    ? sb.from('tournament_teams').insert({ tournament_id: t.id, team_id: teamId }).then(check)
    : sb.from('tournament_teams').delete().eq('tournament_id', t.id).eq('team_id', teamId).then(check));

  const setGroup = (teamId: string, group: string) => run(() =>
    sb.from('tournament_teams').update({ group_name: group.trim().toUpperCase() || null })
      .eq('tournament_id', t.id).eq('team_id', teamId).then(check));

  const addAll = () => run(() => sb.from('tournament_teams').insert(
    data.teams.filter(x => !entry(x.id)).map(x => ({ tournament_id: t.id, team_id: x.id }))).then(check), 'All teams added');

  return (
    <div className="panel">
      <h2>Teams in {t.name} {t.year}</h2>
      <p className="muted" style={{ marginTop: -6 }}>Tick the teams that play. For a group stage, give each team a group (A, B, …).
        Leave groups empty for a single league table.</p>
      {data.teams.length === 0 && <div className="empty">Add teams in <b>Teams &amp; squads</b> first.</div>}
      {data.teams.length > entries.length && <button className="small secondary" onClick={addAll}>Add all teams</button>}
      {data.teams.map(team => {
        const e = entry(team.id);
        return (
          <div className="list-item" key={team.id}>
            <label className="check" style={{ flex: 1 }}>
              <input type="checkbox" checked={!!e} onChange={ev => toggle(team.id, ev.target.checked)} />
              <TeamChip team={team} />
            </label>
            {e && (
              <div style={{ width: 110 }}>
                <input placeholder="Group" defaultValue={e.group_name ?? ''} key={e.group_name ?? ''}
                  onBlur={ev => ev.target.value.trim().toUpperCase() !== (e.group_name ?? '') && setGroup(team.id, ev.target.value)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
