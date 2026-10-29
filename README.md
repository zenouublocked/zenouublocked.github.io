# Zenou Unblocked

A fast, dark, emerald-accented **games + entertainment portal**. Static site (HTML + CSS + vanilla JS) for GitHub Pages:

**https://zenoutools.github.io/zenou-unblocked/**

_This is a sister project to Zenou Tools; it does not touch or replace it._
_Last updated: October 29, 2026._

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Homepage: hero, trending, collections rail, media rails, game grid, random-game button |
| `play.html` | Game player: full-bleed frame, fullscreen, sound toggle (local games), loading/error states, fallback link-out |
| `movies.html` / `tv.html` | TMDB-powered trending / popular / top-rated / upcoming rails |
| `detail.html` | Movie/TV detail page: artwork, cast, trailer (YouTube), watchlist, similar titles; TV: season/episode browsing |
| `watch.html` | Playback view: official trailer embed, authorized stream providers when available, error state + link-outs |
| `music.html` | Music library: paste a Spotify or SoundCloud link and it plays in the persistent bottom player via each company's official embed |
| `search.html` | Global search over games, movies, TV and music items |
| `library.html` | Watchlist, favourites, history, saved music — all per-device (`localStorage`) |

## The catalog (games)

Real, verified browser games only — no fakes, no dead links:

| | |
|---|---|
| Total games | **5,920** |
| Playable on-site (iframe embed of the official build) | **5,764** |
| — Hosted from CrazyGames' official game-file host | 4,206 |
| — Hosted from the game publisher's own build | 308 |
| — Played in the official Scratch player | 1,250 |
| External-only (play on the official site) | **156** |
| Locally hosted here (open-source, license permits it) | **5** — HexGL, Clumsy Bird, 2048, ns-shaft, plus the Scratch-embedded picks |

Verification: every CrazyGames slug was HTTP-checked against the official file host and its wrapper config; every Scratch ID against the official Scratch API. Titles whose publisher disables embedding (e.g. "play exclusively on CrazyGames") are honestly listed as external-only and never put in an iframe. **No game files are mirrored**; originals stay with their creators — see the credit line on every player page.

neal.fun games are **not open source**, so they appear as external link-outs, honoring their site.

## Movies & TV (TMDB)

Discovery data is from **TMDB** and refreshed by running, from the repo root, once you place your free TMDB key in an environment variable:

```bash
TMDB_KEY=your_key_here node scripts/fetch-tmdb.mjs
```

It writes public catalog files to `data/media/*.json` that the site serves, so **the browser never handles the key** and no secret ships with the site. The data files carry an `updated` timestamp, surfaced as "Catalog updated …" on the pages. IMDb itself offers no public API, so TMDB (which IMDb data mirrors in the public sense) is the configured provider and it is swappable via `data/media/provider.json`.

**Metadata ≠ permission.** Full films are not streamed on this site. Every detail page plays *official YouTube trailers* where available, and the Watch page provides authorized watch links (IMDb, TMDB, JustWatch). Sites like Vidking or movy.sx are **not** integrated because they distribute unlicensed streams — this site does not frame them and does not host or rehost any film files.

## Music (official embeds only)

Playback uses each provider's **official embeddable widget**:

- **Spotify** – `open.spotify.com/embed/…` iframe (official, token-free)
- **SoundCloud** – `w.soundcloud.com/player` widget API

Paste any track/album/playlist/artist link into the search box or the paste field and it plays in the persistent bottom player. The widget itself carries the provider's own branding/controls; nothing about it is re-skinned or hidden. No streams are scraped and no protected audio is copied.

## Tab masking & settings

The settings panel (gear icon in the top bar of every page) lets you swap the tab title and favicon (presets such as YouTube, Google, Drive, Classroom, Roblox, plus a custom upload) and switch the theme accent. Stored only in `localStorage`; nothing leaves the device.

## Architecture

- Pure HTML/CSS/JS — no build step, no backend, no paid APIs.
- `catalog/manifest.json` indexes all games in small chunks for efficient lazy loading.
- `js/` is grouped by feature (`app.js` games, `media.js`/`ent.js` movies/TV, `music*.js`, `watch.js`/`providers.js`, `search.js`, `library.js`, `play.js`, `settings.js`).
- All thumbnails and images lazy-load with the browser's native `loading="lazy"`.
- Relative paths throughout — works under `/zenou-unblocked/`.

## Deploying to GitHub Pages

Push the contents of this folder to your `zenoutools/zenou-unblocked` repo's `main` branch (or the `docs/` folder of a repo). Pages settings: deploy from branch `main`, root. No build step required.

Or upload the provided `zenou-unblocked.zip` into GitHub's "upload files" web UI (extract at repo root).

## Try it locally

```bash
cd zenou-unblocked
python -m http.server 8080     # then open http://localhost:8080/
```

(Or `npx serve .` if you prefer Node's http server.)

## Structure

```
zenou-unblocked/
├── index.html  play.html  movies.html  tv.html  detail.html  watch.html
├── music.html  search.html  library.html
├── css/style.css
├── js/            (feature modules)
├── catalog/       (game manifest chunks)
├── data/media/    (TMDB snapshot JSON, timestamped)
├── assets/thumbs/ (SVG placeholders for locally hosted games)
├── games/         (locally hosted open-source games)
└── scripts/       (TMDB fetcher; run manually, never shipped)
```

## Licensing

The site code is yours. Game titles, artwork, TMDB data, Spotify/SoundCloud audio and video content all remain the property of their respective rights holders and are used per each provider's documented embed terms; attribution is shown on each detail/player page.
