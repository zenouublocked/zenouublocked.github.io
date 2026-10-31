// Find the game JSON config that lists the playable game URL.
import fs from 'node:fs';
const html = fs.readFileSync('stickman.html', 'utf8');

// json-ld blocks
for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
  console.log('=== JSON-LD ===');
  console.log(m[1].slice(0, 1200));
}

// LOADABLE chunks
const req = html.match(/<script id="__LOADABLE_REQUIRED_CHUNKS__"[^>]*>([\s\S]*?)<\/script>/);
if (req) { console.log('=== CHUNKS ==='); console.log(req[1].slice(0, 600)); }
const req2 = html.match(/<script id="__LOADABLE_REQUIRED_CHUNKS___ext"[^>]*>([\s\S]*?)<\/script>/);
if (req2) { console.log('=== CHUNKS ext ==='); console.log(req2[1].slice(0, 600)); }

// any URL with /games/ on play.poki or c.poki
console.log('=== poki-cdn games urls ===');
for (const m of html.matchAll(/https:\/\/[a-z0-9.-]*poki[\/.-][a-z0-9.-]*\.(?:io|com|dev|net)[^"'\s\\]{0,160}/gi)) {
  console.log(m[0]);
}
