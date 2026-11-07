/**
 * One-shot restructure: rebrand to ZenouMath, move every page to a clean
 * extensionless URL, and leave a redirect stub behind at the old .html path.
 *
 * Run from the repo root:  node scripts/restructure.mjs
 *
 * Input  : the flat *.html pages
 * Output : <slug>/index.html  (+ root index.html)
 *          <old>.html         a 10-line redirect stub
 *
 * Every internal reference becomes root-absolute ("/css/style.css", "/web"),
 * which is what makes the directory layout work on any static host. Pages are
 * then reachable at /web, /movies, ... with no extension, and old bookmarks
 * still land somewhere real.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const DOMAIN = 'https://zenoumath.space';

/** file -> { slug, nav, title, desc } */
const PAGES = [
  {
    file: 'index.html',
    slug: '',
    nav: '/',
    title: 'ZenouMath — a study bench for practice, reference and lectures',
    desc: 'ZenouMath is a study bench: practice games, a reference desk, a lecture library, a tutor console and audio for focus. Free, no account, no install.',
  },
  {
    file: 'web.html',
    slug: 'web',
    nav: '/web',
    title: 'Reference desk | ZenouMath',
    desc: 'Open any address in a framed stage, with a proxy doorway for the sites that refuse to be embedded. Sandboxed, with a visible address bar.',
  },
  {
    file: 'movies.html',
    slug: 'movies',
    nav: '/movies',
    title: 'Lecture hall | ZenouMath',
    desc: 'Film and television metadata from TMDB — trending, popular, upcoming and rated — with availability-checked play sources and no invented data.',
  },
  {
    file: 'ai.html',
    slug: 'ai',
    nav: '/ai',
    title: 'Tutor room | ZenouMath',
    desc: 'A live assistant console plus a directory of AI study tools, each graded by whether it can actually be framed.',
  },
  {
    file: 'social.html',
    slug: 'social',
    nav: '/social',
    title: 'Media shelf | ZenouMath',
    desc: 'A searchable YouTube library with in-page playback, plus short-form and community embeds, all through each company’s own player.',
  },
  {
    file: 'music.html',
    slug: 'music',
    nav: '/music',
    title: 'Audio bench | ZenouMath',
    desc: 'Paste a Spotify or SoundCloud link and it plays in the persistent bottom player, through each company’s official embed.',
  },
  {
    file: 'library.html',
    slug: 'library',
    nav: '/library',
    title: 'My shelf | ZenouMath',
    desc: 'Favourites, recently studied, playlists, ratings, notes and progress — all stored in this browser, never uploaded.',
  },
  {
    file: 'search.html',
    slug: 'search',
    nav: '/search',
    title: 'Search | ZenouMath',
    desc: 'Search every shelf at once: lectures, practice sets, tools and audio, with lecture results coming from TMDB when the API is running.',
  },
  {
    file: 'sources.html',
    slug: 'sources',
    nav: '/sources',
    title: 'Source index | ZenouMath',
    desc: 'Every lecture and reference site in one table, graded by framing verdict and last check date, with the dead ones kept and dated.',
  },
  {
    file: 'title.html',
    slug: 'title',
    nav: '/movies',
    title: 'One lecture | ZenouMath',
    desc: 'A single film or series: synopsis, cast, facts, recommendations and the availability-checked watch panel.',
  },
  {
    file: 'play.html',
    slug: 'play',
    nav: '/',
    title: 'Practice player | ZenouMath',
    desc: 'Full-bleed player with fullscreen, session timer, notes, a rating and a restart.',
  },
  {
    file: 'mineral.html',
    slug: 'mineral',
    nav: '/',
    title: 'Mineral lab | ZenouMath',
    desc: 'The Mineral client, JavaScript or WASM build, launched straight from this page.',
  },
  {
    file: 'mantle.html',
    slug: 'doorway',
    nav: '/web',
    title: 'Doorways | ZenouMath',
    desc: 'Every doorway this site knows about, probed live, each opening at the top level where a proxy can actually run.',
  },
];

/** old file -> new slug (for reference rewriting inside JS and HTML) */
const SLUG = Object.fromEntries(PAGES.map(p => [p.file, p.slug]));
SLUG['mantle.html'] = 'doorway';

const NAV_ITEMS = [
  ['/', 'Practice'],
  ['/web', 'Reference'],
  ['/movies', 'Lectures'],
  ['/ai', 'Tutor'],
  ['/social', 'Media'],
  ['/music', 'Audio'],
  ['/library', 'My shelf'],
];

