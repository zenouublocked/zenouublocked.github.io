// Zenou Unblocked, API and static server.
//
// One process, no dependencies. It serves the static site from the repo root and
// answers /api/* from TMDB with a shared cache in front. The TMDB credential
// lives in this process only; nothing under /api returns it, and .env is never
// served.
//
//   node server/index.mjs           # PORT=8123 by default
//
// Routes:
//   GET /api/config
//   GET /api/feed?type=movie|tv&feed=trending|popular|upcoming|now_playing|top_rated|airing_today|on_the_air&page
//   GET /api/browse?type=&genre=&sort=&page
//   GET /api/search?q=&type=multi|movie|tv&page
//   GET /api/title?type=&id=
//   GET /api/genres?type=
//   GET /api/watch-links?type=&id=&title=&year=&season=&episode
//   GET /api/players?type=&id=&season=&episode
//   GET /api/players/health
//   GET /api/status
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from './env.mjs';
import { TtlCache, TTL } from './cache.mjs';
import { makeTmdb, card, cards, detail, FEEDS, TmdbError, IMAGE_BASE } from './tmdb.mjs';
import { loadRegistry, providersFor, registryHealth } from './players.mjs';
import { movyUrl, movyInfo } from './movy.mjs';
import { resolveStreamex } from './streamex.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A shell that exports PORT=0 (a dev harness does) must not put us on a random
// port, or the preview and every curl below it hits nothing.
const portEnv = Number.parseInt(process.env.PORT || '', 10);
const PORT = Number.isFinite(portEnv) && portEnv > 0 && portEnv < 65536 ? portEnv : 8123;
const HOST = process.env.HOST || '127.0.0.1';

const env = loadEnv(ROOT);
const cache = new TtlCache({ max: 1200 });
const tmdb = makeTmdb({ env: process.env, cache });

let registry = [];
try {
  registry = await loadRegistry(ROOT);
} catch (e) {
  console.warn('[api] catalog/players.json unreadable:', e.message);
}

/* ---------------- helpers ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

function badRequest(res, message) {
  json(res, 400, { error: 'bad_request', message });
}

const int = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

/* ---------------- routes ---------------- */

