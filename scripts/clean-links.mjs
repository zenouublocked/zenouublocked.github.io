/**
 * Rewrite page references inside JavaScript (and any inline scripts left in the
 * built HTML) from flat files to clean, root-absolute paths.
 *
 *   'index.html'          ->  '/'
 *   'index.html?c=drift'  ->  '/?c=drift'
 *   `play.html?id=7`      ->  `/play?id=7`
 *   'library.html#stats'  ->  '/library#stats'
 *
 * Only quoted references to one of the site's own pages are touched. Absolute
 * URLs, external hosts and bare words are left alone. Run from the repo root:
 *
 *   node scripts/clean-links.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const PAGES = new Set([
  'index', 'web', 'movies', 'ai', 'social', 'music', 'library',
  'search', 'sources', 'title', 'play', 'mineral',
]);

const LEGAL = new Set([
  'terms', 'privacy', 'acceptable-use', 'copyright', 'takedown',
  'disclaimer', 'liability', 'contact', 'dmca',
]);

/* quote, optional ./, slug, .html, optional ?query and/or #hash */
const REF = /(["'`])(\.\/)?([a-z][a-z0-9_-]*)\.html((?:[?#][^"'`]*)?)/g;

function rewrite(text, file) {
  let changed = 0;
  const out = text.replace(REF, (m, quote, dotSlash, slug, suffix) => {
    if (!PAGES.has(slug)) return m;
    changed += 1;
    if (slug === 'index') return quote + '/' + suffix;
    return quote + '/' + slug + suffix;
  });
  if (changed) report.push(`${path.relative(ROOT, file)}: ${changed}`);
  return out;
}

const report = [];

for (const dir of ['js']) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    if (!name.endsWith('.js')) continue;
    const file = path.join(ROOT, dir, name);
    const before = fs.readFileSync(file, 'utf8');
    const after = rewrite(before, file);
    if (after !== before) fs.writeFileSync(file, after);
  }
}

/* Legal pages: /legal/terms.html style references inside scripts. */
for (const name of ['js/app.js', 'js/library.js', 'js/settings.js', 'js/zenou-plus.js']) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(/(["'`])legal\/([a-z-]+)\.html/g, (m, q, slug) => {
    if (!LEGAL.has(slug)) return m;
    report.push(`${name}: legal/${slug}`);
    return `${q}/legal/${slug}`;
  });
  if (after !== before) fs.writeFileSync(file, after);
}

console.log(report.length ? report.join('\n') : 'nothing to rewrite');
