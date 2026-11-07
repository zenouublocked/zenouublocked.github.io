// Proxy Players, availability + framing probe.
//
// The registry lives in catalog/players.json. Each entry carries a URL template
// ({id}, {s}, {e}), a priority, and a `licensing` field:
//
//   third-party  an embed host we did not license and cannot vouch for
//   authorised   the operator holds distribution rights for this source
//
// Nothing here decides what is legal; it records what the operator declared, so
// the UI can label a source honestly instead of implying a licence it does not
// have. Availability is measured, never assumed: a portal that answers 404 for a
// title is dropped for that title rather than shown as a broken button.
import fs from 'node:fs/promises';
import path from 'node:path';
import { TTL } from './cache.mjs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PROBE_TIMEOUT = 6500;

function fill(template, { id, season, episode }) {
  return String(template)
    .replaceAll('{id}', String(id))
    .replaceAll('{s}', String(season ?? 1))
    .replaceAll('{e}', String(episode ?? 1));
}

function framing(headers) {
  const xfo = (headers.get('x-frame-options') || '').toLowerCase();
  const csp = (headers.get('content-security-policy') || '').toLowerCase();
  if (xfo.includes('deny') || xfo.includes('sameorigin')) return 'blocked';
  const ancestors = /frame-ancestors([^;]*)/.exec(csp);
  if (ancestors) {
    const value = ancestors[1].trim();
    if (value.includes('*')) return 'direct';
    if (value.includes("'none'")) return 'blocked';
    return 'blocked';
  }
  return 'direct';
}

async function probeOne(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT),
    });
    // We only need the headers; stop the body so a video-sized response does not
    // get pulled down just to prove the host is alive.
    try { await res.body?.cancel(); } catch { /* already consumed */ }
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      ms: Date.now() - started,
      frame: framing(res.headers),
      final: res.url,
    };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, frame: 'unknown', error: e.name || 'error' };
  }
}

export async function loadRegistry(root) {
  const file = path.join(root, 'catalog', 'players.json');
  const raw = JSON.parse(await fs.readFile(file, 'utf8'));
  const list = Array.isArray(raw.players) ? raw.players : [];
  return list
    .filter(p => p && p.id && p.name && p.movie)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

/**
 * Resolve the providers for one title, availability-checked and ordered.
 * Returns only sources that answered, with the unavailable ones kept in a
 * separate list so the API can report them without the UI offering them.
 */
export async function providersFor(registry, cache, { type, id, season, episode }) {
  const wantsTv = type === 'tv';
  const usable = registry.filter(p => (wantsTv ? p.tv && p.tvOk !== false : p.movie));

  const results = await Promise.all(
    usable.map(async player => {
      const template = wantsTv ? player.tv : player.movie;
      const url = fill(template, { id, season, episode });
      const probe = await cache.wrap(
        `player:${url}`,
        TTL.player,
        () => probeOne(url),
      );
      return { player, url, probe };
    }),
  );

  const available = results
    .filter(r => r.probe.ok)
    .map(r => ({
      id: r.player.id,
      name: r.player.name,
      url: r.url,
      frame: r.probe.frame,
      latency: r.probe.ms,
      licensing: r.player.licensing || 'third-party',
      rightsNote: r.player.rightsNote || null,
      note: r.player.note || null,
    }));

  const unavailable = results
    .filter(r => !r.probe.ok)
    .map(r => ({
      id: r.player.id,
      name: r.player.name,
      reason: r.probe.status ? `HTTP ${r.probe.status}` : r.probe.error || 'no answer',
    }));

  return { available, unavailable };
}

/** Health of every host root, for the status endpoint. */
export async function registryHealth(registry, cache) {
  return Promise.all(
    registry.map(async player => {
      const probe = await cache.wrap(`health:${player.id}`, TTL.player, async () => {
        // A CDN can 404 its own root and still serve titles, so a 4xx here is
        // reported but does not count as down.
        const r = await probeOne(player.home || player.url || player.movie);
        return { ...r, ok: r.status > 0 && r.status < 500 };
      });
      return { id: player.id, name: player.name, ...probe };
    }),
  );
}

export { fill };