const routes = {
  async '/api/config'() {
    return {
      configured: tmdb.hasCredentials,
      language: tmdb.language,
      region: tmdb.region,
      images: { base: IMAGE_BASE },
      attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
      feeds: {
        movie: Object.keys(FEEDS.movie),
        tv: Object.keys(FEEDS.tv),
      },
    };
  },

  async '/api/feed'(params) {
    const type = params.get('type') === 'tv' ? 'tv' : 'movie';
    const feed = params.get('feed') || 'trending';
    const builder = FEEDS[type][feed];
    if (!builder) throw new TmdbError(`Unknown feed "${feed}" for ${type}.`, { status: 400, code: 'bad_feed' });

    const page = int(params.get('page'), 1, 1, 500);
    const [endpoint, extra] = builder({ page }, tmdb.region);
    const payload = await tmdb.request(endpoint, extra, { ttl: TTL.list });

    return {
      type,
      feed,
      page: payload.page ?? page,
      pages: Math.min(payload.total_pages ?? 1, 500),
      total: payload.total_results ?? null,
      results: cards(payload.results),
    };
  },

  async '/api/browse'(params) {
    const type = params.get('type') === 'tv' ? 'tv' : 'movie';
    const page = int(params.get('page'), 1, 1, 500);
    const genre = params.get('genre');
    const sortParam = params.get('sort') || 'popularity.desc';

    const allowed = new Set([
      'popularity.desc',
      'popularity.asc',
      'vote_average.desc',
      'vote_count.desc',
      'primary_release_date.desc',
      'primary_release_date.asc',
      'first_air_date.desc',
      'first_air_date.asc',
    ]);
    const sort = allowed.has(sortParam) ? sortParam : 'popularity.desc';

    const query = { page, sort_by: sort, include_adult: 'false', 'vote_count.gte': sort.startsWith('vote_average') ? 50 : undefined };
    if (genre && /^\d+$/.test(genre)) query.with_genres = genre;

    const payload = await tmdb.request(`/discover/${type}`, query, { ttl: TTL.list });
    return {
      type,
      page: payload.page ?? page,
      pages: Math.min(payload.total_pages ?? 1, 500),
      total: payload.total_results ?? null,
      results: cards(payload.results),
    };
  },

  async '/api/search'(params) {
    const q = (params.get('q') || '').trim();
    if (!q) return { q, page: 1, pages: 0, total: 0, results: [] };
    if (q.length > 120) throw new TmdbError('That search is too long.', { status: 400, code: 'query_too_long' });

    const type = ['multi', 'movie', 'tv'].includes(params.get('type')) ? params.get('type') : 'multi';
    const page = int(params.get('page'), 1, 1, 500);
    const payload = await tmdb.request(
      `/search/${type}`,
      { query: q, page, include_adult: 'false' },
      { ttl: TTL.search },
    );
    return {
      q,
      page: payload.page ?? page,
      pages: Math.min(payload.total_pages ?? 1, 500),
      total: payload.total_results ?? null,
      results: cards(payload.results),
    };
  },

  async '/api/title'(params) {
    const type = params.get('type') === 'tv' ? 'tv' : 'movie';
    const id = params.get('id');
    if (!/^\d+$/.test(id || '')) throw new TmdbError('A title id is required.', { status: 400, code: 'bad_id' });

    const append = type === 'movie'
      ? 'credits,videos,similar,recommendations,release_dates,external_ids'
      : 'credits,videos,similar,recommendations,content_ratings,external_ids';
    const payload = await tmdb.request(`/${type}/${id}`, { append_to_response: append }, { ttl: TTL.detail });
    const shaped = detail(payload, type, tmdb.region);
    if (!shaped) throw new TmdbError('TMDB returned nothing for that title.', { status: 404, code: 'not_found' });
    return { title: shaped };
  },

  async '/api/genres'(params) {
    const type = params.get('type') === 'tv' ? 'tv' : 'movie';
    const payload = await tmdb.request(`/genre/${type}/list`, {}, { ttl: TTL.genre });
    return { type, genres: (payload.genres || []).map(g => ({ id: g.id, name: g.name })) };
  },

  async '/api/players'(params) {
    const type = params.get('type') === 'tv' ? 'tv' : 'movie';
    const id = params.get('id');
    if (!/^\d+$/.test(id || '')) throw new TmdbError('A title id is required.', { status: 400, code: 'bad_id' });
    const season = int(params.get('season'), 1, 0, 100);
    const episode = int(params.get('episode'), 1, 0, 2000);

    const { available, unavailable } = await providersFor(registry, cache, { type, id, season, episode });
    const showUnavailable = process.env.DEBUG_PLAYERS === '1';
    return {
      type,
      id: Number(id),
      season: type === 'tv' ? season : null,
      episode: type === 'tv' ? episode : null,
      available,
      ...(showUnavailable ? { unavailable } : { unavailableCount: unavailable.length }),
      checkedAt: new Date().toISOString(),
    };
  },

  // Quick-launch links for the two main catalogue sources. Movy is id-addressable,
  // so its link is built; StreamEx has no id routes, so its exact watch page is
  // resolved through its own search (and falls back to that search).
  async '/api/watch-links'(params) {
    const type = params.get('type') === 'tv' ? 'tv' : 'movie';
    const id = params.get('id');
    if (!/^\d+$/.test(id || '')) throw new TmdbError('A title id is required.', { status: 400, code: 'bad_id' });

    const title = (params.get('title') || '').trim().slice(0, 120);
    const year = (params.get('year') || '').slice(0, 4);
    const season = int(params.get('season'), 1, 0, 100);
    const episode = int(params.get('episode'), 1, 0, 2000);

    const streamEx = title ? await resolveStreamex(cache, { type, title, year }) : null;

    const movy = {
      ...movyInfo({ type }),
      url: movyUrl({ type, id, season, episode }),
      kind: 'id',
      exact: true,
    };

    const streamex = streamEx && {
      id: 'streamex',
      name: 'StreamEx',
      home: 'https://streamex.ws/',
      url: streamEx.url,
      kind: streamEx.exact ? 'resolved' : 'search',
      exact: streamEx.exact,
      frame: 'blocked',
      licensing: 'third-party',
      note: streamEx.exact
        ? 'Resolved to this title on StreamEx.'
        : 'StreamEx has no id routes, so this opens its own search for this title.',
    };

    return {
      type,
      id: Number(id),
      season: type === 'tv' ? season : null,
      episode: type === 'tv' ? episode : null,
      title: title || null,
      links: [movy, streamex].filter(Boolean),
    };
  },

  async '/api/players/health'() {
    const hosts = await registryHealth(registry, cache);
    return { players: hosts, checkedAt: new Date().toISOString() };
  },

  async '/api/status'() {
    return {
      uptime: Math.round(process.uptime()),
      configured: tmdb.hasCredentials,
      cache: cache.stats(),
      players: registry.length,
      env: { file: env.file.replace(ROOT, '.'), loaded: env.loaded },
    };
  },
};

