// School branding. Tournament name, year and tagline come from the database (admin → Tournaments).
export const BRAND = {
  schoolName: 'AL HEKMAH',
  schoolSub: 'INTERNATIONAL SCHOOL',
  // Optional: put files in /public and reference them like '/logo.png'. Empty = built-in drawing.
  logoUrl: '',
  backgroundUrl: '',
  cornerLeft: ['More', 'Than', 'a Game'],
  cornerRight: ['FAIR PLAY', 'STRONGER SCHOOLS', 'BRIGHTER GENERATIONS'],
  values: ['DISCIPLINE', 'TEAMWORK', 'RESPECT', 'COMMUNITY'],
  footerScript: ['Play', 'Respect', 'Excel'],
};

/** Resolve a /public asset against the deploy base path. */
export const asset = (p: string) => (p.startsWith('/') ? import.meta.env.BASE_URL.replace(/\/$/, '') + p : p);
