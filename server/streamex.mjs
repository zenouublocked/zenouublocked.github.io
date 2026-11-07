// StreamEx deep-link resolver.
//
// StreamEx is a catalogue site with human-readable title slugs
// (`/watch-movie-fight-club-1999-2j39fo`), not an id-keyed player, so a TMDB id
// alone cannot address a title. Its own search does answer server-side, which is
// enough to turn a metadata title into the exact watch page: ask for the title,
// then keep the result whose slug carries the full title and the release year.
//
// When nothing matches exactly we hand back the search URL instead of guessing —
// a wrong film is worse than a search box. Both outcomes cache for 30 minutes.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const BASE = 'https://streamex.ws';
const TTL_LINK = 30 * 60 * 1000;
const MAX_BODY = 1_500_000;
const TIMEOUT = 9000;

export function streamexSearchUrl(title) {
  return `${BASE}/search?q=${encodeURIComponent(String(title || '').trim())}`;
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Apostrophes vanish rather than becoming separators ("Ocean's" -> "oceans").
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** True when a watch path is the whole-word title, not a substring of another. */
function carriesTitle(path, slug) {
  if (!slug) return false;
  return path.includes(`-${slug}-`) || path.endsWith(`-${slug}`);
}

function carriesYear(path, year) {
  if (!/^\d{4}$/.test(year || '')) return true;
  return path.includes(`-${year}-`) || path.endsWith(`-${year}`);
}

/**
 * Resolve one title to a StreamEx watch URL.
 * Returns { url, exact, reason } and never throws: resolving is best effort and
 * the caller always has the search URL to fall back to.
 */
export async function resolveStreamex(cache, { type, title, year }) {
  const query = String(title || '').trim().slice(0, 120);
  if (!query) return { url: BASE, exact: false, reason: 'no_title' };

  const kind = type === 'tv' ? 'watch-tv' : 'watch-movie';
  const slug = slugify(query);
  const key = `streamex:${kind}:${slug}:${year || ''}`;

  return cache.wrap(key, TTL_LINK, async () => {
    const fallback = { url: streamexSearchUrl(query), exact: false, reason: 'search' };

    let res;
    try {
      res = await fetch(streamexSearchUrl(query), {
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT),
      });
    } catch {
      return { ...fallback, reason: 'unreachable' };
    }
    if (!res.ok) return { ...fallback, reason: `http_${res.status}` };

    let html;
    try {
      html = await res.text();
    } catch {
      return fallback;
    }
    if (html.length > MAX_BODY) html = html.slice(0, MAX_BODY);

    const seen = new Set();
    const candidates = [];
    for (const match of html.matchAll(/href="(https:\/\/streamex\.ws\/(watch-(?:movie|tv)-[^"?#]+))"/g)) {
      const url = match[1];
      const path = match[2];
      if (seen.has(url)) continue;
      seen.add(url);
      if (!carriesTitle(path, slug) || !carriesYear(path, year)) continue;
      candidates.push({ url, sameType: path.startsWith(kind) });
    }

    const best = candidates.find(c => c.sameType) || candidates[0];
    if (!best) return { ...fallback, reason: 'no_exact_match', seen: seen.size };
    return { url: best.url, exact: true, reason: 'slug', candidates: candidates.length };
  });
}
