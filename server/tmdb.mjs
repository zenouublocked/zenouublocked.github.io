// TMDB client. Server-side only: the key never crosses into the browser.
//
// Credentials, in order of preference:
//   TMDB_READ_TOKEN  v4 read access token (sent as a bearer header)
//   TMDB_API_KEY     v3 key (sent as ?api_key=)
//
// The client also owns the shaping layer, so every route returns the same card
// and detail shapes no matter which endpoint produced them. Missing fields
// become nulls instead of throwing — a title with no poster is still a title.

const DEFAULT_API = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/';

/** Thrown for anything TMDB refuses, carrying enough for a real HTTP status. */
export class TmdbError extends Error {
  constructor(message, { status = 502, code = 'tmdb_error', retryAfter = 0 } = {}) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/* ---------------- rate limiting ---------------- */

// TMDB allows ~50 rps per key. Stay well under it and let bursts through.
const BUCKET = { tokens: 40, max: 40, refillPerMs: 40 / 1000, last: Date.now() };

async function takeToken() {
  for (;;) {
    const now = Date.now();
    BUCKET.tokens = Math.min(BUCKET.max, BUCKET.tokens + (now - BUCKET.last) * BUCKET.refillPerMs);
    BUCKET.last = now;
    if (BUCKET.tokens >= 1) {
      BUCKET.tokens -= 1;
      return;
    }
    await new Promise(r => setTimeout(r, 60));
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- client ---------------- */

export function credentials(env = process.env) {
  const token = (env.TMDB_READ_TOKEN || '').trim();
  const key = (env.TMDB_API_KEY || '').trim();
  if (token) return { kind: 'bearer', value: token };
  if (key) return { kind: 'key', value: key };
  return null;
}

export function makeTmdb({ env = process.env, cache } = {}) {
  const cred = credentials(env);
  const language = (env.TMDB_LANGUAGE || 'en-US').trim();
  const region = (env.TMDB_REGION || 'US').trim().toUpperCase();
  // TMDB_BASE lets the layer run against a fixture server in tests, or a
  // compatible mirror on a network that blocks the real host. It is read here,
  // not at import time, so a test can set it on the object it passes in.
  const apiBase = (env.TMDB_BASE || DEFAULT_API).replace(/\/$/, '');

  async function request(pathname, params = {}, { ttl } = {}) {
    if (!cred) throw new TmdbError('TMDB is not configured on this server.', { status: 503, code: 'no_key' });

    const url = new URL(apiBase + pathname);
    url.searchParams.set('language', language);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
    if (cred.kind === 'key') url.searchParams.set('api_key', cred.value);

    const headers = { accept: 'application/json' };
    if (cred.kind === 'bearer') headers.authorization = `Bearer ${cred.value}`;

    const key = url.toString();
    const run = async () => {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await takeToken();
        let res;
        try {
          res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
        } catch (e) {
          lastError = new TmdbError(`TMDB did not answer (${e.name || 'network error'}).`, {
            status: 504,
            code: 'upstream_offline',
          });
          await sleep(200 * (attempt + 1));
          continue;
        }

        if (res.ok) return res.json();

        if (res.status === 401 || res.status === 403) {
          throw new TmdbError('TMDB rejected the configured credentials.', {
            status: 502,
            code: 'bad_credentials',
          });
        }
        if (res.status === 404) {
          throw new TmdbError('TMDB has no such title.', { status: 404, code: 'not_found' });
        }
        if (res.status === 429) {
          const wait = Number(res.headers.get('retry-after') || 1) * 1000;
          lastError = new TmdbError('TMDB rate limit reached.', { status: 503, code: 'rate_limited', retryAfter: wait });
          await sleep(Math.min(wait, 4000));
          continue;
        }
        if (res.status >= 500) {
          lastError = new TmdbError(`TMDB is having a moment (HTTP ${res.status}).`, {
            status: 503,
            code: 'upstream_error',
          });
          await sleep(250 * (attempt + 1));
          continue;
        }
        lastError = new TmdbError(`TMDB refused the request (HTTP ${res.status}).`, { status: 502 });
      }
      throw lastError;
    };

    if (!cache || !ttl) return run();
    return cache.wrap(key, ttl, run);
  }

  return { request, language, region, hasCredentials: Boolean(cred) };
}

/* ---------------- shapes ---------------- */

const dateOf = item =>
  (item.release_date || item.first_air_date || item.air_date || '').trim() || null;

const yearOf = item => {
  const d = dateOf(item);
  return d && d.length >= 4 ? Number(d.slice(0, 4)) : null;
};

const typeOf = item => {
  if (item.media_type === 'movie' || item.media_type === 'tv') return item.media_type;
  return item.first_air_date !== undefined && item.release_date === undefined ? 'tv' : 'movie';
};

const titleOf = item => item.title || item.name || item.original_title || item.original_name || 'Untitled';

/** The one card shape the whole front end renders. */
export function card(item) {
  if (!item || typeof item !== 'object' || item.id === undefined) return null;
  const type = typeOf(item);
  return {
    id: item.id,
    type,
    title: titleOf(item),
    date: dateOf(item),
    year: yearOf(item),
    poster: item.poster_path || null,
    backdrop: item.backdrop_path || null,
    rating: typeof item.vote_average === 'number' ? Math.round(item.vote_average * 10) / 10 : null,
    votes: typeof item.vote_count === 'number' ? item.vote_count : null,
    overview: item.overview ? item.overview.trim() : '',
    genres: Array.isArray(item.genre_ids) ? item.genre_ids : [],
    adult: Boolean(item.adult),
  };
}

function cards(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    // search/multi returns people too, and the same title can appear twice
    // across a page when TMDB merges results.
    if (!item || item.media_type === 'person') continue;
    const shaped = card(item);
    if (!shaped) continue;
    const key = `${shaped.type}:${shaped.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(shaped);
  }
  return out;
}

function certificationFor(payload, type, region) {
  if (type === 'movie') {
    const list = payload?.release_dates?.results || [];
    const local = list.find(r => r.iso_3166_1 === region) || list.find(r => r.iso_3166_1 === 'US');
    const entry = (local?.release_dates || []).find(r => r.certification);
    return entry?.certification || null;
  }
  const list = payload?.content_ratings?.results || [];
  const local = list.find(r => r.iso_3166_1 === region) || list.find(r => r.iso_3166_1 === 'US');
  return local?.rating || null;
}

function trailerFor(payload) {
  const videos = payload?.videos?.results || [];
  const yt = videos.filter(v => v.site === 'YouTube' && v.key);
  const pick =
    yt.find(v => v.type === 'Trailer' && v.official) ||
    yt.find(v => v.type === 'Trailer') ||
    yt.find(v => v.type === 'Teaser') ||
    yt[0];
  if (!pick) return null;
  return {
    key: pick.key,
    name: pick.name || 'Trailer',
    type: pick.type || 'Trailer',
    thumbnail: `https://img.youtube.com/vi/${pick.key}/hqdefault.jpg`,
  };
}

/** Detail shape for title.html. */
export function detail(payload, type, region) {
  if (!payload || payload.id === undefined) return null;
  const isTv = type === 'tv';
  const people = payload?.credits?.cast || [];
  const crew = payload?.credits?.crew || [];
  const created = crew.filter(p => ['Director', 'Creator'].includes(p.job));

  return {
    id: payload.id,
    type,
    title: titleOf(payload),
    originalTitle: payload.original_title || payload.original_name || null,
    tagline: payload.tagline || null,
    overview: payload.overview ? payload.overview.trim() : '',
    date: dateOf(payload),
    year: yearOf(payload),
    poster: payload.poster_path || null,
    backdrop: payload.backdrop_path || null,
    rating: typeof payload.vote_average === 'number' ? Math.round(payload.vote_average * 10) / 10 : null,
    votes: payload.vote_count || null,
    runtime: isTv ? null : payload.runtime || null,
    seasons: isTv ? payload.number_of_seasons || null : null,
    episodes: isTv ? payload.number_of_episodes || null : null,
    status: payload.status || null,
    certification: certificationFor(payload, type, region),
    genres: (payload.genres || []).map(g => ({ id: g.id, name: g.name })),
    countries: (payload.production_countries || []).map(c => c.name).filter(Boolean),
    languages: (payload.spoken_languages || []).map(l => l.english_name || l.name).filter(Boolean),
    homepage: payload.homepage || null,
    created_by: created.slice(0, 2).map(p => p.name),
    cast: people.slice(0, 12).map(p => ({
      id: p.id,
      name: p.name,
      character: p.character || null,
      photo: p.profile_path || null,
    })),
    trailer: trailerFor(payload),
    recommendations: cards(payload?.recommendations?.results || []).slice(0, 12),
    similar: cards(payload?.similar?.results || []).slice(0, 12),
    seasonsList: isTv
      ? (payload.seasons || [])
          .filter(s => s.season_number > 0 || s.name)
          .slice(0, 24)
          .map(s => ({
            number: s.season_number,
            name: s.name || `Season ${s.season_number}`,
            episodes: s.episode_count || null,
            airDate: s.air_date || null,
            poster: s.poster_path || null,
          }))
      : [],
  };
}

export const FEEDS = {
  movie: {
    trending: p => ['/trending/movie/week', p],
    popular: p => ['/movie/popular', { ...p, region: undefined }],
    upcoming: (p, region) => ['/movie/upcoming', { ...p, region }],
    now_playing: (p, region) => ['/movie/now_playing', { ...p, region }],
    top_rated: p => ['/movie/top_rated', p],
  },
  tv: {
    trending: p => ['/trending/tv/week', p],
    popular: p => ['/tv/popular', p],
    airing_today: p => ['/tv/airing_today', p],
    on_the_air: p => ['/tv/on_the_air', p],
    top_rated: p => ['/tv/top_rated', p],
  },
};

export { cards, IMAGE_BASE };
