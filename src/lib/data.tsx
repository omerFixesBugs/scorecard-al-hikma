import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { isConfigured, loadAll, subscribeAll, syncServerTime } from './supabase';
import { demoData } from './demo';
import type { AppData, Tournament } from './types';

interface DataState {
  data: AppData | null;
  error: string | null;
  reload: () => Promise<void>;
  demo: boolean;
}

const Ctx = createContext<DataState>({ data: null, error: null, reload: async () => {}, demo: false });

const isDemo = () => new URLSearchParams(location.search).has('demo');

/** Loads every table once and keeps it fresh via Supabase Realtime (school-tournament sized data). */
export function DataProvider({ children }: { children: ReactNode }) {
  const demo = isDemo();
  const [data, setData] = useState<AppData | null>(demo ? demoData() : null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (demo || !isConfigured) return;
    try {
      setData(await loadAll());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    if (!isConfigured) { setError('not-configured'); return; }
    syncServerTime().then(reload);
    const unsub = subscribeAll(reload);
    const poll = setInterval(reload, 30000);            // safety net if realtime drops
    const resync = setInterval(syncServerTime, 300000);
    return () => { unsub(); clearInterval(poll); clearInterval(resync); };
  }, [demo, reload]);

  return <Ctx.Provider value={{ data, error, reload, demo }}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);

/** Re-renders the caller every `ms` milliseconds (for running clocks). */
export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set(n => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function activeTournament(data: AppData): Tournament | undefined {
  return data.tournaments.find(t => t.is_active) ?? data.tournaments[0];
}

export function lookup(data: AppData) {
  return {
    team: (id: string | null | undefined) => data.teams.find(t => t.id === id),
    match: (id: string | null | undefined) => data.matches.find(m => m.id === id),
    tournament: (id: string | null | undefined) => data.tournaments.find(t => t.id === id),
  };
}
