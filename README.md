# ZenouMath

A fast, night-arcade **study bench**: practice sets, a reference desk, a lecture
library, a tutor console and audio for focus, all in one tab. Static site
(HTML + CSS + vanilla JS) plus one small optional Node process for TMDB.

**https://zenoumath.space**

_Last updated: 7 November 2026._

## What it is, precisely

| Section | Route | Holds |
|---|---|---|
| Practice | `/` | 5,710 browser games, embedded from their publisher's own build |
| Reference desk | `/web` | A sandboxed frame, an address bar, and the proxy hand-off |
| Doorways | `/doorway` | Every proxy this site knows, each opening top level |
| Lectures | `/movies` | TMDB metadata, rails, search, genres, availability-checked players |
| One lecture | `/title` | Synopsis, cast, facts, recommendations, watch panel |
| Source index | `/sources` | Every lecture and reference site, graded by framing verdict |
| Tutor room | `/ai` | A live assistant console plus a graded directory of AI tools |
| Media shelf | `/social` | A searchable video library with in-page playback |
| Audio bench | `/music` | Spotify and SoundCloud official embeds, persistent player |
| My shelf | `/library` | Favourites, ratings, notes, playlists, milestones — local only |
| Search | `/search` | Every shelf at once |
| Practice player | `/play` | Full-bleed frame, fullscreen, timer, notes, rating |
| Mineral lab | `/mineral` | A Minecraft client build, JavaScript or WASM |
| Legal centre | `/legal` | Eight documents, one hub |

The section names are academic; the contents are what the table says. ZenouMath
is **not a school**, is not accredited, and has no affiliation with any school,
university or education authority. The footer, the agreement and the legal
pages all say so, and nothing on the site claims otherwise.

## Clean URLs

Every public URL is extensionless and every asset reference is root-absolute.

```
/                 <- index.html
/web              <- web/index.html
/legal/terms      <- legal/terms/index.html
```

There is no rewrite engine behind this: `web/index.html` simply *is* the page.
GitHub Pages serves a directory index for `/web` natively; `server/index.mjs`
does the same resolution locally so development and production behave
identically.

**One address, one file.** No flat `.html` file may exist next to a directory
of the same name. GitHub Pages resolves an extensionless path by trying a file
called `web`, then `web.html`, and only then `web/index.html` — the flat file
wins. A stub at `web.html` that redirects to `/web` therefore shadows the real
page and reloads itself forever. That is not a hypothetical: it put every page
of this site except `/` and `/doorway` into a redirect loop in production.
`audit.mjs` now fails the build if any `.html` at the root would shadow a
directory index, and `scripts/build-legal.mjs` deletes stray flat files before
writing so regenerating the legal centre cannot bring the loop back.

Old flat addresses (`/web.html`, `/legal/terms.html`) now 404 into the site's
own not-found page. GitHub Pages cannot issue a server-side redirect, and the
client-side substitute is exactly what caused the loop, so the trade is
accepted: bookmarks need updating once, nothing loops.

`node scripts/restructure.mjs` is the spent one-shot that produced this
layout; it now exits with a message instead of failing on the deleted flat
sources. `node scripts/clean-links.mjs` rewrites page references inside `js/`,
which is where most of them were.

## The first-visit agreement

`js/consent.js` + `css/consent.css`. On first visit the page content is hidden
*before first paint* by an inline head check, and a dialog explains what the
site is, what it does not do, what is stored and where liability stops.

- Nothing is pre-ticked. The Accept button is disabled until the box is ticked.
- Decline stores nothing and replaces the page with a plain "you declined".
- Accept stores `{ v, at }` — a version string and a timestamp, nothing else.
- Returning visitors are not asked again; bumping `VERSION` asks once more.
- Legal pages are exempt: you must be able to read the document you are
  agreeing to.
- The footer's _Review the use agreement_ link reopens it read-only.

## The legal centre

`legal/` is generated, not hand-maintained:

```
node scripts/build-legal.mjs
```

The prose lives in `scripts/legal-docs.mjs`; the shell (header, nav, footer,
cross-links, version stamp) is written once in `scripts/build-legal.mjs`.

Eight documents: Terms, Privacy, Acceptable Use, Copyright, Takedown process,
Disclaimer, Limitation of Liability, Contact. They are written against the
Privacy Act 1988 (Cth) and its APPs, the Australian Consumer Law, the Copyright
Act 1968 (Cth), and Western Australian jurisdiction.

Three things they deliberately do **not** do, because doing them would be false:

1. **No claimed accreditation** or school affiliation anywhere.
2. **No claimed safe harbour.** Section 115A of the Copyright Act is described,
   and the site states plainly that it does not assert that protection. There
   is a takedown process; a process is not a statutory shield.
3. **No excluded consumer guarantees.** The ACL carve-out appears in the Terms,
   the Disclaimer and the Liability page, in the same words.

