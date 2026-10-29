/* Zenou Unblocked — provider-independent playback resolution (audio + video).
 *
 * Implemented providers — documented, permitted, key-free interfaces only:
 *  - 'spotify'    open.spotify.com/embed/{kind}/{id}   (official Spotify embed)
 *                 metadata via https://embed.spotify.com/oembed?public documented oEmbed
 *  - 'soundcloud' w.soundcloud.com/player/?url=...    (official SoundCloud Widget)
 *  - 'youtube'    youtube-nocookie.com/embed/{key}    (official trailers from cached TMDB data)
 *
 * Explicitly NOT integrated (recorded here on purpose):
 *  - Vidking (vidking.net) and movy.sx style movie embeds: these are
 *    stream-embed services for film/TV with no verifiable licensing. Embedding
 *    them would redistribute unauthorised streams, so playback for movies
 *    is limited to trailers + official-platform links.
 */
'use strict';

const PROVIDERS = {
  spotify: {
    name: 'Spotify',
    legal: 'official Spotify embed player',
    /* url formats: /embed/track/{id}, /embed/album/{id}, ... */
    url(ctx) {
      const m = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(ctx.url || '');
      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=zenou` : '';
    },
  },
  soundcloud: {
    name: 'SoundCloud',
    legal: 'official SoundCloud Widget embed',
    url(ctx) {
      if (!ctx.url || !/^https?:\/\/(www\.|api\.)?soundcloud\.com\//.test(ctx.url)) return '';
      const p = new URLSearchParams();
      p.set('url', ctx.url);
      p.set('color', '#29e0a0');
      p.set('auto_play', 'false');
      p.set('hide_related', 'true');
      p.set('show_comments', 'false');
      p.set('visual', 'false');
      return `https://w.soundcloud.com/player/?${p.toString()}`;
    },
  },
  youtube: {
    name: 'YouTube',
    legal: 'official YouTube embed (trailer keys cached at build time)',
    url(ctx) { return ctx.ytKey ? `https://www.youtube-nocookie.com/embed/${ctx.ytKey}?rel=0` : ''; },
  },
};

/* Spotify oEmbed metadata (public, documented) for a pasted link. */
async function spotifyMeta(url) {
  try {
    const r = await fetch(`https://embed.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    return await r.json();   // { title, thumbnail_url, ... }
  } catch { return null; }
}

/* movies/TV: only trailer playback is lawful here. */
function resolveMovieSources(cachedYtKeys) {
  const out = [];
  (cachedYtKeys || []).forEach(k => out.push({ p: 'youtube', ctx: { ytKey: k } }));
  return out;
}
