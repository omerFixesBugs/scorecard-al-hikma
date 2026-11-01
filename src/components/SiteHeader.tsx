import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../lib/data';
import { BRAND, asset } from '../brand';
import { SchoolLogo } from './Crest';
import type { Tournament } from '../lib/types';

export function SiteHeader({ tournament }: { tournament?: Tournament }) {
  const { data, demo } = useData();
  const nav = useNavigate();
  const q = demo ? '?demo' : '';
  return (
    <div className="site-header">
      <div className="inner">
        <Link to={`/${q}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', textDecoration: 'none' }}>
          {BRAND.logoUrl ? <img src={asset(BRAND.logoUrl)} alt="" className="school-logo" /> : <SchoolLogo />}
          <span className="school"><b>{BRAND.schoolName}</b><small>{BRAND.schoolSub}</small></span>
        </Link>
        <span className="spacer" />
        {data && data.tournaments.length > 1 && (
          <select value={tournament?.slug} onChange={e => nav(`/t/${e.target.value}${q}`)} aria-label="Tournament">
            {data.tournaments.map(t => <option key={t.id} value={t.slug}>{t.name} {t.year}</option>)}
          </select>
        )}
        <Link className="btn-ghost" to={`/scoreboard${q}`}>Live scoreboard</Link>
      </div>
    </div>
  );
}

export function StatusPanel() {
  const { data, error } = useData();
  if (error === 'not-configured') return (
    <div className="panel">Supabase is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and fill it in (see README.md).
      Add <code>?demo</code> to the URL to preview with sample data.</div>
  );
  if (error) return <div className="panel">Could not load data: {error}</div>;
  if (!data) return <div className="panel empty">Loading…</div>;
  return null;
}
