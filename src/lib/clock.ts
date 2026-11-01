import { now } from './supabase';
import type { Goal, Match } from './types';

// Match clock in seconds. Periods: 1 = 1st half, 2 = 2nd half, 3 = ET 1st, 4 = ET 2nd.
type ClockFields = Pick<Match, 'half_length' | 'extra_half_length'>;

export function periodStart(m: ClockFields, p: number) {
  const h = m.half_length * 60, e = m.extra_half_length * 60;
  return [0, 0, h, 2 * h, 2 * h + e][p] ?? 0;
}

export function periodEnd(m: ClockFields, p: number) {
  const h = m.half_length * 60, e = m.extra_half_length * 60;
  return [0, h, 2 * h, 2 * h + e, 2 * h + 2 * e][p] ?? 0;
}

/** Seconds until kick-off when the clock is set to start in the future, else 0. */
export function countdown(m: Match) {
  if (!m.running_since) return 0;
  return Math.max(0, Math.ceil((new Date(m.running_since).getTime() - now()) / 1000));
}

export function clockSeconds(m: Match) {
  let s = m.elapsed_seconds;
  if (m.running_since) s += Math.max(0, Math.floor((now() - new Date(m.running_since).getTime()) / 1000));
  return s;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const fmt = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

/** What the big clock should show: main time plus optional stoppage-time counter. */
export function clockView(m: Match): { main: string; stoppage: string | null } {
  if (m.period === 0) return { main: '00:00', stoppage: null };
  const s = clockSeconds(m), end = periodEnd(m, m.period);
  if (m.status === 'break' || m.status === 'finished') return { main: fmt(Math.min(s, end)), stoppage: null };
  if (s > end) return { main: fmt(end), stoppage: '+' + fmt(s - end) };
  return { main: fmt(s), stoppage: null };
}

/** Goal minute in football notation: 0:30 -> 1', 45:00 + 1:10 -> 45+2'. */
export function currentMinute(m: Match): { minute: number; added: number | null } {
  if (m.period === 0 || countdown(m) > 0) return { minute: 1, added: null };
  const s = clockSeconds(m), end = periodEnd(m, m.period);
  if (s > end) return { minute: end / 60, added: Math.ceil((s - end) / 60) };
  return { minute: Math.max(1, Math.floor(s / 60) + 1), added: null };
}

export const minuteLabel = (g: Pick<Goal, 'minute' | 'added_minute'>) =>
  g.added_minute ? `${g.minute}+${g.added_minute}'` : `${g.minute}'`;

const PERIOD = ['', 'FIRST HALF', 'SECOND HALF', 'EXTRA TIME · 1ST', 'EXTRA TIME · 2ND'];
const BREAK = ['', 'HALF TIME', 'END OF 2ND HALF', 'ET HALF TIME', 'END OF EXTRA TIME'];
export const PERIOD_SHORT = ['', '1st half', '2nd half', 'ET 1st half', 'ET 2nd half'];

export function periodLabel(m: Match) {
  if (m.status === 'finished') {
    if (m.pens_home != null && m.pens_away != null) return 'FULL TIME · PENS';
    return m.period > 2 ? 'FULL TIME · AET' : 'FULL TIME';
  }
  if (m.status === 'scheduled' || m.period === 0) return 'KICK-OFF';
  if (countdown(m) > 0) return 'KICK-OFF IN';
  if (m.status === 'break') return m.pens_home != null ? 'PENALTIES' : BREAK[m.period];
  return m.status === 'paused' ? `${PERIOD[m.period]} · PAUSED` : PERIOD[m.period];
}

export const isLive = (m: Match) => m.period > 0 && m.status !== 'finished';