function nav(current) {
  const rows = NAV_ITEMS.map(([href, label]) => {
    const cur = href === current ? ' aria-current="page"' : '';
    return `    <a href="${href}" data-nav${cur}>${label}</a>`;
  }).join('\n');
  return `<nav class="mainnav" aria-label="Sections">\n${rows}\n  </nav>`;
}

const FOOTER = `<footer class="sitefoot">
  <div class="foot-grid">
    <div>
      <span class="foot-mark">Zenou <b>Math</b></span>
      <p>Practice sets, a reference desk, a lecture library and audio for focus, in one tab. Free, no account, no install.</p>
      <p class="foot-small">Published at <a href="https://zenoumath.space/" rel="noopener">zenoumath.space</a></p>
    </div>
    <div>
      <h3>Where it comes from</h3>
      <p>Every practice set runs inside this page, embedded from its publisher's own build: <a href="https://www.hoodamath.com" rel="noopener">HoodaMath</a>, <a href="https://www.crazygames.com" rel="noopener">CrazyGames</a>, <a href="https://scratch.mit.edu" rel="noopener">Scratch</a> or the developer's own server. Nothing is re-hosted and credit stays with each creator.</p>
      <p>Lecture pages show metadata from TMDB and frame other people's players. Audio plays through the Spotify and SoundCloud official embeds.</p>
    </div>
    <div>
      <h3>Contact</h3>
      <p>Corrections, takedown notices and privacy requests: <a href="/legal/contact">the contact page</a>.</p>
      <p class="foot-small">ZenouMath is an independent study site. It is not a school and is not affiliated with one.</p>
    </div>
    <div>
      <h3>Legal</h3>
      <p class="foot-small">
        <a href="/legal">Legal centre</a> ·
        <a href="/legal/terms">Terms</a> ·
        <a href="/legal/privacy">Privacy</a> ·
        <a href="/legal/acceptable-use">Acceptable use</a> ·
        <a href="/legal/copyright">Copyright</a> ·
        <a href="/legal/takedown">Takedown</a> ·
        <a href="/legal/disclaimer">Disclaimer</a> ·
        <a href="/legal/contact">Contact</a>
      </p>
      <p class="foot-small"><a href="#" data-consent-review>Review the use agreement</a></p>
    </div>
  </div>
</footer>`;

