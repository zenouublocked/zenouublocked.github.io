/**
 * Build the legal centre.
 *
 * The shell (header, nav, footer, cross-links, version stamp) is written once
 * here; the documents themselves live in scripts/legal-docs.mjs. Run from the
 * repo root:
 *
 *   node scripts/build-legal.mjs
 *
 * Output: legal/index.html and legal/<slug>/index.html for each document.
 *
 * Editorial rules baked into the copy:
 *   · nothing untrue is asserted — no claimed accreditation, no claimed
 *     licence, no claimed safe-harbour protection;
 *   · every fact only the operator can supply is a [BRACKETED PLACEHOLDER];
 *   · rights that cannot lawfully be excluded (Australian Consumer Law) are
 *     never excluded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DOCS } from './legal-docs.mjs';

const ROOT = process.cwd();
const DOMAIN = 'https://zenoumath.space';
const UPDATED = '7 November 2026';
const VERSION = '2026-11-07';

const NAV = [
  ['/', 'Practice'],
  ['/web', 'Reference'],
  ['/movies', 'Lectures'],
  ['/ai', 'Tutor'],
  ['/social', 'Media'],
  ['/music', 'Audio'],
  ['/library', 'My shelf'],
];

function shell(doc) {
  const navRows = NAV.map(([href, label]) => `    <a href="${href}" data-nav>${label}</a>`).join('\n');
  const crossNav = DOCS.map(d => `<a href="/legal/${d.slug}">${d.label}</a>`).join('\n      ');
  const canonical = doc.slug ? `${DOMAIN}/legal/${doc.slug}` : `${DOMAIN}/legal`;

  const toc = doc.toc
    ? `  <nav class="legal-toc" aria-label="On this page">
    <h2>On this page</h2>
    <ol>
${doc.toc.map(([id, label]) => `      <li><a href="#${id}">${label}</a></li>`).join('\n')}
    </ol>
  </nav>`
    : '';

  const status = doc.status === false
    ? ''
    : `  <div class="legal-status">
    <strong>Working draft, not legal advice.</strong> This document describes what the site actually does rather than copying a template. Items in <code>[SQUARE BRACKETS]</code> are facts only the operator can supply and must be completed before this page is relied on. <a href="/legal/contact#review">What needs review</a>.
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<script>try{if(!localStorage.getItem('zenoumath.consent'))document.documentElement.classList.add('consent-pending')}catch(e){document.documentElement.classList.add('consent-pending')}setTimeout(function(){document.documentElement.classList.remove('consent-pending')},3000)</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>try{var r=document.documentElement,p=JSON.parse(localStorage.getItem('zenou_prefs')||'{}');var t=p.theme;if(t)r.dataset.theme=t;['glow','radius','density','bg','motion'].forEach(function(k){if(p[k])r.dataset[k]=p[k]})}catch(e){}</script>
<title>${doc.title}</title>
<meta name="description" content="${doc.desc}">
<meta name="theme-color" content="#07080e">
<link rel="canonical" href="${canonical}">
<meta property="og:site_name" content="ZenouMath">
<meta property="og:type" content="article">
<meta property="og:title" content="${doc.title}">
<meta property="og:description" content="${doc.desc}">
<meta property="og:url" content="${canonical}">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/assets/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/logo-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/plus.css">
<link rel="stylesheet" href="/css/legal.css">
<link rel="stylesheet" href="/css/consent.css">
</head>
<body>

<header class="topbar">
  <a class="wordmark" href="/" aria-label="ZenouMath home">
    <span class="brand-mark" aria-hidden="true"><img src="/assets/logo.png" alt="" width="38" height="38" decoding="async"></span>
    <span class="wordmark-text">
      <span class="wordmark-lines">Zenou</span>
      <span class="wordmark-sub">math</span>
    </span>
  </a>
  <nav class="mainnav" aria-label="Sections">
${navRows}
  </nav>
  <div class="bar-tools">
    <form class="searchbox" role="search" action="/search" method="get">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 1 1-4.32 13.64L3 19.85 3.94 20.8l3.18-3.18A7.5 7.5 0 0 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/></svg>
      <input name="q" type="search" placeholder="Search everything…" aria-label="Search everything">
    </form>
  </div>
</header>

<main class="legal-main">
  <header class="legal-head">
    <p class="legal-kicker">${doc.kicker || 'Legal'}</p>
    <h1>${doc.h1}</h1>
    <p>${doc.intro}</p>
  </header>
${status}
${toc}
  <div class="legal-body">
${doc.body}
  </div>

  <p class="legal-foot">Version ${VERSION}. Last updated ${UPDATED}. ZenouMath is an independent study site: not a school, not accredited, and not affiliated with any school, university or education authority.</p>

  <nav class="legal-nav" aria-label="Legal documents">
      ${crossNav}
  </nav>
</main>

<footer class="sitefoot">
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
</footer>

<script src="/js/atmosphere.js" defer></script>
<script src="/js/zenou-plus.js" defer></script>
<script src="/js/consent.js" defer></script>
</body>
</html>
`;
}

for (const doc of DOCS) {
  const dir = doc.slug ? path.join(ROOT, 'legal', doc.slug) : path.join(ROOT, 'legal');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), shell(doc));
  console.log(`  ${doc.slug ? '/legal/' + doc.slug : '/legal'}`);
}

/* Old flat addresses (/legal/terms.html) keep working: same rule as the rest
   of the site, a meta refresh plus a canonical, no JavaScript required. */
const LEGACY = [
  ['terms', 'terms'],
  ['privacy', 'privacy'],
  ['acceptable-use', null],
  ['copyright', 'copyright'],
  ['takedown', 'dmca'],
  ['disclaimer', 'disclaimer'],
  ['liability', null],
  ['contact', 'contact'],
];
for (const [slug, legacy] of LEGACY) {
  for (const name of [slug, legacy]) {
    if (!name) continue;
    const target = `/legal/${slug}`;
    fs.writeFileSync(
      path.join(ROOT, 'legal', `${name}.html`),
      `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">\n<title>Moved | ZenouMath</title>\n<link rel="canonical" href="${DOMAIN}${target}">\n<meta name="robots" content="noindex,follow">\n<meta http-equiv="refresh" content="0; url=${target}">\n<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>\n</head><body style="margin:0;background:#07080e;color:#e8e8f0;font:15px system-ui,sans-serif;display:grid;place-items:center;height:100vh"><p><a style="color:#c084fc" href="${target}">${target}</a></p></body></html>\n`,
    );
  }
}
console.log(`built ${DOCS.length} legal pages (version ${VERSION})`);
