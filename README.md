# Zenou Unblocked

A fast, night-arcade **browser games portal**, near-black indigo, magenta-to-violet neon glow, glass panels and slow aurora light. Static site (HTML + CSS + vanilla JS) for GitHub Pages:

**https://zenoutools.github.io/zenou-unblocked/**

_This is a sister project to Zenou Tools; it does not touch or replace it._
_Last updated: October 30, 2026._

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Homepage: masthead stats, most-played chart, featured banner, collection chips, personalised shelves, advanced filters, catalogue grid |
| `play.html` | Game player: full-bleed frame, fullscreen, sound toggle (local games), session timer, star rating, notes, add-to-playlist, report, restart, loading/error states. Mineral and FivePlay replace it with their own local pages |
| `web.html` | Embedded web: address bar, sandboxed stage, Magma proxy door, key-bound web shortcuts, URL masking and about:blank support |
| `social.html` | Media: searchable YouTube library with in-page playback, plus TikTok, Instagram and Discord embeds and the Magma hand-off |
| `mineral.html` | Mineral: EaglercraftX Minecraft client, JavaScript or WASM build |
| `music.html` | Music library: paste a Spotify or SoundCloud link and it plays in the persistent bottom player via each company's official embed |
| `search.html` | Global search over games and music |
| `library.html` | My Library hub: overview + stats, favourites, recently played, playlists, ratings & notes, achievements, hidden games, data tools |
| `playgta5.html` | PlayGTA5: unofficial local GTA V browser port, download ZIP, disclaimer, steps |

Movies and TV were removed in October 2026. They depended on a TMDB snapshot for discovery only (no licensed playback), and the section was not worth keeping without it, the site is games-first now.

## The catalog (games)

Real, verified browser games only, no fakes, no dead links:

| | |
|---|---|
| Total games | **6,568** |
| Playable on-site | **6,568** |
|, Embedded through CrazyGames' game hosts or publisher builds | 3,008 |
|, Played in the official Scratch player | 2,893 |
|, Played from HoodaMath's own mobile build | 661 |
|, Locally hosted here (open-source, licence permits it) | 4, HexGL, Clumsy Bird, 2048, Mineral |
|, GameDistribution build | 1, Moto X3M |
|, Direct publisher app page | 1, FivePlay |

**Starts with no pre-roll ad: 3,901 games**, everything except the CrazyGames file-host embeds. Nothing links out to another site: titles that refused to embed were removed from the catalogue.

### How embedding is verified

Every CrazyGames slug is read from the official wrapper config at
`games.crazygames.com/en_US/<slug>/index.html`. That page carries a `disableEmbedding`
flag: when it is `true`, the build refuses to run on any other domain. Those titles are
not listed at all, so nobody is dropped into a dead frame. `scripts/verify-crazygames.py`
re-checks the catalogue and rewrites both `catalog/games.json` and
`catalog/manifest.json`.

Every Scratch ID is checked against the public Scratch API and played in the official
`/embed` player. Every HoodaMath build is checked for HTTP 200 and for the absence of
`X-Frame-Options` or a CSP `frame-ancestors` block. **No game files are mirrored**,
originals stay with their creators, and every player page credits them.

Mineral and FivePlay open their own full-page players from the same tab. FivePlay needs a
browser with 64-bit WebAssembly memory (current Chrome, Edge or Firefox); older embedded
browsers show a compatibility notice instead of a blank frame.

### Ad-free shelf

The catalogue rail has a **No pre-roll ads** chip: 3,901 Scratch, self-hosted, HoodaMath
and publisher-hosted games that start without CrazyGames' pre-game screen. The 2,667
games served from their file host run inside their own ad-supported wrapper; those ads
cannot be removed without modifying or re-hosting the build.

Scratch entries are produced by `python scripts/fetch-scratch.py [target]`, which reads
the public Scratch search API and appends metadata plus the official embed URL only. It
paces itself, backs off on HTTP 429 and writes the catalogue incrementally.

