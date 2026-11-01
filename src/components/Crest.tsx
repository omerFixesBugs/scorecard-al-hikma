import type { Team } from '../lib/types';

/** Team logo, or a generated shield with the team's initials when no logo is set. */
export function Crest({ team, className = 'crest' }: { team: Team | undefined; className?: string }) {
  if (!team) return <div className={className} />;
  if (team.logo_url) return <img className={className} src={team.logo_url} alt={team.name} />;
  const initials = team.name.replace(/\(.*?\)/g, '').trim().slice(0, 4).toUpperCase();
  return (
    <svg className={className} viewBox="0 0 100 116" role="img" aria-label={team.name}>
      <path d="M50 3 L95 18 V58 C95 86 74 104 50 113 C26 104 5 86 5 58 V18 Z" fill={team.color || '#0b2a5b'} stroke="#c9a23a" strokeWidth="5" />
      <path d="M50 14 L85 26 V58 C85 80 69 95 50 102 C31 95 15 80 15 58 V26 Z" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
      <text x="50" y="66" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700"
        fontSize={initials.length > 3 ? 22 : 28} fill="#fff">{initials}</text>
    </svg>
  );
}

export function TeamChip({ team, className = '' }: { team: Team | undefined; className?: string }) {
  return <span className={`team-chip ${className}`}><Crest team={team} />{team?.name ?? 'TBD'}</span>;
}

export function SchoolLogo({ className = 'school-logo' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 116" className={className} aria-hidden="true">
      <path d="M50 3 L95 18 V58 C95 86 74 104 50 113 C26 104 5 86 5 58 V18 Z" fill="#9b1c1f" stroke="#f08a1c" strokeWidth="5" />
      <path d="M26 50 Q38 44 50 52 Q62 44 74 50 V78 Q62 72 50 80 Q38 72 26 78 Z" fill="#fff" />
      <path d="M50 52 V80" stroke="#9b1c1f" strokeWidth="2.5" />
      <path d="M58 30 L66 22 L70 26 L62 34 Z M56 32 L54 42 L64 36 Z" fill="#fff" />
    </svg>
  );
}

export function BallIcon({ className = 'ico' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#111" strokeWidth="1.5" />
      <path d="M12 7.2l4.2 3-1.6 4.9H9.4L7.8 10.2z" fill="#111" />
      <path d="M12 1v6.2M16.2 10.2l5.9-1.9M14.6 15.1l3.6 5M9.4 15.1l-3.6 5M7.8 10.2L1.9 8.3" stroke="#111" strokeWidth="1.3" />
    </svg>
  );
}

// Classic ball: pentagons around the rim, white centre for the logo.
const pent = (cx: number, cy: number, r: number, rot: number) => Array.from({ length: 5 }, (_, i) => {
  const a = (rot + i * 72) * Math.PI / 180;
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const RIM: [number, number, number][] = [[100, 14, -90], [184, 76, -18], [152, 176, 54], [48, 176, 126], [16, 76, 198]];

export function BigBall() {
  return (
    <svg className="ballsvg" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="ballShade" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff" /><stop offset=".75" stopColor="#ececec" /><stop offset="1" stopColor="#a8a8a8" />
        </radialGradient>
        <clipPath id="ballClip"><circle cx="100" cy="100" r="96" /></clipPath>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#ballShade)" />
      <g clipPath="url(#ballClip)">
        <g stroke="#b9b9b9" strokeWidth="2" fill="none">
          {RIM.map(([x, y], i) => {
            const [nx, ny] = RIM[(i + 1) % 5];
            return <path key={i} d={`M${x} ${y} Q100 100 ${nx} ${ny}`} />;
          })}
        </g>
        <g fill="#1d1d1d">{RIM.map(([x, y, r], i) => <polygon key={i} points={pent(x, y, 30, r + 180)} />)}</g>
      </g>
      <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="2" />
    </svg>
  );
}
