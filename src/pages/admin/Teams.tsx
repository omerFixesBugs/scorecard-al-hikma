import { useState, type FormEvent } from 'react';
import { check, sb } from '../../lib/supabase';
import { TeamChip } from '../../components/Crest';
import { splitJersey } from '../../lib/lineup';
import { formValues, useAdmin } from './AdminLayout';

export default function Teams() {
  const { data, run, toast } = useAdmin();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [editPlayerId, setEditPlayerId] = useState<string | null>(null);

  const sel = data.teams.find(t => t.id === teamId) ?? data.teams[0];
  const et = data.teams.find(t => t.id === editTeamId);
  const squad = data.players.filter(p => p.team_id === sel?.id);
  const ep = data.players.find(p => p.id === editPlayerId);

  const saveTeam = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e), form = e.currentTarget;
    const row = { name: v.name.trim(), full_name: v.full_name.trim() || null, logo_url: v.logo_url.trim() || null, color: v.color };
    const ok = await run(async () => {
      if (et) await sb.from('teams').update(row).eq('id', et.id).then(check);
      else setTeamId(check(await sb.from('teams').insert(row).select().single()).id);
    }, et ? 'Team saved' : 'Team added');
    if (ok) { setEditTeamId(null); form.reset(); }
  };

  const deleteTeam = (id: string) => {
    if (data.matches.some(m => m.home_team_id === id || m.away_team_id === id))
      return toast('This team has matches. Delete those matches first.', true);
    if (confirm('Delete this team and its squad?')) run(() => sb.from('teams').delete().eq('id', id).then(check), 'Team deleted');
  };

  const savePlayer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e), form = e.currentTarget;
    const row = { name: v.name.trim(), jersey_number: v.jersey_number === '' ? null : +v.jersey_number };
    const ok = await run(() => (ep
      ? sb.from('players').update(row).eq('id', ep.id)
      : sb.from('players').insert({ ...row, team_id: sel!.id })).then(check));
    if (ok) { setEditPlayerId(null); form.reset(); (form.elements.namedItem('name') as HTMLInputElement).focus(); }
  };

  const bulk = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const rows = formValues(e).lines.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const s = splitJersey(l);
      return { team_id: sel!.id, name: s.name, jersey_number: s.number };
    });
    if (rows.length && await run(() => sb.from('players').insert(rows).then(check), `${rows.length} players added`)) form.reset();
  };

  // Players saved as "Bruno Fernandes - 8" with an empty jersey box: move the number into the jersey box.
  const fixable = squad.filter(p => p.jersey_number == null && splitJersey(p.name).number != null);
  const fixNumbers = () => run(() => Promise.all(fixable.map(p => {
    const s = splitJersey(p.name);
    return sb.from('players').update({ name: s.name, jersey_number: s.number }).eq('id', p.id).then(check);
  })), `${fixable.length} jersey numbers fixed`);

  return (
    <div className="grid2">
      <div>
        <form className="panel" onSubmit={saveTeam} key={editTeamId ?? 'new'}>
          <h2>{et ? 'Edit team' : 'Add team'}</h2>
          <div className="field"><label>Short name (shown big)</label><input name="name" required placeholder="e.g. CADT" defaultValue={et?.name} /></div>
          <div className="field"><label>Full name / subtitle</label><input name="full_name" placeholder="e.g. International School" defaultValue={et?.full_name ?? ''} /></div>
          <div className="row field">
            <div><label>Logo image URL (optional)</label><input name="logo_url" placeholder="https://…/logo.png" defaultValue={et?.logo_url ?? ''} /></div>
            <div className="shrink"><label>Colour</label><input type="color" name="color" defaultValue={et?.color || '#0b2a5b'} style={{ width: 56, height: 38, padding: 2 }} /></div>
          </div>
          <button className="go">{et ? 'Save team' : 'Add team'}</button>{' '}
          {et && <button type="button" className="secondary" onClick={() => setEditTeamId(null)}>Cancel</button>}
        </form>

        <div className="panel">
          <h2>All teams ({data.teams.length})</h2>
          <p className="muted" style={{ marginTop: -6, fontSize: 13 }}>Teams are shared by all tournaments. Pick which ones play under <b>Tournaments</b>.</p>
          {data.teams.length ? data.teams.map(t => (
            <div className="list-item" key={t.id} style={t.id === sel?.id ? { background: '#fff7ed', margin: '0 -8px', padding: 8 } : undefined}>
              <div className="grow"><TeamChip team={t} /> <span className="muted" style={{ fontSize: 13 }}>{t.full_name}</span>
                <div className="muted" style={{ fontSize: 12 }}>{data.players.filter(p => p.team_id === t.id).length} players</div></div>
              <button className="small" onClick={() => { setTeamId(t.id); setEditPlayerId(null); }}>Squad</button>
              <button className="small secondary" onClick={() => { setEditTeamId(t.id); scrollTo(0, 0); }}>Edit</button>
              <button className="small danger" onClick={() => deleteTeam(t.id)}>Delete</button>
            </div>
          )) : <div className="empty">No teams yet.</div>}
        </div>
      </div>

      <div>
        {sel ? <>
          <div className="panel">
            <h2><TeamChip team={sel} /> squad</h2>
            <form onSubmit={savePlayer} className="row field" key={editPlayerId ?? 'new'}>
              <div style={{ flex: 3 }}><label>{ep ? 'Edit player' : 'Player name'}</label><input name="name" required defaultValue={ep?.name} /></div>
              <div><label>Jersey # (optional)</label><input name="jersey_number" type="number" min="0" max="999" defaultValue={ep?.jersey_number ?? ''} /></div>
              <div className="shrink"><button className="go">{ep ? 'Save' : 'Add'}</button></div>
              {ep && <div className="shrink"><button type="button" className="secondary" onClick={() => setEditPlayerId(null)}>Cancel</button></div>}
            </form>
            {fixable.length > 0 && (
              <div className="list-item" style={{ background: '#fff7ed', margin: '0 -8px 8px', padding: 8, borderRadius: 6 }}>
                <span className="grow" style={{ fontSize: 13 }}>{fixable.length} players have their number inside the name (e.g. “{fixable[0].name}”).</span>
                <button className="small warn" onClick={fixNumbers}>Move numbers to Jersey #</button>
              </div>
            )}
            {squad.length ? squad.map(p => (
              <div className="list-item" key={p.id}>
                <span className={`jersey ${p.jersey_number == null ? 'none' : ''}`}>{p.jersey_number ?? '–'}</span>
                <span className="grow">{p.name}</span>
                <button className="small secondary" onClick={() => setEditPlayerId(p.id)}>Edit</button>
                <button className="small danger" onClick={() => confirm('Remove this player?') && run(() => sb.from('players').delete().eq('id', p.id).then(check))}>Remove</button>
              </div>
            )) : <div className="empty">No players yet.</div>}
          </div>
          <form className="panel" onSubmit={bulk}>
            <h3>Paste a whole squad</h3>
            <div className="field"><label>One player per line. Optional jersey number first, e.g. “10 Samiul Haque”.</label>
              <textarea name="lines" rows={7} placeholder={'1 Goalkeeper Name\n7 Tahmid Rahman\nSamiul Haque'} /></div>
            <button>Add all</button>
          </form>
        </> : <div className="panel empty">Add a team to manage its squad.</div>}
      </div>
    </div>
  );
}
