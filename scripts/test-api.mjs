// End-to-end tests for the API layer.
//
// A fixture TMDB server answers on 8788, the real API server boots against it on
// 8799, and every route is exercised over HTTP. The TMDB client's own failure
// paths (401, 429 with Retry-After, 500) are driven directly, and the player
// prober is fed a synthetic registry pointed at the same fixture server.
//
//   node scripts/test-api.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TtlCache } from '../server/cache.mjs';
import { makeTmdb } from '../server/tmdb.mjs';
import { providersFor } from '../server/players.mjs';
import { movyUrl } from '../server/movy.mjs';
import { resolveStreamex, slugify, streamexSearchUrl } from '../server/streamex.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOCK_PORT = 8788;
const API_PORT = 8799;
const BASE = `http://127.0.0.1:${API_PORT}`;

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await wait(150);
  }
  return false;
}

async function get(pathname) {
  const res = await fetch(BASE + pathname, { signal: AbortSignal.timeout(15000) });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body, headers: res.headers };
}

const mockHits = async () => (await (await fetch(`http://127.0.0.1:${MOCK_PORT}/__hits`)).json()).hits;

/* ---------------- boot ---------------- */

const mock = spawn(process.execPath, [path.join(ROOT, 'scripts', 'mock-tmdb.mjs'), String(MOCK_PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
mock.stdout.on('data', () => {});

const api = spawn(process.execPath, [path.join(ROOT, 'server', 'index.mjs')], {
  env: {
    ...process.env,
    PORT: String(API_PORT),
    TMDB_BASE: `http://127.0.0.1:${MOCK_PORT}/3`,
    TMDB_API_KEY: 'fixture-key',
    TMDB_REGION: 'US',
    DEBUG_PLAYERS: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const apiLog = [];
api.stdout.on('data', d => apiLog.push(String(d)));
api.stderr.on('data', d => apiLog.push(String(d)));

const cleanup = () => {
  for (const child of [api, mock]) {
    if (!child.killed) child.kill();
  }
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

/* ---------------- tests ---------------- */

try {
  const mockUp = await waitFor(`http://127.0.0.1:${MOCK_PORT}/__hits`);
  const apiUp = await waitFor(`${BASE}/api/config`);
  check('fixture server boots', mockUp);
  check('api server boots', apiUp, apiLog.join('').slice(0, 200));
  if (!apiUp) throw new Error('api did not start');

  console.log('\nconfig');
  {
    const { status, body } = await get('/api/config');
    check('config answers 200', status === 200);
    check('reports configured with a key present', body.configured === true);
    check('carries the TMDB attribution string', /not endorsed or certified by TMDB/.test(body.attribution || ''));
    check('publishes the image base', /image\.tmdb\.org/.test(body.images?.base || ''));
    check('lists feeds', Array.isArray(body.feeds?.movie) && body.feeds.movie.includes('upcoming'));
  }

  console.log('\nfeed');
  {
    const { status, body } = await get('/api/feed?type=movie&feed=trending');
    check('feed answers 200', status === 200);
    check('collapses duplicates and drops people', body.results.length === 3, `got ${body.results.length}`);
    const first = body.results[0];
    check('card has the expected shape', ['id', 'type', 'title', 'year', 'poster', 'rating'].every(k => k in first));
    check('overview is trimmed', first.overview === 'A test synopsis.');
    check('year is derived from the release date', first.year === 2026);
    check('rating is rounded to one decimal', first.rating === 7.4);
    check('missing poster survives as null', body.results[2].poster === null);
    check('page metadata passes through', body.pages === 5 && body.page === 1);

    const before = await mockHits();
    await get('/api/feed?type=movie&feed=trending');
    const after = await mockHits();
    check('second identical request is served from cache', before === after, `${before} -> ${after}`);

    const tvFeed = await get('/api/feed?type=tv&feed=airing_today');
    check('tv feeds route', tvFeed.status === 200 && tvFeed.body.type === 'tv');

    const bad = await get('/api/feed?type=movie&feed=nope');
    check('unknown feed is a 400', bad.status === 400 && bad.body.error === 'bad_feed');
  }

  console.log('\nsearch');
  {
    const { body } = await get('/api/search?q=test');
    check('search answers with deduped results', body.results.length === 2, `got ${body.results.length}`);
    const empty = await get('/api/search?q=');
    check('empty query short-circuits without upstream', empty.body.results.length === 0 && empty.body.total === 0);
    const long = await get('/api/search?q=' + 'a'.repeat(200));
    check('over-long query is a 400', long.status === 400);
  }

  console.log('\nbrowse + genres');
  {
    const { body } = await get('/api/browse?type=movie&genre=18&page=2');
    check('browse pages through discover', body.page === 2 && body.results.length === 1);
    const genres = await get('/api/genres?type=movie');
    check('genres list', genres.body.genres.length === 2);
    const badSort = await get('/api/browse?type=movie&sort=drop%20table');
    check('unknown sort falls back instead of erroring', badSort.status === 200);
  }

  console.log('\ntitle');
  {
    const { status, body } = await get('/api/title?type=movie&id=550');
    const t = body.title;
    check('detail answers 200', status === 200);
    check('title fields', t.title === 'Fight Club' && t.year === 1999 && t.runtime === 139);
    check('certification resolved for the region', t.certification === 'R', t.certification);
    check('director picked out of crew', t.created_by.includes('David Fincher'));
    check('cast shaped', t.cast.length === 2 && t.cast[0].character === 'Tyler Durden');
    check('official trailer preferred', t.trailer?.key === 'BdJKm16Co6M');
    check('recommendations deduped', t.recommendations.length === 1);
    check('similar shaped', t.similar.length === 1 && t.similar[0].title === 'Se7en');

    const tv = await get('/api/title?type=tv&id=42');
    check('tv detail has seasons and a rating', tv.body.title.seasons === 2 && tv.body.title.certification === 'TV-MA');
    check('specials still listed', tv.body.title.seasonsList.length === 2);

    const missing = await get('/api/title?type=tv&id=999');
    check('unknown title is a 404', missing.status === 404 && missing.body.error === 'not_found');

    const badId = await get('/api/title?type=movie&id=abc');
    check('non-numeric id is a 400', badId.status === 400);
  }

  console.log('\nclient failure paths');
  {
    const cache = new TtlCache({ max: 50 });
    const client = makeTmdb({ env: { TMDB_BASE: `http://127.0.0.1:${MOCK_PORT}/3`, TMDB_API_KEY: 'x' }, cache });

    const limited = await client.request('/fail/429-once', {}, { ttl: 1000 });
    check('429 is retried and then succeeds', limited.results?.[0]?.title === 'The Matrix');

    let unauthorized;
    try {
      await client.request('/fail/401', {}, { ttl: 1000 });
    } catch (e) { unauthorized = e; }
    check('401 surfaces as bad_credentials', unauthorized?.code === 'bad_credentials');

    let boom;
    try {
      await client.request('/fail/500', {}, { ttl: 1000 });
    } catch (e) { boom = e; }
    check('500 surfaces as upstream_error', boom?.code === 'upstream_error', boom?.code);

    const none = makeTmdb({ env: {}, cache });
    let noKey;
    try { await none.request('/movie/popular'); } catch (e) { noKey = e; }
    check('missing key is a clean 503 setup error', noKey?.status === 503 && noKey?.code === 'no_key');
  }

  console.log('\nplayers');
  {
    const cache = new TtlCache({ max: 50 });
    const registry = [
      { id: 'up', name: 'Up One', priority: 1, movie: `http://127.0.0.1:${MOCK_PORT}/player/up/{id}`, tv: `http://127.0.0.1:${MOCK_PORT}/player/up/{id}/{s}/{e}` },
      { id: 'blocked', name: 'Blocked One', priority: 2, movie: `http://127.0.0.1:${MOCK_PORT}/player/blocked/{id}` },
      { id: 'dead', name: 'Dead One', priority: 3, movie: `http://127.0.0.1:${MOCK_PORT}/player/dead/{id}` },
    ];
    const { available, unavailable } = await providersFor(registry, cache, { type: 'movie', id: 550 });
    check('only answering providers are offered', available.length === 2, `${available.length}`);
    check('priority order is preserved', available[0].id === 'up');
    check('framing verdict is measured', available.find(p => p.id === 'up').frame === 'direct' && available.find(p => p.id === 'blocked').frame === 'blocked');
    check('missing copy is reported, not offered', unavailable.length === 1 && unavailable[0].id === 'dead');

    const before = await mockHits();
    await providersFor(registry, cache, { type: 'movie', id: 550 });
    const after = await mockHits();
    check('probe results are cached', before === after);

    const live = await get('/api/players?type=movie&id=550');
    check('live registry endpoint answers', live.status === 200 && Array.isArray(live.body.available));
    check('every offered source carries its licensing label', live.body.available.every(p => p.licensing === 'third-party'));
  }

  console.log('\nwatch links');
  {
    const movie = await get('/api/watch-links?type=movie&id=550');
    check('watch links answer 200', movie.status === 200);
    const movy = movie.body?.links?.find(l => l.id === 'movy');
    check('movy link is built from the id', movy?.url === 'https://www.movy.sx/movie/550?play=true');
    check('movy link carries its licensing label', movy?.licensing === 'third-party');

    const tv = await get('/api/watch-links?type=tv&id=1399&season=2&episode=5');
    check('series link keeps season and episode', tv.body?.links?.[0]?.url === 'https://www.movy.sx/tv/1399/2/5?play=true');

    const bad = await get('/api/watch-links?type=movie&id=abc');
    check('non-numeric id is a 400', bad.status === 400 && bad.body?.error === 'bad_id');

    check('movyUrl refuses a non-numeric id', movyUrl({ type: 'movie', id: 'tt1375666' }) === null);
    check('slugify drops apostrophes and accents', slugify("Ocean's Eleven: Amélie") === 'oceans-eleven-amelie');
    check('search url is encoded', streamexSearchUrl('Fight Club').endsWith('/search?q=Fight%20Club'));

    // The resolver's parsing is proven against a fixed page, not the live site.
    const page = `
      <a href="https://streamex.ws/watch-movie-fight-club-1999-2j39fo">yes</a>
      <a href="https://streamex.ws/watch-movie-fight-club-2023-x6tghp">no, wrong year</a>
      <a href="https://streamex.ws/watch-movie-zombie-fight-club-2014-6vcbf7">no, wrong title</a>`;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(page, { status: 200, headers: { 'content-type': 'text/html' } });
    try {
      const hit = await resolveStreamex(new TtlCache(), { type: 'movie', title: 'Fight Club', year: '1999' });
      check('resolver picks the title and year, not the first link', hit.url === 'https://streamex.ws/watch-movie-fight-club-1999-2j39fo' && hit.exact === true);
      const miss = await resolveStreamex(new TtlCache(), { type: 'movie', title: 'Nothing Here at All', year: '2026' });
      check('resolver falls back to its search instead of guessing', miss.exact === false && miss.url.includes('/search?q='));
      globalThis.fetch = async () => new Response('nope', { status: 503 });
      const down = await resolveStreamex(new TtlCache(), { type: 'movie', title: 'Fight Club', year: '1999' });
      check('resolver survives a 503', down.exact === false && down.reason === 'http_503');
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  console.log('\nsecurity + static');
  {
    const env = await fetch(`${BASE}/.env`);
    check('.env is never served', env.status === 404);
    const srv = await fetch(`${BASE}/server/index.mjs`);
    check('server source is not served', srv.status === 404);
    const page = await fetch(`${BASE}/movies`);
    const html = await page.text();
    check('static pages still serve', page.status === 200 && html.includes('<!DOCTYPE html>'));
    check('no TMDB key in the page', !/fixture-key|api_key/i.test(html));

    const head = await fetch(`${BASE}/css/style.css`, { headers: { 'if-none-match': 'nope' } });
    check('static assets send an etag', Boolean(head.headers.get('etag')));
    const post = await fetch(`${BASE}/api/config`, { method: 'POST' });
    check('api rejects non-GET', post.status === 405);
  }
} catch (e) {
  failures.push('harness: ' + (e.stack || e.message));
  console.error(e);
} finally {
  cleanup();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('failures:');
  for (const f of failures) console.log(' - ' + f);
  process.exitCode = 1;
}
