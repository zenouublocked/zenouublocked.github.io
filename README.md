# Zenou Unblocked

A fast, night-arcade **games + entertainment portal** — near-black indigo, magenta-to-violet neon glow, glass panels and slow aurora light. Static site (HTML + CSS + vanilla JS) for GitHub Pages:

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
| `playgta5.html` | PlayGTA5: unofficial local GTA V browser port — download ZIP, disclaimer, Steps |

## PlayGTA5 (local project — not an on-site game)

`playgta5/` holds the complete playgta5 source snapshot (server, workers, engine code, bundled Python runtime, evidence docs). It is an unofficial, independently developed, reverse-engineered and vibe-coded project that recreates GTA V's features locally; it is not an official copy of GTA V and is not affiliated with or endorsed by Rockstar Games. No claim of legal authorization or copyright exemption is made.

- **It never runs on the website.** The page gives a download (`downloads/playgta5.zip`, ≈ 16 MB) plus Steps to run `Launch-Local.cmd` on your own Windows PC at `http://localhost:8000/`.
- The ~19.7 GB `.mirror` game-data folder is **not** hosted here — users provide their own copy; nothing from it is committed to this repository.
- Takedown / content-takedown contact: **nuxxzul@gmail.com** (also in every page's footer).

## The catalog (games)

Real, verified browser games only — no fakes, no dead links:

| | |
|---|---|
| Total games | **6,107** |
| Playable on-site (iframe embed of the official build) | **5,871** |
| — Embedded through CrazyGames' official game-file host | 4,272 |
| — Embedded from the game publisher's own build | 346 |
| — Played in the official Scratch player | 1,250 |
| — Locally hosted here (open-source, licence permits it) | 3 — HexGL, Clumsy Bird, 2048 |
| External-only (play on the official site) | **236** |
|   — of which Poki (official page + CDN thumbnail) | 208 |
|   — of which publisher-partner builds that whitelist only crazygames.com | 18 |
|   — of which neal.fun (not open source) | 10 |

Verification: every CrazyGames slug was HTTP-checked against the official file host and its wrapper config; every Scratch ID against the official Scratch API; every Poki slug HTTP-validated on poki.com in October 2026 (16 dead slugs pruned). Every CrazyGames title whose build lives on `games.crazygames.com` is embedded in the player, including the 68 whose catalogue entry pointed at a crazygames.com page. Publisher builds that send no framing restriction are embedded too; the 18 partner builds that whitelist only `crazygames.com` and the 208 Poki titles (which send `frame-ancestors https://*.poki.io`) are honest external links. A minority of embedded publishers hard-lock in-game with a “play exclusively on CrazyGames.com” notice, so the player always carries an Official site button. Poki serves `frame-ancestors https://*.poki.io`, so Poki titles are honest external links — official poki.com page plus the official CDN thumbnail, never an iframe. **No game files are mirrored**; originals stay with their creators — see the credit line on every player page.

neal.fun games are **not open source**, so they appear as external link-outs, honoring their site.

## Movies & TV (TMDB)

Discovery data is from **TMDB** and refreshed by running, from the repo root, once you place your free TMDB key in an environment variable:

```bash
TMDB_KEY=your_key_here node scripts/fetch-tmdb.mjs
```

It writes public catalog files to `data/ent/*.json` that the site serves, so **the browser never handles the key** and no secret ships with the site. The data files carry an `updated` timestamp, surfaced as "Catalog updated …" on the pages. IMDb itself offers no public API, so TMDB (which IMDb data mirrors in the public sense) is the configured provider and it is swappable via `data/ent/provider.json`.

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
├── data/ent/      (TMDB snapshot JSON, timestamped)
├── assets/thumbs/ (SVG placeholders for locally hosted games)
├── games/         (locally hosted open-source games)
└── scripts/       (TMDB fetcher; run manually, never shipped)
```

## Design

The interface is a neon night arcade: a near-black indigo canvas, a magenta-to-violet accent pair, glass panels and a slow aurora with bokeh drifting behind the content.

- **Palette** — ink `#07080e`, glass `rgba(18,21,33,.68)`, magenta `#ff4fb0`, violet `#8b5cf6`, text `#eef1f8`. Body text meets WCAG AA on the dark canvas.
- **Type** — Archivo variable (width 75–125, weight 400–900). Display type uses the width axis and a white→magenta gradient with a soft drop glow.
- **Structure** — floating glass top bar, masthead with the most-played chart, full-width featured banner, pill category index, rails per collection, catalogue grid and a glass footer.
- **Personalisation** — Settings → Look & feel: accent (seven pairs), glow strength (off / soft / medium / strong), corner style, card density, background (aurora / stars / snow / stars + snow / grid / plain / custom image) and motion (full / calm). Settings → Background image takes any photo, resizes it in the browser, stores it in `localStorage` and adds a dim slider so text stays readable. Everything is stored locally; a small inline boot script in each page's `<head>` applies the saved look before first paint.
- **Animated atmosphere** — `js/atmosphere.js` builds one fixed layer stack (nebula, custom image, dim, grid, canvas) and draws a twinkling starfield and swaying snowfall at device pixel ratio, pausing in background tabs and respecting `prefers-reduced-motion`. It is decorative only: `pointer-events: none`, hidden from assistive tech.
- **Motion** — aurora drift, bokeh drift, a slow gradient pan on the headline, hover lift and glow. `prefers-reduced-motion` and the Calm setting both stop the ambient animation.

All styles live in `css/style.css`. The look is driven by `data-theme`, `data-glow`, `data-radius`, `data-density`, `data-bg` and `data-motion` on `<html>`; the matching tokens are `--accent`, `--accent-2`, `--accent-rgb`, `--glow-a`, `--glow-b`, `--radius`, `--card-min`, `--grid-gap`, `--bg-dim` and `--custom-bg`.

## Licensing

The site code is yours. Game titles, artwork, TMDB data, Spotify/SoundCloud audio and video content all remain the property of their respective rights holders and are used per each provider's documented embed terms; attribution is shown on each detail/player page.
