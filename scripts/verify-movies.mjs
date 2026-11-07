// Re-verify every movie source and player in catalog/movies.json.
//
//   node scripts/verify-movies.mjs           probe and rewrite the measured fields
//   node scripts/verify-movies.mjs --dry     print the table, write nothing
//
// The catalogue holds two kinds of record and treats them differently:
//
//   sources  curated sites. The script follows redirects to the final address,
//            because a 200 on the way to a survey farm is not a working site,
//            and records status / frame / finalUrl.
//   players  embed hosts. These take a TMDB or IMDb id in the path, so the
//            script asks for a known id and a known episode and checks that the
//            host answers and permits framing. A player is the only kind of
//            record that can actually play inside the page.
//
// Nothing here guesses: every field it writes came from a request made during
// this run. Fields it does not measure (name, note, cats, tags) are left alone.
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ROOT = path.resolve(import.meta.dirname, '..');
const FILE = path.join(ROOT, 'catalog', 'movies.json');
const DRY = process.argv.includes('--dry');

/* Hosts that answer 200 while being nothing but a redirect slide, a parking
   page or an ad farm. Curated by hand after watching where the redirects land;
   the probe cannot infer intent from a status code. */
const PARK_HOSTS = new Set([
  'survey-twist.com',
  'cerdma.com',
  'portlandplazapenthouse.com',
  'sedoparking.com',
  'parkingcrew.net',
  'bodis.com',
  'hugedomains.com',
  'afternic.com',
  'dan.com',
  'undeveloped.com',
  'domainmarket.com',
  'buydomains.com',
]);

const TRANSIENT = new Set(['EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED']);

function request(url, depth = 0) {
  return new Promise((resolve) => {
    if (depth > 6) return resolve({ url, error: 'redirect-loop' });
    let u;
    try { u = new URL(url); } catch { return resolve({ url, error: 'bad-url' }); }
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      method: 'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
      timeout: 14000,
      rejectUnauthorized: false,
      // some sites ship cookie banners of headers; the default cap rejects them
      maxHeaderSize: 131072,
    }, (res) => {
      const { statusCode, headers } = res;
      const location = headers.location;
      res.destroy();
      if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
        let next;
        try { next = new URL(location, url).href; } catch { return resolve({ url, status: statusCode }); }
        return resolve(request(next, depth + 1));
      }
      const xfo = String(headers['x-frame-options'] || '');
      const csp = String(headers['content-security-policy'] || '');
      const ancestors = (csp.match(/frame-ancestors([^;]*)/i) || [])[1] || '';
      resolve({
        url,
        status: statusCode,
        xfo,
        ancestors: ancestors.trim(),
        type: String(headers['content-type'] || '').split(';')[0],
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ url, error: 'timeout' }); });
    req.on('error', (err) => resolve({ url, error: err.code || err.message }));
    req.end();
  });
}

async function requestWithRetry(url) {
  const first = await request(url);
  if (first.error && TRANSIENT.has(first.error)) return request(url);
  return first;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/* A verdict, not a status code: what a person pressing the tile will get. */
function grade(result) {
  if (result.error) return { status: result.error === 'timeout' ? 'slow' : 'down', frame: 'unknown' };
  const finalHost = hostOf(result.url);
  if (PARK_HOSTS.has(finalHost)) return { status: 'parked', frame: 'blocked' };
  if (result.status >= 400) return { status: 'blocked-http', frame: 'blocked' };
  if (result.xfo || result.ancestors) {
    return { status: 'up', frame: result.xfo.toLowerCase() === 'deny' ? 'deny' : 'blocked' };
  }
  return { status: 'up', frame: 'direct' };
}

function label(verdict, result) {
  const bits = [String(verdict.status).padEnd(12)];
  bits.push(String(result.status ?? result.error).padEnd(6));
  bits.push(((result.xfo || (result.ancestors && 'fa:' + result.ancestors) || '-') + '').slice(0, 20).padEnd(22));
  return bits.join(' ');
}

async function pool(items, size, work) {
  const queue = [...items];
  const out = [];
  async function run() {
    while (queue.length) out.push(await work(queue.shift()));
  }
  await Promise.all(Array.from({ length: size }, run));
  return out;
}

const catalog = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const checkedAt = new Date().toISOString().slice(0, 10);

/* ---------- sources ---------- */

const sources = await pool(catalog.sources, 8, async (source) => {
  const result = await requestWithRetry(source.url);
  const verdict = grade(result);
  const movedTo = result.url && result.url !== source.url ? result.url : '';
  console.log(`${label(verdict, result)} ${source.id.padEnd(14)} ${movedTo ? '→ ' + movedTo : ''}`);
  return { source, result, verdict, movedTo };
});

/* ---------- players ---------- */

const MOVIE_ID = '1400940';   // Clayface (2026), the id StreamEx uses in its own player list
const TV_ID = '1399';         // Game of Thrones, season 1 episode 1
const players = [];

for (const player of catalog.players || []) {
  const movieUrl = player.movie.replace('{id}', MOVIE_ID);
  const tvUrl = (player.tv || '').replace('{id}', TV_ID).replace('{s}', '1').replace('{e}', '1');
  const movie = await requestWithRetry(movieUrl);
  const tv = tvUrl ? await requestWithRetry(tvUrl) : null;
  const verdict = grade(movie);
  console.log(`${label(verdict, movie)} ${player.id.padEnd(14)} movie=${movie.status ?? movie.error} tv=${tv ? (tv.status ?? tv.error) : '-'}`);
  players.push({ player, movie, tv, verdict });
}

/* ---------- write ---------- */

if (!DRY) {
  const byId = new Map(sources.map(s => [s.source.id, s]));

  catalog.sources = catalog.sources.map(s => {
    const hit = byId.get(s.id);
    if (!hit) return s;
    const { source, result, verdict, movedTo } = hit;
    /* A pinned record keeps the verdict a human gave it. Two reasons exist:
       a domain that serves a redirect farm to some clients and a clean 200 to
       others, and a host that answers 403 to anything that is not a real
       browser. The probe result is still recorded next to it. */
    const next = source.pinned
      ? { ...source, probe: `${verdict.status}/${verdict.frame}/${result.status ?? result.error}`, checked: checkedAt }
      : { ...source, status: verdict.status, frame: verdict.frame, checked: checkedAt };
    if (movedTo) next.finalUrl = movedTo;
    else delete next.finalUrl;
    return next;
  });

  catalog.players = players.map(({ player, movie, tv, verdict }) => ({
    ...player,
    status: verdict.status,
    frame: verdict.frame,
    tvOk: tv ? !tv.error && tv.status < 400 : false,
  }));

  catalog.checked = checkedAt;
  catalog.method = 'scripts/verify-movies.mjs follows every redirect, then reads X-Frame-Options and CSP frame-ancestors on the final response. Redirect farms and parking hosts are listed in the script. Players are asked for a known film and a known episode.';
  fs.writeFileSync(FILE, JSON.stringify(catalog, null, 2) + '\n');
  console.log('\nwrote catalog/movies.json');
}

const summary = {};
for (const s of sources) summary[s.verdict.status] = (summary[s.verdict.status] || 0) + 1;
for (const p of players) summary['player-' + p.verdict.status] = (summary['player-' + p.verdict.status] || 0) + 1;
console.log('\n' + Object.entries(summary).map(([k, v]) => `${k}=${v}`).join('  '));
