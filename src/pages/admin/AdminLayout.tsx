import { createContext, useCallback, useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, sb } from '../../lib/supabase';
import { activeTournament, useData } from '../../lib/data';
import type { AppData, Tournament } from '../../lib/types';

interface AdminCtx {
  data: AppData;
  tournament: Tournament | undefined;
  setTournamentId: (id: string) => void;
  /** Runs a write, shows a toast, then reloads data. */
  run: (fn: () => PromiseLike<unknown>, okMsg?: string) => Promise<boolean>;
  toast: (msg: string, error?: boolean) => void;
}

const Ctx = createContext<AdminCtx | null>(null);
export const useAdmin = () => useContext(Ctx)!;

export default function AdminLayout() {
  const { data, reload, error } = useData();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [toasts, setToasts] = useState<{ id: number; msg: string; error: boolean }[]>([]);
  const [tid, setTid] = useState<string | null>(() => localStorage.getItem('admin.tournament'));

  useEffect(() => {
    if (!isConfigured) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const toast = useCallback((msg: string, isError = false) => {
    const id = Math.random();
    setToasts(t => [...t, { id, msg, error: isError }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), isError ? 5000 : 2200);
  }, []);

  const run = useCallback(async (fn: () => PromiseLike<unknown>, okMsg?: string) => {
    try {
      await fn();
      if (okMsg) toast(okMsg);
      await reload();
      return true;
    } catch (e) {
      console.error(e);
      toast((e as Error).message || String(e), true);
      return false;
    }
  }, [reload, toast]);

  const setTournamentId = (id: string) => { setTid(id); localStorage.setItem('admin.tournament', id); };

  if (!isConfigured) return <Shell><div className="panel">Supabase is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code>, fill it in and restart (see README.md).</div></Shell>;
  if (session === undefined) return <Shell><div className="panel empty">Loading…</div></Shell>;
  if (!session) return <Shell><Login /></Shell>;
  if (error) return <Shell><div className="panel">Could not load data: {error}</div></Shell>;
  if (!data) return <Shell><div className="panel empty">Loading…</div></Shell>;

  const tournament = data.tournaments.find(t => t.id === tid) ?? activeTournament(data);

  return (
    <Ctx.Provider value={{ data, tournament, setTournamentId, run, toast }}>
      <div className="topbar">
        <h1>Admin</h1>
        <nav>
          <NavLink to="/admin" end>Match control</NavLink>
          <NavLink to="/admin/matches">Matches</NavLink>
          <NavLink to="/admin/tournaments">Tournaments</NavLink>
          <NavLink to="/admin/teams">Teams &amp; squads</NavLink>
          <Link to="/scoreboard" target="_blank">Scoreboard ↗</Link>
          <Link to="/" target="_blank">Public site ↗</Link>
        </nav>
        <span className="spacer" />
        {data.tournaments.length > 0 && (
          <select value={tournament?.id} onChange={e => setTournamentId(e.target.value)} style={{ width: 'auto' }} aria-label="Working tournament">
            {data.tournaments.map(t => <option key={t.id} value={t.id}>{t.name} {t.year}{t.is_active ? ' (active)' : ''}</option>)}
          </select>
        )}
        <span className="who">{session.user.email}</span>
        <button className="small secondary" onClick={() => sb.auth.signOut()}>Log out</button>
      </div>
      <main><Outlet /></main>
      {toasts.map((t, i) => <div key={t.id} className={`toast ${t.error ? 'error' : ''}`} style={{ bottom: 20 + i * 50 }}>{t.msg}</div>)}
    </Ctx.Provider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <><div className="topbar"><h1>Admin</h1><span className="spacer" /><Link to="/" style={{ color: '#fff' }}>Public site</Link></div><main>{children}</main></>;
}

function Login() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) });
    setBusy(false);
    if (error) setMsg(error.message);
  };
  return (
    <form className="panel login" onSubmit={submit}>
      <h2>Admin login</h2>
      <div className="field"><label>Email</label><input name="email" type="email" required autoComplete="username" /></div>
      <div className="field"><label>Password</label><input name="password" type="password" required autoComplete="current-password" /></div>
      <button className="go" style={{ width: '100%' }} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      {msg && <p style={{ color: 'var(--red)' }}>{msg}</p>}
    </form>
  );
}

/** Small helper for FormData → plain object of strings. */
export const formValues = (e: FormEvent<HTMLFormElement>) =>
  Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)])) as Record<string, string>;

export const toLocalInput = (s: string | null | undefined) => {
  if (!s) return '';
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
