/**
 * Crawl the built site and check every internal reference.
 *
 *   node scripts/audit.mjs [base]
 *
 * Checks:
 *   · every href / src / action that points at this site answers 200
 *   · no internal reference still ends in .html (the stubs are the exception,
 *     and are checked separately by requesting them)
 *   · every clean URL listed in the sitemap answers 200
 *   · the legal centre cross-links resolve
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:8123').replace(/\/$/, '');
const ROOT = process.cwd();

const PAGES = [
  '/', '/web', '/movies', '/ai', '/social', '/music', '/library',
  '/search', '/sources', '/title', '/play', '/mineral', '/doorway',
  '/legal', '/legal/terms', '/legal/privacy', '/legal/acceptable-use',
  '/legal/copyright', '/legal/takedown', '/legal/disclaimer',
  '/legal/liability', '/legal/contact', '/404.html',
];

const REF = /\b(?:href|src|action)="([^"]+)"/g;

const problems = [];
const seen = new Set();
const checked = new Map();

function internal(ref) {
  if (!ref) return null;
  if (/^(https?:|mailto:|tel:|data:|javascript:|about:|#)/i.test(ref)) return null;
  if (!ref.startsWith('/')) return { relative: ref };
  return ref;
}

async function status(url) {
  if (checked.has(url)) return checked.get(url);
  const res = await fetch(BASE + url, { redirect: 'manual' }).catch(e => ({ status: 0, err: e.message }));
  const code = res.status || 0;
  checked.set(url, code);
  return code;
}

for (const page of PAGES) {
  const res = await fetch(BASE + page);
  if (res.status !== 200) {
    problems.push(`${page} -> HTTP ${res.status}`);
    continue;
  }
  const html = await res.text();

  /* Content checks that a 200 alone would not catch. */
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${page}: no <title>`);
  if (!/<meta name="description"/.test(html)) problems.push(`${page}: no meta description`);
  if (!/rel="canonical"/.test(html) && page !== '/404.html') problems.push(`${page}: no canonical`);
  if (/Zenou Unblocked/.test(html)) problems.push(`${page}: still says "Zenou Unblocked"`);
  if (page !== '/404.html' && !/consent\.js/.test(html)) problems.push(`${page}: no consent script`);

  for (const m of html.matchAll(REF)) {
    const ref = m[1];
    if (seen.has(page + '|' + ref)) continue;
    seen.add(page + '|' + ref);

    if (/\.html($|[?#])/.test(ref) && !ref.startsWith('http')) {
      problems.push(`${page}: still links a .html path -> ${ref}`);
      continue;
    }
    const target = internal(ref);
    if (!target) continue;
    if (target.relative) {
      problems.push(`${page}: relative reference -> ${ref}`);
      continue;
    }
    const url = target.split('#')[0].split('?')[0] || '/';
    const code = await status(url);
    if (code !== 200) problems.push(`${page}: ${url} -> HTTP ${code} (from ${ref})`);
  }
}

/* Sitemap routes must all resolve. */
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
for (const m of sitemap.matchAll(/<loc>https:\/\/zenoumath\.space([^<]*)<\/loc>/g)) {
  const url = m[1] || '/';
  const code = await status(url);
  if (code !== 200) problems.push(`sitemap: ${url} -> HTTP ${code}`);
}

/* Old flat paths must still land somewhere real, not on a 404. */
for (const legacy of ['/web.html', '/movies.html', '/legal/terms.html', '/legal/dmca.html']) {
  const html = await (await fetch(BASE + legacy)).text();
  const ok = /Moved \| ZenouMath/.test(html) || /http-equiv="refresh"/.test(html);
  if (!ok) problems.push(`legacy ${legacy}: no redirect stub`);
}

/* The root 404 handler must still be the site's own page. */
{
  const res = await fetch(BASE + '/definitely-not-a-page');
  const html = await res.text();
  if (res.status !== 404) problems.push(`404 handler returned ${res.status}`);
  if (!/That address is not here/.test(html)) problems.push('404 handler is not the site 404 page');
}

const unique = [...new Set(problems)];
console.log(`checked ${checked.size} URLs across ${PAGES.length} pages`);
if (unique.length) {
  console.log(`\n${unique.length} problem(s):`);
  for (const p of unique) console.log('  · ' + p);
  process.exitCode = 1;
} else {
  console.log('no problems');
}