/* ---------------- static ---------------- */

const BLOCKED = [/^\/\./, /^\/server\//, /^\/scripts\//, /package-lock\.json$/, /^\/\.tmp/, /^\/node_modules/];

async function serveStatic(req, res, pathname) {
  if (BLOCKED.some(re => re.test(pathname))) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';

  /* Clean URLs. /web is served from /web/index.html without a redirect, so the
     address bar keeps the extensionless form GitHub Pages gives it in
     production. Resolving the directory index here, rather than 302-ing to it,
     is what makes local and deployed behaviour identical. */
  if (!/\.[a-z0-9]+$/i.test(rel)) {
    const candidate = path.join(ROOT, path.normalize(`${rel}/index.html`));
    if (candidate.startsWith(ROOT) && fs.existsSync(candidate)) rel += '/index.html';
  }

  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    // SPA-ish fallback for extension-less paths, 404 page for everything else.
    const notFound = path.join(ROOT, '404.html');
    res.writeHead(404, { 'content-type': MIME['.html'] });
    if (fs.existsSync(notFound)) res.end(await fsp.readFile(notFound));
    else res.end('Not found');
    return;
  }

  if (stat.isDirectory()) {
    res.writeHead(302, { location: pathname.replace(/\/?$/, '/') + 'index.html' });
    res.end();
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${stat.size}-${stat.mtimeMs.toString(36)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag });
    res.end();
    return;
  }

  // HTML must revalidate; hashed-looking assets are cheap to revalidate anyway.
  const cacheControl = ext === '.html' ? 'no-cache' : 'public, max-age=300, must-revalidate';

  res.writeHead(200, {
    'content-type': type,
    'content-length': stat.size,
    'cache-control': cacheControl,
    etag,
    'x-content-type-options': 'nosniff',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
}

/* ---------------- server ---------------- */

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    badRequest(res, 'Malformed request URL.');
    return;
  }

  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return;
    }
    await serveStatic(req, res, pathname);
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  const handler = routes[pathname.replace(/\/$/, '')];
  if (!handler) {
    json(res, 404, { error: 'not_found', message: `No API route at ${pathname}.` });
    return;
  }

  const started = Date.now();
  try {
    const body = await handler(url.searchParams);
    res.setHeader('x-response-time', `${Date.now() - started}ms`);
    json(res, 200, body);
  } catch (e) {
    const status = e instanceof TmdbError ? e.status : 500;
    if (status >= 500) console.error(`[api] ${pathname}`, e.message);
    json(res, status, {
      error: e.code || 'server_error',
      message: e.message || 'Something went wrong.',
      ...(e.retryAfter ? { retryAfter: Math.ceil(e.retryAfter / 1000) } : {}),
      ...(e.code === 'no_key' ? { setup: true } : {}),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[zenou] http://${HOST}:${PORT}/`);
  console.log(`[zenou] TMDB ${tmdb.hasCredentials ? 'configured' : 'NOT configured (set TMDB_READ_TOKEN or TMDB_API_KEY in .env)'}`);
  console.log(`[zenou] env file: ${env.file}${env.loaded ? ` · ${env.loaded} value(s) loaded` : ''}`);
  console.log(`[zenou] players: ${registry.length}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n[zenou] ${sig} · closing`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
