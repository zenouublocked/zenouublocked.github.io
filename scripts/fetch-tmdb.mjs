/* Build-time TMDB fetcher for Zenou Unblocked's entertainment library.
 *
 * Usage (run BEFORE locating the site, from the repo root):
 *   TMDB_API_KEY=your_v3_key (or TMDB_TOKEN=your_read_access_token) node scripts/fetch-tmdb.mjs
 *
 * Writes into data/ent/:
 *   movies.json — index-light movie rail data (no full detail anywhere client-side)
 *   tv.json     — same for shows, plus seasons/episodes for shows included
 *   detail.json — fuller detail (cast, videos/trailers, recommendations, imdb id)
 *   updated.json— stamp + counts
 *
 * The API key/token is read from the environment only and never written anywhere.
 * Re-run any time to refresh the catalogue (trending/popular/upcoming move around).
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '../data/ent');
fs.mkdirSync(OUT, { recursive: true });
const KEY = process.env.TMDB_API_KEY || '';
const TOKEN = process.env.TMDB_TOKEN || '';
if (!KEY && !TOKEN) {
  console.error('No TMDB_API_KEY / TMDB_TOKEN in environment. Create a free key at themoviedb.org settings → API, then re-run.');
  process.exit(1);
}
const base = 'https://api.themoviedb.org/3';
const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
const pg = (p) => `${p}${p.includes('?') ? '&' : '?'}${KEY ? `api_key=${KEY}` : ''}`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(pathname, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(pg(base + pathname), { headers });
      if (res.status === 429) { await sleep(6000); continue; }
      if (!res.ok) throw new Error(`${res.status} ${pathname}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(2500);
    }
  }
}

/* trim an API item into the small shape the site ships */
function slim(m, kind) {
  if (!m || m.media_type === 'person' || !m.poster_path) return null;
  return {
    id: `${kind === 'tv' ? 'tv' : 'mv'}${m.id}`,
    t: m.title || m.name,
    y: m.release_date || m.first_air_date ? +((m.release_date || m.first_air_date) + '').slice(0, 4) : null,
    g: (m.genre_ids || []).slice(0, 3),
    r: Math.round(((m.vote_average || 0) * 10)) / 10,
    img: m.poster_path,
    bg: m.backdrop_path || '',
    ov: (m.overview || '').slice(0, 300),
    kind,
  };
}

const GENRE = {};
for (const wl of ['movie', 'tv']) {
  for (const g of (await get(`/genre/${wl}/list?language=en-US`)).genres) GENRE[g.id] = g.name;
}

const rails = [
  { file: 'movies.json', kind: 'movie', calls: [
    ['trending', 'trending/movie/week'],
    ['popular', 'movie/popular'],
    ['upcoming', 'movie/upcoming'],
    ['top', 'movie/top_rated'],
  ]},
  { file: 'tv.json', kind: 'tv', calls: [
    ['trending', 'trending/tv/week'],
    ['popular', 'tv/popular'],
    ['air', 'tv/on_the_air'],
    ['top', 'tv/top_rated'],
  ]},
];

const detailIndex = {};   // id -> fuller detail (only for first N of each rail)
const seen = new Set();
const fl = (min = 0) => (m) => m && !seen.has(`${m.id}`) ? (min && m.popularity >= min) : false;

for (const rail of rails) {
  const out = {};
  for (const [railName, endpoint] of rail.calls) {
    out[railName] = [];
    for (let pageI = 1; pageI <= 2; pageI++) {
      const j = await get(`/${endpoint}?language=en-US&page=${pageI}`);
      const items = (j.results || []).map(m => slim(m, rail.kind)).filter(Boolean);
      out[railName].push(...items);
      for (const it of items) seen.add(`${it.id.replace(/^[a-z]+/, '')}`);
      // deeper detail for the first 12 of each rail's first page
      if (pageI === 1) {
        for (const it of items.slice(0, 12)) {
          const imdbId = `${it.id.replace(/^[a-z]+/, '')}`;
          if (detailIndex[it.id]) continue;
          await sleep(260);
          try {
            const d = await get(`/${rail.kind}/${imdbId}?language=en-US&append_to_response=videos,credits,recommendations,external_ids`);
            detailIndex[it.id] = {
              id: it.id,
              seo: d.imdb_id || '',
              cast: (d.credits?.cast || []).slice(0, 6).map(c => ({ n: c.name, ch: c.character, img: c.profile_path })),
              dir: (d.credits?.crew || []).filter(c => c.job === 'Director').slice(0, 2).map(c => c.name),
              trailer: (d.videos?.results || []).find(v => (v.site === 'YouTube') && (v.type === 'Trailer' || v.type === 'Teaser'))?.key || '',
              rec: (d.recommendations?.results || []).slice(0, 12).map(x => slim(x, rail.kind)).filter(Boolean).slice(0, 6),
              runtime: d.runtime || (d.episode_run_time || [])[0] || null,
              status: d.status,
              seasons: (d.seasons || []).filter(s => s.season_number > 0).map(s => ({ n: s.season_number, t: s.name, eps: s.episode_count, y: (s.air_date || '').slice(0, 4) })),
              genres: (d.genres || []).map(g => g.name),
            };
          } catch (e) { console.error('detail failed', it.id, e.message); }
          // cache episode lists for the first seasons of TV shows
          if (rail.kind === 'tv') {
            try {
              const d2 = await get(`/tv/${imdbId}?language=en-US`);
              const seasonList = (d2.seasons || []).filter(s => s.season_number > 0).slice(0, 3);
              const eps = [];
              for (const s of seasonList) {
                await sleep(260);
                const sj = await get(`/tv/${imdbId}/season/${s.season_number}?language=en-US`);
                (sj.episodes || []).forEach(e2 => eps.push({ n: e2.episode_number, s: s.season_number, t: e2.name, ov: (e2.overview || '').slice(0, 120), still: e2.still_path, air: e2.air_date }));
              }
              detailIndex[it.id].episodes = eps;
            } catch { /* keep seasons metadata only */ }
          }
        }
      }
    }
  }
  // dedupe per rail + global map
  const flat = Object.values(out).flat();
  const map = new Map(flat.map(m => [m.id, m]));
  fs.writeFileSync(path.join(OUT, rail.file), JSON.stringify({ v: 1, genre: GENRE, rails: out, items: [...map.values()] }));
}

fs.writeFileSync(path.join(OUT, 'detail.json'), JSON.stringify(detailIndex));
fs.writeFileSync(path.join(OUT, 'updated.json'), JSON.stringify({
  built: new Date().toISOString(),
  provider: 'TMDB (themoviedb.org) — not endorsed or certified by TMDB',
  counts: {
    movieItems: JSON.parse(fs.readFileSync(path.join(OUT, 'movies.json'))).items.length,
    tvItems: JSON.parse(fs.readFileSync(path.join(OUT, 'tv.json'))).items.length,
    withDetail: Object.keys(detailIndex).length,
  },
}, null, 2));
console.log('done → data/ent');
