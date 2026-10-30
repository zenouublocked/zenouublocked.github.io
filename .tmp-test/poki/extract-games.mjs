/* Extract Poki's inline game array (slug/title/image hash/developer).
 * The payload is embedded escaped (\", \\u002F). Unescape broadly, then regex. */
import fs from 'node:fs';

let html = fs.readFileSync('stickman.html', 'utf8');

// Global broad unescape of string-embedded JSON fragments
html = html
  .replace(/\\\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\"/g, '"');

const re = /\{[^{}]{0,600}?"slug"\s*:\s*"([^"]+)"[^{}]{0,400}?"imageUrl"\s*:\s*"([^"]+)"[^{}]{0,600}?"title"\s*:\s*"([^"\\]+)"[^{}]{0,200}?\}/g;
const re2 = /\{[^{}]{0,600}?"title"\s*:\s*"([^"\\]+)"[^{}]{0,500}?"imageUrl"\s*:\s*"([^"]+)"[^{}]{0,400}?"slug"\s*:\s*"([^"]+)"[^{}]{0,200}?\}/g;

const seen = new Map();
// run both key orders
let add = (slug, img, title) => {
  if (slug && img && title && !seen.has(slug)) seen.set(slug, { slug, title, img });
};
let m;
while ((m = re.exec(html))) {
  const [, slug, img, title] = m;
  add(slug, img, title);
}
while ((m = re2.exec(html))) {
  const [, title, img, slug] = m;
  add(slug, img, title);
}
console.log('extracted', seen.size, 'games');

console.log([...seen.values()].map(g => `${g.slug} | ${g.title} | ${g.img}`).join('\n'));

fs.writeFileSync('extracted.json', JSON.stringify([...seen.values()], null, 1));