## The player and library

Everything personal is stored in this browser (`localStorage`), there is no account and
nothing is uploaded.

- **Command palette**, `Ctrl/⌘ K` searches every game, page and action.
- **Ratings, notes, playlists**, per game, with a playlist picker on the player page.
- **Playtime + session timer**, banked on tab hide so a quick close still counts.
- **XP, levels, 22 achievements, streaks**, My Library → Overview / Achievements.
- **Continue playing, top rated, “because you played”, hidden gems**, shelves that build
  themselves from your history.
- **Hide a game**, the × on any card, reversible in My Library → Hidden.
- **Advanced filters**, source, category, popularity, download size, plus eight sort
  orders and a grid/list toggle; all persisted.
- **Backup**, export/import one JSON file from My Library → Data.
- **Installable app**, web manifest + a conservative service worker (network-first for
  HTML/catalogue, cache-first for assets). The worker is skipped on localhost so local
  edits are never hidden by a stale cache.

Keyboard defaults: `/` search, `4` random, `1` games, `2` library, `3` settings, `?` shortcuts,
`Space` fullscreen on a game. Every binding can be changed in Settings → Shortcut keys; defaults
avoid letters so typing in a game never navigates away.

## PlayGTA5 (local project, not an on-site game)

`playgta5/` holds the complete playgta5 source snapshot (server, workers, engine code,
bundled Python runtime, evidence docs). It is an unofficial, independently developed,
reverse-engineered project that recreates GTA V's features locally; it is not an official
copy of GTA V and is not affiliated with or endorsed by Rockstar Games. No claim of legal
authorization or copyright exemption is made.

- **It never runs on the website.** The page gives a download (`downloads/playgta5.zip`,
  ≈ 16 MB) plus steps to run `Launch-Local.cmd` on your own Windows PC at
  `http://localhost:8000/`.
- The ~19.7 GB `.mirror` game-data folder is **not** hosted here, users provide their own
  copy; nothing from it is committed to this repository.