Every fact only the operator can supply is a `[BRACKETED PLACEHOLDER]` —
operator legal name, ABN, postal address, log retention period, hosting
locations, designated copyright agent. They are listed together at
`/legal#placeholders` and `/legal#review`, with the four questions that need an
Australian lawyer rather than a template.

## Films & series (TMDB)

`/movies` and `/title` talk to a small Node process in `server/` because the API
credential must never reach the browser: the page fetches `/api/...` on its own
origin, the process adds the token server-side, and nothing in the HTML or JS
ever holds a key.

The server is optional for the rest of the site. Without it the discovery page
still loads and shows a setup card with the exact two lines to add; it never
spins forever or invents data.

| Route | Returns |
|---|---|
| `/api/config` | whether a credential is present, language, region, image base, attribution |
| `/api/feed` | `trending`, `popular`, `upcoming`, `now_playing`, `top_rated`, `airing_today`, `on_the_air`, paged |
| `/api/browse` | discover by type, genre and sort, paged |
| `/api/search` | multi, film or series search, paged |
| `/api/title` | one title with credits, videos, certification, similar and recommendations |
| `/api/genres` | the genre list for films or series |
| `/api/watch-links` | Movy and StreamEx links for one id, with the StreamEx slug resolved server-side |
| `/api/players` | availability-checked sources for one id, plus season/episode for series |
| `/api/players/health` | every host in the registry, probed |
| `/api/status` | uptime, cache stats, player count, whether an env file was loaded |

**Configuration** is one file. Copy `.env.example` to `.env` and set
`TMDB_READ_TOKEN` (a v4 JWT) or `TMDB_API_KEY` (a v3 key); `TMDB_LANGUAGE`,
`TMDB_REGION` and `PORT` are optional. Real environment variables win over the
file. `.env` is gitignored, and the static handler refuses every path beginning
with `/.`.

**Caching** is a shared TTL + LRU cache with single-flight: lists 30 minutes,
details 6 hours, genres 24 hours, search 5 minutes, player probes 10 minutes.
That is also what makes content refresh on its own — a new release appears in
`trending` when its list entry expires, with no deploy.

**Failures are named, not swallowed.** A 429 is retried once honouring
`Retry-After`; a 401 becomes `bad_credentials`; a 5xx becomes `upstream_error`;
a missing credential is a 503 flagged `setup` so the page renders the setup card
rather than an error toast.

**Attribution.** "This product uses the TMDB API but is not endorsed or
certified by TMDB." plus the official mark sits wherever the data appears.

## Magma, and why it was not working

Magma is an Ultraviolet/Scramjet proxy. The page you ask for is fetched by **a
service worker Magma registers on its own origin**. Two consequences the old
build ignored:

1. **A sandboxed iframe cannot register a service worker.** The previous design
   loaded Mantle's menu into a `srcdoc` frame, which then opened the app from a
   `window.open()` issued *after* an `await`. The popup arrived outside the
   click gesture, so browsers dropped it and the row did nothing; even when it
   did open, the proxy ran in a nested frame where its worker could not install.
2. **Seven CDN mirrors had to answer before the menu could draw at all.**

Both are gone. `js/web.js` now opens `magma-mantle.truegrid.cloud` at the top
level in its own tab, via a real `<a target="_blank">` click — never a popup
blocker target — and puts the address you were trying to reach on the
clipboard. `/doorway` lists every proxy with a live reachability probe from
*your* browser, because a server-side check would only say what our host could
see.

The app host is third-party and moves every few months. It is a single constant
in `js/web.js` and a list in `/doorway`.

## Verification

```
node scripts/audit.mjs            # links, canonicals, sitemap routes, 404, route shadows
node scripts/test-api.mjs         # every API route
node scripts/verify-ai.mjs        # re-probe the AI directory (--write to update)
node scripts/verify-movies.mjs    # re-probe the lecture sources
```

`audit.mjs` checks every internal `href`/`src`/`action` on 23 pages, that no
reference still ends in `.html`, that every sitemap route answers 200, that the
404 handler is the site's own page, that no clean URL serves a redirect stub,
and — the check that HTTP alone cannot make — that no flat `.html` file on disk
shadows a directory index.

## Deployment

GitHub Pages, custom domain, repository root.

- `CNAME` → `zenoumath.space`
- `.nojekyll` → so directory pages are served as-is
- `404.html` → a real not-found page, exempt from the agreement gate
- `sitemap.xml`, `robots.txt` → clean URLs only

A publish must **delete** the removed flat pages, not just upload new ones. If
your upload tool merges instead of mirroring, delete these from the repository
before the next publish, or the loop comes straight back:

```
web.html movies.html ai.html social.html music.html library.html search.html
sources.html title.html play.html mineral.html mantle.html _shot.html
webtest.html webtest2.html webtest3.html legal/*.html
```

Both `zenoumath.space` and `www.zenoumath.space` should resolve; the `www`
host is a DNS alias, not a second copy of the site.

## Local development

```
npm start                 # http://127.0.0.1:8123
npm run dev               # same, with --watch
```

No install step: there are no runtime dependencies. `node >= 20` for the server.
