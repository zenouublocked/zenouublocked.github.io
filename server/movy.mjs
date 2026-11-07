// Movy (movy.sx) deep links.
//
// Movy is the rare catalogue that takes a TMDB id straight in the path:
// `/movie/550` and `/tv/1399/2/5` both render the right title, and `?play=true`
// opens its player. That makes it addressable from metadata alone — no search
// scrape, no slug lookup — which is why it is the primary quick-launch target.
//
// It sends `X-Frame-Options: DENY`, so nothing can frame it. Every link here is
// built for a new tab.
const BASE = 'https://www.movy.sx';

export function movyUrl({ type, id, season, episode, play = true }) {
  const n = String(id || '');
  if (!/^\d+$/.test(n)) return null;
  const tv = type === 'tv';
  const s = Math.max(0, Math.min(Number(season) || 1, 100));
  const e = Math.max(0, Math.min(Number(episode) || 1, 2000));
  const path = tv ? `${BASE}/tv/${n}/${s}/${e}` : `${BASE}/movie/${n}`;
  return play ? `${path}?play=true` : path;
}

export function movyInfo({ type }) {
  return {
    id: 'movy',
    name: 'Movy',
    home: `${BASE}/`,
    frame: 'blocked',
    licensing: 'third-party',
    note:
      type === 'tv'
        ? 'TMDB id plus season and episode in the path. Opens its own player in a new tab; the site sends X-Frame-Options: DENY.'
        : 'TMDB id in the path, so the film resolves by number alone. Opens its own player in a new tab; the site sends X-Frame-Options: DENY.',
  };
}