- Takedown / content-takedown contact: **nuxxzul@gmail.com** (also in every page's footer).

## Music (official embeds only)

Playback uses each provider's **official embeddable widget**:

- **Spotify** - `open.spotify.com/embed/…` iframe (official, token-free)
- **SoundCloud** - `w.soundcloud.com/player` widget API

Paste any track/album/playlist/artist link into the search box or the paste field and it
plays in the persistent bottom player. Nothing about the widget is re-skinned or hidden.
No streams are scraped and no protected audio is copied.

## Web, Media & Mineral

- **Web** (`web.html`), a sandboxed frame with an address bar, built-in doors and key-bound quick-launch shortcuts. Bind each one in Settings → Web shortcuts. Pressing its key leaves Zenou and opens that exact address in the same tab; Math Tutorsmart shows its code (8329) before it sends you there. Sites that send `X-Frame-Options` or `frame-ancestors` still refuse the frame; Magma is offered as the proxy path instead.
- **Mineral** (`mineral.html`), EaglercraftX inside the site. It defaults to the JavaScript build because the WASM build needs JSPI, which most browsers still leave off; if the browser exposes JSPI, the WASM build is chosen automatically. The version menu switches builds, and the choice is remembered.

## Settings & appearance

The settings panel (gear icon on every page) covers:

- **Accent**, 12 presets, plus a **custom hue slider** that overrides them.
- **Glow strength**, **corner style**, **card density**, **motion** (full / calm).
- **Background**, aurora, stars, snow, stars + snow, grid, plain, or your own image
  (resized in the browser, dim slider, stored locally).
- **Tab disguise**, swap the tab title and favicon (YouTube, Drive, Classroom, Roblox
  presets or a custom upload).
- **Web shortcuts**, add one at a time up to 12; each has its own key and URL. Pressing the key opens the address in this tab, duplicate keys and URLs are refused, and a shortcut must be removed before its address can change.
- **Shortcut keys**, rebind search, random, games, library, settings and the shortcut sheet; defaults use digits and punctuation, and duplicate keys are refused.
- **App & shortcuts**, install the app, show all shortcuts, jump to library sections.

A small inline boot script in each page's `<head>` applies the saved look before first
paint.

## Architecture

- Pure HTML/CSS/JS, no build step, no backend, no paid APIs.
- `catalog/games.json` is the single catalogue; `catalog/manifest.json` records the
  verification counts and method.
- `js/` is grouped by feature: `app.js` (catalogue/home), `play.js` (player),
  `library.js` (My Library), `zenou-plus.js` (shared layer: palette, store, achievements,
  toasts, shortcuts, PWA), `settings.js`, `atmosphere.js`, `search.js`, `social.js`
  (Media), `web.js` (embedded web), `music*.js`, `playgta5` helpers.
- `fiveplay/` is an isolated same-origin player for FivePlay: a tiny service worker adds
  COOP/COEP headers, then the page loads fiveplay.lol in its own frame.
- `css/style.css` holds the design system; `css/plus.css`, `css/home.css`, `css/social.css`,
  `css/web.css` and `css/mineral.css` hold page-level components.
- Relative paths throughout, works under `/zenou-unblocked/`.

## Deploying to GitHub Pages

Push the contents of this folder to your `zenoutools/zenou-unblocked` repo's `main` branch
(or the `docs/` folder of a repo). Pages settings: deploy from branch `main`, root. No
build step required.

## Try it locally

```bash
cd zenou-unblocked
python -m http.server 8080     # then open http://localhost:8080/
```

(Or `npx serve .` if you prefer Node's http server.)

## Structure

```
zenou-unblocked/
├── index.html  play.html  web.html  social.html  mineral.html
├── music.html  search.html  library.html  playgta5.html
├── fiveplay/      (isolated FivePlay player + COI service worker)
├── css/style.css  css/plus.css  css/home.css  css/social.css  css/web.css  css/mineral.css
├── js/            (feature modules)
├── catalog/       (games.json, media.json, verification manifest)
├── assets/thumbs/ (SVG placeholders for locally hosted games)
├── games/         (locally hosted open-source games)
└── scripts/       (catalogue fetchers; run manually, never shipped)
```

## Design

The interface is a neon night arcade: a near-black indigo canvas, a magenta-to-violet
accent pair, glass panels and a slow aurora with bokeh drifting behind the content.

- **Palette**, ink `#07080e`, glass `rgba(18,21,33,.68)`, magenta `#ff4fb0`, violet
  `#8b5cf6`, text `#eef1f8`. Body text meets WCAG AA on the dark canvas.
- **Type**, Archivo variable (width 75-125, weight 400-900). Display type uses the width
  axis and a white→magenta gradient with a soft drop glow.
- **Structure**, floating glass top bar, masthead with the most-played chart, full-width
  featured banner, pill category index, rails per collection, catalogue grid and a glass
  footer.
- **Animated atmosphere**, `js/atmosphere.js` builds one fixed layer stack (nebula,
  custom image, dim, grid, canvas) and draws a twinkling starfield and swaying snowfall at
  device pixel ratio, pausing in background tabs and respecting `prefers-reduced-motion`.
  Decorative only: `pointer-events: none`, hidden from assistive tech.
- **Motion**, aurora drift, bokeh drift, hover lift and glow; `prefers-reduced-motion`
  and the Calm setting both stop the ambient animation.

The look is driven by `data-theme`, `data-glow`, `data-radius`, `data-density`, `data-bg`,
`data-motion` and `data-view` on `<html>`; matching tokens are `--accent`, `--accent-2`,
`--accent-rgb`, `--glow-a`, `--glow-b`, `--radius`, `--card-min`, `--grid-gap`,
`--bg-dim` and `--custom-bg`.

## Licensing

The site code is yours. Game titles, artwork, Spotify/SoundCloud audio and video content
remain the property of their respective rights holders and are used per each provider's
documented embed terms; attribution is shown on each player page.