/** Rewrite one relative reference to a root-absolute clean path. */
function toClean(ref) {
  if (/^(https?:|mailto:|tel:|data:|javascript:|about:|#|\/)/i.test(ref)) return ref;

  const [rawPath, hash = ''] = ref.split('#');
  const [file, query = ''] = rawPath.split('?');
  const suffix = (query ? `?${query}` : '') + (hash ? `#${hash}` : '');

  const page = file.replace(/^\.\//, '');
  if (SLUG[page] !== undefined) {
    const slug = SLUG[page];
    return (slug ? `/${slug}` : '/') + suffix;
  }
  if (/^legal\/[a-z-]+\.html$/.test(page)) {
    return `/legal/${page.replace(/^legal\//, '').replace(/\.html$/, '')}` + suffix;
  }
  if (/^(css|js|assets|catalog|games|legal)\//.test(page) || page === 'manifest.webmanifest') {
    return `/${page}` + suffix;
  }
  return ref;
}

function rewriteRefs(html) {
  return html.replace(/\b(href|src)="([^"]*)"/g, (m, attr, ref) => `${attr}="${toClean(ref)}"`);
}

function head(html, page) {
  const url = page.slug ? `${DOMAIN}/${page.slug}` : `${DOMAIN}/`;
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${page.title}</title>`);
  const descMeta = `<meta name="description" content="${page.desc.replace(/"/g, '&quot;')}">`;
  if (/<meta name="description" content="[^"]*">/i.test(out)) {
    out = out.replace(/<meta name="description" content="[^"]*">/i, descMeta);
  } else {
    out = out.replace(/(<title>[\s\S]*?<\/title>)/i, `$1\n${descMeta}`);
  }
  const seo = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:site_name" content="ZenouMath">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${page.title.replace(/"/g, '&quot;')}">`,
    `<meta property="og:description" content="${page.desc.replace(/"/g, '&quot;')}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${DOMAIN}/assets/logo.png">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('\n');
  if (/<link rel="canonical"/i.test(out)) {
    out = out.replace(/<link rel="canonical"[^>]*>/i, `__SEO__`);
    out = out.replace('__SEO__', seo);
  } else {
    out = out.replace(/(<meta name="theme-color"[^>]*>)/i, `$1\n${seo}`);
    if (!out.includes('rel="canonical"')) {
      out = out.replace(/<\/head>/i, `${seo}\n</head>`);
    }
  }
  if (!out.includes('/css/consent.css')) {
    out = out.replace(/<\/head>/i, `<link rel="stylesheet" href="/css/consent.css">\n</head>`);
  }
  /* Hide the page before first paint when there is no stored acceptance, so the
     gate never flashes over content. The timer is a failsafe: if consent.js
     never runs, the page shows itself rather than staying blank forever. */
  if (!out.includes('consent-pending')) {
    const precheck = `<script>try{if(!localStorage.getItem('zenoumath.consent'))document.documentElement.classList.add('consent-pending')}catch(e){document.documentElement.classList.add('consent-pending')}setTimeout(function(){document.documentElement.classList.remove('consent-pending')},3000)</script>`;
    out = out.replace(/(<meta charset="[^"]*">)/i, `$1\n${precheck}`);
  }
  return out;
}

function rebrand(html) {
  return html
    .replace(/Zenou Unblocked/g, 'ZenouMath')
    .replace(/<span class="wordmark-sub">unblocked<\/span>/gi, '<span class="wordmark-sub">math</span>')
    .replace(/<span class="foot-mark">Zenou <b>Unblocked<\/b><\/span>/gi, '<span class="foot-mark">Zenou <b>Math</b></span>');
}

const warnings = [];

function build(page) {
  let html = fs.readFileSync(path.join(ROOT, page.file), 'utf8');

  html = rebrand(html);
  if (!/<nav class="mainnav"/i.test(html)) warnings.push(`${page.file}: no mainnav to replace`);
  html = html.replace(/<nav class="mainnav"[\s\S]*?<\/nav>/i, nav(page.nav));
  if (!/<footer class="sitefoot"/i.test(html)) warnings.push(`${page.file}: no sitefoot to replace`);
  html = html.replace(/<footer class="sitefoot"[\s\S]*?<\/footer>/i, FOOTER);
  html = rewriteRefs(html);
  html = head(html, page);

  if (!html.includes('/js/consent.js')) {
    html = html.replace(/<\/body>/i, `<script src="/js/consent.js" defer></script>\n</body>`);
  }

  const dir = page.slug ? path.join(ROOT, page.slug) : ROOT;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return page;
}

function stub(page) {
  const target = page.slug ? `/${page.slug}` : '/';
  const url = page.slug ? `${DOMAIN}/${page.slug}` : `${DOMAIN}/`;
  // No JavaScript-only hop: a meta refresh works with scripting off, and the
  // canonical tells a crawler which URL is the real one.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved | ZenouMath</title>
<link rel="canonical" href="${url}">
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
</head>
<body style="margin:0;background:#07080e;color:#e8e8f0;font:15px/1.6 system-ui,sans-serif;display:grid;place-items:center;height:100vh">
<p>This page has moved to <a style="color:#c084fc" href="${target}">${target}</a>.</p>
</body>
</html>
`;
}

/* One-shot migration: it reads the original flat pages, writes the directory
   form, then replaces the flat originals with stubs it would refuse to
   overwrite on a second run. The flat pages are gone for good now — the stubs
   shadowed the directories on GitHub Pages and caused a redirect loop — so
   this exits cleanly instead of throwing ENOENT. */
const SOURCE = path.join(ROOT, 'web.html');
if (!fs.existsSync(SOURCE)) {
  console.error(
    'Nothing to do: the flat pages are gone and the site already lives at /<slug>/.\n' +
      'This migration script is spent; edit <slug>/index.html directly.',
  );
  process.exit(1);
}
if (fs.readFileSync(SOURCE, 'utf8').includes('Moved | ZenouMath')) {
  console.error('Already restructured. Restore the flat pages from .tmp/orig first.');
  process.exit(1);
}

const built = PAGES.map(build);
for (const page of PAGES) {
  if (page.file === 'index.html') continue;
  fs.writeFileSync(path.join(ROOT, page.file), stub(page));
}

/* 404 stays at the root, but its hop has to be the new root. */
const four = fs
  .readFileSync(path.join(ROOT, '404.html'), 'utf8')
  .replace(/content="0; url=[^"]*"/, 'content="0; url=/"')
  .replace(/location\.replace\('[^']*'\)/, "location.replace('/')");
fs.writeFileSync(path.join(ROOT, '404.html'), four);

console.log(`built ${built.length} pages + ${built.length - 1} redirect stubs`);
for (const p of built) console.log(`  ${p.file.padEnd(16)} -> ${p.slug ? '/' + p.slug : '/'}`);
for (const w of warnings) console.log(`  warn: ${w}`);
